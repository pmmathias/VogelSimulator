import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Gerstner wave GLSL — injected into the Water vertex shader.
 * 4 overlapping waves with different directions/frequencies for realism.
 */
const GERSTNER_PARS = /* glsl */ `
  uniform float waveTime;

  // wave(amplitude, frequency, speed, dirX, dirZ)
  vec3 gerstnerWave(vec2 pos, float amp, float freq, float speed, vec2 dir, float steep) {
    float phase = freq * dot(dir, pos) - speed * waveTime;
    float c = cos(phase);
    float s = sin(phase);
    return vec3(
      steep * amp * dir.x * c,
      amp * s,
      steep * amp * dir.y * c
    );
  }

  vec3 gerstnerDisplace(vec2 pos) {
    vec3 d = vec3(0.0);
    d += gerstnerWave(pos, 1.2, 0.06, 1.5, normalize(vec2(1.0, 0.3)), 0.6);
    d += gerstnerWave(pos, 0.8, 0.10, 2.0, normalize(vec2(-0.5, 1.0)), 0.5);
    d += gerstnerWave(pos, 0.5, 0.15, 2.5, normalize(vec2(0.7, -0.6)), 0.4);
    d += gerstnerWave(pos, 0.3, 0.22, 3.0, normalize(vec2(-0.3, -0.8)), 0.3);
    return d;
  }
`;

const GERSTNER_VERTEX = /* glsl */ `
  vec3 wavePos = gerstnerDisplace(worldPosition.xz);
  worldPosition.x += wavePos.x;
  worldPosition.y += wavePos.y;
  worldPosition.z += wavePos.z;
`;

/**
 * Create an animated water plane with Gerstner wave displacement.
 */
export function createWaterPlane(sun) {
  // Subdivided geometry for vertex displacement (128×128 = 16K verts)
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE * 4, WORLD_SIZE * 4, 128, 128);

  const water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'textures/waternormals.jpg',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
      },
      undefined,
      () => {
        // Fallback: procedural normal map
        const canvas = document.createElement('canvas');
        const sz = 512;
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, sz, sz);
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
    fog: false,
  });

  // Inject Gerstner wave displacement into the Water vertex shader
  water.material.uniforms.waveTime = { value: 0 };
  water.material.vertexShader = water.material.vertexShader.replace(
    'void main() {',
    GERSTNER_PARS + '\nvoid main() {',
  );
  water.material.vertexShader = water.material.vertexShader.replace(
    'gl_Position = projectionMatrix * mvPosition;',
    GERSTNER_VERTEX + '\ngl_Position = projectionMatrix * mvPosition;',
  );
  water.material.needsUpdate = true;

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  // Underwater plane (no Gerstner needed — viewed from below, fine without displacement)
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
  underWater.rotation.x = Math.PI / 2;
  underWater.position.y = WATER_LEVEL - 0.05;

  const waterGroup = new THREE.Group();
  waterGroup.add(water);
  waterGroup.add(underWater);

  function update(dt) {
    water.material.uniforms.time.value += dt;
    water.material.uniforms.waveTime.value += dt;
    underWater.material.uniforms.time.value += dt;
  }

  return { mesh: waterGroup, update };
}
