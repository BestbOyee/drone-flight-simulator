import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRONES } from './config/dronesConfig';
import { DronePhysics } from './physics/DronePhysics';

export default function App() {
  const containerRef = useRef(null);
  const [selectedDrone, setSelectedDrone] = useState(DRONES[0]);
  const [telemetry, setTelemetry] = useState({ altitude: 0, speed: 0, throttle: 0 });

  useEffect(() => {
    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    scene.fog = new THREE.FogExp2('#030712', 0.02);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    
    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 3. Park Environment (Ground & Obstacle Rings)
    const gridHelper = new THREE.GridHelper(200, 50, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#0b0f19', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add some glowing obstacle rings in the park
    const rings = [];
    const ringGeo = new THREE.TorusGeometry(4, 0.2, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.8 });
    
    [
      { x: 0, y: 5, z: -25 },
      { x: 15, y: 8, z: -50 },
      { x: -15, y: 10, z: -75 },
    ].forEach(pos => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(pos.x, pos.y, pos.z);
      scene.add(ring);
      rings.push(ring);
    });

    // 4. Drone Physics & 3D Mesh Construction
    const physics = new DronePhysics(selectedDrone);
    
    // Create a procedural drone mesh group
    const droneGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: selectedDrone.color, metalness: 0.8, roughness: 0.2 });
    
    // Central hub
    const hub = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), bodyMat);
    hub.castShadow = true;
    droneGroup.add(hub);

    // Rotor arms & blades
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8' });
    const rotors = [];

    const angles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    angles.forEach(angle => {
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(Math.cos(angle) * 1.2, 0, Math.sin(angle) * 1.2);
      droneGroup.add(arm);

      const rotor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.2), bladeMat);
      rotor.position.set(Math.cos(angle) * 2.2, 0.2, Math.sin(angle) * 2.2);
      droneGroup.add(rotor);
      rotors.push(rotor);
    });

    scene.add(droneGroup);

    // 5. Keyboard Event Listeners
    const keys = {};
    const handleKeyDown = (e) => { keys[e.code] = true; };
    const handleKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 6. Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Map keyboard inputs to physics controls
      physics.controls.throttle = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 0.6 : 0);
      physics.controls.roll = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0);
      physics.controls.pitch = (keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0);
      physics.controls.yaw = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

      // Update physics simulation
      physics.update(delta);

      // Sync 3D Drone Mesh position & rotation with physics engine
      droneGroup.position.copy(physics.position);
      droneGroup.rotation.copy(physics.rotation);

      // Spin rotors faster when throttle is active
      const rotorSpeed = 20 + (physics.controls.throttle + 1) * 30;
      rotors.forEach((rotor, i) => {
        rotor.rotation.y += rotorSpeed * delta * (i % 2 === 0 ? 1 : -1);
      });

      // Camera third-person follow
      const cameraOffset = new THREE.Vector3(0, 4, -8).applyEuler(new THREE.Euler(0, physics.rotation.y, 0));
      camera.position.copy(physics.position).add(cameraOffset);
      camera.lookAt(physics.position.clone().add(new THREE.Vector3(0, 1, 0)));

      // Update React HUD telemetry state every few frames
      if (Math.random() < 0.2) {
        setTelemetry({
          altitude: physics.position.y.toFixed(1),
          speed: physics.velocity.length().toFixed(1),
          throttle: ((physics.controls.throttle + 1) * 50).toFixed(0),
        });
      }

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

      {/* Top Header / Drone Selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-3 items-center bg-gray-900/80 backdrop-blur-md p-3 rounded-xl border border-gray-800 shadow-2xl">
        <h1 className="text-cyan-400 font-bold tracking-wider text-lg mr-2">DRONE SIM</h1>
        {DRONES.map((drone) => (
          <button
            key={drone.id}
            onClick={() => setSelectedDrone(drone)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedDrone.id === drone.id
                ? 'bg-cyan-500 text-gray-950 shadow-lg shadow-cyan-500/30'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {drone.name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Telemetry HUD Overlay */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/80 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl text-sm min-w-[200px]">
        <div className="text-cyan-400 font-bold mb-2 tracking-wider text-xs uppercase border-b border-gray-800 pb-1">
          Telemetry HUD
        </div>
        <div className="flex justify-between py-1 text-gray-300">
          <span>Altitude:</span>
          <span className="font-mono text-white">{telemetry.altitude} m</span>
        </div>
        <div className="flex justify-between py-1 text-gray-300">
          <span>Speed:</span>
          <span className="font-mono text-white">{telemetry.speed} m/s</span>
        </div>
        <div className="flex justify-between py-1 text-gray-300">
          <span>Throttle:</span>
          <span className="font-mono text-white">{telemetry.throttle} %</span>
        </div>
      </div>

      {/* Flight Controls Help Banner */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-900/80 backdrop-blur-md px-6 py-3 rounded-xl border border-gray-800 shadow-2xl text-xs text-gray-300 flex gap-6">
        <div><strong className="text-cyan-400">W / S:</strong> Throttle Up / Down</div>
        <div><strong className="text-cyan-400">A / D:</strong> Yaw Rotate</div>
        <div><strong className="text-cyan-400">Arrow Keys:</strong> Pitch & Roll</div>
      </div>
    </div>
  );
}