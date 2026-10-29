import * as THREE from 'three';
import { buildTerrain, scatterOnTerrain } from '../../utils/terrainBuilder.js';
import { createInstancedPropVariants } from '../../utils/instancedProps.js';
import { createTerrainMaterial } from '../../utils/terrainMaterial.js';
import { generateRockVariants } from '../../utils/rockVariants.js';
import { createCanyonCarver } from '../../utils/canyonCarver.js';
import { createMapModule } from '../types.js';

const ARENA_SIZE = 800;
const ROCK_BASE_RADIUS = 1; // matches generateRockVariants' IcosahedronGeometry(1, detail)

const CANYON_CARVE_PARAMS = {
  seed: 777,
  centerX: 180,        // chasm centered east of spawn (0,0) so takeoff area stays flat
  meanderScale: 0.0015,
  meanderAmplitude: 80,
  width: 100,
  widthVariance: 30,
  depth: 75,            // how deep the drop is
  wallSoftness: 20,
  floorNoiseAmplitude: 4,
};

function generateTerrain(scene) {
  const material = createTerrainMaterial('rock', { seed: 4242, repeat: 28, roughnessBase: 1.0 });
  const carver = createCanyonCarver(CANYON_CARVE_PARAMS);

  const { mesh, getHeightAt, noise2D } = buildTerrain({
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    segments: 240,
    seed: 4242,
    heightParams: {
      scale: 0.004,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.2,
      amplitude: 6,
      offset: 0,
    },
    material,
    carve: (x, z, baseHeight) => carver.carve(x, z, baseHeight),
    slopeColors: {
      flatColor: [150, 120, 80],   // sandy mesa top
      steepColor: [94, 70, 50],    // canyon wall rock
      slopeStart: 0.85,
      slopeEnd: 0.55,
      depthColor: [120, 60, 42],   // reddish canyon floor
      depthThreshold: -35,
      depthBlendRange: 20,
    },
  });

  scene.add(mesh);
  return { mesh, getHeightAt, noise2D };
}

function scatterRimRocks(carver, getHeightAt, countPerSide = 160) {
  const transforms = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < countPerSide; i++) {
      const z = (Math.random() - 0.5) * ARENA_SIZE;
      const cx = carver.getCenterlineX(z);
      const halfWidth = carver.getHalfWidth(z);
      const rimOffset = Math.random() * 25 - 5; // hugs the cliff edge, some spill over
      const x = cx + side * (halfWidth + rimOffset);
      const y = getHeightAt(x, z);
      const scale = 2 + Math.random() * 5;

      transforms.push({
        x,
        y: y + scale * ROCK_BASE_RADIUS * 0.6,
        z,
        rotationY: Math.random() * Math.PI * 2,
        scale,
      });
    }
  }
  return transforms;
}

function createButtes(scene, carver, getHeightAt) {
  const butteVariants = generateRockVariants({ count: 3, seed: 555, detail: 2, jaggedness: 0.5 });
  const butteMaterial = createTerrainMaterial('rock', { seed: 321, repeat: 3, roughnessBase: 0.95 });

  const butteSpots = [
    { z: -260 }, { z: -90 }, { z: 110 }, { z: 270 },
  ];

  const group = new THREE.Group();
  butteSpots.forEach((spot, idx) => {
    const cx = carver.getCenterlineX(spot.z);
    const halfWidth = carver.getHalfWidth(spot.z);
    const x = cx + (Math.random() - 0.5) * halfWidth * 0.5; // stay clear of the walls
    const z = spot.z;
    const floorY = getHeightAt(x, z);

    const geo = butteVariants[idx % butteVariants.length];
    const butte = new THREE.Mesh(geo, butteMaterial);
    const height = 25 + Math.random() * 20;
    butte.scale.set(6 + Math.random() * 3, height, 6 + Math.random() * 3);
    butte.position.set(x, floorY + height * 0.5, z);
    butte.rotation.y = Math.random() * Math.PI * 2;
    butte.castShadow = true;
    butte.receiveShadow = true;
    group.add(butte);
  });

  scene.add(group);

  return {
    mesh: group,
    dispose: () => {
      butteVariants.forEach(g => g.dispose());
      butteMaterial.dispose();
    },
  };
}

function generateProps(scene, THREE_, getHeightAt, noise2D) {
  const carver = createCanyonCarver(CANYON_CARVE_PARAMS); // deterministic, re-derives identical shape

  const rockVariants = generateRockVariants({ count: 6, seed: 77, detail: 1, jaggedness: 0.4 });
  const rockMaterial = createTerrainMaterial('rock', { seed: 909, repeat: 2, roughnessBase: 1.0 });

  const densityNoise = { noise2D, scale: 0.015, threshold: -0.1 };

  // General boulders across the whole arena — thanks to getHeightAt already
  // including the carved canyon shape, these naturally land correctly on
  // the mesa, the walls, AND the canyon floor, no special-casing needed.
  const generalRaw = scatterOnTerrain({
    count: 650,
    width: ARENA_SIZE,
    depth: ARENA_SIZE,
    getHeightAt,
    minScale: 2,
    maxScale: 8,
    exclusionZones: [{ x: 0, z: 0, radius: 40 }],
    densityNoise,
  });
  const generalTransforms = generalRaw.map(t => ({
    ...t,
    y: t.y + t.scale * ROCK_BASE_RADIUS * 0.6, // embed base into terrain, not centered through it
  }));

  const rimTransforms = scatterRimRocks(carver, getHeightAt, 160);

  const allTransforms = [...generalTransforms, ...rimTransforms];

  const entries = createInstancedPropVariants({
    geometries: rockVariants,
    material: rockMaterial,
    transforms: allTransforms,
    castShadow: true,
    receiveShadow: true,
  });
  entries.forEach(entry => scene.add(entry.mesh));

  const butteEntry = createButtes(scene, carver, getHeightAt);

  return [...entries, butteEntry];
}

function generateAtmosphere() {
  return { update: () => {}, dispose: () => {} };
}

function generateHazards() {
  return [];
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
  ambienceTrackId: 'wind',
  dispose,
});