import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSound, roomImpulse } from '../site/src/backing-sound.js';
import { BackingPlayer } from '../site/src/backing-player.js';
import { arrangeSong } from '../site/src/song-arrangement.js';
import { compileDraft, newDraft } from '../site/src/song-draft.js';

function context() {
  const nodes = [], sources = [];
  const param = () => ({ value: 0, events: [], setValueAtTime(value, time) { this.events.push([value,time]); },
    exponentialRampToValueAtTime(value, time) { this.events.push([value,time]); }, setTargetAtTime(value) { this.value = value; } });
  const node = kind => { const n = { kind, connections: [], gain: param(), frequency: param(), Q: param(),
    connect(destination) { this.connections.push(destination); return destination; }, disconnect() { this.connections = []; this.disconnected = true; } }; nodes.push(n); return n; };
  const source = kind => { const n = { ...node(kind), start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; }, addEventListener() {} }; sources.push(n); return n; };
  return { currentTime: 0, sampleRate: 44100, destination: node('destination'), nodes, sources, resume: async () => {},
    createGain: () => node('gain'), createDynamicsCompressor: () => node('compressor'), createBiquadFilter: () => node('filter'), createConvolver: () => node('convolver'),
    createOscillator: () => source('oscillator'), createBufferSource: () => source('bufferSource'),
    createBuffer: (count, length) => { const data = Array.from({ length: count }, () => new Float32Array(length)); return { getChannelData: channel => data[channel] }; } };
}
const options = { tickerFactory: () => ({ start() {}, stop() {}, dispose() {} }), requestFrame: () => 1, cancelFrame() {} };
const makePlayer = ctx => new BackingPlayer({ context: ctx, transportOptions: options });
const note = (part = 'piano') => ({ kind: 'note', part, frequency: 220, duration: 0.3, velocity: 0.5 });

test('saved sound settings reject unknown tones and normalize reverb without coercion', () => {
  for (const value of [null, {}, 'bad', { pianoTone: 'unknown', bassTone: 'constructor', reverb: '0.4' }])
    assert.deepEqual(normalizeSound(value), { pianoTone: 'piano', bassTone: 'acoustic', reverb: 0 });
  assert.deepEqual(normalizeSound({ pianoTone: 'organ', bassTone: 'electric', reverb: 2 }), { pianoTone: 'organ', bassTone: 'electric', reverb: 1 });
  assert.equal(normalizeSound({ reverb: -1 }).reverb, 0);
  for (const value of [NaN, Infinity]) assert.equal(normalizeSound({ reverb: value }).reverb, 0);
});

test('room impulse is deterministic, stereo, finite and decaying at either sample rate', () => {
  for (const sampleRate of [44100,48000]) {
    const ctx = { ...context(), sampleRate };
    const a = roomImpulse(ctx), b = roomImpulse(ctx);
    assert.deepEqual(a.getChannelData(0), b.getChannelData(0));
    assert.notDeepEqual(a.getChannelData(0), a.getChannelData(1));
    const data = a.getChannelData(0);
    assert.equal(data.length, Math.ceil(sampleRate * 1.2));
    assert.ok(data.every(Number.isFinite));
    assert.ok(data.slice(0, Math.round(sampleRate * 0.015)).every(n => n === 0));
    const energy = values => values.reduce((sum, n) => sum + n * n, 0);
    assert.ok(Math.abs(energy(data) - 0.36) < 1e-7);
    assert.ok(energy(data.slice(-data.length / 4)) < energy(data.slice(data.length / 4, data.length / 2)) / 100);
  }
});

test('timbres change the spectrum and all voices remain owned by the transport', () => {
  const signatures = [];
  for (const pianoTone of ['piano','electric','organ']) for (const bassTone of ['acoustic','electric']) {
    const ctx = context(), player = makePlayer(ctx);
    player.setSound({ pianoTone, bassTone });
    player.voice(note(), 0.05); player.voice(note('bass'), 0.05);
    signatures.push(JSON.stringify(ctx.sources.map(s => [s.type,s.frequency.events,s.connections.map(n => n.gain.value)])));
    assert.ok(ctx.sources.every(s => s.stopTime === 0.35));
    assert.equal(player.transport.sources.size, ctx.sources.length);
    assert.equal(player.reverb.graphs.size, 0); // dry mode allocates no convolution
    player.stop();
    assert.equal(player.transport.sources.size, 0);
    assert.ok(ctx.sources.every(s => s.disconnected));
    player.dispose();
  }
  assert.equal(new Set(signatures).size, 6);
});

test('reverb returns before the part mixer; count-in stays dry and silence resets only affected parts', () => {
  const ctx = context(), player = makePlayer(ctx);
  player.setSound({ reverb: 1 });
  player.voice(note(), 0.05); player.voice(note('bass'), 0.05);
  player.voice({ part: 'drums', sound: 'hat', duration: 0.1, velocity: 0.5 }, 0.05);
  const graphs = [...player.reverb.graphs];
  for (const graph of graphs) assert.deepEqual(graph.gate.connections, [player.channels[graph.part]]);
  player.schedule({ kind: 'click', accent: true }, { countIn: true, time: 0.1 });
  assert.equal(player.reverb.graphs.size, 3);
  player.setPart('piano', 1, true); assert.equal(player.channels.piano.gain.value, 0);
  player.schedule({ kind: 'silence', parts: ['bass','piano'] }, { time: 0.2 });
  assert.ok(graphs.filter(g => g.part !== 'drums').every(g => g.gate.gain.events.some(([value,time]) => value === 0 && time === 0.2)));
  const drum = graphs.find(g => g.part === 'drums'); assert.equal(drum.end, Infinity);
  player.voice(note(), 0.4);
  assert.notEqual(player.reverb.current.get('piano'), graphs.find(g => g.part === 'piano'));
  assert.equal(player.reverb.current.get('drums'), drum);
  ctx.currentTime = 0.3; player.reverb.collect();
  assert.ok(graphs.filter(g => g.part !== 'drums').every(g => g.convolver.disconnected));
  player.stop(); assert.equal(player.reverb.graphs.size, 0);
  assert.ok(graphs.every(g => g.convolver.disconnected));
  player.dispose();
});

test('finite end, loop and seek clip effects before visual frames and do not reuse old tails', async () => {
  const draft = newDraft(); draft.sections[0].measures = [{ meter: '1/4', chords: 'Cmaj7', text: '', alternate: '' }];
  const compiled = arrangeSong(compileDraft(draft).compiled.song);
  const ctx = context(), player = makePlayer(ctx);
  await player.start(compiled, { bpm: 300, repeats: 1, countIn: false, sound: { reverb: 1 } });
  const first = [...player.reverb.graphs]; assert.ok(first.length > 0);
  assert.ok(first.every(g => g.gate.gain.events.some(([value,time]) => value === 0 && Math.abs(time - 0.25) < 1e-8)));
  // No requestAnimationFrame has executed; the audio deadline is already set.
  assert.equal(player.transport.playing, true);
  player.stop(); assert.equal(player.reverb.graphs.size, 0);
  await player.start(compiled, { bpm: 300, repeats: 0, countIn: false, sound: { reverb: 1 } });
  const beforeSeek = [...player.reverb.graphs];
  player.transport.seek(0);
  assert.ok(beforeSeek.every(g => g.convolver.disconnected));
  player.transport.setLoop(0,1);
  const beforeLoop = [...player.reverb.graphs];
  ctx.currentTime = 0.2; player.transport.schedule();
  assert.ok(beforeLoop.every(g => Number.isFinite(g.end)));
  assert.ok([...player.reverb.graphs].some(g => !beforeLoop.includes(g)));
  player.dispose(); assert.equal(player.reverb.graphs.size, 0);
  const timed = new BackingPlayer({ context: ctx, transportOptions: { ...options, durationSeconds: () => 0.1 } });
  await timed.start(compiled, { bpm: 120, repeats: 0, countIn: false, sound: { reverb: 1 } });
  assert.ok([...timed.reverb.graphs].every(g => Math.abs(g.end - (ctx.currentTime + 0.15)) < 1e-8));
  timed.dispose();
});

test('arranger emits exact effect boundaries for Break, N.C. and empty harmony', () => {
  const draft = newDraft(); draft.sections[0].measures = [{ meter: '4/4', chords: 'C:1/2 Break:1/2 N.C.:1 C:2', text: '', alternate: '' },
    { meter: '4/4', chords: '', text: '', alternate: '' }];
  const result = arrangeSong(compileDraft(draft).compiled.song);
  const silence = result.steps[0].events.find(e => e.kind === 'silence');
  assert.deepEqual(silence.parts, ['bass','piano','drums']);
  assert.deepEqual(silence.offset, { n: 1, d: 8 });
  assert.deepEqual(result.steps[1].events.find(e => e.kind === 'silence').parts, ['bass','piano']);
  assert.deepEqual(result.steps[4].events.find(e => e.kind === 'silence').parts, ['bass','piano']);
});
