import * as THREE from 'three';
import { buildTerrain, scatterOnTerrain } from '../../utils/terrainBuilder.js';
import { createInstancedProps } from '../../utils/instancedProps.js';
import { createMapModule } from '../types.js';

const ARENA_SIZE = 800;
const SPAWN_EXCLUSION = { x: 0, z: 0, radius: 35 };

function generateTerrain(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xc9a06a,
    roughness: 1.0,
    metalness: 0.0,
  });

  const { mesh, getHeightAt } = buildTerrain({
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    segments: 180,
    seed: 5521,
    heightParams: {
      scale: 0.0025,     // low frequency = broad sweeping dune shapes
      octaves: 5,
      persistence: 0.45,
      lacunarity: 2.4,
      amplitude: 14,
      offset: 0,
    },
    material,
  });

  scene.add(mesh);
  return { mesh, getHeightAt };
}

function generateProps(scene, THREE_, getHeightAt) {
  const disposables = [];
  const colliders = [];

  // --- Squashed-sphere dune rocks (same look as legacy generateDuneRocks, now instanced + terrain-aware) ---
  const duneRockGeo = new THREE.SphereGeometry(1, 10, 6);
  duneRockGeo.scale(1, 0.3, 1); // bake the flattening into the base geometry so instancing scale stays uniform
  const duneRockMat = new THREE.MeshStandardMaterial({
    color: '#a9825a',
    roughness: 1.0,
    metalness: 0.0,
  });

  const rockTransforms = scatterOnTerrain({
    count: 240,
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    getHeightAt,
    minScale: 2.5,
    maxScale: 6,
    exclusionZones: [SPAWN_EXCLUSION],
  });

  rockTransforms.forEach(t => {
    colliders.push({ x: t.x, y: t.y, z: t.z, radius: t.scale * 1.0 });
  });

  const rocks = createInstancedProps({
    geometry: duneRockGeo,
    material: duneRockMat,
    transforms: rockTransforms,
    castShadow: true,
    receiveShadow: true,
  });
  scene.add(rocks.mesh);
  disposables.push({ ...rocks, transforms: rockTransforms });

  // --- Buried ruin landmarks: a handful of unique partially-sunken structures ---
  const ruinMat = new THREE.MeshStandardMaterial({
    color: '#8c7a5e',
    roughness: 0.9,
    metalness: 0.05,
  });

  const ruinSpots = scatterOnTerrain({
    count: 6,
    width: ARENA_SIZE * 0.8,
    depth: ARENA_SIZE * 0.8,
    getHeightAt,
    minScale: 1,
    maxScale: 1,
    exclusionZones: [SPAWN_EXCLUSION],
  });

  const ruinGroup = new THREE.Group();
  ruinSpots.forEach((spot) => {
    const pillarHeight = 8 + Math.random() * 14;
    const buriedDepth = pillarHeight * (0.4 + Math.random() * 0.3); // sink a chunk into the dune
    const radiusTop = 1.5 + Math.random();
    const radiusBottom = 2 + Math.random();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, pillarHeight, 8),
      ruinMat
    );
    const pillarY = spot.y + pillarHeight / 2 - buriedDepth;
    pillar.position.set(spot.x, pillarY, spot.z);
    pillar.rotation.z = (Math.random() - 0.5) * 0.3; // slight lean, looks ancient/collapsed
    pillar.rotation.y = Math.random() * Math.PI;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    ruinGroup.add(pillar);

    const exposedHeight = pillarHeight - buriedDepth;
    colliders.push({
      x: spot.x,
      y: pillarY + buriedDepth - exposedHeight / 2 + exposedHeight / 2, // center of exposed portion
      z: spot.z,
      radius: Math.max(radiusTop, radiusBottom),
    });
  });
  scene.add(ruinGroup);

  disposables.push({
    mesh: ruinGroup,
    dispose: () => {
      ruinGroup.children.forEach(child => child.geometry.dispose());
      ruinMat.dispose();
    },
  });

  return { entries: disposables, colliders };
}

function generateAtmosphere() {
  // Sandstorm wall curtain + heat-haze shimmer + whiteout events land in Phase 5.
  // fogPulse oscillation is already handled generically in App.jsx's animate loop.
  return {
    update: () => {},
    dispose: () => {},
  };
}

function generateHazards() {
  return []; // no environmental hazards on dust (yet)
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
  ambienceTrackId: 'dust-wind',
  dispose,
});