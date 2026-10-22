import * as THREE from 'three';

// Helper to create high-detail procedural PBR maps via HTML5 Canvas
export function generatePBRTexture(type = 'park') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Fill base color
  ctx.fillStyle = type === 'cyber' ? '#1e1b4b' : type === 'desert' ? '#b45309' : '#2e7d32';
  ctx.fillRect(0, 0, 512, 512);

  // Generate noise and surface roughness details
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 25;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);

  // Procedural Normal Map (Simulates micro-bumps and crevices)
  const normCanvas = document.createElement('canvas');
  normCanvas.width = 512;
  normCanvas.height = 512;
  const normCtx = normCanvas.getContext('2d');
  normCtx.fillStyle = '#8080ff'; // Default flat normal (RGB: 128, 128, 255)
  normCtx.fillRect(0, 0, 512, 512);

  const normData = normCtx.getImageData(0, 0, 512, 512);
  const nData = normData.data;

  for (let i = 0; i < nData.length; i += 4) {
    const nx = 128 + (Math.random() - 0.5) * 60;
    const ny = 128 + (Math.random() - 0.5) * 60;
    nData[i] = nx;     // Red (X slope)
    nData[i + 1] = ny; // Green (Y slope)
    nData[i + 2] = 255; // Blue (Z normal facing up)
  }
  normCtx.putImageData(normData, 0, 0);

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(16, 16);

  return { albedoMap: map, normalMap };
}