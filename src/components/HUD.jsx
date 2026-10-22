import React from 'react';
import { DRONES } from '../config/dronesConfig';
import { Activity, Compass, BatteryCharging, Gauge, Shield, Zap } from 'lucide-react';

export default function HUD({ telemetry, selectedDrone, onSelectDrone, flightMode, setFlightMode }) {
  return (
    <>
      {/* Top-Left: Mission Control Header & Drone Selector */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 bg-gray-900/80 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 min-w-[320px]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-black tracking-widest text-sm">MISSION CONTROL v1.0</span>
          </div>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">ONLINE</span>
        </div>

        <div className="text-xs text-gray-400 font-medium">SELECT DRONE PROFILE</div>
        <div className="grid grid-cols-2 gap-2">
          {DRONES.map((drone) => (
            <button
              key={drone.id}
              onClick={() => onSelectDrone(drone)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between ${
                selectedDrone.id === drone.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-gray-950 shadow-lg shadow-cyan-500/25 scale-[1.02]'
                  : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 border border-gray-700/50'
              }`}
            >
              <span>{drone.name.split(' ')[0]}</span>
              <span className="text-[10px] opacity-75 font-mono">{drone.mass}kg</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top-Right: Advanced Telemetry HUD */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/80 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 min-w-[260px]">
        <div className="text-cyan-400 font-black mb-3 tracking-widest text-xs uppercase border-b border-gray-800 pb-2 flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Flight Telemetry
        </div>
        
        <div className="space-y-2.5 font-mono text-sm">
          <div className="flex justify-between items-center bg-gray-950/50 px-3 py-1.5 rounded-lg border border-gray-800/60">
            <span className="text-gray-400 text-xs flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-cyan-400"/> ALTITUDE</span>
            <span className="text-cyan-300 font-bold">{telemetry.altitude} <span className="text-xs text-gray-500">m</span></span>
          </div>
          <div className="flex justify-between items-center bg-gray-950/50 px-3 py-1.5 rounded-lg border border-gray-800/60">
            <span className="text-gray-400 text-xs flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400"/> SPEED</span>
            <span className="text-yellow-300 font-bold">{telemetry.speed} <span className="text-xs text-gray-500">m/s</span></span>
          </div>
          <div className="flex justify-between items-center bg-gray-950/50 px-3 py-1.5 rounded-lg border border-gray-800/60">
            <span className="text-gray-400 text-xs flex items-center gap-1.5"><BatteryCharging className="w-3.5 h-3.5 text-emerald-400"/> THROTTLE</span>
            <span className="text-emerald-300 font-bold">{telemetry.throttle} <span className="text-xs text-gray-500">%</span></span>
          </div>
        </div>
      </div>

      {/* Bottom Center: Keybindings Banner */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-900/80 backdrop-blur-xl px-6 py-3 rounded-2xl border border-gray-800 shadow-2xl text-xs text-gray-300 flex gap-6 items-center">
        <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">W / S</kbd> <span>Throttle</span></div>
        <div className="w-px h-4 bg-gray-800"></div>
        <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">A / D</kbd> <span>Yaw</span></div>
        <div className="w-px h-4 bg-gray-800"></div>
        <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">Arrow Keys</kbd> <span>Pitch & Roll</span></div>
      </div>
    </>
  );
}