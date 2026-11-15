import test from 'node:test';
import assert from 'node:assert/strict';
import { pentatonicExercises } from '../site/src/pentatonic-exercises.js';
import { SCALE_TYPES, keysFor } from '../site/src/harmony.js';
import { pitchClass } from '../site/src/pitch.js';

test('pentatonic exercises spell the major/minor formulas in every supported key', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) {
    const data = pentatonicExercises(key, type);
    assert.deepEqual(data.notes.map(note => (pitchClass(note) - pitchClass(key) + 12) % 12),
      type === 'major' ? [0,2,4,7,9] : [0,3,5,7,10]);
    assert.equal(new Set(data.notes).size, 5);
    for (const pattern of data.patterns) for (const group of pattern.groups) for (const note of group) {
      assert.ok(data.notes.includes(note.note));
      assert.ok([0,1].includes(note.octave));
    }
    const [up, down] = data.patterns[0].groups;
    assert.deepEqual([...up].reverse(), down);
    assert.deepEqual(up.at(-1), { note: key, octave: 1 });
  }
  assert.deepEqual(pentatonicExercises('D♭').notes, ['D♭','E♭','F','A♭','B♭']);
  assert.deepEqual(pentatonicExercises('F♯','harmonicMinor').notes, ['F♯','A','B','C♯','E']);
  assert.deepEqual(pentatonicExercises('A','melodicMinor').notes, ['A','C','D','E','G']);
  assert.throws(() => pentatonicExercises('C', 'unknown'), RangeError);
  assert.throws(() => pentatonicExercises('H'), RangeError);
});

test('groups of three and four continue ascending across the octave', () => {
  const data = pentatonicExercises('C');
  for (const [id, size] of [['threes',3], ['fours',4]]) {
    const groups = data.patterns.find(p => p.id === id).groups;
    assert.equal(groups.length,5);
    for (const group of groups) {
      assert.equal(group.length,size);
      const pitches=group.map(n=>pitchClass(n.note)+n.octave*12);
      assert.ok(pitches.every((pitch,i)=>i===0||pitch>pitches[i-1]));
    }
  }
  assert.deepEqual(data.patterns.find(p => p.id === 'fours').groups.at(-1), [
    {note:'A',octave:0},{note:'C',octave:1},{note:'D',octave:1},{note:'E',octave:1},
  ]);
});
