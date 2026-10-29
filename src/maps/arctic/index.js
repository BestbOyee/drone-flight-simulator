import * as THREE from 'three';
import { buildTerrain, scatterOnTerrain } from '../../utils/terrainBuilder.js';
import { createInstancedProps } from '../../utils/instancedProps.js';
import { createMapModule } from '../types.js';

const ARENA_SIZE = 800;
const SPAWN_EXCLUSION = { x: 0, z: 0, radius: 35 };

function generateTerrain(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xe8f4fb,
    roughness: 0.25,
    metalness: 0.1,
  });

  const { mesh, getHeightAt } = buildTerrain({
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    segments: 180,
    seed: 9981,
    heightParams: {
      scale: 0.006,
      octaves: 4,
      persistence: 0.55,
      lacunarity: 2.1,
      amplitude: 9,    // icy ridges + crevasses, a bit sharper than canyon's rolling floor
      offset: 0,
    },
    material,
  });

  scene.add(mesh);
  return { mesh, getHeightAt };
}

function generateProps(scene, THREE_, getHeightAt) {
  const disposables = [];

  // --- Tall ice spires ---
  const spireGeo = new THREE.ConeGeometry(1.3, 1, 7); // unit height, scaled per-instance via Y
  const spireMat = new THREE.MeshStandardMaterial({
    color: '#d9f0ff',
    roughness: 0.15,
    metalness: 0.1,
    emissive: '#8ecbe8',
    emissiveIntensity: 0.15,
  });

  const spireTransforms = scatterOnTerrain({
    count: 260,
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    getHeightAt,
    minScale: 6,
    maxScale: 20, // acts as height since geometry is unit-height
    exclusionZones: [SPAWN_EXCLUSION],
  }).map(t => ({
    ...t,
    y: t.y + t.scale / 2, // lift so base sits on terrain, not centered through it
  }));

  const spires = createInstancedProps({
    geometry: spireGeo,
    material: spireMat,
    transforms: spireTransforms,
    castShadow: true,
    receiveShadow: false,
  });
  scene.add(spires.mesh);
  disposables.push({ ...spires, transforms: spireTransforms });

  // --- Ground-level ice boulders for close-range detail ---
  const boulderGeo = new THREE.IcosahedronGeometry(1, 0);
  const boulderMat = new THREE.MeshStandardMaterial({
    color: '#bcdff0',
    roughness: 0.3,
    metalness: 0.15,
  });

  const boulderTransforms = scatterOnTerrain({
    count: 180,
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    getHeightAt,
    minScale: 1.5,
    maxScale: 4,
    exclusionZones: [SPAWN_EXCLUSION],
  });

  const boulders = createInstancedProps({
    geometry: boulderGeo,
    material: boulderMat,
    transforms: boulderTransforms,
    castShadow: true,
    receiveShadow: true,
  });
  scene.add(boulders.mesh);
  disposables.push({ ...boulders, transforms: boulderTransforms });

  return disposables;
}

function generateAtmosphere() {
  // Aurora shader + ground-hugging blowing-snow layer land in Phase 5.
  // Legacy particleType: 'snow' system in App.jsx already covers falling
  // snow for this map in the meantime.
  return {
    update: () => {},
    dispose: () => {},
  };
}

function generateHazards() {
  return []; // no environmental hazards on arctic (yet)
}

function dispose(scene, built) {
  if (built?.terrain?.mesh) {
    scene.remove(built.terrain.mesh);
    built.terrain.mesh.geometry.dispose();
    built.terrain.mesh.material.dispose();
  }
  if (built?.props) {
    built.props.forEach(entry => {
      scene.remove(entry.mesh);
      entry.dispose();
    });
  }
}

export default createMapModule({
  generateTerrain,
  generateProps,
  generateAtmosphere,
  generateHazards,
  ambienceTrackId: 'arctic-wind',
  dispose,
});