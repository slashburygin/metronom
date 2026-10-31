import { playbackOutput } from './audio-output.js';
// Audio engine. Uses the Web Audio "lookahead scheduler" pattern: a coarse timer
// wakes up every few ms and schedules any clicks due soon on the audio clock,
// which is sample-accurate, instead of relying on JS timers for timing.

import { DEFAULTS, PITCHES, SUBDIVISIONS, DENOMINATORS, resizeAccents } from './tempo.js';
import { fraction, multiply } from './musical-time.js';
import { Transport } from './transport.js';

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

export class Metronome {
  constructor({ onTick, onStop } = {}) {
    this.onTick = onTick; // (beatIndex, subIndex) at the moment the click is heard
    this.onStop = onStop; // called when the practice timer ends a run
    this.beatsPerBar = DEFAULTS.beatsPerBar;
    this.subdivision = DEFAULTS.subdivision;
    this.accents = resizeAccents([], this.beatsPerBar);
    this.sound = DEFAULTS.sound;
    this.pitch = DEFAULTS.pitch;
    this.volume = DEFAULTS.volume;
    this.timerMinutes = DEFAULTS.timerMinutes;

    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.transport = new Transport({
      nextStep: index => {
        const beat = index % this.beatsPerBar;
        const duration = fraction(1, this.noteValue);
        return { duration, beatIndex: beat, events: (SUBDIVISIONS[this.subdivision] ?? SUBDIVISIONS.quarter).map((onset, sub) => ({
          kind: 'click', beat, sub,
          offset: multiply(duration, fraction(Math.round(onset * 24), 24)),
          level: sub === 0 ? this.accents[beat] : 'sub',
        })) };
      },
      durationSeconds: () => this.timerSeconds,
      onSchedule: (event, timing) => {
        if (event.level !== 'mute') this.playClick(timing.time, event.level);
      },
      onEvent: event => this.onTick?.(event.beat, event.sub),
      onStop: () => this.onStop?.(),
    });
    this.setNoteValue(DEFAULTS.noteValue);
  }

  get bpm() { return this.transport.bpm; }
  get playing() { return this.transport.playing; }
  get pending() { return this.transport.pending; }
  get startedAt() { return this.transport.startedAt; }

  // BPM counts the denominator note, preserving the standalone metronome's
  // pulse rate. A song may instead choose e.g. a dotted-quarter tempo unit.
  setNoteValue(noteValue) {
    if (!DENOMINATORS.includes(noteValue)) throw new RangeError('Invalid beat note');
    this.noteValue = noteValue;
    this.transport.tempoUnit = fraction(1, noteValue);
  }

  get timerSeconds() { return this.timerMinutes * 60; }

  setBpm(bpm) { this.transport.setBpm(bpm); }

  setBeatsPerBar(beats) {
    this.beatsPerBar = beats;
    this.accents = resizeAccents(this.accents, beats);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  async start() {
    if (this.playing || this.pending) return;
    if (!this.ctx) this.initAudio();
    await this.transport.start({ index: 0 });
  }

  stop() { this.transport.stop(); }

  toggle() { return this.playing || this.pending ? this.stop() : this.start(); }

  initAudio() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.transport.context = this.ctx;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(playbackOutput(this.ctx));
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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

    const nodes = [env];
    let out = env;
    if (v.bandpass) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(v.bandpass * pitch, nyquist);
      env.connect(bp);
      out = bp;
      nodes.push(bp);
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
      nodes.push(filter);
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
    let remainingSources = sources.length;
    for (const s of sources) {
      s.start(time);
      this.transport.track(s, () => {
        s.disconnect();
        if (--remainingSources === 0) nodes.forEach(node => node.disconnect());
      }, time + v.dur + 0.01);
    }
  }

  // Continuous pulse position for the pendulum, independent of note value.
  position() {
    const position = this.transport.position();
    return position ? position.count + position.fraction : null;
  }

  remaining() {
    if (!this.timerSeconds || !this.playing) return null;
    return Math.max(0, this.transport.until - this.ctx.currentTime);
  }
}
