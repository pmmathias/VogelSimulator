import * as THREE from 'three';
import { fbm } from '../utils/noise.js';
import { randomRange } from '../utils/math.js';
import { getTerrainHeight } from './Terrain.js';
import { createTreeGeometry, generateTreeCanvas } from './TreeCluster.js';
import {
  WORLD_HALF, WATER_LEVEL,
  TREE_CLUSTER_COUNT, TREES_PER_CLUSTER_MIN, TREES_PER_CLUSTER_MAX,
  TREE_MIN_HEIGHT, TREE_MAX_HEIGHT,
} from '../constants.js';

/**
 * Place tree clusters across the terrain using noise-based distribution.
 * Uses InstancedMesh for performance.
 *
 * @param {Array} arcs - terrain arcs for height sampling
 * @returns {THREE.InstancedMesh}
 */
export function createForest(arcs) {
  // Generate tree texture
  const treeCanvas = generateTreeCanvas();
  const treeTexture = new THREE.CanvasTexture(treeCanvas);
  treeTexture.colorSpace = THREE.SRGBColorSpace;

  // Create tree geometry (3 crossed planes)
  const treeGeo = createTreeGeometry(1, 0.6); // unit size, scaled per instance

  const treeMaterial = new THREE.MeshLambertMaterial({
    map: treeTexture,
    transparent: true,
    alphaTest: 0.3,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // Collect all tree positions and scales
  const treeTransforms = [];

  for (let c = 0; c < TREE_CLUSTER_COUNT; c++) {
    // Pick cluster center using noise to get natural grouping
    const clusterX = randomRange(-WORLD_HALF * 0.9, WORLD_HALF * 0.9);
    const clusterZ = randomRange(-WORLD_HALF * 0.9, WORLD_HALF * 0.9);

    // Check if cluster center is above water
    const centerHeight = getTerrainHeight(clusterX, clusterZ, arcs);
    if (centerHeight < WATER_LEVEL + 1) continue;

    const treeCount = Math.floor(randomRange(TREES_PER_CLUSTER_MIN, TREES_PER_CLUSTER_MAX));
    const clusterRadius = 20 + Math.random() * 40;

    for (let t = 0; t < treeCount; t++) {
      // Scatter within cluster radius
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * clusterRadius;
      const tx = clusterX + Math.cos(angle) * dist;
      const tz = clusterZ + Math.sin(angle) * dist;

      // Check bounds
      if (Math.abs(tx) > WORLD_HALF * 0.95 || Math.abs(tz) > WORLD_HALF * 0.95) continue;

      const terrainY = getTerrainHeight(tx, tz, arcs);
      if (terrainY < WATER_LEVEL + 0.5) continue;

      // Use noise to modulate density
      const density = fbm(tx * 0.01, tz * 0.01, 3);
      if (density < -0.2) continue; // skip sparse areas

      const height = randomRange(TREE_MIN_HEIGHT, TREE_MAX_HEIGHT);
      const width = height * 0.5 + Math.random() * 2;

      treeTransforms.push({ x: tx, y: terrainY, z: tz, height, width });
    }
  }

  // Create InstancedMesh
  const instanceCount = treeTransforms.length;
  const instancedMesh = new THREE.InstancedMesh(treeGeo, treeMaterial, instanceCount);
  instancedMesh.name = 'forest';

  const dummy = new THREE.Object3D();
  for (let i = 0; i < instanceCount; i++) {
    const t = treeTransforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.scale.set(t.width, t.height, t.width);
    // Random Y rotation for variety
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.frustumCulled = false; // we handle culling via octree

  return instancedMesh;
}
