import test from 'node:test';
import assert from 'node:assert/strict';
import { fraction as f, add, multiply, secondsFor } from '../site/src/musical-time.js';
import { compileSong, normalizeMeter } from '../site/src/song.js';

test('musical durations remain exact through tuplets, JSON and long forms', () => {
  let total = f(0);
  for (let i = 0; i < 3000; i++) total = add(total, f(1, 12));
  assert.deepEqual(total, f(250));
  assert.deepEqual(multiply(f(3, 8), f(2, 3)), f(1, 4));
  assert.equal(secondsFor(f(3, 8), 120, f(3, 8)), 0.5);
  assert.deepEqual(JSON.parse(JSON.stringify(f(6, 8))), f(3, 4));
  assert.throws(() => f(1, 0));
  assert.throws(() => f(0.5));
  assert.throws(() => add(f(Number.MAX_SAFE_INTEGER), f(1)));
});

function mixedSong() {
  return compileSong({ title: 'Mixed meter', bpm: 120, sections: [{ name: 'A', measures: [
    { meter: { numerator: 4, denominator: 4 }, chords: [
      { symbol: 'Dm7', offset: f(0), duration: f(1, 2) },
      { symbol: 'G7', offset: f(1, 2), duration: f(1, 2) },
    ] },
    { meter: { numerator: 3, denominator: 4 }, chords: [{ symbol: 'Cmaj7', offset: f(0), duration: f(3, 4) }] },
    { meter: { numerator: 6, denominator: 8 }, chords: [
      { symbol: 'F/C', offset: f(1, 8), duration: f(5, 8) },
    ] },
  ] }] });
}

test('song compiles mixed meters and off-pulse chords on the same exact timeline', () => {
  const compiled = mixedSong();
  assert.equal(compiled.steps.length, 9);
  assert.deepEqual(compiled.duration, f(5, 2));
  assert.deepEqual(compiled.steps[7].position, f(7, 4));
  assert.deepEqual(compiled.steps[7].duration, f(3, 8));
  assert.deepEqual(compiled.steps[7].events[1], { kind: 'chord', symbol: 'F/C', offset: f(1, 8), duration: f(5, 8) });
  assert.deepEqual(compileSong(JSON.parse(JSON.stringify(compiled.song))), compiled);
});

test('grouping supports compound and asymmetric pulses explicitly', () => {
  assert.deepEqual(normalizeMeter({ numerator: 6, denominator: 8 }).groups, [3, 3]);
  assert.deepEqual(normalizeMeter({ numerator: 5, denominator: 8, groups: [2, 3] }).groups, [2, 3]);
  assert.throws(() => normalizeMeter({ numerator: 5, denominator: 8, groups: [3, 3] }));
});

test('invalid forms, overflowing and overlapping chords fail before playback', () => {
  const song = chord => ({ sections: [{ measures: [{ chords: [chord] }] }] });
  assert.throws(() => compileSong({ sections: [] }));
  assert.throws(() => compileSong(song({ symbol: 'C', offset: f(3, 4), duration: f(1, 2) })));
  assert.throws(() => compileSong(song({ symbol: 'C', offset: f(-1, 4), duration: f(1, 2) })));
  assert.throws(() => compileSong(song({ symbol: '', offset: f(0), duration: f(1) })));
  assert.throws(() => compileSong({ sections: [{ measures: [{ chords: [
    { symbol: 'C', offset: f(0), duration: f(1) },
    { symbol: 'G', offset: f(1, 2), duration: f(1, 2) },
  ] }] }] }));
});
