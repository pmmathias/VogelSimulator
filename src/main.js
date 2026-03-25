import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './core/Renderer.js';
import { createScene } from './core/Scene.js';
import { GameLoop } from './core/GameLoop.js';
import { createDebugPanel } from './ui/DebugPanel.js';
import { buildWorld } from './world/WorldBuilder.js';
import {
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
  FOG_NEAR, FOG_FAR,
} from './constants.js';

// --- Renderer & Scene ---
const renderer = createRenderer();
const scene = createScene();

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  CAMERA_NEAR,
  CAMERA_FAR,
);
camera.position.set(0, 80, 150);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- OrbitControls (debug) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 20, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// --- Build the world ---
const world = buildWorld(scene);

// --- Debug Panel ---
const { params } = createDebugPanel({
  fogNear: FOG_NEAR,
  fogFar: FOG_FAR,
  onWireframe: (v) => {
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.wireframe = v;
      }
    });
  },
  onFogChange: (near, far) => {
    scene.fog.near = near;
    scene.fog.far = far;
  },
});

// --- Game Loop ---
const loop = new GameLoop();
loop.onUpdate((dt) => {
  controls.update();
  world.update(dt, camera);
  renderer.render(scene, camera);
});
loop.start();
