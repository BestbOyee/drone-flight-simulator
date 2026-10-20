import * as THREE from 'three';

export class DronePhysics {
  constructor(droneProfile) {
    this.profile = droneProfile;
    this.mass = droneProfile.mass;
    this.maxThrust = droneProfile.maxThrust;
    this.dragCoeff = droneProfile.dragCoeff;
    this.agility = droneProfile.agility;

    this.position = new THREE.Vector3(0, 2, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.angularVelocity = new THREE.Vector3(0, 0, 0);

    this.controls = {
      throttle: 0,
      pitch: 0,
      roll: 0,
      yaw: 0
    };
  }

  update(delta) {
    const gravity = new THREE.Vector3(0, -9.81 * this.mass, 0);
    const liftMagnitude = (this.controls.throttle + 1) * 0.5 * this.maxThrust; 
    
    const localThrust = new THREE.Vector3(0, liftMagnitude, 0);
    localThrust.applyEuler(this.rotation);

    const dragForce = this.velocity.clone().multiplyScalar(-this.dragCoeff);

    const netForce = new THREE.Vector3()
      .add(gravity)
      .add(localThrust)
      .add(dragForce);

    const acceleration = netForce.divideScalar(this.mass);

    this.velocity.addScaledVector(acceleration, delta);
    this.position.addScaledVector(this.velocity, delta);

    if (this.position.y < 0) {
      this.position.y = 0;
      this.velocity.set(0, 0, 0);
    }

    this.rotation.x = THREE.MathUtils.lerp(this.rotation.x, this.controls.pitch * 0.5 * this.agility, delta * 5);
    this.rotation.z = THREE.MathUtils.lerp(this.rotation.z, -this.controls.roll * 0.5 * this.agility, delta * 5);
    this.rotation.y -= this.controls.yaw * 1.5 * delta * this.agility;
  }
}