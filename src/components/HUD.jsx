import React, { useState, useEffect } from 'react';
import { DRONES } from '../config/dronesConfig';
import { MAPS } from '../config/mapsConfig';
import { Activity, Compass, BatteryCharging, Gauge, Zap, Camera, Navigation, MapPin, Volume2, VolumeX, Shield, Crosshair, Skull, Award } from 'lucide-react';

export default function HUD({
  telemetry,
  combatState,
  selectedDrone,
  onSelectDrone,
  selectedMap,
  onSelectMap,
  flightMode,
  setFlightMode,
  audioEnabled,
  volume,
  muted,
  onVolumeChange,
  onToggleMute
}) {
  const [isPhotoMode, setIsPhotoMode] = useState(false);
  const [activeTab, setActiveTab] = useState('DRONES');
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [showDamageFlash, setShowDamageFlash] = useState(false);

  const RADAR_RADIUS = 70;
  const MAP_SCALE = 0.55;

  // Flash triggers
  useEffect(() => {
    if (combatState?.hitMarker) {
      setShowHitMarker(true);
      const timer = setTimeout(() => setShowHitMarker(false), 120);
      return () => clearTimeout(timer);
    }
  }, [combatState?.hitMarker]);

  useEffect(() => {
    if (combatState?.playerDamageFlash) {
      setShowDamageFlash(true);
      const timer = setTimeout(() => setShowDamageFlash(false), 200);
      return () => clearTimeout(timer);
    }
  }, [combatState?.playerDamageFlash]);

  const getCardinal = (heading) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  const landingPadPos = { x: 0, z: 0 };

  const getHeadingUpCoords = (objX, objZ) => {
    const relX = objX - telemetry.position.x;
    const relZ = objZ - telemetry.position.z;
    const yaw = telemetry.rotationY || 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    const rotX = relX * cos - relZ * sin;
    const rotZ = relX * sin + relZ * cos;

    return {
      x: RADAR_RADIUS + rotX * MAP_SCALE,
      y: RADAR_RADIUS + rotZ * MAP_SCALE
    };
  };

  const hpSegments = 5;
  const currentHpSegments = Math.ceil((combatState.health / combatState.maxHealth) * hpSegments);

  return (
    <>
      {/* Damage Screen Flash */}
      {showDamageFlash && (
        <div className="absolute inset-0 bg-red-600/30 pointer-events-none z-50 animate-pulse border-8 border-red-500/80" />
      )}

      {/* Respawn Death Screen */}
      {combatState.isDead && (
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
          <div className="text-red-500 text-3xl font-black font-mono tracking-widest uppercase flex items-center gap-3">
            <Skull className="w-8 h-8 animate-bounce" /> DRONE DESTROYED
          </div>
          <div className="text-gray-300 font-mono text-sm mt-3">
            RESPAWNING ON LANDING PAD IN <span className="text-cyan-400 font-bold text-xl">{combatState.respawnCountdown}</span>s
          </div>
        </div>
      )}

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
          {/* Central Combat Crosshair */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center justify-center">
            <div className={`relative w-12 h-12 flex items-center justify-center transition-transform ${showHitMarker ? 'scale-125' : 'scale-100'}`}>
              <div className="absolute w-3 h-3 border border-cyan-400/80 rounded-full" />
              <div className="absolute w-6 h-px bg-cyan-400/60" />
              <div className="absolute h-6 w-px bg-cyan-400/60" />

              {/* Hit confirmation marker */}
              {showHitMarker && (
                <div className="absolute text-red-400 font-mono text-xs font-black animate-ping">
                  ✕
                </div>
              )}
            </div>
          </div>

          {/* Top Center: Compass Heading Bar */}
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

          {/* Left Panel: Mission Control & Score Status */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 bg-gray-900/85 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-950/50 w-80">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span className="text-cyan-400 font-black tracking-widest text-xs">TACTICAL COMBAT</span>
              </div>
              <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/40 font-mono font-bold">LEVEL 1</span>
            </div>

            {/* Combat Score & Frags */}
            <div className="grid grid-cols-2 gap-2 bg-gray-950/60 p-2.5 rounded-xl border border-gray-800">
              <div className="flex items-center gap-2">
                <Skull className="w-4 h-4 text-red-400" />
                <div>
                  <div className="text-[9px] text-gray-400 font-mono uppercase">Enemies Down</div>
                  <div className="text-sm font-bold text-white font-mono">{combatState.kills}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-400" />
                <div>
                  <div className="text-[9px] text-gray-400 font-mono uppercase">Combat Score</div>
                  <div className="text-sm font-bold text-yellow-400 font-mono">{combatState.score}</div>
                </div>
              </div>
            </div>

            {/* Tab Toggle (Drones vs Maps) */}
            <div className="grid grid-cols-2 gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('DRONES')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'DRONES' ? 'bg-cyan-500 text-gray-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Drones
              </button>
              <button
                onClick={() => setActiveTab('MAPS')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'MAPS' ? 'bg-cyan-500 text-gray-950 shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                Arenas
              </button>
            </div>

            {activeTab === 'DRONES' ? (
              <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto pr-1">
                {DRONES.map((drone) => {
                  const isSelected = selectedDrone.id === drone.id;
                  return (
                    <button
                      key={drone.id}
                      onClick={() => onSelectDrone(drone)}
                      className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-cyan-500 text-white'
                          : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-800/60'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-cyan-300">{drone.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{drone.rotorCount} Rotors • {drone.mass} kg</div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full border ${isSelected ? 'bg-cyan-400 border-cyan-300' : 'border-gray-600 bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[170px] overflow-y-auto pr-1">
                {MAPS.map((map) => {
                  const isSelected = selectedMap.id === map.id;
                  return (
                    <button
                      key={map.id}
                      onClick={() => onSelectMap(map)}
                      className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between border ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-cyan-500 text-white'
                          : 'bg-gray-950/40 border-gray-800 text-gray-300 hover:bg-gray-800/60'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-cyan-300 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-cyan-400"/> {map.name}</div>
                        <div className="text-[10px] text-gray-400">{map.description}</div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full border ${isSelected ? 'bg-cyan-400 border-cyan-300' : 'border-gray-600 bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setIsPhotoMode(true)}
              className="mt-1 w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-cyan-400/30"
            >
              <Camera className="w-3.5 h-3.5" /> Cinematic Camera
            </button>
          </div>

          {/* Right Panel: Health & Telemetry HUD */}
          <div className="absolute top-4 right-4 z-10 bg-gray-900/85 backdrop-blur-xl p-4 rounded-2xl border border-cyan-500/30 shadow-2xl min-w-[270px]">
            <div className="text-cyan-400 font-black mb-2.5 tracking-widest text-xs uppercase border-b border-gray-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2"><Crosshair className="w-4 h-4" /> Drone Status</span>
              <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-mono">[C] FPV</span>
            </div>

            {/* 5-Segment Armor / Health Bar */}
            <div className="mb-3 bg-gray-950/70 p-2.5 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center text-xs font-mono font-bold mb-1.5">
                <span className="text-gray-300 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-cyan-400" /> HULL INTEGRITY</span>
                <span className={combatState.health <= 40 ? 'text-red-400' : 'text-cyan-400'}>{combatState.health}%</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 h-3">
                {[...Array(hpSegments)].map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm transition-all duration-200 ${
                      i < currentHpSegments
                        ? (currentHpSegments <= 2 ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-cyan-400 shadow-sm shadow-cyan-400')
                        : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Telemetry Metrics */}
            <div className="space-y-2 font-mono text-sm">
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

            {/* Audio Controls */}
            <div className="mt-2.5 pt-2.5 border-t border-gray-800">
              {!audioEnabled ? (
                <div className="flex items-center gap-2 bg-gray-950/50 px-3 py-2 rounded-lg border border-gray-800/60 text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                  <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                  <span>Press any key to enable audio</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-950/50 px-3 py-1.5 rounded-lg border border-gray-800/60">
                  <button onClick={onToggleMute} className="text-cyan-400 hover:text-cyan-300 transition-colors flex-shrink-0">
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Right: Radar Minimap with Enemy Tracking Pips */}
          <div className="absolute bottom-4 right-4 z-10 bg-gray-900/85 backdrop-blur-xl p-3 rounded-2xl border border-cyan-500/30 shadow-2xl flex flex-col items-center">
            <div className="text-[10px] text-cyan-400 font-mono font-bold mb-2 uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> RADAR
            </div>
            <div className="relative w-36 h-36 rounded-full border border-cyan-500/40 bg-gray-950/80 overflow-hidden flex items-center justify-center shadow-inner">
              <div className="absolute w-24 h-24 rounded-full border border-gray-800/60" />
              <div className="absolute w-12 h-12 rounded-full border border-gray-800/60" />
              <div className="absolute w-full h-px bg-gray-800/50" />
              <div className="absolute h-full w-px bg-gray-800/50" />

              {/* Landing Pad Pip */}
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

              {/* Enemy Drone Pips (Red Pulsing Dots) */}
              {combatState.radarEnemies?.map((enemy, i) => {
                const coord = getHeadingUpCoords(enemy.x, enemy.z);
                if (coord.x >= 5 && coord.x <= 135 && coord.y >= 5 && coord.y <= 135) {
                  return (
                    <div
                      key={i}
                      className="absolute w-2.5 h-2.5 rounded-full bg-red-500 border border-red-300 shadow-md shadow-red-500 animate-pulse transform -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${coord.x}px`, top: `${coord.y}px` }}
                      title="Hostile Drone"
                    />
                  );
                }
                return null;
              })}

              {/* Player Icon */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-cyan-400 drop-shadow-[0_0_6px_#38bdf8]">
                  <polygon points="12,2 22,22 12,17 2,22" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bottom Center: Combat Keybindings Banner */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-gray-900/85 backdrop-blur-xl px-6 py-3 rounded-2xl border border-gray-800 shadow-2xl text-xs text-gray-300 flex gap-4 items-center">
            <div className="flex items-center gap-2"><kbd className="bg-red-500/20 px-2 py-1 rounded text-red-400 font-mono border border-red-500/30 font-bold">SPACE / CLICK</kbd> <span>Fire Laser</span></div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">W / S</kbd> <span>Throttle</span></div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">A / D</kbd> <span>Yaw</span></div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">Arrows</kbd> <span>Pitch & Roll</span></div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">E</kbd> <span>Probe</span></div>
            <div className="w-px h-4 bg-gray-800" />
            <div className="flex items-center gap-2"><kbd className="bg-gray-800 px-2 py-1 rounded text-cyan-400 font-mono border border-gray-700">C</kbd> <span>FPV</span></div>
          </div>
        </>
      )}
    </>
  );
}