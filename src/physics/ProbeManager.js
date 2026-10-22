import * as THREE from 'three';

export class ProbeManager {
  constructor(scene) {
    this.scene = scene;
    this.probes = [];

    // Probe physical geometry and material
    this.probeGeo = new THREE.SphereGeometry(0.3, 16, 16);
    this.probeMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8
    });

    // Physical constants
    this.gravity = -9.81;
    this.dragCoeff = 0.45; // Sphere drag coefficient
    this.airDensity = 1.225; // kg/m^3
    this.radius = 0.3;
    this.area = Math.PI * Math.pow(this.radius, 2);
    this.restitution = 0.55; // Ground bounce dampening
    this.friction = 0.85; // Ground sliding friction
  }

  // Eject a new probe from the drone with inherited + thrust velocity
  ejectProbe(dronePosition, droneVelocity, droneRotation, impulseSpeed = 15) {
    const mesh = new THREE.Mesh(this.probeGeo, this.probeMat);
    mesh.castShadow = true;
    mesh.position.copy(dronePosition);
    this.scene.add(mesh);

    // Calculate forward/downward ejection vector relative to drone heading
    const forwardImpulse = new THREE.Vector3(0, -0.2, 1)
      .applyEuler(droneRotation)
      .normalize()
      .multiplyScalar(impulseSpeed);

    // Initial total velocity = Drone current velocity + Ejection force
    const initialVelocity = droneVelocity.clone().add(forwardImpulse);

    this.probes.push({
      mesh: mesh,
      position: dronePosition.clone(),
      velocity: initialVelocity,
      mass: 0.5, // 500g sensor sphere
      isGrounded: false
    });
  }

  // Physics integration loop for all active probes
  update(delta) {
    for (let i = this.probes.length - 1; i >= 0; i--) {
      const p = this.probes[i];

      if (!p.isGrounded) {
        // 1. Gravity Force
        const fGravity = new THREE.Vector3(0, p.mass * this.gravity, 0);

        // 2. Aerodynamic Quadratic Drag Force
        const speed = p.velocity.length();
        let fDrag = new THREE.Vector3(0, 0, 0);
        if (speed > 0.001) {
          const dragMagnitude = 0.5 * this.airDensity * Math.pow(speed, 2) * this.dragCoeff * this.area;
          fDrag = p.velocity.clone().normalize().negate().multiplyScalar(dragMagnitude);
        }

        // 3. Sum Acceleration (a = F / m)
        const totalForce = fGravity.add(fDrag);
        const acceleration = totalForce.divideScalar(p.mass);

        // 4. Euler Integration
        p.velocity.add(acceleration.clone().multiplyScalar(delta));
        p.position.add(p.velocity.clone().multiplyScalar(delta));

        // 5. Ground Collision Detection & Response
        if (p.position.y <= this.radius) {
          p.position.y = this.radius;

          // Bounce vertical velocity component
          if (Math.abs(p.velocity.y) > 0.5) {
            p.velocity.y = -p.velocity.y * this.restitution;
          } else {
            p.velocity.y = 0;
            p.isGrounded = true;
          }

          // Apply ground surface friction to X/Z movement
          p.velocity.x *= this.friction;
          p.velocity.z *= this.friction;
        }

        p.mesh.position.copy(p.position);
      } else {
        // Friction dampening while resting on ground
        p.velocity.x *= 0.9;
        p.velocity.z *= 0.9;
        p.position.add(p.velocity.clone().multiplyScalar(delta));
        p.mesh.position.copy(p.position);
      }
    }
  }
}