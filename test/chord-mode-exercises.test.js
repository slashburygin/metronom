import test from 'node:test';
import assert from 'node:assert/strict';
import { chordModeExercises } from '../site/src/chord-mode-exercises.js';
import { SCALE_TYPES, keysFor, scaleHarmony } from '../site/src/harmony.js';

test('twelve chord/mode tasks retain modal spelling and compound degrees in every key', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) for (let mode = 0; mode < 7; mode++) {
    const data = chordModeExercises(key, type, mode), harmony = scaleHarmony(key, type);
    assert.equal(data.exercises.length, 12);
    assert.equal(data.tonic, harmony.notes[mode]);
    assert.equal(data.chord, harmony.chords[mode].symbol);
    assert.deepEqual(data.exercises[5].notes.map(n => n.name), harmony.chords[mode].notes);
    const ninth = data.exercises[6].notes.at(-1);
    assert.equal(ninth.name, data.notes[1]); assert.equal(ninth.octave, 1); assert.equal(ninth.degree, 9);
    assert.deepEqual(data.exercises[8].degrees, [1,3,5,6]);
    for (const exercise of data.exercises) {
      assert.equal(exercise.notes[0].name, data.tonic);
      assert.ok(exercise.notes.every(n => harmony.notes.includes(n.name)));
    }
  }
});

test('mixed scale/arpeggio routes and descending broken thirds follow the supplied plan', () => {
  const data = chordModeExercises('C', 'major', 1);
  assert.deepEqual(data.notes, ['D','E','F','G','A','B','C']);
  assert.deepEqual(data.exercises[9].degrees, [1,2,3,4,5,6,7,8,9,7,5,3,1]);
  assert.deepEqual(data.exercises[10].degrees, [1,3,5,7,9,8,7,6,5,4,3,2,1]);
  assert.deepEqual(data.exercises[11].degrees, [1,3,2,4,3,5,4,6,5,7,6,8,6,7,5,6,4,5,3,4,2,3,1]);
  assert.deepEqual(chordModeExercises('A','harmonicMinor').exercises[5].notes.map(n=>n.name), ['A','C','E','G♯']);
  assert.throws(() => chordModeExercises('C','major',7), RangeError);
});
