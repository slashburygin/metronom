import test from 'node:test';
import assert from 'node:assert/strict';
import { MAJOR_KEYS, majorHarmony } from '../site/src/harmony.js';

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
