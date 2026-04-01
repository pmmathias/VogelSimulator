import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Create an animated water plane at WATER_LEVEL.
 * @param {THREE.DirectionalLight} sun - sun light for reflection direction
 * @returns {{ mesh: Water, update: (dt: number) => void }}
 */
export function createWaterPlane(sun) {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4);

  const water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      // Official Three.js water normals (much better than procedural)
      'textures/waternormals.jpg',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
      },
      undefined,
      () => {
        // Fallback: generate a tileable wave normal map procedurally
        const canvas = document.createElement('canvas');
        const sz = 512;
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext('2d');
        // Base flat normal
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, sz, sz);

        // Layered wave-like noise for realistic ripples
        for (let octave = 0; octave < 3; octave++) {
          const count = [200, 400, 800][octave];
          const maxR = [20, 8, 3][octave];
          const strength = [20, 12, 6][octave];
          for (let i = 0; i < count; i++) {
            const x = Math.random() * sz;
            const y = Math.random() * sz;
            const r = 1 + Math.random() * maxR;
            const angle = Math.random() * Math.PI * 2;
            const nr = 128 + Math.floor(Math.cos(angle) * strength);
            const ng = 128 + Math.floor(Math.sin(angle) * strength);
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
            gradient.addColorStop(0, `rgb(${nr}, ${ng}, 255)`);
            gradient.addColorStop(1, `rgb(128, 128, 255)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
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
    fog: false, // water extends to horizon, fog would make it blue
  });

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  // Second Water plane flipped — same shader, viewed from below
  const underWater = new Water(new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: water.material.uniforms.normalSampler.value,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: false,
  });
  underWater.rotation.x = Math.PI / 2; // flipped (facing up = visible from below)
  underWater.position.y = WATER_LEVEL - 0.05;

  // Group water surface + underside together
  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt) {
    water.material.uniforms.time.value += dt;
    underWater.material.uniforms.time.value += dt;
  }

  return { mesh: waterGroup, update };
}
