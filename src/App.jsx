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

  useEffect(() => {
    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    scene.fog = new THREE.FogExp2('#030712', 0.015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Park Environment & Landing Pads
    const gridHelper = new THREE.GridHelper(300, 60, 0x0891b2, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Neon Landing Pad
    const padGeo = new THREE.RingGeometry(2, 3, 32);
    const padMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide });
    const landingPad = new THREE.Mesh(padGeo, padMat);
    landingPad.rotation.x = -Math.PI / 2;
    landingPad.position.y = 0.01;
    scene.add(landingPad);

    // Glowing Obstacle Rings
    const rings = [];
    const ringGeo = new THREE.TorusGeometry(4, 0.2, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.9 });
    
    [
      { x: 0, y: 6, z: -30 },
      { x: 20, y: 10, z: -60 },
      { x: -20, y: 12, z: -90 },
    ].forEach(pos => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, pos.y, pos.z);
      scene.add(ring);
      rings.push(ring);
    });

    // 4. Initialize Physics with Selected Drone Profile
    const physics = new DronePhysics(selectedDrone);
    
    // 5. Dynamic 3D Drone Mesh Construction (Quad, Hex, or Octo based on config)
    const droneGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: selectedDrone.color, metalness: 0.85, roughness: 0.2 });
    
    // Central Hub
    const hubSize = selectedDrone.rotorCount > 6 ? 1.5 : 1.2;
    const hub = new THREE.Mesh(new THREE.BoxGeometry(hubSize, 0.35, hubSize), bodyMat);
    hub.castShadow = true;
    droneGroup.add(hub);

    // Procedural Arms and Rotors based on rotorCount
    const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.5 });
    const rotors = [];

    const rotorCount = selectedDrone.rotorCount || 4;
    for (let i = 0; i < rotorCount; i++) {
      const angle = (i * 2 * Math.PI) / rotorCount;
      
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3);
      droneGroup.add(arm);

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.22), bladeMat);
      rotor.position.set(Math.cos(angle) * 2.4, 0.2, Math.sin(angle) * 2.4);
      droneGroup.add(rotor);
      rotors.push(rotor);
    }

    scene.add(droneGroup);

    // 6. Keyboard Event Listeners
    const keys = {};
    const handleKeyDown = (e) => { keys[e.code] = true; };
    const handleKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 7. Animation & Physics Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1); // Prevent physics spikes on tab switch

      // Map controls
      physics.controls.throttle = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 0.6 : 0);
      physics.controls.roll = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0);
      physics.controls.pitch = (keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0);
      physics.controls.yaw = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

      // Update simulation physics
      physics.update(delta);

      // Sync drone mesh position & rotation
      droneGroup.position.copy(physics.position);
      droneGroup.rotation.copy(physics.rotation);

      // Spin rotors dynamically based on throttle & mass
      const spinSpeed = 25 + (physics.controls.throttle + 1) * 35;
      rotors.forEach((rotor, i) => {
        rotor.rotation.y += spinSpeed * delta * (i % 2 === 0 ? 1 : -1);
      });

      // Smooth cinematic chase camera
      const targetCameraOffset = new THREE.Vector3(0, 4.5, -9).applyEuler(new THREE.Euler(0, physics.rotation.y, 0));
      camera.position.lerp(physics.position.clone().add(targetCameraOffset), delta * 5);
      
      const lookTarget = physics.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      camera.lookAt(lookTarget);

      // Update telemetry state
      setTelemetry({
        altitude: physics.position.y.toFixed(1),
        speed: physics.velocity.length().toFixed(1),
        throttle: Math.round(((physics.controls.throttle + 1) * 50)),
      });

      renderer.render(scene, camera);
    };

    animate();

    // Window Resize Handler
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
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Glassmorphism Mission Control HUD */}
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