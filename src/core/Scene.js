import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { FOG_NEAR, FOG_FAR } from '../constants.js';

export function createScene(renderer) {
  const scene = new THREE.Scene();

  // --- Procedural Sky (kept for sun direction + lighting) ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 10;
  skyUniforms.rayleigh.value = 3;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.7;

  // Sun position
  const sunElevation = 20;
  const sunAzimuth = 180;
  const phi = THREE.MathUtils.degToRad(90 - sunElevation);
  const theta = THREE.MathUtils.degToRad(sunAzimuth);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyUniforms.sunPosition.value.copy(sunPosition);

  // Generate env map from procedural sky for reflections
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const skyScene = new THREE.Scene();
  skyScene.add(sky.clone());
  const skyEnvMap = pmremGenerator.fromScene(skyScene, 0, 0.1, 1000).texture;
  scene.environment = skyEnvMap;

  // Load HDR sky map for background (richer sky with real clouds)
  new RGBELoader().load('textures/sky.hdr', (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    const hdrEnvMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
    scene.background = hdrEnvMap;
    scene.environment = hdrEnvMap; // also use for reflections
    hdrTexture.dispose();
    pmremGenerator.dispose();
  }, undefined, () => {
    // Fallback: use procedural sky if HDR fails to load
    scene.background = skyEnvMap;
    pmremGenerator.dispose();
  });

  // Temporarily set procedural sky as background until HDR loads
  scene.background = skyEnvMap;

  // Higher exposure for brighter, more dramatic sky + sun blending
  renderer.toneMappingExposure = 1.3;

  // Fog with warm horizon tint
  const fogColor = new THREE.Color(0xb0d0e8);
  scene.fog = new THREE.Fog(fogColor, FOG_NEAR, FOG_FAR);

  // Ambient light — slightly brighter for HDR sky
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Directional light (sun) — brighter for sun glare feel
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.copy(sunPosition).multiplyScalar(500);
  scene.add(sun);

  // Store sun position for lens flare
  scene.userData.sunPosition = sunPosition.clone().multiplyScalar(500);

  return scene;
}
