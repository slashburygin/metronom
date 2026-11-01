import test from 'node:test';
import assert from 'node:assert/strict';
import { MAJOR_KEYS, scaleHarmony } from '../site/src/harmony.js';
import { fingerExercise, fingerSettings } from '../site/src/finger-exercises.js';

test('ascending exercise combines seventh arpeggios with descending scale steps', () => {
  const rows = fingerExercise('C');
  assert.equal(rows.length, 7);
  assert.equal(rows[0].chord, 'Cmaj7');
  assert.deepEqual(rows[0].notes.map(n => n.name), ['C', 'E', 'G', 'B', 'A', 'G', 'F', 'E']);
  assert.deepEqual(rows[1].notes.map(n => [n.name, n.octave]), [['D',0],['F',0],['A',0],['C',1],['B',0],['A',0],['G',0],['F',0]]);
});
test('descending exercise reverses the degree order and starts with a descending arpeggio', () => {
  const rows = fingerExercise('C', 'down');
  assert.deepEqual(rows.map(row => row.start), [7,6,5,4,3,2,1]);
  assert.deepEqual(rows.at(-1).notes.map(n => n.name), ['B','G','E','C','D','E','F','G']);
});
test('all twelve keys preserve diatonic spelling and octave crossings in both directions', () => {
  for (const key of MAJOR_KEYS) for (const direction of ['up', 'down']) {
    const scale = scaleHarmony(key);
    const rows = fingerExercise(key, direction);
    assert.equal(rows.length, 7);
    for (const row of rows) {
      assert.equal(row.notes.length, 8);
      assert.equal(row.chord, scale.chords[row.start - 1].symbol);
      for (const note of row.notes) {
        assert.equal(note.name, scale.notes[note.degree - 1]);
        assert.ok([0,1].includes(note.octave));
      }
    }
  }
  assert.deepEqual(fingerExercise('F♯')[0].notes.map(n => n.name), ['F♯','A♯','C♯','E♯','D♯','C♯','B','A♯']);
});
test('practice settings configure note values without changing BPM semantics', () => {
  for (const level of ['quarter','eighths','sixteenths']) {
    assert.deepEqual(fingerSettings(level, 75), {bpm:75,beatsPerBar:4,noteValue:4,subdivision:level,timerMinutes:5});
  }
  for (const bpm of [NaN,0,29,301,60.5]) assert.throws(() => fingerSettings('quarter',bpm), RangeError);
  assert.throws(() => fingerSettings('unknown',60), RangeError);
  assert.throws(() => fingerExercise('invalid'), RangeError);
  assert.throws(() => fingerExercise('C','invalid'), RangeError);
});
