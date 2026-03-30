import * as THREE from 'three';
import { CLOUD_HEIGHT, CLOUD_COUNT, WORLD_HALF } from '../constants.js';
import { randomRange } from '../utils/math.js';

const CLOUD_SPREAD = WORLD_HALF * 3;

/**
 * Generate a procedural cloud sprite texture.
 */
function generateCloudCanvas() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw soft white blobs
  const blobCount = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < blobCount; i++) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.5;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.3;
    const r = 30 + Math.random() * 50;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Create a cloud layer with scattered sprites.
 * @returns {{ group: THREE.Group, update: (dt: number) => void }}
 */
export function createCloudLayer() {
  const group = new THREE.Group();
  group.name = 'clouds';

  // Generate a few cloud texture variants
  const cloudTextures = [];
  for (let i = 0; i < 4; i++) {
    const canvas = generateCloudCanvas();
    const tex = new THREE.CanvasTexture(canvas);
    cloudTextures.push(tex);
  }

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const tex = cloudTextures[Math.floor(Math.random() * cloudTextures.length)];
    const material = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.6 + Math.random() * 0.3,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    const scale = randomRange(120, 350);
    sprite.scale.set(scale, scale * 0.35, 1);
    sprite.position.set(
      randomRange(-CLOUD_SPREAD, CLOUD_SPREAD),
      CLOUD_HEIGHT + randomRange(-50, 80),
      randomRange(-CLOUD_SPREAD, CLOUD_SPREAD),
    );

    group.add(sprite);
  }

  // Slow drift animation
  const driftSpeeds = group.children.map(() => ({
    x: randomRange(-2, 2),
    z: randomRange(-1, 1),
  }));

  function update(dt) {
    for (let i = 0; i < group.children.length; i++) {
      const cloud = group.children[i];
      const speed = driftSpeeds[i];
      cloud.position.x += speed.x * dt;
      cloud.position.z += speed.z * dt;

      // Wrap around world bounds
      if (cloud.position.x > CLOUD_SPREAD) cloud.position.x = -CLOUD_SPREAD;
      if (cloud.position.x < -CLOUD_SPREAD) cloud.position.x = CLOUD_SPREAD;
      if (cloud.position.z > CLOUD_SPREAD) cloud.position.z = -CLOUD_SPREAD;
      if (cloud.position.z < -CLOUD_SPREAD) cloud.position.z = CLOUD_SPREAD;
    }
  }

  return { group, update };
}
