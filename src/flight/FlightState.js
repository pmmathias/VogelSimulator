import * as THREE from 'three';

/**
 * Holds the bird's flight state: position, velocity, orientation.
 */
export class FlightState {
  constructor() {
    this.position = new THREE.Vector3(0, 60, 0);
    this.velocity = new THREE.Vector3(0, 0, -10); // initial forward speed
    this.forward = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.right = new THREE.Vector3(1, 0, 0);

    // Euler angles (radians)
    this.yaw = Math.PI;    // facing -Z
    this.pitch = 0;
    this.roll = 0;

    // Derived values
    this.speed = 10;
    this.altitude = 60;
  }

  /** Update derived vectors from euler angles */
  updateVectors() {
    // Forward vector from yaw and pitch
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();

    // Right vector (perpendicular, in XZ plane considering roll)
    this.right.set(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    ).normalize();

    // Up vector
    this.up.crossVectors(this.right, this.forward).normalize();

    this.speed = this.velocity.length();
    this.altitude = this.position.y;
  }
}
