import * as THREE from 'three';
import { createNoise2D } from './noise.js';

/**
 * Generates `count` unique deformed rock geometries by displacing an
 * icosahedron's vertices along their normals using noise, plus random
 * non-uniform axis scaling. Assign instances across these variants
 * (round-robin via createInstancedPropVariants) instead of cloning one
 * identical shape repeatedly.
 */
export function generateRockVariants({ count = 5, seed = 1, detail = 1, jaggedness = 0.35 } = {}) {
  const noise2D = createNoise2D(seed);
  const variants = [];

  for (let v = 0; v < count; v++) {
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    const posAttr = geometry.attributes.position;

    const offsetX = v * 137.5;
    const offsetY = v * 91.3;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);

      const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const nx = vx / len, ny = vy / len, nz = vz / len;

      const theta = Math.atan2(nz, nx) + offsetX;
      const phi = Math.acos(ny) + offsetY;

      const n = noise2D(theta * 2, phi * 2);
      const displacement = 1 + n * jaggedness;

      posAttr.setXYZ(i, vx * displacement, vy * displacement, vz * displacement);
    }

    geometry.scale(
      0.8 + Math.random() * 0.5,
      0.6 + Math.random() * 0.6,
      0.8 + Math.random() * 0.5
    );

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    variants.push(geometry);
  }

  return variants;
}