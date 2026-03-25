import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRenderer } from './core/Renderer.js';
import { createScene } from './core/Scene.js';
import { GameLoop } from './core/GameLoop.js';
import { InputManager } from './core/InputManager.js';
import { createDebugPanel } from './ui/DebugPanel.js';
import { HUD } from './ui/HUD.js';
import { WebcamOverlay } from './ui/WebcamOverlay.js';
import { buildWorld } from './world/WorldBuilder.js';
import { getTerrainHeight } from './world/Terrain.js';
import { FlightState } from './flight/FlightState.js';
import { FlightPhysics } from './flight/FlightPhysics.js';
import { CameraRig } from './flight/CameraRig.js';
import { WebcamManager } from './pose/WebcamManager.js';
import { PoseDetector } from './pose/PoseDetector.js';
import { ArmAnalyzer } from './pose/ArmAnalyzer.js';
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

// --- OrbitControls (debug mode) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 20, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// --- Build the world ---
const world = buildWorld(scene);

// --- Flight system ---
const flightState = new FlightState();
const flightPhysics = new FlightPhysics(flightState);
const cameraRig = new CameraRig(camera, flightState);
const input = new InputManager();
const hud = new HUD();

// --- Pose detection ---
const webcamManager = new WebcamManager();
const poseDetector = new PoseDetector();
const armAnalyzer = new ArmAnalyzer();
let webcamOverlay = null;
let poseActive = false;

// --- Flight mode toggle ---
let flightMode = false;

async function initWebcam() {
  const video = await webcamManager.init();
  if (!video) {
    console.warn('Webcam not available, using keyboard only.');
    return;
  }

  await poseDetector.init();
  if (!poseDetector.ready) {
    console.warn('Pose detection not available, using keyboard only.');
    return;
  }

  webcamOverlay = new WebcamOverlay(video);
  webcamOverlay.hide();
  poseActive = true;

  // Auto-calibrate after a short delay
  setTimeout(() => {
    const landmarks = poseDetector.detect(webcamManager.video);
    if (landmarks) {
      armAnalyzer.calibrate(landmarks);
      console.log('Pose calibrated! Raise and lower arms to fly.');
    }
  }, 2000);
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    flightMode = !flightMode;
    controls.enabled = !flightMode;
    hud.el.style.display = flightMode ? 'block' : 'none';
    hud.flapIndicator.style.display = flightMode ? 'flex' : 'none';

    if (flightMode && webcamOverlay) {
      webcamOverlay.show();
    } else if (webcamOverlay) {
      webcamOverlay.hide();
    }

    hud.hint.innerHTML = flightMode
      ? 'SPACE = Flap &nbsp;|&nbsp; A/D = Turn &nbsp;|&nbsp; W/S = Pitch &nbsp;|&nbsp; F = Debug Camera &nbsp;|&nbsp; C = Recalibrate'
      : 'F = Enter Flight Mode &nbsp;|&nbsp; Mouse = Orbit Camera';
  }

  // Recalibrate pose
  if (e.code === 'KeyC' && flightMode && poseActive) {
    const landmarks = poseDetector.detect(webcamManager.video);
    if (landmarks) {
      armAnalyzer.calibrate(landmarks);
      console.log('Recalibrated!');
    }
  }
});

// Start in debug mode
hud.el.style.display = 'none';
hud.flapIndicator.style.display = 'none';

// --- Debug Panel ---
createDebugPanel({
  fogNear: FOG_NEAR,
  fogFar: FOG_FAR,
  onWireframe: (v) => {
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => { m.wireframe = v; });
        } else {
          obj.material.wireframe = v;
        }
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
  world.update(dt, camera);

  if (flightMode) {
    // Pose detection
    if (poseActive && webcamManager.ready) {
      const landmarks = poseDetector.detect(webcamManager.video);
      const poseData = armAnalyzer.analyze(landmarks);
      input.setPoseInput(poseData);

      if (webcamOverlay) {
        webcamOverlay.drawSkeleton(landmarks);
      }
    }

    // Update input
    input.update(dt);

    // Apply controls to physics
    flightPhysics.flap(input.lift);
    flightPhysics.applyRoll(input.roll, dt);
    flightPhysics.applyPitch(input.pitch, dt);
    flightPhysics.update(dt);

    // Terrain collision
    const groundY = getTerrainHeight(
      flightState.position.x,
      flightState.position.z,
      world.arcs,
    );
    flightPhysics.enforceGround(groundY);

    // Camera follow
    cameraRig.update(dt);

    // HUD
    hud.update(flightState, input.lift > 0);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
loop.start();

// Init webcam in background (non-blocking)
initWebcam();
