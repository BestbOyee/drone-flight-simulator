import * as THREE from 'three';

/**
 * Builds a gradient sky dome (inverted sphere, vertex-colored from
 * horizon to zenith) to replace a flat scene.background color.
 */
export function buildSkyDome({
  radius = 600,
  horizonColor = '#cfe8f7',
  zenithColor = '#1a4d8f',
  exponent = 0.6,
} = {}) {
  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  const posAttr = geometry.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const horizon = new THREE.Color(horizonColor);
  const zenith = new THREE.Color(zenithColor);

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i) / radius;
    const t = Math.pow(Math.max(0, y), exponent);
    const c = horizon.clone().lerp(zenith, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1000;

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, dispose };
}