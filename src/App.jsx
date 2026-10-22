import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRONES } from './config/dronesConfig';
import { DronePhysics } from './physics/DronePhysics';
import HUD from './components/HUD';

export default function App() {
  const containerRef = useRef(null);
  const [selectedDrone, setSelectedDrone] = useState(DRONES[0]);
  const [telemetry, setTelemetry] = useState({ altitude: '0.0', speed: '0.0', throttle: '0' });
  const [flightMode, setFlightMode] = useState('STABILIZE');
  
  // Camera Perspective State ('CHASE' or 'FPV')
  const [cameraMode, setCameraMode] = useState('CHASE');
  const cameraModeRef = useRef('CHASE');
  cameraModeRef.current = cameraMode;

  useEffect(() => {
    // 1. Scene, Camera, Renderer Setup (Sky Blue Background & Atmosphere)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#87ceeb');
    scene.fog = new THREE.FogExp2('#87ceeb', 0.008);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Realistic Outdoor Lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemisphereLight.position.set(0, 50, 0);
    scene.add(hemisphereLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(40, 80, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Park Environment (Lush Green Grass & Landing Pad)
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: '#2e7d32', 
      roughness: 0.8,
      metalness: 0.1 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Neon Landing Pad at Center
    const padGeo = new THREE.RingGeometry(2, 3, 32);
    const padMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide });
    const landingPad = new THREE.Mesh(padGeo, padMat);
    landingPad.rotation.x = -Math.PI / 2;
    landingPad.position.y = 0.02;
    scene.add(landingPad);

    // 4. Procedural Low-Poly Trees Scatter
    const treeTrunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033' });
    const treeLeavesGeo = new THREE.ConeGeometry(2.5, 6, 6);
    const treeLeavesMat = new THREE.MeshStandardMaterial({ color: '#1b5e20', roughness: 0.9 });

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

    // 5. Initialize Physics with Selected Drone Profile
    const physics = new DronePhysics(selectedDrone);
    
    // 6. Dynamic 3D Drone Mesh Construction (Perfected Rectangular & Multi-Rotor Layouts)
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
      motorOffsets.push(
        { x: -1.6, z: -1.0 },
        { x:  1.6, z: -1.0 },
        { x:  1.6, z:  1.0 },
        { x: -1.6, z:  1.0 }
      );
    } else if (rotorCount === 6) {
      motorOffsets.push(
        { x: -1.7, z: -1.0 },
        { x:  1.7, z: -1.0 },
        { x:  2.1, z:  0.0 },
        { x:  1.7, z:  1.0 },
        { x: -1.7, z:  1.0 },
        { x: -2.1, z:  0.0 }
      );
    } else if (rotorCount === 8) {
      motorOffsets.push(
        { x: -1.8, z: -1.0 },
        { x: -0.8, z: -1.2 },
        { x:  0.8, z: -1.2 },
        { x:  1.8, z: -1.0 },
        { x:  2.2, z:  0.0 },
        { x:  1.8, z:  1.0 },
        { x: -1.8, z:  1.0 },
        { x: -2.2, z:  0.0 }
      );
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

    // 7. Keyboard Event Listeners (Including 'C' key for Camera FPV Toggle)
    const keys = {};
    const handleKeyDown = (e) => { 
      keys[e.code] = true; 
      if (e.code === 'KeyC') {
        setCameraMode((prev) => (prev === 'CHASE' ? 'FPV' : 'CHASE'));
      }
    };
    const handleKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 8. Animation & Physics Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      physics.update(delta, keys);

      droneGroup.position.copy(physics.position);
      droneGroup.rotation.copy(physics.rotation);

      // Stop propellers completely at 0 throttle, spin dynamically otherwise
      const spinSpeed = physics.throttle === 0 ? 0 : 20 + physics.throttle * 60;
      rotors.forEach((rotor, i) => {
        rotor.rotation.y += spinSpeed * delta * (i % 2 === 0 ? 1 : -1);
      });

      // Camera Positioning (Chase vs FPV Cockpit)
      if (cameraModeRef.current === 'CHASE') {
        const targetCameraOffset = new THREE.Vector3(0, 4.5, -9).applyEuler(new THREE.Euler(0, physics.rotation.y, 0));
        camera.position.lerp(physics.position.clone().add(targetCameraOffset), delta * 5);
        
        const lookTarget = physics.position.clone().add(new THREE.Vector3(0, 0.8, 0));
        camera.lookAt(lookTarget);
      } else {
        const fpvOffset = new THREE.Vector3(0, 0.4, 0.4).applyEuler(physics.rotation);
        camera.position.copy(physics.position).add(fpvOffset);

        const lookAhead = new THREE.Vector3(0, 0.4, 10).applyEuler(physics.rotation);
        camera.lookAt(physics.position.clone().add(lookAhead));
      }

      setTelemetry({
        altitude: physics.position.y.toFixed(1),
        speed: physics.velocity.length().toFixed(1),
        throttle: Math.round(physics.throttle * 100),
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
  }, [selectedDrone]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-950 font-sans select-none">
      <div ref={containerRef} className="absolute inset-0" />
      <HUD
        telemetry={telemetry}
        selectedDrone={selectedDrone}
        onSelectDrone={setSelectedDrone}
        flightMode={flightMode}
        setFlightMode={setFlightMode}
      />
    </div>
  );
}