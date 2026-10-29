import test from 'node:test';
import assert from 'node:assert/strict';
import { fraction as f, ZERO } from '../site/src/musical-time.js';
import { compileSong } from '../site/src/song.js';
import { Transport } from '../site/src/transport.js';
import { Metronome } from '../site/src/metronome.js';

const pulse = (duration = f(1, 4)) => ({ duration, events: [{ kind: 'click', offset: ZERO }] });
function harness(options = {}) {
  const scheduled = [], heard = [], stopped = [];
  const context = { currentTime: 0, resume: async () => {} };
  const transport = new Transport({ context, steps: [pulse(), pulse(), pulse()],
    onSchedule: (event, timing) => scheduled.push({ event, ...timing }),
    onEvent: (event, timing) => heard.push({ event, ...timing }),
    onStop: () => stopped.push(context.currentTime),
    tickerFactory: () => ({ start() {}, stop() {}, dispose() {} }),
    requestFrame: () => 1, cancelFrame() {}, ...options,
  });
  return { transport, context, scheduled, heard, stopped,
    advance(time) { context.currentTime = time; transport.schedule(); transport.frame(); } };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('lookahead schedules audio early but delivers visuals at the audible time', async () => {
  const h = harness();
  await h.transport.start();
  near(h.scheduled[0].time, 0.05);
  assert.equal(h.heard.length, 0);
  assert.equal(h.transport.position(), null);
  h.advance(0.05);
  assert.equal(h.heard.length, 1);
  h.advance(0.3);
  near(h.transport.position().fraction, 0.5);
  h.advance(0.46);
  assert.equal(h.scheduled.length, 2);
  assert.equal(h.heard.length, 1);
  h.advance(0.55);
  assert.equal(h.heard[1].index, 1);
});

test('mixed meters keep clicks, chord changes and positions on one audio clock', async () => {
  const compiled = compileSong({ bpm: 120, sections: [{ measures: [
    { meter: { numerator: 3, denominator: 4 }, chords: [{ symbol: 'C', offset: ZERO, duration: f(3, 4) }] },
    { meter: { numerator: 6, denominator: 8 }, chords: [{ symbol: 'G7', offset: f(1, 8), duration: f(5, 8) }] },
  ] }] });
  const h = harness({ steps: compiled.steps });
  await h.transport.start();
  for (let i = 1; i <= 310; i++) h.advance(i / 100);
  const clicks = h.scheduled.filter(e => e.event.kind === 'click');
  [0.05, 0.55, 1.05, 1.55, 2.3].forEach((time, i) => near(clicks[i].time, time));
  const chords = h.scheduled.filter(e => e.event.kind === 'chord');
  near(chords[1].time, 1.8);
  assert.deepEqual(h.heard.map(e => e.time), h.scheduled.map(e => e.time));
  assert.equal(h.stopped.length, 1);
  assert.equal(h.transport.playing, false);
});

test('count-in omits harmony and loop boundaries are half-open with no duplicate downbeat', async () => {
  const steps = Array.from({ length: 3 }, () => ({ ...pulse(), events: [
    { kind: 'click', offset: ZERO }, { kind: 'chord', symbol: 'C', offset: ZERO },
  ] }));
  const h = harness({ steps });
  h.transport.setLoop(1, 3);
  await h.transport.start({ index: 1, countIn: [steps[0], steps[0]] });
  for (let i = 1; i <= 260; i++) h.advance(i / 100);
  assert.equal(h.scheduled.filter(e => e.countIn && e.event.kind === 'chord').length, 0);
  const clicks = h.scheduled.filter(e => e.event.kind === 'click');
  assert.deepEqual(clicks.map(e => e.countIn), [true, true, false, false, false, false]);
  assert.deepEqual(clicks.filter(e => !e.countIn).map(e => [e.index, e.cycle]), [[1, 0], [2, 0], [1, 1], [2, 1]]);
  clicks.forEach((e, i) => near(e.time, 0.05 + i * 0.5));
  assert.throws(() => h.transport.setLoop(2, 2));
  h.transport.stop();
});

test('tempo changes take effect on the next unscheduled pulse without moving queued timestamps', async () => {
  const h = harness({ nextStep: () => pulse() });
  await h.transport.start();
  h.transport.setBpm(60);
  h.advance(0.46);
  near(h.scheduled[1].time, 0.55);
  h.advance(1.46);
  near(h.scheduled[2].time, 1.55);
  h.transport.stop();
});

test('deadline excludes subdivisions after the timer and stops exactly once', async () => {
  const h = harness({ durationSeconds: () => 0.2, steps: [{ ...pulse(), events: [
    { kind: 'click', offset: ZERO }, { kind: 'click', offset: f(1, 8) },
  ] }] });
  await h.transport.start();
  assert.equal(h.scheduled.length, 1);
  h.advance(0.25);
  assert.equal(h.stopped.length, 1);
  h.advance(1);
  assert.equal(h.stopped.length, 1);
});

function source() {
  return { stops: [], cleanups: 0, addEventListener(type, fn) { this.ended = fn; },
    stop(time) { this.stops.push(time); }, disconnect() { this.cleanups++; } };
}

test('stop and seek cancel future sources, active tails and old visual events', async () => {
  const h = harness();
  await h.transport.start();
  const active = source(), future = source();
  h.transport.track(active);
  h.transport.track(future);
  h.context.currentTime = 0.01;
  h.transport.seek(2);
  assert.deepEqual(active.stops, [0.01]);
  assert.deepEqual(future.stops, [0.01]);
  assert.equal(active.cleanups, 1);
  active.ended();
  assert.equal(active.cleanups, 1);
  h.advance(0.07);
  assert.deepEqual(h.heard.map(e => e.index), [2]);
  h.transport.stop();
  assert.equal(h.transport.queue.length, 0);
  assert.equal(h.transport.sources.size, 0);
  assert.equal(h.transport.position(), null);
});

test('stop cancels pending resume, and an old resume cannot restart a newer run', async () => {
  const resolvers = [];
  const h = harness();
  h.context.resume = () => new Promise(resolve => resolvers.push(resolve));
  const old = h.transport.start();
  await h.transport.start(); // duplicate start while pending
  assert.equal(resolvers.length, 1);
  h.transport.stop();
  const current = h.transport.start({ index: 0 });
  resolvers[0]();
  await old;
  assert.equal(h.transport.playing, false);
  resolvers[1]();
  await current;
  assert.equal(h.transport.playing, true);
  assert.equal(h.scheduled.length, 1);
  h.transport.stop();
});

test('standalone BPM counts the selected denominator note', () => {
  const metronome = new Metronome();
  metronome.setBpm(120);
  metronome.setNoteValue(8);
  assert.deepEqual(metronome.transport.tempoUnit, f(1, 8));
  const step = metronome.transport.nextStep(0);
  assert.deepEqual(step.duration, f(1, 8));
  metronome.subdivision = 'triplets';
  assert.deepEqual(metronome.transport.nextStep(0).events.map(e => e.offset), [ZERO, f(1, 24), f(1, 12)]);
});

test('finite ending clips sustained voices on the audio clock before a UI frame runs', async () => {
  const h = harness({ steps: [pulse(), pulse()] });
  await h.transport.start();
  const tail = source();
  h.transport.track(tail, () => tail.disconnect(), 10);
  h.context.currentTime = 0.46;
  h.transport.schedule();
  near(tail.stops.at(-1), 1.05);
  assert.equal(h.stopped.length, 0);
  assert.equal(h.transport.playing, true);
  h.context.currentTime = 1.05;
  h.transport.frame();
  assert.equal(h.stopped.length, 1);
  await h.transport.start();
  assert.equal(h.scheduled.at(-1).index, 0);
  h.transport.stop();
});

test('loop rewind clips previous voices without cancelling the new pass', async () => {
  const h = harness({ steps: [pulse()] });
  h.transport.setLoop(0, 1);
  await h.transport.start();
  const tail = source();
  h.transport.track(tail, () => tail.disconnect(), 10);
  h.context.currentTime = 0.46;
  h.transport.schedule();
  near(tail.stops.at(-1), 0.55);
  const next = source();
  h.transport.track(next, () => next.disconnect(), 0.8);
  near(next.stops.at(-1), 0.8);
  assert.equal(h.scheduled.at(-1).cycle, 1);
  h.transport.stop();
});
