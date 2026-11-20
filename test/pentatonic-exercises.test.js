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

test('Better Sax practice covers ten linked patterns and preserves their cells in every key', async () => {
  const { betterSaxPentatonicExercises } = await import('../site/src/pentatonic-exercises.js');
  const cells = [[0,1,2,3,4,3,2,0], [0,1,2,3], [2,0,1,2],
    [0,2,1,3,2,4,3,2], [0,2,3,1], [0,1,2,0],
    [0,2,1,3,2,1,0,2], [0,1,2], [0,-1,-2,0,-1,1,0,-2], [0,1,2]];
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) {
    const notes = pentatonicExercises(key, type).notes;
    const patterns = betterSaxPentatonicExercises(key, type);
    assert.equal(patterns.length, 10);
    assert.equal(new Set(patterns.map(p => p.id)).size, 10);
    patterns.forEach((pattern, i) => {
      assert.equal(pattern.number, i + 1);
      assert.equal(pattern.notesPerBeat, i === 9 ? 3 : 2);
      assert.equal(new URL(pattern.url).searchParams.get('v'), '27njCPeYtEg');
      assert.equal(new URL(pattern.url).searchParams.get('t'), `${pattern.seconds}s`);
      assert.deepEqual(pattern.rows.map(r => r.direction), i === 8 ? ['down','up'] : ['up','down']);
      pattern.rows.forEach((row, r) => {
        assert.equal(row.groups.length, 5);
        const indices = row.groups.map(group => group.map(n => {
          assert.ok(notes.includes(n.note));
          assert.ok(Number.isInteger(n.octave) && n.octave >= 0 && n.octave <= 2);
          return notes.indexOf(n.note) + 5 * n.octave;
        }));
        indices.forEach((group, start) => {
          assert.deepEqual(group.map(n => n - group[0]), cells[i].map(n => (n - cells[i][0]) * (r ? -1 : 1) || 0));
          if (start) assert.equal(group[0] - indices[start - 1][0], (row.direction === 'up' ? 1 : -1) * (i === 4 ? 2 : 1));
        });
      });
    });
  }
  assert.throws(() => betterSaxPentatonicExercises('H'), RangeError);
});
