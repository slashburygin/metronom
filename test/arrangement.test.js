import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceChord, normalizeSeed, BACKING_STYLES } from '../site/src/arrangement.js';
import { parseChord, CHORD_QUALITIES } from '../site/src/chords.js';
import { arrangeSong } from '../site/src/song-arrangement.js';
import { newDraft, compileDraft } from '../site/src/song-draft.js';
import { add, compare, fraction as f } from '../site/src/musical-time.js';

function song(symbols, meter = '4/4') {
  const draft = newDraft();
  draft.sections[0].measures = symbols.map(chords => ({ chords, meter, text: '', alternate: '' }));
  return compileDraft(draft).compiled.song;
}
const notes = (step, part) => step.events.filter(e => e.kind === 'note' && e.part === part);

test('voicings preserve chord colors, fit the register and minimize full-voice motion', () => {
  for (const quality of CHORD_QUALITIES) {
    const chord = parseChord('F#' + quality), voicing = voiceChord(chord);
    assert.ok(voicing.length >= (quality === '5' ? 2 : 3) && voicing.length <= 4);
    assert.equal(new Set(voicing.map(n => n % 12)).size, voicing.length);
    for (const midi of voicing) { assert.ok(midi >= 48 && midi <= 76); assert.ok(chord.pitchClasses.includes(midi % 12)); }
  }
  const sequence = ['Dm7', 'G7', 'Cmaj7'].map(parseChord);
  const voices = sequence.reduce((all, chord) => [...all, voiceChord(chord, all.at(-1))], []);
  const motion = values => values.slice(1).reduce((sum, voice, i) => sum + voice.reduce((s, note, j) => s + Math.abs(note - values[i][j]), 0), 0);
  const rootPosition = sequence.map(chord => {
    let previous = 47;
    return chord.pitchClasses.map(pc => { let midi = 48 + pc; while (midi <= previous) midi += 12; previous = midi; return midi; });
  });
  assert.ok(motion(voices) < motion(rootPosition));
  assert.deepEqual(voiceChord(sequence[0], voices[0]), voices[0]);
});

test('walking bass approaches the next chord, respects slash bass and resolves the finite ending', () => {
  const result = arrangeSong(song(['Dm7', 'G7', 'Cmaj7', 'F/C']), { style: 'swing' });
  const approach = notes(result.steps[3], 'bass')[0];
  assert.equal(approach.midi % 12, 6); assert.equal(approach.approach, true);
  assert.equal(notes(result.steps[4], 'bass')[0].midi % 12, 7);
  for (const step of result.steps.slice(12)) assert.equal(notes(step, 'bass')[0].midi % 12, 0);
  const ending = arrangeSong(song(['Dm7', 'G7', 'Cmaj7']));
  assert.equal(notes(ending.steps.at(-1), 'bass')[0].midi % 12, 0);
  assert.equal(notes(ending.steps.at(-1), 'bass')[0].approach, undefined);
});

test('performance seed reproduces all events and changes velocities without moving note times', () => {
  const source = song(['Dm9', 'G7b9', 'Cmaj9']);
  for (const style of BACKING_STYLES) {
    const first = arrangeSong(source, { style, seed: 123 });
    assert.deepEqual(arrangeSong(source, { style, seed: 123 }), first);
    const other = arrangeSong(source, { style, seed: 124 });
    assert.notDeepEqual(other.steps, first.steps);
    const withoutVelocity = steps => steps.map(step => ({ ...step, events: step.events.map(({ velocity, ...event }) => event) }));
    assert.deepEqual(withoutVelocity(other.steps), withoutVelocity(first.steps));
  }
  for (const seed of [-1, Infinity, NaN, '3', 1.1, 4294967296]) assert.equal(normalizeSeed(seed), 1);
  assert.equal(normalizeSeed(0), 0); assert.equal(normalizeSeed(4294967295), 4294967295);
});

test('styles have distinct rhythms and preserve pauses and asymmetric pulse boundaries', () => {
  const source = song(['C:1/2 Break:1/2 Dm7:1 G7:3', 'N.C.', 'Cmaj7'], '5/8');
  const signatures = new Set();
  for (const style of BACKING_STYLES) {
    const result = arrangeSong(source, { style });
    signatures.add(JSON.stringify(result.steps.map(step => step.events.filter(e => e.part).map(({part,offset,sound}) => ({part,offset,sound})))));
    assert.ok(result.steps.filter(s => s.barIndex === 1).every(s => s.events.filter(e => e.part).every(e => e.part === 'drums')));
    for (const step of result.steps) for (const event of step.events.filter(e => e.part)) {
      assert.ok(compare(add(event.offset, event.duration), step.duration) <= 0);
      if (step.barIndex === 0 && step.beatIndex === 0 && compare(event.offset, f(1, 16)) < 0)
        assert.ok(compare(add(event.offset, event.duration), f(1, 16)) <= 0);
    }
  }
  assert.equal(signatures.size, BACKING_STYLES.length);
  assert.throws(() => arrangeSong(source, { style: 'unknown' }));
});

test('a gap before the next chord does not create a chromatic approach', () => {
  const source = song(['C', 'G7']);
  source.sections[0].measures[1].chords[0].offset = f(1, 4);
  source.sections[0].measures[1].chords[0].duration = f(3, 4);
  const result = arrangeSong(source);
  assert.equal(notes(result.steps[3], 'bass')[0].approach, undefined);
  assert.equal(notes(result.steps[4], 'bass').length, 0);
});
