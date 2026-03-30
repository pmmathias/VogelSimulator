import { clamp } from '../utils/math.js';
import {
  GRAVITY, WING_AREA, AIR_DENSITY, BIRD_MASS,
  WING_INCIDENCE, CL_MAX, CL_SLOPE,
  CD_PARASITIC, CD_INDUCED_K,
  FLAP_THRUST, FLAP_DURATION, FLAP_COOLDOWN, FLAP_LIFT_BONUS,
  MAX_SPEED, TERMINAL_VELOCITY, MIN_FLIGHT_SPEED,
  BANK_RATE, PITCH_RATE, ROLL_RATE, MAX_ROLL, MAX_PITCH,
} from '../constants.js';

/**
 * Aerodynamic flight physics for a soaring bird.
 * All forces derive from airspeed, angle of attack, and wing area.
 */
export class FlightPhysics {
  /**
   * @param {import('./FlightState.js').FlightState} state
   */
  constructor(state) {
    this.state = state;
  }

  /**
   * Initiate a flap (timed downstroke, not an impulse).
   * @param {number} strength - 0..1
   */
  flap(strength) {
    if (strength > 0 && this.state.flapCooldown <= 0) {
      this.state.flapPhase = FLAP_DURATION; // always full duration
      this.state.flapStrengthScale = strength; // scale thrust by strength
      this.state.flapCooldown = FLAP_COOLDOWN;
    }
  }

  /**
   * Apply roll input for banking turns.
   * @param {number} rollInput - -1..1
   * @param {number} dt
   */
  applyRoll(rollInput, dt) {
    const targetRoll = rollInput * MAX_ROLL;
    this.state.roll += (targetRoll - this.state.roll) * ROLL_RATE * dt;
    this.state.yaw += this.state.roll * BANK_RATE * dt;
  }

  /**
   * Apply pitch input.
   * @param {number} pitchInput - -1..1
   * @param {number} dt
   */
  applyPitch(pitchInput, dt) {
    const targetPitch = pitchInput * MAX_PITCH;
    this.state.pitch += (targetPitch - this.state.pitch) * PITCH_RATE * dt;
    this.state.pitch = clamp(this.state.pitch, -MAX_PITCH - 0.1, MAX_PITCH + 0.1);
  }

  /**
   * Compute angle of attack: angle between velocity and forward vector.
   * Positive AoA = nose above flight path (generating lift).
   * @returns {number} radians
   */
  _computeAoA() {
    const s = this.state;
    const speed = s.velocity.length();
    if (speed < 0.5) return 0;

    const velDir = s.velocity.clone().normalize();
    const dot = clamp(velDir.dot(s.forward), -1, 1);
    const rawAoA = Math.acos(dot);

    // Sign: positive when pitched up relative to velocity
    const sign = velDir.dot(s.up) < 0 ? 1 : -1;
    return sign * rawAoA;
  }

  /**
   * Compute lift coefficient from AoA. Simple linear model clamped to CL_MAX.
   * No stall — keeps flight predictable and fun.
   * @param {number} aoa - angle of attack in radians
   * @returns {number} lift coefficient
   */
  _computeCL(aoa) {
    const sign = Math.sign(aoa) || 1;
    return sign * Math.min(CL_SLOPE * Math.abs(aoa), CL_MAX);
  }

  /**
   * Main physics step — aerodynamic force model.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    const s = this.state;
    s.updateVectors();

    const speed = s.velocity.length();
    const dynamicPressure = 0.5 * AIR_DENSITY * speed * speed;

    // Effective wing area based on wing spread (arms up = full, arms down = tucked)
    const effectiveWingArea = WING_AREA * s.wingSpread;

    // --- 1. Angle of Attack ---
    s.angleOfAttack = this._computeAoA();

    // --- 2. Lift coefficient (with flap bonus) ---
    let CL = this._computeCL(s.angleOfAttack);
    if (s.flapPhase > 0) {
      CL += FLAP_LIFT_BONUS;
    }
    s.liftCoefficient = CL;
    s.isStalling = false;

    // --- 3. Lift force ---
    // Direction: bird's up vector projected perpendicular to velocity
    // When banked, up tilts sideways → vertical lift component decreases
    // When wings tucked (wingSpread→0), no lift → free fall
    const liftMag = dynamicPressure * effectiveWingArea * Math.abs(CL) / BIRD_MASS;

    if (speed > 1) {
      const velNorm = s.velocity.clone().normalize();
      const liftDir = s.up.clone();
      // Remove velocity-parallel component so lift is perpendicular to flight path
      liftDir.addScaledVector(velNorm, -liftDir.dot(velNorm));
      const liftDirLen = liftDir.length();
      if (liftDirLen > 0.01) {
        liftDir.divideScalar(liftDirLen);
        s.velocity.addScaledVector(liftDir, liftMag * Math.sign(CL) * dt);
      }
    }

    // --- 4. Baseline lift from wing incidence ---
    // Wing is mounted at slight angle → always some upward lift proportional to speed²
    // This acts in world-up direction (not tilted by roll/AoA) to prevent stall death spiral
    const baselineCL = CL_SLOPE * WING_INCIDENCE;
    const baselineLift = dynamicPressure * effectiveWingArea * baselineCL / BIRD_MASS;
    s.velocity.y += baselineLift * dt;

    // --- 5. Drag: parasitic + induced ---
    // Body always has some drag even with tucked wings (min 15% wing area for drag)
    const dragArea = Math.max(effectiveWingArea, WING_AREA * 0.15);
    const CD = CD_PARASITIC + CD_INDUCED_K * CL * CL;
    const dragMag = dynamicPressure * dragArea * CD / BIRD_MASS;
    if (speed > 0.1) {
      const dragDir = s.velocity.clone().normalize().negate();
      s.velocity.addScaledVector(dragDir, dragMag * dt);
    }

    // --- 6. Gravity ---
    s.velocity.y += GRAVITY * dt;

    // --- 7. Flap thrust (timed downstroke) ---
    if (s.flapPhase > 0) {
      const thrustAccel = FLAP_THRUST * (s.flapStrengthScale || 1) / BIRD_MASS;
      const thrustDir = s.forward.clone();
      thrustDir.y += 1.2; // strong upward component (~70% vertical)
      thrustDir.normalize();
      s.velocity.addScaledVector(thrustDir, thrustAccel * dt);
      s.flapPhase -= dt;
    }
    if (s.flapCooldown > 0) {
      s.flapCooldown -= dt;
    }

    // --- 8. Auto-trim pitch toward velocity (prevent AoA divergence) ---
    // Only pitch, NOT yaw — yaw is player-controlled via banking
    if (speed > 2) {
      const velDir = s.velocity.clone().normalize();
      const targetPitch = Math.asin(clamp(velDir.y, -0.8, 0.8));
      s.pitch += (targetPitch - s.pitch) * 2.0 * dt;
    }

    // --- 9. Wing tuck → nosedive ---
    // When wings are tucked (arms down), bird actively dives
    if (s.wingSpread < 0.5) {
      const tuckForce = (1 - s.wingSpread / 0.5); // 0→1 as wings tuck

      // Aggressive pitch down — nearly vertical possible
      s.pitch -= tuckForce * 8.0 * dt;
      s.pitch = clamp(s.pitch, -Math.PI * 0.45, MAX_PITCH); // allow ~81° dive

      // Active dive acceleration (bird tucks and pushes down, not just falling)
      s.velocity.y += GRAVITY * 0.5 * tuckForce * dt; // 50% extra gravity when fully tucked
    }

    // --- 10. Safety clamps ---
    s.velocity.y = Math.max(s.velocity.y, TERMINAL_VELOCITY);
    if (s.velocity.length() > MAX_SPEED) {
      s.velocity.normalize().multiplyScalar(MAX_SPEED);
    }

    // --- 11. Integrate position ---
    s.position.addScaledVector(s.velocity, dt);
    s.speed = s.velocity.length();
    s.altitude = s.position.y;
  }

  /**
   * Enforce terrain collision (minimum altitude).
   * @param {number} terrainHeight - ground height at current position
   */
  enforceGround(terrainHeight) {
    const minAlt = terrainHeight + 1.0;
    if (this.state.position.y < minAlt) {
      this.state.position.y = minAlt;
      if (this.state.velocity.y < 0) {
        this.state.velocity.y = 0;
      }
      this.state.pitch *= 0.9;
      // Ensure minimum forward speed so the bird can recover
      if (this.state.speed < MIN_FLIGHT_SPEED) {
        this.state.velocity.addScaledVector(this.state.forward, MIN_FLIGHT_SPEED);
      }
    }
  }
}
