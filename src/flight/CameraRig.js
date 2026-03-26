import * as THREE from 'three';
import { lerp } from '../utils/math.js';
import { CHASE_DISTANCE, CHASE_HEIGHT } from '../constants.js';

/**
 * Third-person chase camera that smoothly follows the bird.
 */
export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('./FlightState.js').FlightState} flightState
   */
  constructor(camera, flightState) {
    this.camera = camera;
    this.state = flightState;
    this._currentPos = new THREE.Vector3();
    this._currentLookAt = new THREE.Vector3();
    this._initialized = false;
  }

  update(dt) {
    const s = this.state;

    // Desired camera position: behind and above the bird
    const behindOffset = s.forward.clone().multiplyScalar(-CHASE_DISTANCE);
    const upOffset = new THREE.Vector3(0, CHASE_HEIGHT, 0);

    // Add some roll effect to camera (slight lateral offset when banking)
    const rollOffset = s.right.clone().multiplyScalar(-s.roll * 3);

    const desiredPos = s.position.clone()
      .add(behindOffset)
      .add(upOffset)
      .add(rollOffset);

    // Look-ahead point (slightly in front of the bird)
    const lookAhead = s.position.clone()
      .add(s.forward.clone().multiplyScalar(10));

    if (!this._initialized) {
      this._currentPos.copy(desiredPos);
      this._currentLookAt.copy(lookAhead);
      this._initialized = true;
    }

    // Smooth follow
    const followSpeed = 4.0;
    const t = 1 - Math.exp(-followSpeed * dt);

    this._currentPos.lerp(desiredPos, t);
    this._currentLookAt.lerp(lookAhead, t);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLookAt);

    // Apply roll and pitch tilt to camera for immersive feel
    const camQuat = this.camera.quaternion.clone();
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), s.roll * 0.4
    );
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), s.pitch * 0.15
    );
    this.camera.quaternion.copy(camQuat).multiply(rollQuat).multiply(pitchQuat);
  }
}
