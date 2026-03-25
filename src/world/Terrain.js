import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import {
  WORLD_SIZE, WORLD_HALF, CHUNK_COUNT, CHUNK_SIZE,
  ARC_COUNT, ARC_MIN_RADIUS, ARC_MAX_RADIUS,
  ARC_MIN_HEIGHT, ARC_MAX_HEIGHT,
  TERRAIN_SEGMENTS, GRASS_TEXTURE_REPEAT,
} from '../constants.js';

/**
 * Generate random parabolic arcs that define the terrain height.
 * Each arc: { cx, cz, radius, height }
 * height(x, z) = SUM [ h * max(0, 1 - ((x-cx)^2 + (z-cz)^2) / r^2) ]
 */
export function generateArcs(count = ARC_COUNT, seed = null) {
  const arcs = [];
  for (let i = 0; i < count; i++) {
    arcs.push({
      cx: randomRange(-WORLD_HALF, WORLD_HALF),
      cz: randomRange(-WORLD_HALF, WORLD_HALF),
      radius: randomRange(ARC_MIN_RADIUS, ARC_MAX_RADIUS),
      height: randomRange(ARC_MIN_HEIGHT, ARC_MAX_HEIGHT),
    });
  }
  return arcs;
}

/**
 * Sample terrain height at world coordinates (x, z).
 */
export function getTerrainHeight(x, z, arcs) {
  let h = 0;
  for (const arc of arcs) {
    const dx = x - arc.cx;
    const dz = z - arc.cz;
    const distSq = dx * dx + dz * dz;
    const rSq = arc.radius * arc.radius;
    const contribution = 1 - distSq / rSq;
    if (contribution > 0) {
      h += arc.height * contribution;
    }
  }
  return h;
}

/**
 * Create a single terrain chunk mesh.
 * @param {number} chunkX - chunk index X (0..CHUNK_COUNT-1)
 * @param {number} chunkZ - chunk index Z (0..CHUNK_COUNT-1)
 * @param {Array} arcs - parabolic arcs
 * @param {THREE.Texture} grassTexture - tiled grass texture
 * @returns {THREE.Mesh}
 */
export function createTerrainChunk(chunkX, chunkZ, arcs, grassTexture) {
  const segsPerChunk = Math.floor(TERRAIN_SEGMENTS / CHUNK_COUNT);
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segsPerChunk, segsPerChunk);

  // Rotate to XZ plane
  geometry.rotateX(-Math.PI / 2);

  // World offset for this chunk
  const offsetX = -WORLD_HALF + chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
  const offsetZ = -WORLD_HALF + chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;

  // Displace vertices
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const localX = pos.getX(i);
    const localZ = pos.getZ(i);
    const worldX = localX + offsetX;
    const worldZ = localZ + offsetZ;
    const height = getTerrainHeight(worldX, worldZ, arcs);
    pos.setY(i, height);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Adjust UVs for seamless tiling across chunks
  const uv = geometry.attributes.uv;
  const tilesPerChunk = GRASS_TEXTURE_REPEAT / CHUNK_COUNT;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i); // 0..1 within chunk
    const v = uv.getY(i);
    uv.setXY(
      i,
      (chunkX + u) * tilesPerChunk,
      (chunkZ + v) * tilesPerChunk,
    );
  }
  uv.needsUpdate = true;

  const material = new THREE.MeshLambertMaterial({ map: grassTexture });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(offsetX, 0, offsetZ);

  // Store chunk coords for culling
  mesh.userData.chunkX = chunkX;
  mesh.userData.chunkZ = chunkZ;

  return mesh;
}

/**
 * Create all terrain chunks.
 * @returns {{ chunks: THREE.Mesh[], arcs: Array, group: THREE.Group }}
 */
export function createTerrain(grassTexture) {
  const arcs = generateArcs();
  const group = new THREE.Group();
  group.name = 'terrain';
  const chunks = [];

  for (let cx = 0; cx < CHUNK_COUNT; cx++) {
    for (let cz = 0; cz < CHUNK_COUNT; cz++) {
      const chunk = createTerrainChunk(cx, cz, arcs, grassTexture);
      group.add(chunk);
      chunks.push(chunk);
    }
  }

  return { chunks, arcs, group };
}
