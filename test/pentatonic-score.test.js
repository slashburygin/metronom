import test from 'node:test';
import assert from 'node:assert/strict';
import { pentatonicScore } from '../site/src/pentatonic-score.js';
import { fingerStaffSvg } from '../site/src/finger-score.js';
import { betterSaxPentatonicExercises, pentatonicExercises } from '../site/src/pentatonic-exercises.js';
import { SCALE_TYPES, keysFor } from '../site/src/harmony.js';
import { pitchClass } from '../site/src/pitch.js';

test('pentatonic staves retain every pitch and octave across all supported keys', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) {
    const exercises = [
      ...pentatonicExercises(key, type).patterns.map(p => ({groups: p.groups, perBeat: 1})),
      ...betterSaxPentatonicExercises(key, type).flatMap(p => p.rows.map(r => ({groups: r.groups, perBeat: p.notesPerBeat}))),
    ];
    for (const {groups, perBeat} of exercises) {
      const systems = pentatonicScore(groups, key, type, perBeat);
      assert.equal(systems.length, Math.ceil(groups.flat().length / 25));
      assert.ok(systems.every(s => s.notes.length <= 25));
      assert.ok(systems.slice(0, -1).every(s => s.notes.length === Math.floor(25 / perBeat) * perBeat && !s.last));
      assert.equal(systems.at(-1).last, true);
      const actual = systems.flatMap(s => s.notes);
      assert.equal(actual.length, groups.flat().length);
      groups.flat().forEach((n, i) => {
        const octave = Number(actual[i].label.at(-1));
        assert.equal(pitchClass(n.note) + octave * 12,
          48 + pitchClass(key) + (pitchClass(n.note) - pitchClass(key) + 12) % 12 + n.octave * 12);
        assert.ok(actual[i].label.startsWith(n.note));
      });
      for (const system of systems) {
        const svg = fingerStaffSvg(system);
        assert.equal((svg.match(/class="staff-note"/g) || []).length, system.notes.length);
        assert.equal((svg.match(/class="staff-stem"/g) || []).length, system.notes.length);
        assert.equal((svg.match(/class="staff-tuplet"/g) || []).length, perBeat === 3 ? system.notes.filter(n => !n.quarter).length / 3 : 0);
        assert.ok(!svg.includes('NaN'));
        assert.ok(system.notes.every(n => n.y > system.top && n.y < system.bottom));
      }
    }
  }
});

test('ending quarter has no flag or tuplet; isolated eighths still have flags', () => {
  const patterns = betterSaxPentatonicExercises('F', 'naturalMinor');
  const eighths = pentatonicScore(patterns[7].rows[0].groups, 'F', 'naturalMinor', 2);
  const triplets = pentatonicScore(patterns[9].rows[0].groups, 'F', 'naturalMinor', 3);
  assert.doesNotMatch(fingerStaffSvg(eighths.at(-1)), /class="staff-flag"/);
  assert.equal(eighths.at(-1).notes.at(-1).quarter, true);
  const isolated = pentatonicScore([[{note: 'F', octave: 0}]], 'F', 'naturalMinor', 2);
  assert.match(fingerStaffSvg(isolated[0]), /class="staff-flag"/);
  assert.doesNotMatch(fingerStaffSvg(eighths[0]), /staff-tuplet/);
  assert.match(fingerStaffSvg(triplets[0]), /class="staff-tuplet"/);
  assert.deepEqual(triplets[0].keySignature.map(a => a.symbol), ['♭','♭','♭','♭']);
});


test('25-note phrases stay together without splitting beats in longer phrases', () => {
  const patterns = betterSaxPentatonicExercises('D', 'naturalMinor');
  for (const index of [1, 7, 9]) {
    const pattern = patterns[index];
    const score = pentatonicScore(pattern.rows[0].groups, 'D', 'naturalMinor', pattern.notesPerBeat);
    assert.deepEqual(score.map(s => s.notes.length), [25]);
    assert.equal(score[0].notes.at(-1).quarter, true);
  }
  const down = pentatonicScore(patterns[1].rows[1].groups, 'D', 'naturalMinor', 2);
  assert.deepEqual(down.map(s => s.notes.length), [24, 5]);
});
