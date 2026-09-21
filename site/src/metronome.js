// Audio engine. Uses the Web Audio "lookahead scheduler" pattern: a coarse timer
// wakes up every few ms and schedules any clicks due soon on the audio clock,
// which is sample-accurate, instead of relying on JS timers for timing.

import { DEFAULTS, PITCHES, SUBDIVISIONS, clampBpm, resizeAccents } from './tempo.js';

const LOOKAHEAD_MS = 25; // how often the scheduler wakes up
const SCHEDULE_AHEAD_S = 0.1; // how far ahead clicks are scheduled

const LEVEL_GAIN = { accent: 1, normal: 0.65, sub: 0.35 };
const LEVEL_PITCH = { accent: 1.4, normal: 1, sub: 0.8 };

// Each voice is synthesized: tone voices use oscillators, noise voices use a
// filtered white-noise burst. `freq` is the base pitch before level/pitch scaling.
const VOICES = {
  click: { tone: 'sine', freq: [1100], dur: 0.03 },
  beep: { tone: 'square', freq: [660], dur: 0.06, gain: 0.4 },
  wood: { tone: 'triangle', freq: [900], dur: 0.05, drop: 0.5 },
  drum: { tone: 'sine', freq: [140], dur: 0.18, drop: 0.35, gain: 1.4 },
  tick: { noise: 'bandpass', freq: 3000, q: 4, dur: 0.02, gain: 2 },
  cowbell: { tone: 'square', freq: [560, 845], dur: 0.25, gain: 0.3, bandpass: 800 },
  hihat: { noise: 'highpass', freq: 7000, dur: 0.05 },
  ping: { tone: 'sine', freq: [1500], dur: 0.4, gain: 0.8 },
};

// A Worker-based timer keeps ticking in background tabs, where setInterval
// on the main thread gets throttled to ~1s and would starve the scheduler.
function createTicker(onTick) {
  try {
    const src = `let id=null;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}`;
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = onTick;
    return { start: (ms) => worker.postMessage(ms), stop: () => worker.postMessage(0) };
  } catch {
    let id = null;
    return {
      start: (ms) => { clearInterval(id); id = setInterval(onTick, ms); },
      stop: () => clearInterval(id),
    };
  }
}

export class Metronome {
  constructor({ onTick, onStop } = {}) {
    this.onTick = onTick; // (beatIndex, subIndex) at the moment the click is heard
    this.onStop = onStop; // called when the practice timer ends a run
    this.bpm = DEFAULTS.bpm;
    this.beatsPerBar = DEFAULTS.beatsPerBar;
    this.subdivision = DEFAULTS.subdivision;
    this.accents = resizeAccents([], this.beatsPerBar);
    this.sound = DEFAULTS.sound;
    this.pitch = DEFAULTS.pitch;
    this.volume = DEFAULTS.volume;
    this.timerMinutes = DEFAULTS.timerMinutes;
    this.playing = false;
    this.startedAt = 0; // audio time of the first click of this run

    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.beat = 0;
    this.beatCount = 0;
    this.nextBeatTime = 0;
    this.visualQueue = [];
    this.lastHeardBeat = null;
    this.ticker = createTicker(() => this.schedule());
    this.frame = this.frame.bind(this);
  }

  get timerSeconds() { return this.timerMinutes * 60; }

  setBpm(bpm) { this.bpm = clampBpm(bpm); }

  setBeatsPerBar(beats) {
    this.beatsPerBar = beats;
    this.accents = resizeAccents(this.accents, beats);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  async start() {
    if (this.playing) return;
    if (!this.ctx) this.initAudio();
    await this.ctx.resume();
    this.playing = true;
    this.beat = 0;
    this.beatCount = 0;
    this.visualQueue = [];
    this.lastHeardBeat = null;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.startedAt = this.nextBeatTime; // so the timer covers the full run
    this.schedule();
    this.ticker.start(LOOKAHEAD_MS);
    requestAnimationFrame(this.frame);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.ticker.stop();
    this.visualQueue = [];
    this.lastHeardBeat = null;
  }

  toggle() { return this.playing ? this.stop() : this.start(); }

  initAudio() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  // Schedules whole beats (with all their subdivision clicks) that start
  // within the lookahead window.
  schedule() {
    if (!this.playing) return;
    const horizon = this.ctx.currentTime + SCHEDULE_AHEAD_S;
    const until = this.timerSeconds ? this.startedAt + this.timerSeconds : Infinity;
    while (this.nextBeatTime < horizon) {
      // Don't schedule past the practice timer; frame() stops the run once the
      // clicks already scheduled have been heard.
      if (this.nextBeatTime > until) break;
      const beatDur = 60 / this.bpm;
      const onsets = SUBDIVISIONS[this.subdivision] ?? SUBDIVISIONS.quarter;
      const beat = this.beat % this.beatsPerBar;
      onsets.forEach((onset, sub) => {
        const time = this.nextBeatTime + onset * beatDur;
        const level = sub === 0 ? this.accents[beat] : 'sub';
        if (level !== 'mute') this.playClick(time, level);
        this.visualQueue.push({ beat, sub, time, count: this.beatCount, beatDur });
      });
      this.nextBeatTime += beatDur;
      this.beatCount++;
      // Modulo against the current bar length so changing the time signature
      // mid-playback never leaves an out-of-range beat.
      this.beat = (beat + 1) % this.beatsPerBar;
    }
  }

  playClick(time, level) {
    const v = VOICES[this.sound] ?? VOICES.click;
    const pitch = (PITCHES[this.pitch] ?? 1) * LEVEL_PITCH[level];
    const nyquist = this.ctx.sampleRate / 2 - 100;
    const env = this.ctx.createGain();
    const peak = LEVEL_GAIN[level] * (v.gain ?? 1);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, time + v.dur);

    let out = env;
    if (v.bandpass) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(v.bandpass * pitch, nyquist);
      env.connect(bp);
      out = bp;
    }
    out.connect(this.master);

    const sources = [];
    if (v.noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = v.noise;
      filter.frequency.value = Math.min(v.freq * pitch, nyquist);
      if (v.q) filter.Q.value = v.q;
      src.connect(filter).connect(env);
      sources.push(src);
    } else {
      for (const f of v.freq) {
        const osc = this.ctx.createOscillator();
        const freq = Math.min(f * pitch, nyquist);
        osc.type = v.tone;
        osc.frequency.setValueAtTime(freq, time);
        if (v.drop) osc.frequency.exponentialRampToValueAtTime(freq * v.drop, time + v.dur);
        osc.connect(env);
        sources.push(osc);
      }
    }
    for (const s of sources) {
      s.start(time);
      s.stop(time + v.dur + 0.01);
    }
  }

  // Continuous beat position of what is currently heard (e.g. 7.5 = halfway
  // between the 8th and 9th beats since start). Null before the first click.
  position() {
    if (!this.lastHeardBeat) return null;
    const { time, count, beatDur } = this.lastHeardBeat;
    return count + Math.min(1, (this.ctx.currentTime - time) / beatDur);
  }

  // Seconds left of the practice timer, or null when no timer is set.
  remaining() {
    if (!this.timerSeconds || !this.playing) return null;
    return Math.max(0, this.startedAt + this.timerSeconds - this.ctx.currentTime);
  }

  // Fires onTick in sync with what is heard, not when it was scheduled.
  frame() {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    if (this.timerSeconds && now >= this.startedAt + this.timerSeconds) {
      this.stop();
      this.onStop?.();
      return;
    }
    while (this.visualQueue.length && this.visualQueue[0].time <= now) {
      const tick = this.visualQueue.shift();
      if (tick.sub === 0) this.lastHeardBeat = tick;
      this.onTick?.(tick.beat, tick.sub);
    }
    requestAnimationFrame(this.frame);
  }
}
