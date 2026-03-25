import * as THREE from 'three';
import { FOG_NEAR, FOG_FAR } from '../constants.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // light sky blue
  scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR, FOG_FAR);

  // Ambient light for soft overall illumination
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Directional light (sun)
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(200, 300, 100);
  scene.add(sun);

  return scene;
}
