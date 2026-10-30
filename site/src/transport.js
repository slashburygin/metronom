import { QUARTER, ZERO, asFraction, secondsFor } from './musical-time.js';
import { clampBpm } from './tempo.js';

export function createTicker(onTick) {
  let url;
  try {
    const src = 'let id=null;onmessage=e=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data)}';
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = onTick;
    return { start: ms => worker.postMessage(ms), stop: () => worker.postMessage(0), dispose: () => worker.terminate() };
  } catch {
    let id;
    return { start: ms => { clearInterval(id); id = setInterval(onTick, ms); }, stop: () => clearInterval(id), dispose: () => clearInterval(id) };
  } finally { if (url) URL.revokeObjectURL(url); }
}

// One audio clock for every part. nextStep(index) returns a musical pulse or null.
// Schedule callbacks receive future audio timestamps; UI callbacks run only when
// those timestamps are heard. A loop is a half-open range of pulse indices.
export class Transport {
  constructor({ context, steps, nextStep = index => steps[index] ?? null,
    bpm = 120, tempoUnit = QUARTER, onSchedule, onEvent, onStep, onStop,
    durationSeconds = () => 0, tickerFactory = createTicker,
    requestFrame = fn => requestAnimationFrame(fn), cancelFrame = id => cancelAnimationFrame(id),
  } = {}) {
    this.context = context;
    this.nextStep = nextStep;
    this.bpm = clampBpm(bpm);
    this.tempoUnit = asFraction(tempoUnit);
    if (this.tempoUnit.n <= 0) throw new RangeError('Tempo unit must be positive');
    Object.assign(this, { onSchedule, onEvent, onStep, onStop, durationSeconds, tickerFactory, requestFrame, cancelFrame });
    this.playing = false;
    this.pending = false;
    this.generation = 0;
    this.index = 0;
    this.startIndex = 0;
    this.loop = null;
    this.sources = new Map();
    this.queue = [];
    this.lastStep = null;
    this.frame = this.frame.bind(this);
  }

  setBpm(bpm) { this.bpm = clampBpm(bpm); }
  get until() {
    const duration = this.durationSeconds();
    return duration > 0 ? this.startedAt + duration : Infinity;
  }

  setLoop(start, end) {
    if (start === null) { this.loop = null; return; }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start
        || !this.nextStep(start) || !this.nextStep(end - 1)) throw new RangeError('Invalid loop');
    this.loop = { start, end };
  }

  async start({ index = this.startIndex, countIn = [] } = {}) {
    if (this.playing || this.pending) return;
    if (!Number.isInteger(index) || index < 0 || !this.nextStep(index)) throw new RangeError('Invalid start position');
    if (!Array.isArray(countIn)) throw new TypeError('Expected count-in pulses');
    const generation = ++this.generation;
    this.pending = true;
    try {
      await this.context.resume();
      if (generation !== this.generation) return;
      this.pending = false;
      this.playing = true;
      this.index = index;
      this.startIndex = index;
      this.countIn = [...countIn];
      this.countInIndex = 0;
      this.count = 0;
      this.cycle = 0;
      this.queue = [];
      this.lastStep = null;
      this.startedAt = this.nextTime = this.context.currentTime + 0.05;
      this.endTime = Infinity;
      this.schedule();
      this.ticker ??= this.tickerFactory(() => this.schedule());
      this.ticker.start(25);
      this.frameId = this.requestFrame(this.frame);
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }

  // Register every oscillator/buffer source immediately after scheduling it.
  // Stopping overrides its scheduled stop and disconnects its entire voice.
  track(source, cleanup = () => source.disconnect(), stopAt = Infinity) {
    const end = Math.min(stopAt, this.until, this.endTime);
    this.sources.set(source, { cleanup, stopAt: end });
    source.addEventListener('ended', () => {
      if (!this.sources.has(source)) return;
      this.sources.delete(source);
      cleanup();
    }, { once: true });
    if (Number.isFinite(end)) source.stop(end);
  }

  clipAudio(end) {
    for (const [source, voice] of this.sources) {
      if (voice.stopAt > end) {
        source.stop(end);
        voice.stopAt = end;
      }
    }
  }

  cancelAudio() {
    for (const [source, { cleanup }] of this.sources) {
      source.stop(this.context.currentTime);
      cleanup();
    }
    this.sources.clear();
    this.queue = [];
    this.lastStep = null;
  }

  stop() {
    ++this.generation;
    this.playing = this.pending = false;
    this.ticker?.stop();
    if (this.frameId !== undefined) this.cancelFrame(this.frameId);
    this.frameId = undefined;
    this.cancelAudio();
  }

  seek(index) {
    if (!Number.isInteger(index) || index < 0 || !this.nextStep(index)) throw new RangeError('Invalid seek position');
    if (this.pending) this.stop();
    this.cancelAudio();
    this.index = index;
    this.startIndex = index;
    this.countIn = [];
    this.countInIndex = 0;
    this.count = this.cycle = 0;
    this.endTime = Infinity;
    if (this.playing) {
      this.nextTime = this.context.currentTime + 0.05;
      this.schedule();
    }
  }

  schedule() {
    if (!this.playing) return;
    const horizon = this.context.currentTime + 0.1;
    while (this.nextTime < horizon && this.nextTime < this.until && this.nextTime < this.endTime) {
      const countIn = this.countInIndex < this.countIn.length;
      if (!countIn && this.loop && this.index >= this.loop.end) {
        this.clipAudio(this.nextTime);
        this.index = this.loop.start;
        this.cycle++;
      }
      const step = countIn ? this.countIn[this.countInIndex++] : this.nextStep(this.index);
      if (!step) { this.endTime = this.nextTime; break; }
      const bpm = step.bpm ?? this.bpm;
      const duration = secondsFor(step.duration, bpm, this.tempoUnit);
      if (!(duration > 0)) throw new RangeError('Pulse duration must be positive');
      if (!countIn && !this.loop && !this.nextStep(this.index + 1)) this.endTime = this.nextTime + duration;
      const timing = { step, index: this.index, count: this.count++, cycle: this.cycle, countIn, time: this.nextTime, duration, bpm };
      this.queue.push({ type: 'step', timing, time: this.nextTime });
      for (const event of step.events ?? []) {
        if (countIn && event.kind !== 'click') continue;
        const time = this.nextTime + secondsFor(event.offset ?? ZERO, bpm, this.tempoUnit);
        if (time >= this.until) continue;
        const eventTiming = { ...timing, time, duration: event.duration ? secondsFor(event.duration, bpm, this.tempoUnit) : duration };
        this.onSchedule?.(event, eventTiming);
        this.queue.push({ type: 'event', event, timing: eventTiming, time });
      }
      this.nextTime += duration;
      if (!countIn) this.index++;
    }
    this.clipAudio(Math.min(this.until, this.endTime));
    this.queue.sort((a, b) => a.time - b.time);
  }

  position() {
    if (!this.lastStep) return null;
    const { time, duration } = this.lastStep;
    return { ...this.lastStep, fraction: Math.max(0, Math.min(1, (this.context.currentTime - time) / duration)) };
  }

  frame() {
    if (!this.playing) return;
    const now = this.context.currentTime;
    if (now >= Math.min(this.until, this.endTime)) {
      this.stop();
      this.onStop?.();
      return;
    }
    while (this.queue.length && this.queue[0].time <= now) {
      const item = this.queue.shift();
      if (item.type === 'step') {
        this.lastStep = item.timing;
        this.onStep?.(item.timing);
      } else this.onEvent?.(item.event, item.timing);
      if (!this.playing) return;
    }
    this.frameId = this.requestFrame(this.frame);
  }

  dispose() { this.stop(); this.ticker?.dispose(); }
}
