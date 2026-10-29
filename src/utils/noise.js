// Self-contained 2D Simplex noise implementation (no external deps).
// Based on the public-domain algorithm by Stefan Gustavson.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function buildPermutationTable(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // simple seeded shuffle (mulberry32-style PRNG)
  let s = seed >>> 0 || 1;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/**
 * Returns a noise2D(x, y) function seeded deterministically,
 * so the same seed always produces the same terrain.
 */
export function createNoise2D(seed = 1337) {
  const perm = buildPermutationTable(seed);

  return function noise2D(xin, yin) {
    let n0, n1, n2;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    const gi0 = perm[ii + perm[jj]] % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    n0 = t0 < 0 ? 0 : (t0 **= 4, t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0));

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    n1 = t1 < 0 ? 0 : (t1 **= 4, t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1));

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    n2 = t2 < 0 ? 0 : (t2 **= 4, t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2));

    return 70 * (n0 + n1 + n2); // roughly in [-1, 1]
  };
}

/**
 * Fractal Brownian Motion — layers multiple octaves of noise
 * to create natural-looking terrain (big rolling shapes +
 * medium detail + fine bumps).
 */
export function fbm(noise2D, x, y, {
  octaves = 4,
  persistence = 0.5,
  lacunarity = 2.0,
  scale = 0.01,
} = {}) {
  let amplitude = 1;
  let frequency = scale;
  let sum = 0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    sum += noise2D(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return sum / maxAmp; // normalized to roughly [-1, 1]
}

/**
 * Convenience wrapper: turns normalized fbm noise into an actual
 * world-space height value for terrain building / prop placement.
 *
 * params:
 *   noise2D      - a function from createNoise2D()
 *   scale        - lower = bigger/smoother features, higher = more jagged
 *   octaves      - detail layers
 *   persistence  - how much each octave contributes
 *   lacunarity   - frequency growth per octave
 *   amplitude    - max height in world units
 *   offset       - flat height added to everything (base elevation)
 */
export function sampleHeight(noise2D, x, z, params = {}) {
  const {
    scale = 0.01,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2.0,
    amplitude = 10,
    offset = 0,
  } = params;

  const n = fbm(noise2D, x, z, { octaves, persistence, lacunarity, scale });
  return n * amplitude + offset;
}