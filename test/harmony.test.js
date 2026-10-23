import test from 'node:test';
import assert from 'node:assert/strict';
import { MAJOR_KEYS, MINOR_KEYS, SCALE_TYPES, SCALE_INTERVALS, keysFor, scaleHarmony, majorHarmony } from '../site/src/harmony.js';

test('C major chords and ii–V–I guide tones', () => {
  const harmony = majorHarmony('C');
  assert.deepEqual(harmony.chords.map((chord) => chord.symbol), ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  assert.deepEqual(harmony.progression.map((chord) => chord.notes), [['D', 'F', 'A', 'C'], ['G', 'B', 'D', 'F'], ['C', 'E', 'G', 'B']]);
  assert.deepEqual(harmony.guideTones, [['F', 'F', 'E'], ['C', 'B', 'B']]);
});

test('all twelve keys retain major intervals, diatonic spelling and seventh chord qualities', () => {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitch = (note) => (natural[note[0]] + (note.includes('♯') ? 1 : note.includes('♭') ? -1 : 0) + 12) % 12;
  const expectedChords = [[0, 4, 7, 11], [0, 3, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 10], [0, 3, 7, 10], [0, 3, 6, 10]];
  assert.equal(new Set(MAJOR_KEYS.map(pitch)).size, 12);
  for (const key of MAJOR_KEYS) {
    const { notes, chords } = majorHarmony(key);
    assert.equal(new Set(notes.map((note) => note[0])).size, 7, key);
    assert.deepEqual(notes.map((note) => (pitch(note) - pitch(key) + 12) % 12), [0, 2, 4, 5, 7, 9, 11], key);
    chords.forEach((chord, index) => assert.deepEqual(chord.notes.map((note) => (pitch(note) - pitch(chord.notes[0]) + 12) % 12), expectedChords[index], chord.symbol));
  }
  assert.deepEqual(majorHarmony('F♯').notes, ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
  assert.deepEqual(majorHarmony('D♭').notes, ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C']);
  assert.throws(() => majorHarmony('invalid'), RangeError);
});


test('minor scales, seventh chord qualities and functional minor cadences in every key', () => {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pitch = (note) => (natural[note[0]] + [...note].filter((c) => c === '♯').length - [...note].filter((c) => c === '♭').length + 24) % 12;
  const qualities = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10], 'm7♭5': [0, 3, 6, 10], 'm(maj7)': [0, 3, 7, 11], '+maj7': [0, 4, 8, 11], dim7: [0, 3, 6, 9] };
  for (const type of SCALE_TYPES.slice(1)) {
    assert.equal(new Set(keysFor(type).map(pitch)).size, 12);
    for (const key of MINOR_KEYS) {
      const h = scaleHarmony(key, type);
      assert.equal(new Set(h.notes.map((note) => note[0])).size, 7);
      assert.deepEqual(h.notes.map((note) => (pitch(note) - pitch(key) + 12) % 12), SCALE_INTERVALS[type], `${key} ${type}`);
      for (const chord of [...h.chords, ...h.progression]) {
        const quality = chord.symbol.slice(chord.notes[0].length);
        assert.deepEqual(chord.notes.map((note) => (pitch(note) - pitch(chord.notes[0]) + 12) % 12), qualities[quality], `${type} ${chord.symbol}`);
      }
      assert.deepEqual(h.guideTones, [[h.progression[0].notes[1], h.progression[1].notes[3], h.progression[2].notes[1]], [h.progression[0].notes[3], h.progression[1].notes[1], h.progression[2].notes[3]]]);
    }
  }
  assert.deepEqual(scaleHarmony('A', 'naturalMinor').notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(scaleHarmony('A', 'harmonicMinor').notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G♯']);
  assert.deepEqual(scaleHarmony('A', 'melodicMinor').notes, ['A', 'B', 'C', 'D', 'E', 'F♯', 'G♯']);
  assert.deepEqual(scaleHarmony('C', 'naturalMinor').progression.map((chord) => chord.symbol), ['Dm7♭5', 'G7', 'Cm7']);
  assert.deepEqual(scaleHarmony('C', 'harmonicMinor').progression.map((chord) => chord.symbol), ['Dm7♭5', 'G7', 'Cm(maj7)']);
  assert.deepEqual(scaleHarmony('C', 'melodicMinor').progression.map((chord) => chord.symbol), ['Dm7', 'G7', 'Cm(maj7)']);
});
