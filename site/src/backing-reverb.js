import { roomImpulse } from './backing-sound.js';

// Each part has its own return before the mixer, so mute also silences tails.
// A new graph after a pause cannot pick up any old convolver history.
export class BackingReverb {
  constructor(context, channels) {
    this.context = context;
    this.channels = channels;
    this.graphs = new Set();
    this.current = new Map();
  }

  connect(part, voice, time, amount, end = Infinity) {
    if (!amount || !this.channels[part]) return;
    this.collect();
    let graph = this.current.get(part);
    if (!graph || graph.end <= time) {
      this.impulse ??= roomImpulse(this.context);
      const convolver = this.context.createConvolver(), gate = this.context.createGain();
      convolver.normalize = false;
      convolver.buffer = this.impulse;
      gate.gain.value = amount * 0.45;
      convolver.connect(gate).connect(this.channels[part]);
      graph = { part, convolver, gate, end };
      if (Number.isFinite(end)) gate.gain.setValueAtTime(0, end);
      this.graphs.add(graph); this.current.set(part, graph);
    }
    voice.connect(graph.convolver);
  }

  clip(end, parts = Object.keys(this.channels)) {
    if (!Number.isFinite(end)) return;
    for (const graph of this.graphs) if (parts.includes(graph.part) && graph.end > end) {
      graph.gate.gain.setValueAtTime(0, end);
      graph.end = end;
      if (this.current.get(graph.part) === graph) this.current.delete(graph.part);
    }
  }

  collect() {
    for (const graph of this.graphs) if (graph.end <= this.context.currentTime) this.remove(graph);
  }

  remove(graph) {
    graph.convolver.disconnect(); graph.gate.disconnect();
    this.graphs.delete(graph);
    if (this.current.get(graph.part) === graph) this.current.delete(graph.part);
  }

  cancel() { for (const graph of this.graphs) this.remove(graph); }
  dispose() { this.cancel(); this.impulse = null; }
}
