import test from 'node:test';
import assert from 'node:assert/strict';
import { colorChord, normalizeArrangement } from '../site/src/arrangement-ornaments.js';
import { parseChord } from '../site/src/chords.js';
import { arrangeSong } from '../site/src/song-arrangement.js';
import { compileDraft, newDraft } from '../site/src/song-draft.js';
import { BACKING_STYLES } from '../site/src/arrangement.js';
import { add, compare, ZERO, fraction as f } from '../site/src/musical-time.js';
import { transposeArrangement, parseKey, keyAt } from '../site/src/transposition.js';
import { buildAccompaniment } from '../site/src/accompaniment.js';
import { scaleHarmony, keysFor } from '../site/src/harmony.js';

const enabled = { colors: true, fills: true };
function song(chords, forms = [], meter = '4/4') {
  const draft = newDraft();
  draft.sections[0].measures = chords.map((chords,i) => ({ chords, form: forms[i] ?? '', meter, alternate: '', text: '' }));
  return compileDraft(draft).compiled.song;
}

test('ornament settings are opt-in and do not coerce saved strings', () => {
  for (const value of [undefined, null, {}, { colors: 'true', fills: 1 }]) assert.deepEqual(normalizeArrangement(value), { colors: false, fills: false });
  assert.deepEqual(normalizeArrangement(enabled), enabled);
});

test('natural colors retain source guide tones and bass; explicit qualities stay authoritative', () => {
  const source = parseChord('G7/D'), before = structuredClone(source);
  const colored = colorChord(source, 'C', 1);
  assert.deepEqual(colored.addedPitchClasses, [9,4]);
  for (const pc of source.pitchClasses) assert.ok(colored.pitchClasses.includes(pc));
  assert.equal(colored.bassPitch, 2); assert.equal(colored.symbol, 'G7/D');
  assert.deepEqual(source, before);
  assert.deepEqual(colorChord(parseChord('Cmaj7'), 'C').addedPitchClasses, [2]);
  assert.deepEqual(colorChord(parseChord('Dm7'), 'C').addedPitchClasses, [4]);
  for (const symbol of ['G7b9','G7#5','G7alt','Cmaj9','C13','Csus4','Cdim7','Cm7b5','Break','N.C.']) {
    const chord = parseChord(symbol); assert.equal(colorChord(chord, 'C'), chord, symbol);
  }
  // Natural A/E colors of G7 would clash with the source C-minor scale.
  const dominant = parseChord('G7'); assert.equal(colorChord(dominant, 'Cm', 1), dominant);
});

test('colors affect only keys and leave source grids and slash-bass pitches untouched', () => {
  const source = song(['Dm7','G7/D','Cmaj7']), before = structuredClone(source);
  const plain = arrangeSong(source, { style: 'swing', seed: 13 });
  const rich = arrangeSong(source, { style: 'swing', seed: 13, arrangement: { colors: true } });
  assert.deepEqual(rich.song, before); assert.deepEqual(source, before);
  assert.deepEqual(rich.symbols, plain.symbols);
  for (let i = 0; i < rich.steps.length; i++) {
    assert.deepEqual(rich.steps[i].events.filter(e => e.part !== 'piano'), plain.steps[i].events.filter(e => e.part !== 'piano'));
    const keys = rich.steps[i].events.filter(e => e.part === 'piano');
    assert.ok(keys.length <= 4);
    assert.ok(keys.every(e => e.midi >= 48 && e.midi <= 76));
  }
  assert.ok(rich.steps.some(s => s.events.some(e => e.color)));
  assert.ok(rich.steps.filter(s => s.barIndex === 1).every(s => s.events.find(e => e.part === 'bass').midi % 12 === 2));
});

test('fills follow expanded repeats, section boundaries and the final played bar', () => {
  const source = song(['Cmaj7','G7','Fmaj7'], ['|:','[1 :|','[2 ]']);
  const result = arrangeSong(source, { arrangement: { fills: true } });
  const ends = result.steps.filter(s => s.beatIndex === 3);
  assert.deepEqual(ends.map(s => s.events.find(e => e.fill)?.fill ?? null), [null,'transition','transition','ending']);
  assert.equal(ends[1].barIndex, 1); assert.equal(ends.at(-1).barIndex, 2);
  const finalNotes = ends.at(-1).events.filter(e => e.kind === 'note');
  assert.ok(finalNotes.every(e => e.ending && e.offset.n === 0 && compare(e.duration, f(1,8)) <= 0));
  const sectioned = song(['C','G7']);
  sectioned.sections.push({ name: 'B', measures: [structuredClone(sectioned.sections[0].measures[0])] });
  const transition = arrangeSong(sectioned, { arrangement: { fills: true } }).steps.find(s => s.barIndex === 1 && s.beatIndex === 3);
  assert.ok(transition.events.some(e => e.fill === 'transition'));
});

test('all styles ornament mixed and compound meters inside exact pulses, without fills through rests', () => {
  for (const style of BACKING_STYLES) for (const meter of ['3/4','5/8','6/8','1/4']) {
    const source = song(['Cmaj7','G7','C','C','F','G7','C','C'], [], meter);
    const result = arrangeSong(source, { style, arrangement: enabled });
    assert.ok(result.steps.some(s => s.events.some(e => e.fill === 'phrase')));
    for (const step of result.steps) for (const event of step.events.filter(e => e.part)) {
      assert.ok(compare(event.offset, ZERO) >= 0);
      assert.ok(compare(add(event.offset, event.duration), step.duration) <= 0);
      assert.ok(event.velocity > 0 && event.velocity <= 1);
    }
  }
  for (const pause of ['Break','N.C.','']) {
    const result = arrangeSong(song(['C','C','C','G7',pause]), { arrangement: enabled });
    assert.equal(result.steps.some(s => s.events.some(e => e.fill)), false);
  }
  const partial = arrangeSong(song(['C:7/2 Break:1/2']), { arrangement: enabled });
  assert.equal(partial.steps.some(s => s.events.some(e => e.fill)), false);
});

test('seed reproduces colored notes and fill patterns, with independent selection streams', () => {
  const source = song(Array(8).fill('G7'));
  const result = arrangeSong(source, { seed: 42, arrangement: enabled });
  assert.deepEqual(arrangeSong(source, { seed: 42, arrangement: enabled }), result);
  const withFills = arrangeSong(source, { seed: 42, arrangement: enabled });
  const without = arrangeSong(source, { seed: 42, arrangement: { colors: true } });
  assert.deepEqual(withFills.steps.slice(0,-1).map(s => s.events.filter(e => e.color).map(e => e.midi)), without.steps.slice(0,-1).map(s => s.events.filter(e => e.color).map(e => e.midi)));
  const patterns = new Set();
  for (const seed of [0,1,42,1024,65536,4294967295]) {
    const arranged = arrangeSong(source, { seed, arrangement: enabled });
    patterns.add(JSON.stringify(arranged.steps.flatMap(s => s.events.filter(e => e.fill === 'phrase').map(({sound,offset}) => ({sound,offset})))));
  }
  assert.ok(patterns.size > 1);
});

test('practice supports ornaments in every key; training transposes colors and retains rhythmic fills', () => {
  for (const type of ['major','naturalMinor']) for (const key of keysFor(type)) {
    const source = buildAccompaniment(scaleHarmony(key,type), { style: 'swing', arrangement: enabled });
    const shifted = transposeArrangement(source, 5, keyAt(parseKey(source.song.key).pitch + 5, parseKey(source.song.key).minor));
    for (let i = 0; i < source.steps.length; i++) source.steps[i].events.forEach((event,j) => {
      const next = shifted.steps[i].events[j];
      if (event.kind === 'note') { assert.equal(next.midi, event.midi + 5); assert.equal(next.color, event.color); }
      else if (event.fill) assert.deepEqual(next, event);
    });
  }
});
