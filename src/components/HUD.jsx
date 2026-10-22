import React, { useState } from 'react';
import { DRONES } from '../config/dronesConfig';
import { Activity, Compass, BatteryCharging, Gauge, Zap, Camera, Eye } from 'lucide-react';

export default function HUD({ telemetry, selectedDrone, onSelectDrone, flightMode, setFlightMode }) {
  const [isPhotoMode, setIsPhotoMode] = useState(false);

  return (
    <>
      {/* Floating Photo Mode Exit Button (Appears only when photo mode is active) */}
      {isPhotoMode && (
        <button
          onClick={() => setIsPhotoMode(false)}
          className="absolute top-6 right-6 z-30 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-black px-4 py-2 rounded-xl shadow-2xl transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Camera className="w-4 h-4" /> Exit Photo Mode
        </button>
      )}

      {/* Main HUD Container (Hidden entirely when Photo Mode is active) */}
      {!isPhotoMode && (
        <>
          {/* Top-Left: Mission Control & Drone Selector */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 bg-gray-900/85 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 w-80">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="text-cyan-400 font-black tracking-widest text-xs">MISSION CONTROL</span>
              </div>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">ONLINE</span>
            </div>

            <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Select Drone Profile</div>
            
            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
              {DRONES.map((drone) => {
                const isSelected = selectedDrone.id === drone.id;
                return (
                  <button
                    key={drone.id}
                    onClick={() => onSelectDrone(drone)}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between border ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-cyan-500 shadow-lg shadow-cyan-500/10 text-white'
                        : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-800/60 hover:border-gray-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-cyan-300">{drone.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{drone.rotorCount} Rotors • {drone.mass} kg</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full border ${isSelected ? 'bg-cyan-400 border-cyan-300 shadow-md shadow-cyan-400' : 'border-gray-600 bg-transparent'}`} />
                  </button>
                );
              })}
            </div>

            {/* Photo Mode Button */}
            <button
              onClick={() => setIsPhotoMode(true)}
              className="mt-1 w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-cyan-400/30"
            >
              <Camera className="w-4 h-4" /> Cinematic Photo Mode
            </button>
          </div>

          {/* Top-Right: Advanced Telemetry HUD */}
          <div className="absolute top-4 right-4 z-10 bg-gray-900/85 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 min-w-[260px]">
            <div className="text-cyan-400 font-black mb-3 tracking-widest text-xs uppercase border-b border-gray-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2"><Gauge className="w-4 h-4" /> Flight Telemetry</span>
              <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-mono">Press [C] to toggle FPV</span>
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
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-900/85 backdrop-blur-xl px-6 py-3 rounded-2xl border border-gray-800 shadow-2xl text-xs text-gray-300 flex gap-5 items-center">
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">W / S</kbd> <span>Throttle</span></div>
            <div className="w-px h-4 bg-gray-800"></div>
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">A / D</kbd> <span>Yaw</span></div>
            <div className="w-px h-4 bg-gray-800"></div>
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">Arrows</kbd> <span>Pitch & Roll</span></div>
            <div className="w-px h-4 bg-gray-800"></div>
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">C</kbd> <span>Toggle FPV</span></div>
          </div>
        </>
      )}
    </>
  );
}