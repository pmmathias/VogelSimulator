import * as THREE from 'three';
import { CHASE_DISTANCE, CHASE_HEIGHT, CAMERA_FOV } from '../constants.js';

/**
 * Third-person chase camera centered on bird.
 * Rotation happens purely in camera orientation, not position offset.
 */
export class CameraRig {
  constructor(camera, flightState) {
    this.camera = camera;
    this.state = flightState;
    this._currentPos = new THREE.Vector3();
    this._initialized = false;
  }

  update(dt) {
    const s = this.state;

    // Camera position: directly behind and above the bird
    // No lateral offset — rotation is purely visual (via quaternion)
    const desiredPos = s.position.clone()
      .addScaledVector(s.forward, -CHASE_DISTANCE)
      .add(new THREE.Vector3(0, CHASE_HEIGHT, 0));

    if (!this._initialized) {
      this._currentPos.copy(desiredPos);
      this._initialized = true;
    }

    // Smooth follow
    const followSpeed = 4.0 + Math.max(0, s.speed - 20) * 0.1;
    const t = 1 - Math.exp(-followSpeed * dt);
    this._currentPos.lerp(desiredPos, t);

    // Position camera and look at bird (rotation center = bird = screen center)
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(s.position);

    // Apply roll tilt as pure camera rotation (no position shift)
    const camQuat = this.camera.quaternion.clone();
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), s.roll * 0.5
    );
    this.camera.quaternion.copy(camQuat).multiply(rollQuat);

    // Speed-rush FOV
    const speedRatio = s.speed / 40;
    const targetFov = CAMERA_FOV + Math.max(0, (speedRatio - 1.5)) * 15;
    this.camera.fov += (targetFov - this.camera.fov) * 3.0 * dt;
    this.camera.updateProjectionMatrix();
  }
}
