// YIN pitch detection: the first reliable period avoids octave errors from harmonics.
export function detectPitch(samples, sampleRate) {
  let energy = 0;
  for (const value of samples) energy += value * value;
  if (Math.sqrt(energy / samples.length) < 0.01) return null;
  const maxLag = Math.min(Math.floor(sampleRate / 50), Math.floor(samples.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / 1500));
  const difference = new Float32Array(maxLag + 1);
  const size = samples.length - maxLag;
  let sum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let value = 0;
    for (let i = 0; i < size; i++) {
      const delta = samples[i] - samples[i + lag];
      value += delta * delta;
    }
    sum += value;
    difference[lag] = sum ? value * lag / sum : 1;
    if (lag > minLag && difference[lag - 1] < 0.15 && difference[lag] >= difference[lag - 1]) {
      const center = lag - 1;
      const a = difference[center - 1], b = difference[center], c = difference[lag];
      const divisor = 2 * (2 * b - a - c);
      const period = center + (divisor ? (c - a) / divisor : 0);
      return sampleRate / period;
    }
  }
  return null;
}

const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function pitchToNote(frequency) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const target = 440 * 2 ** ((midi - 69) / 12);
  return { name: NOTES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1,
    cents: 1200 * Math.log2(frequency / target), frequency };
}

export class Tuner {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.state = 'idle';
    this.generation = 0;
  }

  async start() {
    if (this.state === 'listening' || this.state === 'requesting') return;
    const generation = ++this.generation;
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.state = 'unsupported';
      this.onUpdate();
      return;
    }
    this.state = 'requesting';
    this.onUpdate();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      await this.context.resume();
      if (generation !== this.generation) return;
      this.source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 4096;
      this.source.connect(this.analyser); // Never connect the microphone to speakers.
      this.samples = new Float32Array(this.analyser.fftSize);
      this.state = 'listening';
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (generation === this.generation) this.stop('unavailable');
      }));
      let lastMeasurement = -Infinity;
      const measure = (now = 0) => {
        if (generation !== this.generation) return;
        if (now - lastMeasurement < 100) {
          this.frame = requestAnimationFrame(measure);
          return;
        }
        lastMeasurement = now;
        this.analyser.getFloatTimeDomainData(this.samples);
        const frequency = detectPitch(this.samples, this.context.sampleRate);
        this.note = frequency ? pitchToNote(frequency) : null;
        this.onUpdate();
        this.frame = requestAnimationFrame(measure);
      };
      measure();
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop(error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }

  stop(state = 'idle') {
    ++this.generation;
    cancelAnimationFrame(this.frame);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context?.close().catch(() => {});
    this.source = this.stream = this.context = null;
    this.note = null;
    this.state = state;
    this.onUpdate();
  }
}
