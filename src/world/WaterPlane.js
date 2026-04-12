import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Ocean } from '../vendor/Ocean3.js';
import { WORLD_SIZE, WATER_LEVEL } from '../constants.js';

/**
 * Hybrid water: Three.js Water class (for sun reflection) +
 * Phil Crowther's Ocean3 iFFT wave generator (displacement + normal maps).
 *
 * - Water class handles: sun reflection, mirror reflection, PBR water look
 * - Ocean3 handles: realistic wave shape via FFT → vertex displacement + normals
 *
 * Ocean3.js © Phil Crowther — CC BY-NC-SA 3.0
 *
 * @param {THREE.DirectionalLight} sun
 * @param {THREE.WebGLRenderer} renderer
 */
export function createWaterPlane(sun, renderer) {
  const WAVE_TILE = 2400;
  const wav_ = {
    Res: 512,
    Siz: WAVE_TILE,
    WSp: 18,
    WHd: 295,
    Chp: 1.5,
  };
  const ocean = new Ocean(renderer, wav_);

  const PLANE_SIZE = WORLD_SIZE * 4;               // 24000m
  const TILE_COUNT = PLANE_SIZE / WAVE_TILE;       // 10× tiling
  const SEGMENTS = 256;

  // Subdivided geometry for vertex displacement (65K verts)
  const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * TILE_COUNT, uv.getY(i) * TILE_COUNT);
  }

  // Configure Phil's FFT textures for repeating
  const normalMap = ocean.normalMapFramebuffer.texture;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  const displacementMap = ocean.displacementMapFramebuffer.texture;
  displacementMap.wrapS = displacementMap.wrapT = THREE.RepeatWrapping;

  // Three.js Water class — gives us sun reflection + mirror reflection
  // Using Phil's FFT normal map instead of the default one
  const water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: normalMap,
    sunDirection: new THREE.Vector3().copy(sun.position).normalize(),
    sunColor: 0xffeedd,
    waterColor: 0x003050,
    distortionScale: 2.5,
    fog: false,
  });

  // Inject Phil's displacement map into Water's vertex shader
  water.material.uniforms.oceanDisplacement = { value: displacementMap };
  water.material.vertexShader =
    'uniform sampler2D oceanDisplacement;\n' +
    water.material.vertexShader.replace(
      'void main() {',
      `void main() {
        vec3 oceanDisp = texture2D(oceanDisplacement, uv).rgb;
      `,
    ).replace(
      // Replace ALL uses of `vec4( position, 1.0 )` with displaced position
      /vec4\s*\(\s*position\s*,\s*1\.0\s*\)/g,
      'vec4(position + oceanDisp, 1.0)',
    );
  water.material.needsUpdate = true;

  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;

  // Simple flat underwater plane (viewed from below when diving)
  const underWater = new Water(new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE), {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals: normalMap,
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
    ocean.update(dt);
    water.material.uniforms.time.value += dt;
    underWater.material.uniforms.time.value += dt;
  }

  return { mesh: waterGroup, update };
}
