import { playbackOutput } from './audio-output.js';
import { Transport } from './transport.js';
import { midiFrequency, PARTS } from './accompaniment.js';
import { trainingState, trainingArrangement } from './training.js';
import { normalizeSound, voiceProfile } from './backing-sound.js';
import { loadTrioSamples, selectSample } from './backing-samples.js';
import { BackingReverb } from './backing-reverb.js';

// Recorded acoustic voices and procedural electric tones share transport ownership.
export class BackingPlayer {
  constructor({ context, onStep, onStop, transportOptions = {}, sampleLoader = loadTrioSamples }) {
    this.context = context;
    this.sampleLoader = sampleLoader;
    this.sampleVariation = {};
    this.onStep = onStep;
    this.onStop = onStop;
    this.sound = normalizeSound();
    this.output = context.createGain();
    this.output.gain.value = 0.65;
    this.compressor = context.createDynamicsCompressor();
    this.output.connect(this.compressor).connect(playbackOutput(context));
    this.channels = Object.fromEntries(PARTS.map(part => {
      const gain = context.createGain();
      gain.gain.value = part === 'drums' ? 0.55 : 0.75;
      gain.connect(this.output);
      return [part, gain];
    }));
    this.reverb = new BackingReverb(context, this.channels);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = this.noise.getChannelData(0);
    // Fixed seed makes offline renders reproducible.
    let seed = 17;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      data[i] = (seed >>> 0) / 2147483648 - 1;
    }
    this.transport = new Transport({ ...transportOptions, context,
      onSchedule: (event, timing) => this.schedule(event, timing),
      onStep: timing => this.onStep?.(timing), onStop: () => this.onStop?.(),
      onAudioClip: end => this.reverb.clip(end), onAudioCancel: () => this.reverb.cancel(),
    });
  }

  setPart(part, volume, muted = false) {
    if (!PARTS.includes(part) || !Number.isFinite(volume)) throw new RangeError('Invalid mixer channel');
    this.channels[part].gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)), this.context.currentTime, 0.01);
  }

  setSound(sound) { this.stop(); this.sound = normalizeSound(sound); }

  async start(compiled, { bpm = 120, repeats = 4, countIn = true, training = {}, sound = this.sound } = {}) {
    if (!Number.isInteger(repeats) || repeats < 0 || repeats > 32) throw new RangeError('Invalid repeat count');
    this.stop();
    this.sound = normalizeSound(sound);
    this.sampleVariation = {};
    const length = compiled.steps.length;
    const cache = new Map();
    const arrangement = state => {
      const key = `${state.key}:${state.semitones}`;
      if (!cache.has(key)) cache.set(key, trainingArrangement(compiled, state));
      return cache.get(key);
    };
    this.transport.nextStep = index => {
      if (repeats && index >= length * repeats) return null;
      const pass = Math.floor(index / length) + 1;
      const state = trainingState(compiled.song.key, pass, this.transport.bpm, training);
      const step = arrangement(state).steps[index % length];
      return { ...step, pass, bpm: state.bpm, training: state };
    };
    this.transport.setBpm(bpm);
    this.transport.tempoUnit = compiled.song.tempoUnit;
    const first = this.transport.nextStep(0);
    const firstBar = arrangement(first.training).steps;
    const boundary = firstBar.findIndex((step, index) => index > 0 && step.beatIndex === 0);
    await this.transport.start({ index: 0, prepare: () => this.prepareSamples(), countIn: countIn ? firstBar.slice(0, boundary < 0 ? firstBar.length : boundary) : [] });
  }

  async prepareSamples() {
    if (this.sampleLoader) this.samples = await this.sampleLoader(this.context);
  }

  stop() { this.transport.stop(); }

  schedule(event, timing) {
    this.reverb.collect();
    if (timing.countIn) {
      if (event.kind === 'click') this.voice({ part: 'countIn', frequency: event.accent ? 1100 : 800, duration: 0.045, velocity: 0.3 }, timing.time);
      return;
    }
    if (event.kind === 'silence') { this.reverb.clip(timing.time, event.parts); return; }
    if (event.kind === 'note') this.voice({ ...event, frequency: midiFrequency(event.midi), duration: timing.duration }, timing.time);
    if (event.kind === 'drum') this.voice({ ...event, duration: Math.min(timing.duration, event.sound === 'snare' ? 0.14 : 0.1) }, timing.time);
  }

  voice(event, time) {
    const key = event.part === 'drums' ? event.sound : event.part;
    const variation = this.sampleVariation[key] ?? 0;
    const sample = selectSample(this.samples, event, this.sound, variation);
    if (sample) {
      this.sampleVariation[key] = variation + 1;
      this.sampleVoice(event, sample, time);
      return;
    }
    const ctx = this.context;
    const duration = Math.max(0.0001, event.duration);
    const profile = voiceProfile(event.part, this.sound);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    const peak = event.velocity * profile.level;
    gain.gain.exponentialRampToValueAtTime(peak, time + Math.min(0.004, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * profile.sustain), time + duration * profile.decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(this.channels[event.part] ?? this.output);
    this.reverb.connect(event.part, gain, time, this.sound.reverb, Math.min(this.transport.until, this.transport.endTime));
    const nodes = [gain];
    const sources = [];
    if (event.part === 'drums' && event.sound !== 'kick') {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = event.sound === 'hat' ? 'highpass' : 'bandpass';
      filter.frequency.value = event.sound === 'hat' ? 6500 : 1800;
      filter.Q.value = 0.7;
      source.connect(filter).connect(gain);
      nodes.push(filter);
      sources.push(source);
    } else {
      let destination = gain;
      if (profile.cutoff) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = Math.min(1600, Math.max(220, event.frequency * profile.cutoff));
        filter.Q.value = 0.5; filter.connect(gain); nodes.push(filter); destination = filter;
      }
      for (const [ratio, level] of profile.partials) {
        const source = ctx.createOscillator(), partial = ctx.createGain();
        source.type = profile.wave;
        source.frequency.setValueAtTime((event.frequency ?? 140) * ratio, time);
        if (event.sound === 'kick') source.frequency.exponentialRampToValueAtTime(45, time + duration);
        // Hammer/pluck harmonics fade faster than the fundamental. Loud notes
        // open the spectrum; organ and electric timbres keep their own profiles.
        const acoustic = (event.part === 'piano' && this.sound.pianoTone === 'piano')
          || (event.part === 'bass' && this.sound.bassTone === 'acoustic');
        if (acoustic && ratio > 1) {
          const brightness = .45 + Math.min(1, event.velocity) * .55;
          partial.gain.setValueAtTime(level * brightness, time);
          partial.gain.exponentialRampToValueAtTime(Math.max(.0001, level * .06),
            time + duration / Math.sqrt(ratio));
        } else partial.gain.value = level;
        source.connect(partial).connect(destination);
        nodes.push(partial); sources.push(source);
      }
    }
    let remaining = sources.length;
    for (const source of sources) {
      source.start(time);
      this.transport.track(source, () => {
        source.disconnect();
        if (--remaining === 0) nodes.forEach(node => node.disconnect());
      }, time + duration);
    }
  }

  sampleVoice(event, sample, time) {
    const source = this.context.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.setValueAtTime(sample.rate, time);
    const duration = Math.max(.0001, Math.min(event.duration, sample.buffer.duration / sample.rate));
    const gain = this.context.createGain();
    const peak = Math.max(.0001, event.velocity * (event.part === 'piano' ? .55 : event.part === 'bass' ? .8 : .5));
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + Math.min(.003, duration * .1));
    gain.gain.setValueAtTime(peak, time + duration * .8);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(gain).connect(this.channels[event.part]);
    this.reverb.connect(event.part, gain, time, this.sound.reverb, Math.min(this.transport.until, this.transport.endTime));
    source.start(time);
    this.transport.track(source, () => { source.disconnect(); gain.disconnect(); }, time + duration);
  }

  dispose() {
    this.transport.dispose();
    this.reverb.dispose();
    Object.values(this.channels).forEach(channel => channel.disconnect());
    this.output.disconnect();
    this.compressor.disconnect();
  }
}
