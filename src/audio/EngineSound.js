/**
 * EngineSound
 * ------------------------------------------------------------
 * Procedural Web Audio engine for drone rotor hum + wind noise +
 * physics impact thumps. No external audio files required —
 * everything is synthesized at runtime.
 */

export default class EngineSound {
    constructor({
      rotorCount = 4,
      idleFreq = 70,
      maxFreq = 230,
      idleVolume = 0.05,
      maxVolume = 0.35,
    } = {}) {
      this.rotorCount = rotorCount;
      this.idleFreq = idleFreq;
      this.maxFreq = maxFreq;
      this.idleVolume = idleVolume;
      this.maxVolume = maxVolume;
  
      this.ctx = null;
      this.ready = false;
      this.muted = false;
      this._masterVolume = 1;
    }
  
    async init() {
      if (this.ready) return;
  
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      const ctx = this.ctx;
  
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;
      this.masterGain.connect(ctx.destination);
  
      // ROTOR HUM
      this.rotorGain = ctx.createGain();
      this.rotorGain.gain.value = this.idleVolume;
  
      this.rotorFilter = ctx.createBiquadFilter();
      this.rotorFilter.type = 'lowpass';
      this.rotorFilter.frequency.value = 400;
      this.rotorFilter.Q.value = 0.6;
  
      this.oscA = ctx.createOscillator();
      this.oscA.type = 'sawtooth';
      this.oscA.frequency.value = this.idleFreq;
  
      this.oscB = ctx.createOscillator();
      this.oscB.type = 'sawtooth';
      this.oscB.frequency.value = this.idleFreq * 1.015;
      this.oscB.detune.value = 8 + this.rotorCount;
  
      this.chopLFO = ctx.createOscillator();
      this.chopLFO.type = 'sine';
      this.chopLFO.frequency.value = 18 + this.rotorCount * 2;
  
      this.chopDepth = ctx.createGain();
      this.chopDepth.gain.value = 0.15;
  
      this.chopLFO.connect(this.chopDepth);
      this.chopDepth.connect(this.rotorGain.gain);
  
      this.oscA.connect(this.rotorFilter);
      this.oscB.connect(this.rotorFilter);
      this.rotorFilter.connect(this.rotorGain);
      this.rotorGain.connect(this.masterGain);
  
      this.oscA.start();
      this.oscB.start();
      this.chopLFO.start();
  
      // WIND NOISE
      this.windNoiseBuffer = this._createNoiseBuffer(2);
      this.windSource = ctx.createBufferSource();
      this.windSource.buffer = this.windNoiseBuffer;
      this.windSource.loop = true;
  
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 500;
      this.windFilter.Q.value = 0.8;
  
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
  
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
  
      this.windSource.start();
  
      this.ready = true;
    }
  
    async resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    }
  
    update(throttle = 0, airspeed = 0) {
      if (!this.ready) return;
  
      const t = Math.max(0, Math.min(1, throttle));
      const now = this.ctx.currentTime;
      const smoothing = 0.08;
  
      const targetFreqA = this.idleFreq + t * (this.maxFreq - this.idleFreq);
      const targetFreqB = targetFreqA * 1.015;
      const targetVol = this.idleVolume + t * (this.maxVolume - this.idleVolume);
      const targetFilterFreq = 300 + t * 2500;
      const targetChopFreq = 16 + this.rotorCount * 2 + t * 40;
  
      this.oscA.frequency.setTargetAtTime(targetFreqA, now, smoothing);
      this.oscB.frequency.setTargetAtTime(targetFreqB, now, smoothing);
      this.rotorFilter.frequency.setTargetAtTime(targetFilterFreq, now, smoothing);
      this.chopLFO.frequency.setTargetAtTime(targetChopFreq, now, smoothing);
      this.rotorGain.gain.setTargetAtTime(targetVol, now, smoothing);
  
      const speedNorm = Math.max(0, Math.min(1, airspeed / 40));
      this.windGain.gain.setTargetAtTime(speedNorm * 0.25, now, smoothing);
      this.windFilter.frequency.setTargetAtTime(400 + speedNorm * 3000, now, smoothing);
    }
  
    playImpact(strength = 1) {
      if (!this.ready) return;
  
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const intensity = Math.max(0.05, Math.min(1, strength / 15));
  
      const noiseBuffer = this._createNoiseBuffer(0.3);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
  
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 800 + intensity * 1500;
  
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.5 * intensity, now + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  
      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
  
      const thumpOsc = ctx.createOscillator();
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(120 + intensity * 60, now);
      thumpOsc.frequency.exponentialRampToValueAtTime(35, now + 0.2);
  
      const thumpGain = ctx.createGain();
      thumpGain.gain.setValueAtTime(0.6 * intensity, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
      thumpOsc.connect(thumpGain);
      thumpGain.connect(this.masterGain);
  
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.3);
      thumpOsc.start(now);
      thumpOsc.stop(now + 0.32);
    }
  
    setMasterVolume(v) {
      this._masterVolume = Math.max(0, Math.min(1, v));
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(
          this.muted ? 0 : this._masterVolume,
          this.ctx.currentTime,
          0.05
        );
      }
    }
  
    setMuted(muted) {
      this.muted = muted;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(
          muted ? 0 : this._masterVolume,
          this.ctx.currentTime,
          0.05
        );
      }
    }
  
    toggleMuted() {
      this.setMuted(!this.muted);
      return this.muted;
    }
  
    _createNoiseBuffer(durationSec) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * durationSec);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }
  
    dispose() {
      if (!this.ctx) return;
      try {
        this.oscA?.stop();
        this.oscB?.stop();
        this.chopLFO?.stop();
        this.windSource?.stop();
      } catch (e) {}
      this.ctx.close();
      this.ready = false;
    }
  }