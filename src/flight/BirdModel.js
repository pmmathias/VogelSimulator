import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FLIGHT_MODE } from '../constants.js';

/**
 * 3D Stork model (GLB) with morph-target flight animation.
 * Positioned at bird location with lazy follow for smooth tracking.
 */
export class BirdModel {
  constructor(scene) {
    this._scene = scene;
    this._model = null;
    this._mixer = null;
    this._action = null;
    this._loaded = false;

    // Smooth tracking
    this._smoothPos = new THREE.Vector3();
    this._smoothQuat = new THREE.Quaternion();
    this._initialized = false;

    this._load();
  }

  _load() {
    const loader = new GLTFLoader();
    loader.load('models/Stork.glb', (gltf) => {
      this._model = gltf.scene;
      this._model.name = 'bird-stork';

      // Scale up for visibility from chase camera
      this._model.scale.setScalar(0.04); // Stork model is large, scale to world units

      // Fix materials for mobile compatibility (no env map needed)
      this._model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (child.material) {
            // Keep original material but disable env-map dependency
            child.material.envMap = null;
            if (child.material.metalness !== undefined) child.material.metalness = 0;
            if (child.material.roughness !== undefined) child.material.roughness = 0.8;
            child.material.needsUpdate = true;
          }
        }
      });

      this._scene.add(this._model);

      // Setup animation
      if (gltf.animations && gltf.animations.length > 0) {
        this._mixer = new THREE.AnimationMixer(this._model);
        this._action = this._mixer.clipAction(gltf.animations[0]);
        this._action.play();
      }

      this._loaded = true;
      console.log('Stork model loaded');
    }, undefined, (err) => {
      console.warn('Failed to load Stork model:', err);
    });
  }

  /**
   * Update bird position, rotation, and animation.
   */
  update(state, dt, camera) {
    if (!this._loaded || !this._model) return;

    // Target position: bird's actual position
    const targetPos = state.position.clone();

    if (!this._initialized) {
      this._smoothPos.copy(targetPos);
      this._initialized = true;
    }

    // Lazy follow — smooth position interpolation
    const followRate = 1 - Math.exp(-5.0 * dt);
    this._smoothPos.lerp(targetPos, followRate);
    this._model.position.copy(this._smoothPos);

    // Smooth orientation via quaternion slerp
    const lookTarget = this._smoothPos.clone().add(state.forward);
    const tempObj = new THREE.Object3D();
    tempObj.position.copy(this._smoothPos);
    tempObj.lookAt(lookTarget);
    tempObj.rotateZ(-state.roll);

    this._smoothQuat.slerp(tempObj.quaternion, followRate);
    this._model.quaternion.copy(this._smoothQuat);

    // Animation control
    if (this._mixer && this._action) {
      const mode = state.mode;
      const isFlapping = state.flapPhase > 0;

      if (mode === FLIGHT_MODE.GROUNDED) {
        // Grounded: very slow animation (wings folded idle) + walking bob
        this._action.paused = false;
        this._action.timeScale = 0.05; // near-still wings
        // Walking bob: gentle up-down oscillation
        if (state.speed > 0.5) {
          this._model.position.y += Math.sin(performance.now() * 0.008) * 0.03;
        }
      } else if (mode === FLIGHT_MODE.TAKEOFF) {
        // Takeoff: fast powerful flap
        this._action.paused = false;
        this._action.timeScale = 2.5;
      } else if (mode === FLIGHT_MODE.LANDING) {
        // Landing: wings spread, slowing down
        this._action.paused = false;
        this._action.timeScale = 0.3;
      } else if (isFlapping) {
        // Flapping: play animation at normal/fast speed
        this._action.paused = false;
        this._action.timeScale = 1.5;
      } else if (state.wingSpread > 0.7) {
        // Gliding: slow animation (wings spread, gentle movement)
        this._action.paused = false;
        this._action.timeScale = 0.15;
      } else if (state.wingSpread < 0.3) {
        // Diving: fast animation reversed (wings tucking)
        this._action.paused = false;
        this._action.timeScale = 0.3;
      } else {
        // Transition: moderate speed
        this._action.paused = false;
        this._action.timeScale = 0.4;
      }

      this._mixer.update(dt);
    }
  }
}
