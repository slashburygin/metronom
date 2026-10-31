import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleHarmony, SCALE_TYPES, keysFor } from '../site/src/harmony.js';
import { buildAccompaniment, practiceChords, pitchClass, midiFrequency, BACKING_FORMS, BACKING_STYLES } from '../site/src/accompaniment.js';
import { fraction as f, ZERO, add, compare } from '../site/src/musical-time.js';
import { BackingPlayer } from '../site/src/backing-player.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8);
test('spelled notes including double accidentals map to equal-tempered sound', () => {
  assert.equal(pitchClass('E♯'), 5);
  assert.equal(pitchClass('B♭♭'), 9);
  assert.equal(pitchClass('F♯♯'), 7);
  assert.equal(pitchClass('C♭'), 11);
  near(midiFrequency(69), 440);
  assert.throws(() => pitchClass('H'));
});

test('four-bar cadence holds tonic for two bars in every supported scale and key', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) {
    const harmony = scaleHarmony(key, type);
    const result = buildAccompaniment(harmony);
    assert.deepEqual(result.symbols, [...harmony.progression.map(c => c.symbol), harmony.progression[2].symbol]);
    assert.equal(result.steps.length, 16);
    assert.deepEqual(result.duration, f(4));
    const dominant = result.steps[4].events.find(e => e.part === 'piano' && e.kind === 'note');
    assert.ok(dominant);
  }
});

test('major and minor blues preserve root spelling and twelve-bar form', () => {
  const harmony = scaleHarmony('C♯', 'naturalMinor');
  assert.deepEqual(practiceChords(harmony, 'majorBlues').map(c => c.symbol), [
    'C♯7','C♯7','C♯7','C♯7','F♯7','F♯7','C♯7','C♯7','G♯7','F♯7','C♯7','G♯7',
  ]);
  const minor = practiceChords(harmony, 'minorBlues');
  assert.equal(minor[0].symbol, 'C♯m7');
  assert.equal(minor[4].symbol, 'F♯m7');
  assert.equal(minor[8].symbol, 'G♯7');
  assert.equal((minor[8].notes[1] - minor[8].notes[0] + 12) % 12, 4);
});

test('all styles stay inside pulses; only marked walking approaches leave chord tones', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) for (const form of BACKING_FORMS) for (const style of BACKING_STYLES) {
    const harmony = scaleHarmony(key, type);
    const chords = practiceChords(harmony, form);
    const result = buildAccompaniment(harmony, { form, style });
    for (const step of result.steps) {
      const pcs = chords[step.barIndex].notes.map(n => typeof n === 'number' ? n : pitchClass(n));
      for (const event of step.events) {
        assert.ok(compare(event.offset, ZERO) >= 0 && compare(event.offset, step.duration) < 0);
        if (event.part && event.duration) assert.ok(compare(add(event.offset, event.duration), step.duration) <= 0);
        if (event.kind === 'note') {
          if (event.approach) {
            assert.equal(style, 'swing'); assert.equal(event.part, 'bass'); assert.equal(step.beatIndex, 3);
            const next = chords[step.barIndex + 1]; assert.ok(next);
            const root = typeof next.notes[0] === 'number' ? next.notes[0] : pitchClass(next.notes[0]);
            assert.equal((event.midi + 1) % 12, root);
          } else assert.ok(pcs.includes(event.midi % 12), `${key} ${form} ${event.midi}`);
          assert.ok(event.midi >= 36 && event.midi <= 95);
        }
      }
      const hats = step.events.filter(e => e.sound === 'hat');
      if (['straight','swing','bossa','ballad','rock'].includes(style)) assert.deepEqual(hats.map(e => e.offset), style === 'ballad' ? [ZERO] : [ZERO, style === 'swing' ? f(1, 6) : f(1, 8)]);
    }
  }
});

function audioContext() {
  const sources = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
  const node = () => ({ connect(destination) { return destination; }, disconnect() {}, gain: param(), frequency: param(), Q: param() });
  const source = () => { const s = { ...node(), start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; }, addEventListener() {} }; sources.push(s); return s; };
  return { currentTime: 0, sampleRate: 48000, destination: node(), resume: async () => {}, sources,
    createGain: node, createDynamicsCompressor: node, createBiquadFilter: node,
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }), createBufferSource: source, createOscillator: source };
}

test('player count-in is click-only; finite repetitions stop all voices and live mute changes gain', async () => {
  const context = audioContext();
  const heard = [];
  let finished = 0;
  const player = new BackingPlayer({ context, onStep: t => heard.push(t), onStop: () => finished++,
    transportOptions: { tickerFactory: () => ({ start() {}, stop() {}, dispose() {} }), requestFrame: () => 1, cancelFrame() {} } });
  const compiled = buildAccompaniment(scaleHarmony('C'));
  await player.start(compiled, { bpm: 300, repeats: 2, countIn: true });
  assert.equal(context.sources.length, 1);
  player.setPart('bass', 0.7, true);
  assert.equal(player.channels.bass.gain.value, 0);
  player.setPart('bass', 0.7, false);
  assert.equal(player.channels.bass.gain.value, 0.7);
  for (let i = 1; i <= 730; i++) {
    context.currentTime = i / 100;
    player.transport.schedule(); player.transport.frame();
  }
  assert.equal(finished, 1);
  assert.equal(heard.filter(t => !t.countIn).length, 32);
  assert.deepEqual([...new Set(heard.filter(t => !t.countIn).map(t => t.step.pass))], [1, 2]);
  assert.equal(player.transport.sources.size, 0);
  assert.ok(context.sources.every(source => Number.isFinite(source.stopTime)));
  player.dispose();
});
