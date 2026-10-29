import * as THREE from 'three';
import { createNoise2D, sampleHeight } from './noise.js';
import { applySlopeVertexColors } from './terrainMaterial.js';

export function buildTerrain({
  width = 800,
  depth = 800,
  segments = 200,
  seed = 1337,
  heightParams = {},
  material,
  slopeColors = null,
  carve = null, // optional (x, z, baseHeight) => finalHeight, for canyons/trenches/valleys
} = {}) {
  const noise2D = createNoise2D(seed);

  const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    let y = sampleHeight(noise2D, x, z, heightParams);
    if (carve) y = carve(x, z, y);
    posAttr.setY(i, y);
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  if (slopeColors) {
    applySlopeVertexColors(geometry, slopeColors);
  }

  const mesh = new THREE.Mesh(
    geometry,
    material || new THREE.MeshStandardMaterial({ color: 0x556644, roughness: 1 })
  );
  mesh.receiveShadow = true;

  function getHeightAt(x, z) {
    let y = sampleHeight(noise2D, x, z, heightParams);
    if (carve) y = carve(x, z, y);
    return y;
  }

  return { mesh, getHeightAt, noise2D };
}

export function scatterOnTerrain({
  count = 200,
  width = 800,
  depth = 800,
  getHeightAt,
  minY = -Infinity,
  maxY = Infinity,
  minScale = 0.8,
  maxScale = 1.3,
  exclusionZones = [],
  densityNoise = null, // optional: { noise2D, scale, threshold }
} = {}) {
  const transforms = [];
  let attempts = 0;
  const maxAttempts = count * 40;

  while (transforms.length < count && attempts < maxAttempts) {
    attempts++;
    const x = (Math.random() - 0.5) * width;
    const z = (Math.random() - 0.5) * depth;

    if (densityNoise) {
      const d = densityNoise.noise2D(x * densityNoise.scale, z * densityNoise.scale);
      if (d < densityNoise.threshold) continue;
    }

    const y = getHeightAt(x, z);
    if (y < minY || y > maxY) continue;

    const blocked = exclusionZones.some(zone => {
      const dx = x - zone.x;
      const dz = z - zone.z;
      return Math.sqrt(dx * dx + dz * dz) < zone.radius;
    });
    if (blocked) continue;

    transforms.push({
      x, y, z,
      rotationY: Math.random() * Math.PI * 2,
      scale: minScale + Math.random() * (maxScale - minScale),
    });
  }

  return transforms;
}