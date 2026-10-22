import React, { useState } from 'react';
import { DRONES } from '../config/dronesConfig';
import { Activity, Compass, BatteryCharging, Gauge, Zap, Camera, Navigation } from 'lucide-react';

export default function HUD({ telemetry, selectedDrone, onSelectDrone, flightMode, setFlightMode }) {
  const [isPhotoMode, setIsPhotoMode] = useState(false);

  const RADAR_RADIUS = 70; 
  const MAP_SCALE = 0.8;   // Scale world units to radar pixels

  const getCardinal = (heading) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  // World objects
  const rings = [
    { x: 0, z: -35 },
    { x: 25, z: -70 },
    { x: -25, z: -105 }
  ];
  const landingPadPos = { x: 0, z: 0 };

  // Helper to rotate world coordinates so that forward is ALWAYS at the top of the radar
  const getHeadingUpCoords = (objX, objZ) => {
    const relX = objX - telemetry.position.x;
    const relZ = objZ - telemetry.position.z;

    const yaw = telemetry.rotationY || 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    // Rotate relative positions based on drone's yaw orientation
    const rotX = relX * cos - relZ * sin;
    const rotZ = relX * sin + relZ * cos;

    return {
      x: RADAR_RADIUS + rotX * MAP_SCALE,
      y: RADAR_RADIUS + rotZ * MAP_SCALE
    };
  };

  return (
    <>
      {isPhotoMode && (
        <button
          onClick={() => setIsPhotoMode(false)}
          className="absolute top-6 right-6 z-30 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-black px-4 py-2 rounded-xl shadow-2xl transition-all flex items-center gap-2 text-xs uppercase tracking-wider"
        >
          <Camera className="w-4 h-4" /> Exit Photo Mode
        </button>
      )}

      {!isPhotoMode && (
        <>
          {/* Compass Heading Bar (Top Center) */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-gray-900/85 backdrop-blur-xl px-6 py-2 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col items-center min-w-[280px]">
            <div className="flex items-center gap-2 font-mono text-sm font-black text-cyan-400">
              <Navigation className="w-4 h-4 text-cyan-400" style={{ transform: `rotate(${telemetry.heading}deg)` }} />
              <span>{telemetry.heading}° {getCardinal(telemetry.heading)}</span>
            </div>

            <div className="relative w-full h-3 overflow-hidden mt-1 border-t border-gray-800">
              <div 
                className="absolute top-0 flex gap-8 font-mono text-[9px] text-gray-400 font-bold transition-all duration-75 whitespace-nowrap"
                style={{ transform: `translateX(calc(50% - ${((telemetry.heading % 360) / 360) * 320}px))` }}
              >
                <span>N</span><span>NE</span><span>E</span><span>SE</span><span>S</span><span>SW</span><span>W</span><span>NW</span><span>N</span>
              </div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-cyan-400" />
            </div>
          </div>

          {/* Top-Left: Mission Control & Drone Profile Selector */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 bg-gray-900/85 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 w-80">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="text-cyan-400 font-black tracking-widest text-xs">MISSION CONTROL</span>
              </div>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">ONLINE</span>
            </div>

            <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Select Drone Profile</div>
            
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
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
              <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-mono">[C] FPV</span>
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

          {/* Heading-Up Radar Minimap (Bottom Right) */}
          <div className="absolute bottom-4 right-4 z-10 bg-gray-900/85 backdrop-blur-xl p-3 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col items-center">
            <div className="text-[10px] text-cyan-400 font-mono font-bold mb-2 uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" /> RADAR (HEADING-UP)
            </div>
            <div className="relative w-36 h-36 rounded-full border border-cyan-500/40 bg-gray-950/80 overflow-hidden flex items-center justify-center shadow-inner">
              <div className="absolute w-24 h-24 rounded-full border border-gray-800/60" />
              <div className="absolute w-12 h-12 rounded-full border border-gray-800/60" />
              <div className="absolute w-full h-px bg-gray-800/50" />
              <div className="absolute h-full w-px bg-gray-800/50" />

              {/* Landing Pad (Moves dynamically so it's always ahead of you when you look at it) */}
              {(() => {
                const padCoord = getHeadingUpCoords(landingPadPos.x, landingPadPos.z);
                if (padCoord.x >= 5 && padCoord.x <= 135 && padCoord.y >= 5 && padCoord.y <= 135) {
                  return (
                    <div 
                      className="absolute w-3.5 h-3.5 rounded-full border border-cyan-400 bg-cyan-500/40 transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${padCoord.x}px`, top: `${padCoord.y}px` }}
                      title="Landing Pad"
                    />
                  );
                }
                return null;
              })()}

              {/* Obstacle Rings (Move dynamically relative to your heading) */}
              {rings.map((r, i) => {
                const ringCoord = getHeadingUpCoords(r.x, r.z);
                if (ringCoord.x >= 5 && ringCoord.x <= 135 && ringCoord.y >= 5 && ringCoord.y <= 135) {
                  return (
                    <div 
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-yellow-400 border border-yellow-200 transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${ringCoord.x}px`, top: `${ringCoord.y}px` }}
                    />
                  );
                }
                return null;
              })}

              {/* Drone Fixed Permanently in the Center, Pointing Straight UP */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-cyan-400 drop-shadow-[0_0_6px_#38bdf8]">
                  <polygon points="12,2 22,22 12,17 2,22" />
                </svg>
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