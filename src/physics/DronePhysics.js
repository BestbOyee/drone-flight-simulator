import * as THREE from 'three';

export class DronePhysics {
  constructor(droneProfile) {
    this.setDroneProfile(droneProfile);

    this.position = new THREE.Vector3(0, 2, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.angularVelocity = new THREE.Vector3(0, 0, 0);

    this.throttle = 0.5;

    this.currentPitch = 0;
    this.currentRoll = 0;
    this.currentYaw = 0;

    this.gravityScale = 1.0;
    this.getGroundHeight = () => 0;

    // How strong tilt-driven forward/strafe thrust is, independent of
    // throttle entirely. This is THE knob for "move forward faster" —
    // raise it for snappier/faster horizontal flight, lower it for
    // more gradual acceleration.
    this.cruiseThrustFactor = 3.0;

    // Per-axis control feel tuning
    this.controlRates = {
      pitchInput: 3.5,
      rollInput: 4.5,
      yawInput: 2.5,
      pitchRotation: 5.0,
      rollRotation: 6.0,
    };

    // Collision tuning
    this.groundFriction = 0.92;
    this.normalSampleDist = 0.5;
    this.arenaRadius = 390; // overridden per-map in App.jsx
    this.propColliders = [];
  }

  setDroneProfile(profile) {
    this.profile = profile;
    this.mass = profile.mass;
    this.maxThrust = profile.maxThrust;
    this.dragCoeff = profile.dragCoeff;
    this.agility = profile.agility;
  }

  update(delta, keys) {
    // Smooth continuous throttle ramping
    if (keys['KeyW']) {
      this.throttle = Math.min(1.0, this.throttle + delta * 0.7);
    }
    if (keys['KeyS']) {
      this.throttle = Math.max(0.0, this.throttle - delta * 1.5);
    }

    // Target inputs from keyboard
    const targetPitch = (keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0);
    const targetRoll = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0);
    const targetYaw = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

    // Smooth control inertia (per-axis rates)
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, delta * this.controlRates.pitchInput);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, delta * this.controlRates.rollInput);
    this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, targetYaw, delta * this.controlRates.yawInput);

    // --- Gravity ---
    const gravityMultiplier = this.throttle < 0.2 ? 1.6 : 1.0;
    const gravity = new THREE.Vector3(0, -9.81 * this.mass * gravityMultiplier * this.gravityScale, 0);

    // --- Vertical lift: ALWAYS straight up in world space, scaled only by
    // throttle. Completely immune to pitch/roll now, so tilting the drone
    // never costs (or gains) altitude. ---
    const liftMagnitude = this.throttle * this.maxThrust * 1.5;
    const liftForce = new THREE.Vector3(0, liftMagnitude, 0);

    // --- Horizontal cruise thrust: a SEPARATE force, independent of
    // throttle entirely. Derived by tilting a constant-magnitude vector
    // through the drone's full rotation (same geometry as before) and
    // discarding the vertical component — so only the forward/strafe
    // push survives. This is what makes Up/Down/Left/Right arrows move
    // you immediately without touching W, and cruiseThrustFactor controls
    // how fast that movement is. ---
    const cruiseMagnitude = this.maxThrust * this.cruiseThrustFactor;
    const cruiseVector = new THREE.Vector3(0, cruiseMagnitude, 0).applyEuler(this.rotation);
    cruiseVector.y = 0; // vertical handled entirely by liftForce above
    const horizontalThrustForce = cruiseVector;

    // --- Drag & wind ---
    const speed = this.velocity.length();
    const dragForce = this.velocity.clone().multiplyScalar(-this.dragCoeff * speed);

    const time = Date.now() * 0.001;
    const windForce = new THREE.Vector3(
      Math.sin(time * 1.2) * 1.8 + Math.cos(time * 0.6) * 1.2,
      Math.sin(time * 0.4) * 0.6,
      Math.cos(time * 1.0) * 1.8 + Math.sin(time * 0.8) * 1.0
    );

    const netForce = new THREE.Vector3()
      .add(gravity)
      .add(liftForce)
      .add(horizontalThrustForce)
      .add(dragForce)
      .add(windForce);

    const acceleration = netForce.divideScalar(this.mass);

    this.velocity.addScaledVector(acceleration, delta);
    this.position.addScaledVector(this.velocity, delta);

    // Soft collision response (slide along slopes/walls instead of hard stop)
        // --- Terrain Collision (floor + steep walls) ---
        const groundY = this.getGroundHeight(this.position.x, this.position.z);
        if (this.position.y < groundY) {
          const d = this.normalSampleDist;
          const hL = this.getGroundHeight(this.position.x - d, this.position.z);
          const hR = this.getGroundHeight(this.position.x + d, this.position.z);
          const hD = this.getGroundHeight(this.position.x, this.position.z - d);
          const hU = this.getGroundHeight(this.position.x, this.position.z + d);
    
          const normal = new THREE.Vector3(
            (hL - hR) / (2 * d),
            1,
            (hD - hU) / (2 * d)
          ).normalize();
    
          this.position.y = groundY;
    
          const velAlongNormal = this.velocity.dot(normal);
          if (velAlongNormal < 0) {
            const normalComponent = normal.clone().multiplyScalar(velAlongNormal);
            this.velocity.sub(normalComponent);
            this.velocity.multiplyScalar(this.groundFriction);
          }
        }
    
        // --- Arena Boundary (invisible edge wall) ---   <-- PASTE HERE
        const distFromCenter = Math.hypot(this.position.x, this.position.z);
        if (distFromCenter > this.arenaRadius) {
          const inwardNormal = new THREE.Vector3(-this.position.x, 0, -this.position.z).normalize();
          const penetration = distFromCenter - this.arenaRadius;
          this.position.addScaledVector(inwardNormal, penetration);
    
          const velAlongNormal = this.velocity.dot(inwardNormal);
          if (velAlongNormal < 0) {
            this.velocity.sub(inwardNormal.clone().multiplyScalar(velAlongNormal));
            this.velocity.multiplyScalar(this.groundFriction);
          }
        }
            // --- Prop Collision (rocks, spires, buildings, landmarks) ---
    const droneRadius = 1.0;
    for (let i = 0; i < this.propColliders.length; i++) {
      const c = this.propColliders[i];
      const dx = this.position.x - c.x;
      const dy = this.position.y - c.y;
      const dz = this.position.z - c.z;
      const minDist = c.radius + droneRadius;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const pushNormal = new THREE.Vector3(dx, dy, dz).divideScalar(dist);
        const penetration = minDist - dist;
        this.position.addScaledVector(pushNormal, penetration);

        const velAlongNormal = this.velocity.dot(pushNormal);
        if (velAlongNormal < 0) {
          this.velocity.sub(pushNormal.clone().multiplyScalar(velAlongNormal));
          this.velocity.multiplyScalar(this.groundFriction);
        }
      }
    }
        this.rotation.x = THREE.MathUtils.lerp(this.rotation.x, this.currentPitch * 0.5 * this.agility, delta * this.controlRates.pitchRotation);
        this.rotation.z = THREE.MathUtils.lerp(this.rotation.z, this.currentRoll * 0.5 * this.agility, delta * this.controlRates.rollRotation);
        this.rotation.y -= this.currentYaw * 1.5 * delta * this.agility;
  }
}