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
        assert.equal((svg.match(/class="staff-tuplet"/g) || []).length, perBeat === 3 ? system.notes.length / 3 : 0);
        assert.ok(!svg.includes('NaN'));
        assert.ok(system.notes.every(n => n.y > system.top && n.y < system.bottom));
      }
    }
  }
});

test('last isolated eighth has a flag, and triplets differ from straight eighths', () => {
  const patterns = betterSaxPentatonicExercises('F', 'naturalMinor');
  const eighths = pentatonicScore(patterns[7].rows[0].groups, 'F', 'naturalMinor', 2);
  const triplets = pentatonicScore(patterns[9].rows[0].groups, 'F', 'naturalMinor', 3);
  assert.match(fingerStaffSvg(eighths.at(-1)), /class="staff-flag"/);
  assert.doesNotMatch(fingerStaffSvg(eighths[0]), /staff-tuplet/);
  assert.match(fingerStaffSvg(triplets[0]), /class="staff-tuplet"/);
  assert.deepEqual(triplets[0].keySignature.map(a => a.symbol), ['♭','♭','♭','♭']);
});
