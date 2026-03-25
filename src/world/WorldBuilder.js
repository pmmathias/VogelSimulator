import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { createForest } from './ForestPlacer.js';
import { Octree } from '../spatial/Octree.js';
import { FrustumCuller } from '../spatial/FrustumCuller.js';
import { generateGrassCanvas } from '../utils/generateGrassTexture.js';
import { GRASS_TEXTURE_REPEAT } from '../constants.js';

/**
 * Orchestrates creation of all world elements.
 * @param {THREE.Scene} scene
 * @returns {{ update: (dt: number, camera: THREE.Camera) => void, arcs: Array, terrainChunks: THREE.Mesh[] }}
 */
export function buildWorld(scene) {
  // Find the sun (directional light) in the scene
  let sun = null;
  scene.traverse((obj) => {
    if (obj.isDirectionalLight) sun = obj;
  });

  // --- Grass texture ---
  const grassCanvas = generateGrassCanvas(256);
  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(GRASS_TEXTURE_REPEAT, GRASS_TEXTURE_REPEAT);
  grassTexture.colorSpace = THREE.SRGBColorSpace;

  // --- Terrain ---
  const { chunks, arcs, group: terrainGroup } = createTerrain(grassTexture);
  scene.add(terrainGroup);

  // --- Water ---
  const water = createWaterPlane(sun);
  scene.add(water.mesh);

  // --- Clouds ---
  const clouds = createCloudLayer();
  scene.add(clouds.group);

  // --- Forest ---
  const forest = createForest(arcs);
  scene.add(forest);

  // --- Octree + Frustum Culler ---
  const octree = new Octree();

  // Ensure world matrices are up to date before inserting
  terrainGroup.updateMatrixWorld(true);
  for (const chunk of chunks) {
    octree.insertMesh(chunk);
  }

  const frustumCuller = new FrustumCuller(octree, chunks);

  // --- Update function ---
  function update(dt, camera) {
    water.update(dt);
    clouds.update(dt);
    frustumCuller.update(camera);
  }

  return { update, arcs, terrainChunks: chunks };
}
