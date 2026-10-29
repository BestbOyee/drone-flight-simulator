import { createNoise2D } from './noise.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Creates a deterministic, meandering canyon-carving function.
 * Given the base terrain height at (x, z), carve() returns a modified
 * height that dips down into a deep, steep-walled chasm whenever (x, z)
 * is near the canyon's centerline, and leaves the base height untouched
 * far from it.
 */
export function createCanyonCarver({
  seed = 777,
  centerX = 180,
  meanderScale = 0.0015,
  meanderAmplitude = 80,
  width = 100,
  widthVariance = 30,
  depth = 75,
  wallSoftness = 20,
  floorNoiseAmplitude = 4,
} = {}) {
  const meanderNoise = createNoise2D(seed);
  const widthNoise = createNoise2D(seed + 1);
  const floorNoise = createNoise2D(seed + 2);
  const rimNoise = createNoise2D(seed + 3);

  function getCenterlineX(z) {
    return centerX + meanderNoise(z * meanderScale, 0) * meanderAmplitude;
  }

  function getHalfWidth(z) {
    const w = width + widthNoise(z * 0.004, 50) * widthVariance;
    return Math.max(20, w) / 2;
  }

  function carve(x, z, baseHeight) {
    const cx = getCenterlineX(z);
    const halfWidth = getHalfWidth(z);
    const dist = Math.abs(x - cx);

    // Jitter the rim so the canyon edge isn't a perfectly smooth curve
    const rimJitter = rimNoise(x * 0.02, z * 0.02) * 10;
    const effectiveDist = dist + rimJitter;

    // t = 0 deep inside the canyon, t = 1 fully outside on the mesa
    const t = smoothstep(halfWidth - wallSoftness, halfWidth + wallSoftness, effectiveDist);

    const floorVariation = floorNoise(x * 0.02, z * 0.02) * floorNoiseAmplitude;
    const floorHeight = baseHeight - depth + floorVariation;

    return lerp(floorHeight, baseHeight, t);
  }

  return { carve, getCenterlineX, getHalfWidth };
}