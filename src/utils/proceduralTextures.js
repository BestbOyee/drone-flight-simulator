import * as THREE from 'three';

function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

// Multi-octave value noise field used as the basis for albedo speckling,
// normal-map derivation, and roughness variation.
function generateNoiseField(size, seed, cellSize = 8) {
  const rand = seededRandom(seed);
  const field = new Float32Array(size * size);

  const octaves = [
    { cell: cellSize, amp: 0.6 },
    { cell: cellSize / 3, amp: 0.3 },
    { cell: cellSize / 8, amp: 0.1 },
  ];

  octaves.forEach(({ cell, amp }) => {
    const gridSize = Math.ceil(size / cell) + 2;
    const grid = new Float32Array(gridSize * gridSize);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = x / cell;
        const gy = y / cell;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const x1 = x0 + 1, y1 = y0 + 1;
        const tx = gx - x0, ty = gy - y0;

        const v00 = grid[y0 * gridSize + x0];
        const v10 = grid[y0 * gridSize + x1];
        const v01 = grid[y1 * gridSize + x0];
        const v11 = grid[y1 * gridSize + x1];

        const vx0 = v00 + (v10 - v00) * tx;
        const vx1 = v01 + (v11 - v01) * tx;
        const v = vx0 + (vx1 - vx0) * ty;

        field[y * size + x] += v * amp;
      }
    }
  });

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    min = Math.min(min, field[i]);
    max = Math.max(max, field[i]);
  }
  const range = max - min || 1;
  for (let i = 0; i < field.length; i++) {
    field[i] = (field[i] - min) / range;
  }

  return field;
}

function buildAlbedoCanvas(size, field, colorRamp) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  function sampleRamp(t) {
    for (let i = 0; i < colorRamp.length - 1; i++) {
      const a = colorRamp[i];
      const b = colorRamp[i + 1];
      if (t >= a.stop && t <= b.stop) {
        const localT = (t - a.stop) / (b.stop - a.stop || 1);
        return [
          a.color[0] + (b.color[0] - a.color[0]) * localT,
          a.color[1] + (b.color[1] - a.color[1]) * localT,
          a.color[2] + (b.color[2] - a.color[2]) * localT,
        ];
      }
    }
    return colorRamp[colorRamp.length - 1].color;
  }

  for (let i = 0; i < field.length; i++) {
    const [r, g, b] = sampleRamp(field[i]);
    imgData.data[i * 4] = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function buildNormalCanvas(size, field, strength = 2.0) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  const at = (x, y) => field[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = at(x - 1, y);
      const hR = at(x + 1, y);
      const hD = at(x, y - 1);
      const hU = at(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len, ny = dy / len, nz = dz / len;

      const idx = (y * size + x) * 4;
      imgData.data[idx] = (nx * 0.5 + 0.5) * 255;
      imgData.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      imgData.data[idx + 2] = (nz * 0.5 + 0.5) * 255;
      imgData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function buildRoughnessCanvas(size, field, { base = 0.8, variance = 0.2, invert = false } = {}) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  for (let i = 0; i < field.length; i++) {
    const t = invert ? 1 - field[i] : field[i];
    const v = Math.max(0, Math.min(1, base + (t - 0.5) * variance * 2)) * 255;
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function canvasToTexture(canvas, repeat = 8) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a {map, normalMap, roughnessMap} texture set for a surface type.
 * Call once per material and cache/reuse — generation is a one-time cost
 * (512x512 canvas work), not meant to be called per-instance.
 */
export function generateSurfaceTextures(type, { seed = 1, size = 512, repeat = 16 } = {}) {
  const ramps = {
    rock:     [{ stop: 0, color: [58, 48, 40] },  { stop: 0.5, color: [94, 80, 64] },   { stop: 1, color: [140, 124, 102] }],
    sand:     [{ stop: 0, color: [168, 132, 84] }, { stop: 0.5, color: [201, 160, 106] }, { stop: 1, color: [230, 196, 148] }],
    snow:     [{ stop: 0, color: [198, 214, 224] },{ stop: 0.5, color: [226, 238, 244] }, { stop: 1, color: [255, 255, 255] }],
    ice:      [{ stop: 0, color: [140, 190, 210] },{ stop: 0.5, color: [186, 221, 236] }, { stop: 1, color: [225, 245, 252] }],
    dirt:     [{ stop: 0, color: [48, 36, 26] },  { stop: 0.5, color: [80, 60, 42] },    { stop: 1, color: [110, 86, 60] }],
    grass:    [{ stop: 0, color: [24, 58, 26] },  { stop: 0.5, color: [42, 92, 40] },    { stop: 1, color: [78, 128, 58] }],
    obsidian: [{ stop: 0, color: [10, 8, 8] },    { stop: 0.5, color: [22, 18, 18] },    { stop: 1, color: [40, 32, 30] }],
  };

  const roughnessParams = {
    rock: { base: 0.85, variance: 0.25 },
    sand: { base: 0.95, variance: 0.1 },
    snow: { base: 0.35, variance: 0.3 },
    ice: { base: 0.12, variance: 0.3 },
    dirt: { base: 0.9, variance: 0.15 },
    grass: { base: 0.85, variance: 0.2 },
    obsidian: { base: 0.25, variance: 0.35 },
  };

  const ramp = ramps[type] || ramps.rock;
  const roughCfg = roughnessParams[type] || roughnessParams.rock;

  const field = generateNoiseField(size, seed, size / 48);
  const albedoCanvas = buildAlbedoCanvas(size, field, ramp);
  const normalCanvas = buildNormalCanvas(size, field, type === 'ice' ? 1.0 : 2.5);
  const roughnessCanvas = buildRoughnessCanvas(size, field, roughCfg);

  return {
    map: canvasToTexture(albedoCanvas, repeat),
    normalMap: canvasToTexture(normalCanvas, repeat),
    roughnessMap: canvasToTexture(roughnessCanvas, repeat),
  };
}