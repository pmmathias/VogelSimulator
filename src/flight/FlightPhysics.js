import { clamp } from '../utils/math.js';
import {
  GRAVITY, LIFT_IMPULSE, DRAG_COEFFICIENT,
  MAX_SPEED, TERMINAL_VELOCITY, BANK_RATE,
  GLIDE_RATIO,
} from '../constants.js';

/**
 * Integrates flight physics each frame.
 */
export class FlightPhysics {
  /**
   * @param {import('./FlightState.js').FlightState} state
   */
  constructor(state) {
    this.state = state;
    this._liftAccumulator = 0;
  }

  /**
   * Apply a flap impulse (called when user flaps).
   * @param {number} strength - 0..1
   */
  flap(strength) {
    if (strength > 0) {
      this._liftAccumulator += LIFT_IMPULSE * strength;
    }
  }

  /**
   * Apply roll input for banking turns.
   * @param {number} rollInput - -1..1
   * @param {number} dt
   */
  applyRoll(rollInput, dt) {
    const targetRoll = rollInput * 0.8; // max bank angle ~46 degrees
    this.state.roll += (targetRoll - this.state.roll) * 3.0 * dt;

    // Banking causes yaw change (turning)
    this.state.yaw += this.state.roll * BANK_RATE * dt;
  }

  /**
   * Apply pitch input.
   * @param {number} pitchInput - -1..1
   * @param {number} dt
   */
  applyPitch(pitchInput, dt) {
    const targetPitch = pitchInput * 0.6; // max pitch ~34 degrees
    this.state.pitch += (targetPitch - this.state.pitch) * 2.0 * dt;
    this.state.pitch = clamp(this.state.pitch, -1.0, 1.0);
  }

  /**
   * Main physics step.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    const s = this.state;

    // Update orientation vectors
    s.updateVectors();

    // --- Gravity ---
    s.velocity.y += GRAVITY * dt;

    // --- Lift from flapping ---
    if (this._liftAccumulator > 0) {
      s.velocity.y += this._liftAccumulator;
      this._liftAccumulator = 0;
    }

    // --- Glide lift (opposing gravity proportional to speed and forward direction) ---
    const horizontalSpeed = Math.sqrt(s.velocity.x ** 2 + s.velocity.z ** 2);
    const glideLift = (horizontalSpeed / GLIDE_RATIO) * Math.cos(s.pitch);
    s.velocity.y += glideLift * dt;

    // --- Forward motion (bird always moves in its facing direction) ---
    const targetSpeed = clamp(s.speed, 5, MAX_SPEED);
    const forwardVel = s.forward.clone().multiplyScalar(targetSpeed);
    // Blend horizontal velocity toward forward direction
    s.velocity.x += (forwardVel.x - s.velocity.x) * 2.0 * dt;
    s.velocity.z += (forwardVel.z - s.velocity.z) * 2.0 * dt;

    // --- Drag ---
    const speedSq = s.velocity.lengthSq();
    if (speedSq > 0) {
      const dragMag = DRAG_COEFFICIENT * speedSq * dt;
      const dragForce = s.velocity.clone().normalize().multiplyScalar(-dragMag);
      s.velocity.add(dragForce);
    }

    // --- Terminal velocity ---
    s.velocity.y = Math.max(s.velocity.y, TERMINAL_VELOCITY);

    // --- Integrate position ---
    s.position.addScaledVector(s.velocity, dt);

    // Update derived values
    s.speed = s.velocity.length();
    s.altitude = s.position.y;
  }

  /**
   * Enforce terrain collision (minimum altitude).
   * @param {number} terrainHeight - ground height at current position
   */
  enforceGround(terrainHeight) {
    const minAlt = terrainHeight + 1.0; // 1m above ground
    if (this.state.position.y < minAlt) {
      this.state.position.y = minAlt;
      if (this.state.velocity.y < 0) {
        this.state.velocity.y = 0;
      }
      // Reset pitch when on ground
      this.state.pitch *= 0.9;
    }
  }
}
