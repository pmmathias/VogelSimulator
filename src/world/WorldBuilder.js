import * as THREE from 'three';
import { createTerrain } from './Terrain.js';
import { createWaterPlane } from './WaterPlane.js';
import { createCloudLayer } from './CloudPlane.js';
import { createForest } from './ForestPlacer.js';
import { Octree } from '../spatial/Octree.js';
import { FrustumCuller } from '../spatial/FrustumCuller.js';

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

  // --- Grass texture (from Poly Haven, CC0) ---
  const textureLoader = new THREE.TextureLoader();
  const grassTexture = textureLoader.load(
    'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg'
  );
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
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
