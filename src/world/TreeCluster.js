import * as THREE from 'three';

/**
 * Generate a procedural tree billboard texture with alpha.
 * Returns a canvas element.
 */
export function generateTreeCanvas(width = 128, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;

  // Trunk (extends up to overlap with crown)
  const trunkWidth = width * 0.08;
  const trunkHeight = height * 0.55;
  const trunkTop = height - trunkHeight;
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx - trunkWidth / 2, trunkTop, trunkWidth, trunkHeight);

  // Crown (overlapping circles)
  const crownLayers = [
    { y: height * 0.35, r: width * 0.35, color: '#2d6b1e' },
    { y: height * 0.25, r: width * 0.30, color: '#3a8a2a' },
    { y: height * 0.15, r: width * 0.22, color: '#4a9a3a' },
    { y: height * 0.08, r: width * 0.14, color: '#3a8a2a' },
  ];

  for (const layer of crownLayers) {
    const gradient = ctx.createRadialGradient(cx, layer.y, 0, cx, layer.y, layer.r);
    gradient.addColorStop(0, layer.color);
    gradient.addColorStop(0.7, layer.color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, layer.y, layer.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Add some leaf detail
  for (let i = 0; i < 40; i++) {
    const lx = cx + (Math.random() - 0.5) * width * 0.5;
    const ly = height * 0.05 + Math.random() * height * 0.4;
    const lr = 2 + Math.random() * 5;
    const g = 80 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${20 + Math.floor(Math.random() * 30)}, ${g}, 20, 0.6)`;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Create the geometry for a single tree billboard (3 crossed planes).
 * Returns a merged BufferGeometry.
 */
export function createTreeGeometry(treeHeight = 14, treeWidth = 8) {
  const halfW = treeWidth / 2;
  const planes = [];

  // 3 planes at 0, 60, 120 degrees
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI) / 3;
    const plane = new THREE.PlaneGeometry(treeWidth, treeHeight);

    // Rotate around Y axis
    const matrix = new THREE.Matrix4();
    matrix.makeRotationY(angle);
    // Shift up so base is at y=0
    matrix.setPosition(0, treeHeight / 2, 0);
    plane.applyMatrix4(matrix);

    planes.push(plane);
  }

  // Merge geometries
  return mergeGeometries(planes);
}

/**
 * Simple geometry merge (no dependency on BufferGeometryUtils).
 */
function mergeGeometries(geometries) {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    totalVertices += geo.attributes.position.count;
    totalIndices += geo.index ? geo.index.count : 0;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = [];

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);

      normals[(vertexOffset + i) * 3] = norm.getX(i);
      normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
      normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);

      uvs[(vertexOffset + i) * 2] = uv.getX(i);
      uvs[(vertexOffset + i) * 2 + 1] = uv.getY(i);
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices.push(geo.index.array[i] + vertexOffset);
      }
    }

    vertexOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices.length > 0) {
    merged.setIndex(indices);
  }

  return merged;
}
