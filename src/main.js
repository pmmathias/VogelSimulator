import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './core/Renderer.js';
import { createScene } from './core/Scene.js';
import { GameLoop } from './core/GameLoop.js';
import { createDebugPanel } from './ui/DebugPanel.js';
import { generateGrassCanvas } from './utils/generateGrassTexture.js';
import {
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR,
  WORLD_SIZE, GRASS_TEXTURE_REPEAT,
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
camera.position.set(0, 50, 100);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// --- OrbitControls (debug) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// --- Ground plane with procedural grass texture ---
const grassCanvas = generateGrassCanvas(256);
const grassTexture = new THREE.CanvasTexture(grassCanvas);
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(GRASS_TEXTURE_REPEAT, GRASS_TEXTURE_REPEAT);
grassTexture.colorSpace = THREE.SRGBColorSpace;

const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
const groundMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- Debug Panel ---
const { params } = createDebugPanel({
  fogNear: FOG_NEAR,
  fogFar: FOG_FAR,
  onWireframe: (v) => {
    groundMaterial.wireframe = v;
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
  renderer.render(scene, camera);
});
loop.start();
