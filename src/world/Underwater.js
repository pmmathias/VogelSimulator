import * as THREE from 'three';
import { randomRange } from '../utils/math.js';
import { getTerrainHeight } from './Terrain.js';
import { WORLD_HALF, WATER_LEVEL } from '../constants.js';

/**
 * Underwater world: fish, coral, and visual effects when below water surface.
 */
export class UnderwaterWorld {
  constructor(scene, arcs) {
    this.scene = scene;
    this._arcs = arcs;
    this.group = new THREE.Group();
    this.group.name = 'underwater';
    scene.add(this.group);

    this._isUnderwater = false;
    this._overlay = null;
    this._originalFogColor = null;
    this._originalFogNear = 0;
    this._originalFogFar = 0;

    this._createOverlay();
    this._createFish();
    this._createCoral();
  }

  _createOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 40, 80, 0.35);
      pointer-events: none; z-index: 50;
      transition: opacity 0.3s;
      opacity: 0;
    `;
    document.body.appendChild(this._overlay);
  }

  _createFish() {
    // Fish texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 32);
    ctx.fillStyle = '#c0c8d8';
    ctx.beginPath();
    ctx.ellipse(28, 16, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a0a8b8';
    ctx.beginPath();
    ctx.moveTo(46, 16);
    ctx.lineTo(62, 6);
    ctx.lineTo(62, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(18, 13, 2, 0, Math.PI * 2);
    ctx.fill();

    const fishTex = new THREE.CanvasTexture(canvas);
    const fishGeo = new THREE.PlaneGeometry(1, 0.5);
    const fishMat = new THREE.MeshBasicMaterial({
      map: fishTex,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      fog: false,
    });

    const FISH_TARGET = 5000;
    // Pre-generate valid positions (only over water, not under terrain)
    const fishPositions = [];
    for (let attempts = 0; attempts < FISH_TARGET * 3 && fishPositions.length < FISH_TARGET; attempts++) {
      const x = randomRange(-WORLD_HALF * 0.85, WORLD_HALF * 0.85);
      const z = randomRange(-WORLD_HALF * 0.85, WORLD_HALF * 0.85);
      const terrainH = getTerrainHeight(x, z, this._arcs);
      if (terrainH < WATER_LEVEL - 2) { // only in water areas
        const y = randomRange(Math.max(terrainH + 1, WATER_LEVEL - 12), WATER_LEVEL - 1);
        fishPositions.push({ x, y, z });
      }
    }

    const FISH_COUNT = fishPositions.length;
    const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, FISH_COUNT);
    fishMesh.name = 'fish';
    fishMesh.frustumCulled = false;

    this._fishData = [];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < FISH_COUNT; i++) {
      const { x, y, z } = fishPositions[i];
      const scale = 1 + Math.random() * 3;
      const dir = Math.random() * Math.PI * 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, dir, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      fishMesh.setMatrixAt(i, dummy.matrix);

      // Color variation
      color.setHSL(0.55 + Math.random() * 0.15, 0.3 + Math.random() * 0.4, 0.5 + Math.random() * 0.3);
      fishMesh.setColorAt(i, color);

      this._fishData.push({ x, y, z, dir, speed: 2 + Math.random() * 5, wobble: Math.random() * 6 });
    }

    fishMesh.instanceMatrix.needsUpdate = true;
    fishMesh.instanceColor.needsUpdate = true;
    this._fishMesh = fishMesh;
    this.group.add(fishMesh);
  }

  _createCoral() {
    const coralColors = [
      0xff6644, 0xff8866, 0xee5533, 0xffaa77,
      0x44cc88, 0x55ddaa, 0x33bb77,
      0xcc66cc, 0xdd88dd, 0xff4488,
    ];

    const CORAL_TARGET = 5000;
    const coralGeo = new THREE.ConeGeometry(0.5, 1, 5);
    coralGeo.translate(0, 0.5, 0);
    const coralMat = new THREE.MeshLambertMaterial({ fog: false });

    // Pre-generate valid coral positions
    const coralPositions = [];
    for (let attempts = 0; attempts < CORAL_TARGET * 3 && coralPositions.length < CORAL_TARGET; attempts++) {
      const x = randomRange(-WORLD_HALF * 0.75, WORLD_HALF * 0.75);
      const z = randomRange(-WORLD_HALF * 0.75, WORLD_HALF * 0.75);
      const terrainH = getTerrainHeight(x, z, this._arcs);
      if (terrainH < WATER_LEVEL - 3) { // only on underwater seabed
        const y = terrainH + 0.5; // sit on actual seabed
        coralPositions.push({ x, y, z });
      }
    }

    const CORAL_COUNT = coralPositions.length;
    const coralMesh = new THREE.InstancedMesh(coralGeo, coralMat, CORAL_COUNT);
    coralMesh.name = 'coral';
    coralMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < CORAL_COUNT; i++) {
      const { x, y, z } = coralPositions[i];
      const scale = 0.5 + Math.random() * 3;

      dummy.position.set(x, y, z);
      dummy.scale.set(scale * 0.5, scale, scale * 0.5);
      dummy.rotation.set(0, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      dummy.updateMatrix();
      coralMesh.setMatrixAt(i, dummy.matrix);

      color.set(coralColors[Math.floor(Math.random() * coralColors.length)]);
      coralMesh.setColorAt(i, color);
    }

    coralMesh.instanceMatrix.needsUpdate = true;
    coralMesh.instanceColor.needsUpdate = true;
    this.group.add(coralMesh);
  }

  update(dt, birdAltitude) {
    const wasUnderwater = this._isUnderwater;
    this._isUnderwater = birdAltitude < WATER_LEVEL;

    if (this._isUnderwater !== wasUnderwater) {
      this._overlay.style.opacity = this._isUnderwater ? '1' : '0';
      if (this.scene.fog) {
        if (this._isUnderwater) {
          this._originalFogColor = this.scene.fog.color.clone();
          this._originalFogNear = this.scene.fog.near;
          this._originalFogFar = this.scene.fog.far;
          this.scene.fog.color.set(0x0a2850);
          this.scene.fog.near = 10;
          this.scene.fog.far = 120;
        } else {
          this.scene.fog.color.copy(this._originalFogColor);
          this.scene.fog.near = this._originalFogNear;
          this.scene.fog.far = this._originalFogFar;
        }
      }
    }

    // Animate fish (only update a subset each frame for performance)
    if (this._fishMesh && this._isUnderwater) {
      const dummy = new THREE.Object3D();
      const batchSize = 500; // update 500 fish per frame
      const offset = (Math.floor(performance.now() / 16) * batchSize) % this._fishData.length;

      for (let i = offset; i < Math.min(offset + batchSize, this._fishData.length); i++) {
        const f = this._fishData[i];
        f.wobble += dt * 2;
        f.x += Math.cos(f.dir) * f.speed * dt;
        f.z += Math.sin(f.dir) * f.speed * dt;
        f.y = f.y + Math.sin(f.wobble) * 0.3 * dt;
        if (Math.random() < 0.002) f.dir += (Math.random() - 0.5) * 0.5;

        // Wrap
        const lim = WORLD_HALF * 0.85;
        if (f.x > lim) f.x = -lim;
        if (f.x < -lim) f.x = lim;
        if (f.z > lim) f.z = -lim;
        if (f.z < -lim) f.z = lim;

        dummy.position.set(f.x, f.y, f.z);
        dummy.rotation.set(0, f.dir, 0);
        dummy.updateMatrix();
        this._fishMesh.setMatrixAt(i, dummy.matrix);
      }
      this._fishMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
