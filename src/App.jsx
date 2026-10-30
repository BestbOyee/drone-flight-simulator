import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { DRONES } from './config/dronesConfig';
import { MAPS } from './config/mapsConfig';
import { DronePhysics } from './physics/DronePhysics';
import { ProbeManager } from './physics/ProbeManager';
import { CombatManager } from './physics/CombatManager';
import { generatePBRTexture } from './utils/pbrTextures';
import EngineSound from './audio/EngineSound';
import HUD from './components/HUD';
import mapModules from './maps/registry.js';   
import { buildSkyDome } from './utils/skyDome';

// ============================================================
// BIOME SCENERY GENERATORS
// Each function populates `scene` with props specific to a map theme.
// ============================================================

function generateTrees(scene) {
  const treeTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const treeLeavesGeo = new THREE.ConeGeometry(2.5, 6, 6);
  const treeLeavesMat = new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.8 });

  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
    trunk.position.y = 1.5;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leaves = new THREE.Mesh(treeLeavesGeo, treeLeavesMat);
    leaves.position.y = 4.5;
    leaves.castShadow = true;
    treeGroup.add(leaves);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
  }
}

function generateCyberBuildings(scene, hasRooftopPads) {
  const buildingMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.8 });
  const padMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide });

  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;

    const height = 20 + Math.random() * 40;
    const bld = new THREE.Mesh(new THREE.BoxGeometry(10, height, 10), buildingMat);
    bld.position.set(x, height / 2, z);
    bld.castShadow = true;
    scene.add(bld);

    if (hasRooftopPads && Math.random() > 0.6) {
      const pad = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 24), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, height + 0.05, z);
      scene.add(pad);
    }
  }
}

function generateCanyonWalls(scene) {
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8a6240', roughness: 0.95, metalness: 0.0 });

  for (let side = -1; side <= 1; side += 2) {
    for (let z = -150; z <= 150; z += 25) {
      const offset = 45 + Math.random() * 25;
      const height = 25 + Math.random() * 35;
      const width = 15 + Math.random() * 10;
      const rock = new THREE.Mesh(new THREE.BoxGeometry(width, height, 20), rockMat);
      rock.position.set(side * offset, height / 2 - 2, z + (Math.random() - 0.5) * 10);
      rock.rotation.y = Math.random() * 0.3;
      rock.castShadow = true;
      scene.add(rock);
    }
  }
}

function generateIceSpires(scene) {
  const iceMat = new THREE.MeshStandardMaterial({
    color: '#d9f0ff',
    roughness: 0.15,
    metalness: 0.1,
    emissive: '#8ecbe8',
    emissiveIntensity: 0.15
  });

  for (let i = 0; i < 35; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const height = 6 + Math.random() * 14;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2 + Math.random(), height, 7), iceMat);
    spire.position.set(x, height / 2, z);
    spire.rotation.y = Math.random() * Math.PI;
    spire.castShadow = true;
    scene.add(spire);
  }
}

function generateObsidianRocks(scene) {
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#14110f',
    roughness: 0.3,
    metalness: 0.4,
    emissive: '#5c1a0a',
    emissiveIntensity: 0.1
  });

  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const scale = 2 + Math.random() * 4;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 0), rockMat);
    rock.position.set(x, scale * 0.4, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }
}

// Returns hazard zone descriptors {x, z, radius} consumed by CombatManager for lava damage
function generateLavaRivers(scene, hazardZones) {
  const lavaMat = new THREE.MeshStandardMaterial({
    color: '#ff5722',
    emissive: '#ff3300',
    emissiveIntensity: 1.2,
    roughness: 0.4
  });

  const riverSpots = [
    { x: 30, z: -40, radius: 14 },
    { x: -50, z: -90, radius: 18 },
    { x: 10, z: -140, radius: 12 }
  ];

  riverSpots.forEach((spot) => {
    const lava = new THREE.Mesh(new THREE.CircleGeometry(spot.radius, 24), lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(spot.x, 0.06, spot.z);
    scene.add(lava);
    hazardZones.push(spot);
  });
}

function generateStationModules(scene) {
  const metalMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.8 });

  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * 280;
    const z = (Math.random() - 0.5) * 280;
    if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

    const y = 10 + Math.random() * 60;
    const moduleGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 10, 8), metalMat);
    body.rotation.z = Math.PI / 2;
    moduleGroup.add(body);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.3, 8, 16), glowMat);
    ring.rotation.y = Math.PI / 2;
    moduleGroup.add(ring);

    moduleGroup.position.set(x, y, z);
    moduleGroup.rotation.y = Math.random() * Math.PI;
    scene.add(moduleGroup);
  }
}

function generateFloodedBuildings(scene) {
  const buildingMat = new THREE.MeshStandardMaterial({ color: '#2d3f4a', roughness: 0.6, metalness: 0.2 });

  for (let i = 0; i < 35; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const height = 8 + Math.random() * 22;
    const bld = new THREE.Mesh(new THREE.BoxGeometry(9, height, 9), buildingMat);
    bld.position.set(x, height / 2 - 2, z);
    bld.castShadow = true;
    scene.add(bld);
  }
}

function generateDuneRocks(scene) {
  const duneMat = new THREE.MeshStandardMaterial({ color: '#a9825a', roughness: 1.0, metalness: 0.0 });

  for (let i = 0; i < 25; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const radius = 3 + Math.random() * 5;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6), duneMat);
    dune.scale.y = 0.3;
    dune.position.set(x, radius * 0.15, z);
    dune.castShadow = true;
    scene.add(dune);
  }
}

function generateGlowingJungle(scene) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.9 });
  const glowLeafMat = new THREE.MeshStandardMaterial({
    color: '#0d9488',
    emissive: '#5eead4',
    emissiveIntensity: 0.9,
    roughness: 0.6
  });

  for (let i = 0; i < 45; i++) {
    const x = (Math.random() - 0.5) * 300;
    const z = (Math.random() - 0.5) * 300;
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;

    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 4, 6), trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), glowLeafMat);
    leaves.position.y = 5;
    treeGroup.add(leaves);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
  }
}

export default function App() {
  const containerRef = useRef(null);
  const [selectedDrone, setSelectedDrone] = useState(DRONES[0]);
  const [selectedMap, setSelectedMap] = useState(MAPS[0]);
  const [telemetry, setTelemetry] = useState({ altitude: '0.0', speed: '0.0', throttle: '0', heading: 0, position: { x: 0, z: 0 }, rotationY: 0 });
  const [flightMode, setFlightMode] = useState('STABILIZE');
  const flightModeRef = useRef('STABILIZE');
  flightModeRef.current = flightMode;

  const [combatState, setCombatState] = useState({
    health: 100,
    maxHealth: 100,
    kills: 0,
    score: 0,
    isDead: false,
    respawnCountdown: 0,
    hitMarker: false,
    playerDamageFlash: false,
    radarEnemies: []
  });

  const [cameraMode, setCameraMode] = useState('CHASE');
  const cameraModeRef = useRef('CHASE');
  cameraModeRef.current = cameraMode;

  const engineSoundRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);

  const initAudio = useCallback(async () => {
    if (engineSoundRef.current) {
      await engineSoundRef.current.resume();
      return;
    }
    const engine = new EngineSound({ rotorCount: selectedDrone.rotorCount || 4 });
    await engine.init();
    engine.setMasterVolume(volume);
    engineSoundRef.current = engine;
    setAudioEnabled(true);
  }, [selectedDrone, volume]);

  useEffect(() => {
    const unlock = () => {
      initAudio();
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', unlock);
    return () => {
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };
  }, [initAudio]);

  useEffect(() => {
    return () => {
      engineSoundRef.current?.dispose();
      engineSoundRef.current = null;
    };
  }, []);

  const handleVolumeChange = (v) => {
    setVolume(v);
    engineSoundRef.current?.setMasterVolume(v);
  };

  const handleToggleMute = () => {
    const next = engineSoundRef.current?.toggleMuted();
    setMuted(!!next);
  };

  useEffect(() => {
    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(selectedMap.fogColor, selectedMap.fogDensity);
    const skyDome = buildSkyDome({
      horizonColor: selectedMap.fogColor,
      zenithColor: selectedMap.skyColor,
    });
    scene.add(skyDome.mesh);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, selectedMap.ambientLight);
    hemisphereLight.position.set(0, 50, 0);
    scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(selectedMap.dirLightColor, 1.8);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

        // 3. Ground
        const activeMapModule = mapModules[selectedMap.id] || null; // MOVED UP from section 4
        let groundGetHeightAt = () => 0;
        let groundNoise2D = () => 0;
        let terrainResult = null;
    
        if (activeMapModule) {
          terrainResult = activeMapModule.generateTerrain(scene, THREE);
          groundGetHeightAt = terrainResult.getHeightAt;
          groundNoise2D = terrainResult.noise2D || groundNoise2D;
        } else {
          // Legacy flat ground path (unmigrated maps only)
          const groundGeo = new THREE.PlaneGeometry(400, 400, 128, 128);
          const { albedoMap, normalMap } = generatePBRTexture(selectedMap.id);
    
          const groundMat = new THREE.MeshStandardMaterial({
            color: selectedMap.groundColor,
            map: albedoMap,
            normalMap: normalMap,
            normalScale: new THREE.Vector2(0.8, 0.8),
            roughness: selectedMap.groundRoughness,
            metalness: selectedMap.groundMetalness
          });
    
          const ground = new THREE.Mesh(groundGeo, groundMat);
          ground.rotation.x = -Math.PI / 2;
          ground.receiveShadow = true;
          scene.add(ground);
        }
    
        // Landing Pad Beacon (now sits at correct terrain height instead of hardcoded y=0)
        const padGroundY = groundGetHeightAt(0, 0);
        const padGeo = new THREE.RingGeometry(2, 3, 32);
        const padMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide });
        const landingPad = new THREE.Mesh(padGeo, padMat);
        landingPad.rotation.x = -Math.PI / 2;
        landingPad.position.y = padGroundY + 0.02;
        scene.add(landingPad);
    
        const beaconGeo = new THREE.CylinderGeometry(0.2, 3.5, 120, 16, 1, true);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, padGroundY + 60, 0);
        scene.add(beacon);

      
    // 4. Biome-Specific Scenery Generation
    const hazardZones = [];
    let activeMapBuilt = null;          // holds terrain/props/atmosphere for any migrated map

    if (activeMapModule) {
      // Terrain already built in section 3 above — just add props/atmosphere/hazards
      const propsResult = activeMapModule.generateProps(scene, THREE, groundGetHeightAt, groundNoise2D);
      const atmosphere = activeMapModule.generateAtmosphere(scene, THREE);
      const moduleHazards = activeMapModule.generateHazards(scene, THREE);
      moduleHazards.forEach(z => hazardZones.push(z));

      activeMapBuilt = {
        terrain: terrainResult,
        props: propsResult.entries,
        colliders: propsResult.colliders || [],
        atmosphere,
      };
    } else if (selectedMap.propType === 'trees') {
      generateTrees(scene);
    } else if (selectedMap.propType === 'cyberBuildings') {
      generateCyberBuildings(scene, selectedMap.hasRooftopPads);
    } else if (selectedMap.propType === 'canyonWalls') {
      generateCanyonWalls(scene);
    } else if (selectedMap.propType === 'iceSpires') {
      generateIceSpires(scene);
    } else if (selectedMap.propType === 'obsidianRocks') {
      generateObsidianRocks(scene);
      generateLavaRivers(scene, hazardZones);
    } else if (selectedMap.propType === 'stationModules') {
      generateStationModules(scene);
    } else if (selectedMap.propType === 'floodedBuildings') {
      generateFloodedBuildings(scene);
    } else if (selectedMap.propType === 'duneRocks') {
      generateDuneRocks(scene);
    } else if (selectedMap.propType === 'glowingJungle') {
      generateGlowingJungle(scene);
    }

    if (selectedMap.hasWater) {
      const waterGeo = new THREE.PlaneGeometry(400, 400);
      const waterMat = new THREE.MeshStandardMaterial({
        color: '#0e3a4a',
        transparent: true,
        opacity: 0.75,
        roughness: 0.1,
        metalness: 0.4
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.05;
      scene.add(water);
    }

    if (selectedMap.skyboxStars) {
      const starCount = 2000;
      const starGeo = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPositions[i] = (Math.random() - 0.5) * 800;
        starPositions[i + 1] = Math.random() * 400 - 50;
        starPositions[i + 2] = (Math.random() - 0.5) * 800;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, transparent: true, opacity: 0.9 });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
    }

    // 5. Atmospheric Particle Systems (biome-specific)
    let particles = null;
    let particleGeo = null;
    let particlePhases = null;
    const particleType = selectedMap.particleType;

    if (particleType === 'snow' || particleType === 'rain' || particleType === 'embers') {
      const count = particleType === 'rain' ? 1200 : 800;
      particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = Math.random() * 50;
        positions[i + 2] = (Math.random() - 0.5) * 200;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleColor = particleType === 'embers' ? '#ff8844' : (particleType === 'rain' ? '#a8c8d8' : '#ffffff');
      const particleSize = particleType === 'rain' ? 0.35 : (particleType === 'embers' ? 0.5 : 0.7);

      const particleMat = new THREE.PointsMaterial({
        color: particleColor,
        size: particleSize,
        transparent: true,
        opacity: particleType === 'rain' ? 0.6 : 0.85,
        blending: THREE.AdditiveBlending
      });

      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);
    } else if (particleType === 'fireflies') {
      const count = 250;
      particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      particlePhases = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = 1 + Math.random() * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        particlePhases[i] = Math.random() * Math.PI * 2;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const particleMat = new THREE.PointsMaterial({
        color: '#5eead4',
        size: 0.6,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });

      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);
    }

    // 6. High-Altitude Cloud Layer
    const cloudCount = 700;
    const cloudGeo = new THREE.BufferGeometry();
    const cloudPositions = new Float32Array(cloudCount * 3);

    for (let i = 0; i < cloudCount * 3; i += 3) {
      cloudPositions[i] = (Math.random() - 0.5) * 380;
      cloudPositions[i + 1] = 35 + Math.random() * 55;
      cloudPositions[i + 2] = (Math.random() - 0.5) * 380;
    }

    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
    const cloudMat = new THREE.PointsMaterial({
      color: '#f8fafc',
      size: 4.5,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const cloudPoints = new THREE.Points(cloudGeo, cloudMat);
    scene.add(cloudPoints);

    // 7. Storm Lightning System
    let lightningLight = null;
    let lightningTimer = 2 + Math.random() * 3;

    if (selectedMap.lightningEnabled) {
      lightningLight = new THREE.PointLight(0xffffff, 0, 400, 2);
      lightningLight.position.set(0, 150, 0);
      scene.add(lightningLight);
    }

    // 8. Physics, Probe & Combat Manager Systems
    const physics = new DronePhysics(selectedDrone);
    physics.gravityScale = selectedMap.gravityScale ?? 1.0;
    physics.getGroundHeight = groundGetHeightAt;
    physics.arenaRadius = activeMapModule ? 390 : 190;
    physics.propColliders = activeMapBuilt?.colliders || [];
    const probeManager = new ProbeManager(scene, {
      onImpact: (impactSpeed) => {
        engineSoundRef.current?.playImpact(impactSpeed);
      }
    });
    const combatManager = new CombatManager(scene, engineSoundRef.current, { hazardZones });

    // 9. Dynamic Drone Mesh Construction
    const droneGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: selectedDrone.color, metalness: 0.85, roughness: 0.2 });

    const hubWidth = selectedDrone.rotorCount > 6 ? 2.0 : (selectedDrone.rotorCount > 4 ? 1.6 : 1.8);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(hubWidth, 0.35, 1.0), bodyMat);
    hub.castShadow = true;
    droneGroup.add(hub);

    const bladeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.5 });
    const rotors = [];
    const rotorCount = selectedDrone.rotorCount || 4;
    const motorOffsets = [];

    if (rotorCount === 4) {
      motorOffsets.push({ x: -1.6, z: -1.0 }, { x: 1.6, z: -1.0 }, { x: 1.6, z: 1.0 }, { x: -1.6, z: 1.0 });
    } else if (rotorCount === 6) {
      motorOffsets.push({ x: -1.7, z: -1.0 }, { x: 1.7, z: -1.0 }, { x: 2.1, z: 0.0 }, { x: 1.7, z: 1.0 }, { x: -1.7, z: 1.0 }, { x: -2.1, z: 0.0 });
    } else if (rotorCount === 8) {
      motorOffsets.push({ x: -1.8, z: -1.0 }, { x: -0.8, z: -1.2 }, { x: 0.8, z: -1.2 }, { x: 1.8, z: -1.0 }, { x: 2.2, z: 0.0 }, { x: 1.8, z: 1.0 }, { x: -1.8, z: 1.0 }, { x: -2.2, z: 0.0 });
    }

    motorOffsets.forEach((pos) => {
      const dist = Math.hypot(pos.x, pos.z);
      const angle = Math.atan2(pos.x, pos.z);

      const armGeo = new THREE.CylinderGeometry(0.06, 0.06, dist, 8);
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.position.set(pos.x / 2, 0, pos.z / 2);
      arm.rotation.x = Math.PI / 2;
      arm.rotation.z = -angle;
      droneGroup.add(arm);

      const motorMountGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12);
      const motorMount = new THREE.Mesh(motorMountGeo, bodyMat);
      motorMount.position.set(pos.x, 0.05, pos.z);
      droneGroup.add(motorMount);

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(rotorCount > 6 ? 1.2 : 1.6, 0.04, 0.22), bladeMat);
      rotor.position.set(pos.x, 0.18, pos.z);
      droneGroup.add(rotor);
      rotors.push(rotor);
    });

    scene.add(droneGroup);

    // 10. Input Listeners
    const keys = {};
    const handleKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === 'KeyC') {
        setCameraMode((prev) => (prev === 'CHASE' ? 'FPV' : 'CHASE'));
      }
      if (e.code === 'Space') {
        combatManager.firePlayerLaser(physics.position, physics.rotation, physics.velocity);
      }
      if (e.code === 'KeyE') {
        probeManager.ejectProbe(physics.position, physics.velocity, physics.rotation, 18);
      }
    };
    const handleKeyUp = (e) => { keys[e.code] = false; };
    const handleMouseDown = (e) => {
      if (e.button === 0) {
        combatManager.firePlayerLaser(physics.position, physics.rotation, physics.velocity);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);

        // 11. Animation & Physics Loop
        let animationFrameId;
        const clock = new THREE.Clock();
    
        // Camera spring-damper + FOV-on-speed state
        const cameraVelocity = new THREE.Vector3();
        const BASE_FOV = 60;
        const MAX_FOV = 92;
        const FOV_SPEED_FACTOR = 0.6;
        const CAMERA_SPRING_STIFFNESS = 60;
        const CAMERA_SPRING_DAMPING = 12;
        let currentFov = BASE_FOV;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      combatManager.soundEngine = engineSoundRef.current;
      if (!combatManager.isPlayerDead) {
        physics.update(delta, keys);
      }
      probeManager.update(delta);
      const combatEvents = combatManager.update(delta, physics);

      droneGroup.visible = !combatManager.isPlayerDead;
      droneGroup.position.copy(physics.position);
      droneGroup.rotation.copy(physics.rotation);

      const spinSpeed = physics.throttle === 0 ? 0 : 20 + physics.throttle * 60;
      rotors.forEach((rotor, i) => {
        rotor.rotation.y += spinSpeed * delta * (i % 2 === 0 ? 1 : -1);
      });

      if (engineSoundRef.current?.ready) {
        const droneSpeed = combatManager.isPlayerDead ? 0 : physics.velocity.length();
        const droneThrottle = combatManager.isPlayerDead ? 0 : physics.throttle;
        engineSoundRef.current.update(droneThrottle, droneSpeed);
      }
      if (activeMapBuilt) {
        activeMapBuilt.atmosphere.update(delta, clock.getElapsedTime());
      }
      // Drift high-altitude clouds
      const cloudPos = cloudGeo.attributes.position.array;
      for (let i = 0; i < cloudPos.length; i += 3) {
        cloudPos[i + 2] += delta * 1.2;
        if (cloudPos[i + 2] > 200) cloudPos[i + 2] = -200;
      }
      cloudGeo.attributes.position.needsUpdate = true;

      // Animate atmospheric particles
      if (particles && particleGeo) {
        const positions = particleGeo.attributes.position.array;

        if (particleType === 'snow') {
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= delta * 4;
            if (positions[i] < 0) positions[i] = 50;
          }
        } else if (particleType === 'rain') {
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= delta * 28;
            if (positions[i] < 0) positions[i] = 50;
          }
        } else if (particleType === 'embers') {
          for (let i = 1; i < positions.length; i += 3) {
            positions[i] += delta * 3;
            if (positions[i] > 50) positions[i] = 0;
          }
        } else if (particleType === 'fireflies' && particlePhases) {
          const t = clock.getElapsedTime();
          for (let i = 0; i < particlePhases.length; i++) {
            positions[i * 3 + 1] += Math.sin(t * 1.5 + particlePhases[i]) * delta * 0.3;
          }
        }

        particleGeo.attributes.position.needsUpdate = true;
      }

      // Lightning flashes (Storm Front)
      if (selectedMap.lightningEnabled && lightningLight) {
        lightningTimer -= delta;
        if (lightningTimer <= 0) {
          lightningLight.intensity = 5 + Math.random() * 4;
          engineSoundRef.current?.playThunder();
          lightningTimer = 3 + Math.random() * 7;
        } else {
          lightningLight.intensity = THREE.MathUtils.lerp(lightningLight.intensity, 0, delta * 5);
        }
      }

      // Pulsing fog density (Desert Dust Storm)
      if (selectedMap.fogPulse && scene.fog) {
        const t = clock.getElapsedTime();
        scene.fog.density = selectedMap.fogDensity + Math.sin(t * 0.3) * (selectedMap.fogDensity * 0.4);
      }

            // Camera Positioning (Chase vs FPV)
            if (cameraModeRef.current === 'CHASE') {
              const targetCameraOffset = new THREE.Vector3(0, 4.5, -9).applyEuler(new THREE.Euler(0, physics.rotation.y, 0));
              const targetCameraPos = physics.position.clone().add(targetCameraOffset);
      
              const springForce = targetCameraPos.clone().sub(camera.position).multiplyScalar(CAMERA_SPRING_STIFFNESS);
              const dampingForce = cameraVelocity.clone().multiplyScalar(-CAMERA_SPRING_DAMPING);
              const cameraAccel = springForce.add(dampingForce);
      
              cameraVelocity.addScaledVector(cameraAccel, delta);
              camera.position.addScaledVector(cameraVelocity, delta);
      
              camera.lookAt(physics.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
            } else {
              const fpvOffset = new THREE.Vector3(0, 0.4, 0.4).applyEuler(physics.rotation);
              camera.position.copy(physics.position).add(fpvOffset);
              camera.lookAt(physics.position.clone().add(new THREE.Vector3(0, 0.4, 10).applyEuler(physics.rotation)));
              cameraVelocity.set(0, 0, 0); // prevent spring overshoot/snap when switching back to CHASE
            }
      
            // FOV-on-speed
            const droneSpeedForFov = physics.velocity.length();
            const targetFov = THREE.MathUtils.clamp(BASE_FOV + droneSpeedForFov * FOV_SPEED_FACTOR, BASE_FOV, MAX_FOV);
            currentFov = THREE.MathUtils.lerp(currentFov, targetFov, delta * 3);
            if (Math.abs(camera.fov - currentFov) > 0.05) {
              camera.fov = currentFov;
              camera.updateProjectionMatrix();
            }
      let headingDeg = Math.round((-physics.rotation.y * (180 / Math.PI)) % 360);
      if (headingDeg < 0) headingDeg += 360;

      setTelemetry({
        altitude: physics.position.y.toFixed(1),
        speed: physics.velocity.length().toFixed(1),
        throttle: Math.round(physics.throttle * 100),
        heading: headingDeg,
        position: { x: physics.position.x, z: physics.position.z },
        rotationY: physics.rotation.y
      });

      setCombatState({
        health: combatManager.playerHealth,
        maxHealth: combatManager.playerMaxHealth,
        kills: combatManager.kills,
        score: combatManager.score,
        isDead: combatManager.isPlayerDead,
        respawnCountdown: combatEvents.respawnCountdown,
        hitMarker: combatEvents.hitRegistered,
        playerDamageFlash: combatEvents.playerHitRegistered || combatEvents.hazardHit,
        radarEnemies: combatManager.getRadarEnemies()
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      combatManager.dispose();

      // Clean up map module if one was loaded
      if (activeMapBuilt && activeMapModule) {
        activeMapModule.dispose(scene, activeMapBuilt);
      }

      // Clean up procedural sky dome
      if (skyDome) {
        skyDome.dispose();
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [selectedDrone, selectedMap]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 font-sans select-none">
      <div ref={containerRef} className="absolute inset-0" />
      <HUD
        telemetry={telemetry}
        combatState={combatState}
        selectedDrone={selectedDrone}
        onSelectDrone={setSelectedDrone}
        selectedMap={selectedMap}
        onSelectMap={setSelectedMap}
        flightMode={flightMode}
        setFlightMode={setFlightMode}
        audioEnabled={audioEnabled}
        volume={volume}
        muted={muted}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}