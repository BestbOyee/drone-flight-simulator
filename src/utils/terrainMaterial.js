import * as THREE from 'three';
import { generateSurfaceTextures } from './proceduralTextures.js';

export function createTerrainMaterial(detailType = 'rock', {
  seed = 1,
  repeat = 24,
  roughnessBase = 1.0,
  metalness = 0.0,
} = {}) {
  const detailTex = generateSurfaceTextures(detailType, { seed, repeat });

  return new THREE.MeshStandardMaterial({
    map: detailTex.map,
    normalMap: detailTex.normalMap,
    roughnessMap: detailTex.roughnessMap,
    roughness: roughnessBase,
    metalness,
    vertexColors: true,
  });
}

/**
 * Computes per-vertex terrain colors by blending:
 *   steepColor <-> flatColor   based on slope (surface normal steepness)
 *   then optionally overriding toward depthColor for low-elevation areas
 *   (e.g. a canyon floor), based on absolute world Y height.
 * Call AFTER geometry.computeVertexNormals() and after any height carving.
 */
export function applySlopeVertexColors(geometry, {
  flatColor = [60, 110, 50],
  steepColor = [110, 96, 80],
  slopeStart = 0.85,
  slopeEnd = 0.6,
  depthColor = null,
  depthThreshold = -40,
  depthBlendRange = 15,
} = {}) {
  const normalAttr = geometry.attributes.normal;
  const posAttr = geometry.attributes.position;
  const count = normalAttr.count;
  const colors = new Float32Array(count * 3);

  const fc = flatColor.map(c => c / 255);
  const sc = steepColor.map(c => c / 255);
  const dc = depthColor ? depthColor.map(c => c / 255) : null;

  for (let i = 0; i < count; i++) {
    const ny = normalAttr.getY(i);
    const slopeT = THREE.MathUtils.clamp((ny - slopeEnd) / (slopeStart - slopeEnd), 0, 1);

    let r = sc[0] + (fc[0] - sc[0]) * slopeT;
    let g = sc[1] + (fc[1] - sc[1]) * slopeT;
    let b = sc[2] + (fc[2] - sc[2]) * slopeT;

    if (dc) {
      const y = posAttr.getY(i);
      const depthT = THREE.MathUtils.clamp((depthThreshold - y) / depthBlendRange, 0, 1);
      r = r + (dc[0] - r) * depthT;
      g = g + (dc[1] - g) * depthT;
      b = b + (dc[2] - b) * depthT;
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}