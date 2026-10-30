import { Transport } from './transport.js';
import { midiFrequency, PARTS } from './accompaniment.js';

// Small procedural voices for practice. Every source has an explicit lifetime;
// no samples, network requests or third-party sound assets are needed.
export class BackingPlayer {
  constructor({ context, onStep, onStop, transportOptions = {} }) {
    this.context = context;
    this.onStep = onStep;
    this.onStop = onStop;
    this.output = context.createGain();
    this.output.gain.value = 0.65;
    this.compressor = context.createDynamicsCompressor();
    this.output.connect(this.compressor).connect(context.destination);
    this.channels = Object.fromEntries(PARTS.map(part => {
      const gain = context.createGain();
      gain.gain.value = part === 'drums' ? 0.55 : 0.75;
      gain.connect(this.output);
      return [part, gain];
    }));
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
    });
  }

  setPart(part, volume, muted = false) {
    if (!PARTS.includes(part) || !Number.isFinite(volume)) throw new RangeError('Invalid mixer channel');
    this.channels[part].gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)), this.context.currentTime, 0.01);
  }

  async start(compiled, { bpm = 120, repeats = 4, countIn = true } = {}) {
    if (!Number.isInteger(repeats) || repeats < 0 || repeats > 32) throw new RangeError('Invalid repeat count');
    this.stop();
    const length = compiled.steps.length;
    this.transport.nextStep = index => {
      if (repeats && index >= length * repeats) return null;
      const step = compiled.steps[index % length];
      return { ...step, pass: Math.floor(index / length) + 1 };
    };
    this.transport.setBpm(bpm);
    this.transport.tempoUnit = compiled.song.tempoUnit;
    await this.transport.start({ index: 0, countIn: countIn ? compiled.steps.filter(step => step.barIndex === 0) : [] });
  }

  stop() { this.transport.stop(); }

  schedule(event, timing) {
    if (timing.countIn) {
      if (event.kind === 'click') this.voice({ part: 'countIn', frequency: event.accent ? 1100 : 800, duration: 0.045, velocity: 0.3 }, timing.time);
      return;
    }
    if (event.kind === 'note') this.voice({ ...event, frequency: midiFrequency(event.midi), duration: timing.duration }, timing.time);
    if (event.kind === 'drum') this.voice({ ...event, duration: Math.min(timing.duration, event.sound === 'snare' ? 0.14 : 0.1) }, timing.time);
  }

  voice(event, time) {
    const ctx = this.context;
    const duration = Math.max(0.0001, event.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    const peak = event.velocity * (event.part === 'piano' ? 0.12 : event.part === 'bass' ? 0.35 : 0.25);
    gain.gain.exponentialRampToValueAtTime(peak, time + Math.min(0.004, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.3), time + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(this.channels[event.part] ?? this.output);
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
      const source = ctx.createOscillator();
      source.type = event.part === 'bass' ? 'triangle' : 'sine';
      source.frequency.setValueAtTime(event.frequency ?? 140, time);
      if (event.sound === 'kick') source.frequency.exponentialRampToValueAtTime(45, time + duration);
      source.connect(gain);
      sources.push(source);
      if (event.part === 'piano') {
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.frequency.value = event.frequency * 2;
        overtoneGain.gain.value = 0.2;
        overtone.connect(overtoneGain).connect(gain);
        nodes.push(overtoneGain);
        sources.push(overtone);
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

  dispose() {
    this.transport.dispose();
    Object.values(this.channels).forEach(channel => channel.disconnect());
    this.output.disconnect();
    this.compressor.disconnect();
  }
}
