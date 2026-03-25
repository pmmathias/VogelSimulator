import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Create an animated water plane at WATER_LEVEL.
 * @param {THREE.DirectionalLight} sun - sun light for reflection direction
 * @returns {{ mesh: Water, update: (dt: number) => void }}
 */
export function createWaterPlane(sun) {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE * 1.5, WORLD_SIZE * 1.5);

  const water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      // Use a procedural fallback if no texture file exists
      'textures/water-normal.jpg',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
      },
      undefined,
      () => {
        // Fallback: generate a simple normal map procedurally
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        // Flat normal (128, 128, 255) = pointing up
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, 256, 256);
        // Add some variation
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * 256;
          const y = Math.random() * 256;
          const r = 2 + Math.random() * 8;
          const nr = 120 + Math.floor(Math.random() * 16);
          const ng = 120 + Math.floor(Math.random() * 16);
          ctx.fillStyle = `rgb(${nr}, ${ng}, 255)`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        water.material.uniforms.normalSampler.value = tex;
      },
    ),
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: true,
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  function update(dt) {
    water.material.uniforms.time.value += dt;
  }

  return { mesh: water, update };
}
