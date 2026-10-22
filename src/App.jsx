import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRONES } from './config/dronesConfig';
import { MAPS } from './config/mapsConfig';
import { DronePhysics } from './physics/DronePhysics';
import { ProbeManager } from './physics/ProbeManager';
import { generatePBRTexture } from './utils/pbrTextures';
import HUD from './components/HUD';

export default function App() {
  const containerRef = useRef(null);
  const [selectedDrone, setSelectedDrone] = useState(DRONES[0]);
  const [selectedMap, setSelectedMap] = useState(MAPS[0]);
  const [telemetry, setTelemetry] = useState({ altitude: '0.0', speed: '0.0', throttle: '0', heading: 0, position: { x: 0, z: 0 }, rotationY: 0 });
  const [flightMode, setFlightMode] = useState('STABILIZE');
  
  const [cameraMode, setCameraMode] = useState('CHASE');
  const cameraModeRef = useRef('CHASE');
  cameraModeRef.current = cameraMode;

  useEffect(() => {
    // 1. Scene, Camera, Renderer Setup with Film Tone Mapping & Shadows
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(selectedMap.skyColor);
    scene.fog = new THREE.FogExp2(selectedMap.fogColor, 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft realistic shadows
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    
    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Outdoor Lighting Setup with Dynamic Shadows
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

    // 3. Ground Environment with Procedural PBR Textures
    const groundGeo = new THREE.PlaneGeometry(400, 400, 128, 128);
    const { albedoMap, normalMap } = generatePBRTexture(selectedMap.id);

    const groundMat = new THREE.MeshStandardMaterial({ 
      color: selectedMap.groundColor, 
      map: albedoMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: selectedMap.id === 'cyber' ? 0.2 : 0.85,
      metalness: selectedMap.id === 'cyber' ? 0.6 : 0.05
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Dynamic Landing Pad Beacon
    const padGeo = new THREE.RingGeometry(2, 3, 32);
    const padMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide });
    const landingPad = new THREE.Mesh(padGeo, padMat);
    landingPad.rotation.x = -Math.PI / 2;
    landingPad.position.y = 0.02;
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
    beacon.position.set(0, 60, 0);
    scene.add(beacon);

    // 4. Conditional Scenery Props
    if (selectedMap.hasTrees) {
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
    } else if (selectedMap.id === 'cyber') {
      const buildingMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.8 });
      for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;

        const height = 20 + Math.random() * 40;
        const bldGeo = new THREE.BoxGeometry(10, height, 10);
        const bld = new THREE.Mesh(bldGeo, buildingMat);
        bld.position.set(x, height / 2, z);
        bld.castShadow = true;
        scene.add(bld);
      }
    }

    // 5. Dynamic Snow Particles (Rendered ONLY in Verdant Park)
    let particles = null;
    let particleGeo = null;

    if (selectedMap.particleType === 'snow') {
      const particleCount = 800;
      particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        particlePositions[i] = (Math.random() - 0.5) * 200;
        particlePositions[i + 1] = Math.random() * 50;
        particlePositions[i + 2] = (Math.random() - 0.5) * 200;
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      
      const particleMat = new THREE.PointsMaterial({
        color: '#ffffff',
        size: 0.7,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });

      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);
    }

    // Glowing Obstacle Rings
    const ringGeo = new THREE.TorusGeometry(4, 0.25, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.8 });
    
    [
      { x: 0, y: 8, z: -35 },
      { x: 25, y: 12, z: -70 },
      { x: -25, y: 15, z: -105 },
    ].forEach(pos => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, pos.y, pos.z);
      scene.add(ring);
    });

    // 6. Physics & Probe Ejector System Initialization
    const physics = new DronePhysics(selectedDrone);
    const probeManager = new ProbeManager(scene);
    
    // 7. Dynamic Drone Mesh Construction
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

    // 8. Key Listeners (Camera Toggle & Spacebar Probe Launch)
    const keys = {};
    const handleKeyDown = (e) => { 
      keys[e.code] = true; 
      if (e.code === 'KeyC') {
        setCameraMode((prev) => (prev === 'CHASE' ? 'FPV' : 'CHASE'));
      }
      if (e.code === 'Space') {
        // Launch sensor probe with current drone position, vector momentum, and heading
        probeManager.ejectProbe(physics.position, physics.velocity, physics.rotation, 18);
      }
    };
    const handleKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 9. Animation & Physics Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      // Physics Integration
      physics.update(delta, keys);
      probeManager.update(delta);

      droneGroup.position.copy(physics.position);
      droneGroup.rotation.copy(physics.rotation);

      // Rotor spinning animation
      const spinSpeed = physics.throttle === 0 ? 0 : 20 + physics.throttle * 60;
      rotors.forEach((rotor, i) => {
        rotor.rotation.y += spinSpeed * delta * (i % 2 === 0 ? 1 : -1);
      });

      // Animate snowfall (only active in Verdant Park)
      if (particles && particleGeo) {
        const positions = particleGeo.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= delta * 4;
          if (positions[i] < 0) positions[i] = 50;
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      // Dynamic Camera Positioning (Chase vs FPV)
      if (cameraModeRef.current === 'CHASE') {
        const targetCameraOffset = new THREE.Vector3(0, 4.5, -9).applyEuler(new THREE.Euler(0, physics.rotation.y, 0));
        camera.position.lerp(physics.position.clone().add(targetCameraOffset), delta * 5);
        camera.lookAt(physics.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      } else {
        const fpvOffset = new THREE.Vector3(0, 0.4, 0.4).applyEuler(physics.rotation);
        camera.position.copy(physics.position).add(fpvOffset);
        camera.lookAt(physics.position.clone().add(new THREE.Vector3(0, 0.4, 10).applyEuler(physics.rotation)));
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
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
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
        selectedDrone={selectedDrone}
        onSelectDrone={setSelectedDrone}
        selectedMap={selectedMap}
        onSelectMap={setSelectedMap}
        flightMode={flightMode}
        setFlightMode={setFlightMode}
      />
    </div>
  );
}