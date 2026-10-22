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

    // Smooth control inertia
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, delta * 3.5);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, delta * 3.5);
    this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, targetYaw, delta * 3.5);

    // Gravity & Lift
    const gravityMultiplier = this.throttle < 0.2 ? 1.6 : 1.0;
    const gravity = new THREE.Vector3(0, -9.81 * this.mass * gravityMultiplier, 0);
    
    const liftMagnitude = this.throttle * this.maxThrust * 1.5; 
    const localThrust = new THREE.Vector3(0, liftMagnitude, 0);
    localThrust.applyEuler(this.rotation);

    // Quadratic drag & wind gusts
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
      .add(localThrust)
      .add(dragForce)
      .add(windForce);

    const acceleration = netForce.divideScalar(this.mass);

    this.velocity.addScaledVector(acceleration, delta);
    this.position.addScaledVector(this.velocity, delta);

    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.set(0, 0, 0);
    }

    // CORRECTED ROTATIONS: Fixed signs so left/right inputs match natural movement
    // Rotations with corrected Yaw orientation for A and D keys
    this.rotation.x = THREE.MathUtils.lerp(this.rotation.x, this.currentPitch * 0.5 * this.agility, delta * 5);
    this.rotation.z = THREE.MathUtils.lerp(this.rotation.z, this.currentRoll * 0.5 * this.agility, delta * 5);
    this.rotation.y -= this.currentYaw * 1.5 * delta * this.agility; // Changed back to -= so A/D turn the correct way
  }
}