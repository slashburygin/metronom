import test from 'node:test';
import assert from 'node:assert/strict';
import { parseForm, formText, compileForm } from '../site/src/song-form.js';
import { compileDraft, newDraft, loadDrafts, DraftHistory } from '../site/src/song-draft.js';
import { compileSong } from '../site/src/song.js';
import { arrangeSong } from '../site/src/song-arrangement.js';
import { transposeDraft, transposeArrangement } from '../site/src/transposition.js';
import { fraction as f, add, ZERO } from '../site/src/musical-time.js';
import { BackingPlayer } from '../site/src/backing-player.js';

const order = signs => compileForm(signs.map(sign => ({ form: parseForm(sign) })));
function draftWith(signs, meters = []) {
  const draft = newDraft();
  draft.sections[0].measures = signs.map((form, i) => ({ form, meter: meters[i] ?? '4/4', chords: ['Dm7','G7','Cmaj7','F/C'][i % 4], alternate: '', text: '' }));
  return draft;
}

test('form notation round-trips and rejects unknown, duplicate and malformed signs', () => {
  const signs = ['|:', ':|', ':|3', '[1,2 ]', 'Segno Coda Fine ToCoda', 'D.C.', 'D.S.', 'D.C.alFine', 'D.S.alFine', 'D.C.alCoda', 'D.S.alCoda'];
  for (const sign of signs) assert.deepEqual(parseForm(formText(parseForm(sign))), parseForm(sign));
  for (const bad of ['oops', ':|1', ':|9', '[0', '[1,1', '|: |:', 'D.C. D.S.', '[1 [2', '[1,2,', 'constructor']) assert.throws(() => parseForm(bad));
  const base = compileDraft(draftWith([''])).compiled.song;
  for (const form of [null, [], { repeatStart: 1 }, { repeatEnd: true }, { ending: [1,1] }, { jump: 'unknown' }, { ignored: true }]) {
    base.sections[0].measures[0].form = form;
    assert.throws(() => compileSong(base));
  }
});

test('repeat regions support implicit first opening, counts, separate and nested repeats', () => {
  assert.deepEqual(order(['', ':|', '']), [0,1,0,1,2]);
  assert.deepEqual(order(['|: :|3']), [0,0,0]);
  assert.deepEqual(order(['|:', ':|', '|:', ':|']), [0,1,0,1,2,3,2,3]);
  assert.deepEqual(order(['|:', '|:', ':|', ':|']), [0,1,2,1,2,3,0,1,2,1,2,3]);
});

test('first/second endings and shared endings select the intended pass', () => {
  assert.deepEqual(order(['|:', '[1 :|', '[2 ]', '']), [0,1,0,2,3]);
  assert.deepEqual(order(['|:', '[1,2 :|3', '[3 ]']), [0,1,0,1,0,2]);
  assert.deepEqual(order(['|:', '[1 :|3', '[2 ]', '[3 ]']), [0,1,0,2,0,3]);
  assert.deepEqual(order(['|:', '[1', ':|', '[2', ']']), [0,1,2,0,3,4]);
  // Inner alternate endings are replayed for each outer repeat pass.
  assert.deepEqual(order(['|:', '|:', '[1 :|', '[2 ]', ':|']), [0,1,2,1,3,4,0,1,2,1,3,4]);
  assert.deepEqual(order(['|:', '|:', '[1 :|', '[2 ]', '[1 :|', '[2 ]']), [0,1,2,1,3,4,0,1,2,1,3,5]);
});

test('D.C./D.S. are taken once; alFine stops only on the return journey', () => {
  assert.deepEqual(order(['', '', 'D.C.']), [0,1,2,0,1,2]);
  assert.deepEqual(order(['', 'Segno', '', 'D.S.']), [0,1,2,3,1,2,3]);
  assert.deepEqual(order(['', 'Fine', '', 'D.C.alFine']), [0,1,2,3,0,1]);
  assert.deepEqual(order(['', 'Segno', 'Fine', 'D.S.alFine']), [0,1,2,3,1,2]);
  assert.deepEqual(order(['|:', '[1 :|', '[2 ] Fine', 'D.C.alFine']), [0,1,0,2,3,0,2]);
  // Jump on a repeat closing waits until its final pass.
  assert.deepEqual(order(['|: Fine', ':| D.C.alFine']), [0,1,0,1,0]);
});

test('alCoda takes ToCoda after the return and reaches the coda in source order', () => {
  assert.deepEqual(order(['', 'ToCoda', 'D.C.alCoda', 'Coda', '']), [0,1,2,0,1,3,4]);
  assert.deepEqual(order(['', 'Segno', 'ToCoda', 'D.S.alCoda', 'Coda']), [0,1,2,3,1,2,4]);
});

test('malformed form and unreachable targets fail at a source bar before playback', () => {
  const invalid = [
    ['|:', ''], [':|', ':|'], ['[1 ]'], [']'], ['|:', '[1 :|'], ['|:', '[3 :|', '[2 ]'],
    ['|:', '[1', '[2 ] :|'], ['|:', '|:', '[1 :|', '[2', ':|', ']'],
    ['', 'D.S.'], ['D.S.', 'Segno'], ['Segno', 'Segno', 'D.S.'],
    ['', 'D.C.alFine'], ['Fine', 'Segno', 'D.S.alFine'], ['D.C.alFine', 'Fine'],
    ['ToCoda', 'D.C.alCoda'], ['Coda', 'ToCoda', 'D.C.alCoda'], ['D.C.', 'D.S.'],
    ['ToCoda'], ['ToCoda', 'D.C.'], ['|:', '[1 :| D.C.', '[2 ]'],
  ];
  for (const signs of invalid) {
    const result = compileDraft(draftWith(signs));
    assert.equal(result.compiled, null, JSON.stringify(signs));
    assert.ok(Number.isInteger(result.errors[0].measureIndex), JSON.stringify(result.errors));
  }
  const signs = Array(10).fill('');
  // A fourth nested eight-pass repeat exceeds the fixed expansion bound.
  signs[0] = '|:'; signs[1] = '|:'; signs[2] = '|:'; signs[3] = '|:';
  signs[4] = ':|8'; signs[5] = ':|8'; signs[6] = ':|8'; signs[7] = ':|8';
  assert.throws(() => order(signs), /4096/);
});

test('one-bar count-in and training changes surround the entire expanded form', async () => {
  const node = () => ({ gain: { value: 1 }, connect(destination) { return destination; }, disconnect() {} });
  const ctx = { currentTime: 0, sampleRate: 44100, destination: node(), resume: async () => {}, createGain: node, createDynamicsCompressor: node,
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }) };
  const heard = [], scheduled = [];
  const player = new BackingPlayer({ context: ctx, onStep: p => heard.push(p),
    transportOptions: { tickerFactory: () => ({ start() {}, stop() {}, dispose() {} }), requestFrame: () => 1, cancelFrame() {} } });
  player.schedule = (event, timing) => { if (event.kind === 'note') scheduled.push({ event, timing }); };
  const compiled = arrangeSong(compileDraft(draftWith(['|:', '[1 :|', '[2 ]'])).compiled.song);
  await player.start(compiled, { bpm: 120, repeats: 2, countIn: true, training: { keyStep: 5, tempoIncrement: 10 } });
  for (let i = 1; i <= 2200; i++) { ctx.currentTime = i / 100; player.transport.schedule(); player.transport.frame(); }
  const countIn = heard.filter(p => p.countIn), played = heard.filter(p => !p.countIn);
  assert.equal(countIn.length, 4);
  assert.equal(played.length, 32); // 4 played bars × 4 beats × 2 choruses
  assert.equal(scheduled.some(e => e.timing.countIn), false);
  assert.deepEqual(played.filter(p => p.step.beatIndex === 0).map(p => p.step.barIndex), [0,1,0,2,0,1,0,2]);
  assert.ok(played.slice(0,16).every(p => p.bpm === 120 && p.step.training.key === 'C'));
  assert.ok(played.slice(16).every(p => p.bpm === 130 && p.step.training.key === 'F'));
  assert.ok(Math.abs(played[16].time - (0.05 + 20 * 0.5)) < 1e-8);
  assert.equal(player.transport.playing, false);
  player.dispose();
});

test('arrangement follows the expanded route, retains source bars and exact mixed-meter timing', () => {
  const draft = draftWith(['|:', '[1 :|', '[2 ]', 'Fine', 'D.C.alFine'], ['3/4', '6/8', '5/8', '1/4', '4/4']);
  const source = compileDraft(draft).compiled;
  assert.ok(source);
  assert.deepEqual(compileSong(JSON.parse(JSON.stringify(source.song))), source);
  const arrangement = arrangeSong(source.song);
  const expected = [0,1,0,2,3,4,0,2,3];
  assert.deepEqual(arrangement.steps.filter(s => s.beatIndex === 0).map(s => s.barIndex), expected);
  assert.deepEqual(arrangement.steps.filter(s => s.beatIndex === 0).map(s => s.playbackBarIndex), expected.map((_,i) => i));
  let time = ZERO;
  for (const step of arrangement.steps) { assert.deepEqual(step.position, time); time = add(time, step.duration); }
  assert.deepEqual(arrangement.duration, time);
  assert.equal(arrangement.symbols.length, 5);
  assert.equal(arrangement.song.sections[0].measures.length, 5);
  const transposed = transposeArrangement(arrangement, 2, 'D');
  assert.deepEqual(transposed.playOrder, expected);
  assert.deepEqual(transposed.steps.map(s => [s.barIndex,s.playbackBarIndex,s.position]), arrangement.steps.map(s => [s.barIndex,s.playbackBarIndex,s.position]));
});

test('bass approaches follow the next played bar across repeats and alternate endings', () => {
  const source = compileDraft(draftWith(['|:', '[1 :|', '[2 ]'])).compiled;
  const result = arrangeSong(source.song);
  const bars = result.steps.filter(s => s.beatIndex === 3);
  // End of first ending G7 approaches Dm7, not the printed Cmaj7 second ending.
  assert.equal(bars[1].events.find(e => e.part === 'bass').midi % 12, 1);
  // Final common bar Dm7 approaches the selected second ending Cmaj7.
  assert.equal(bars[2].events.find(e => e.part === 'bass').midi % 12, 11);
  assert.equal(bars.at(-1).events.find(e => e.part === 'bass').midi % 12, 0);
});

test('old drafts load; raw invalid form survives saving, undo and source transposition', () => {
  const draft = draftWith(['|:', 'unknown']);
  const data = { version: 1, currentId: 'a', documents: [{ id: 'a', draft }] };
  assert.deepEqual(loadDrafts({ getItem: () => JSON.stringify(data) }), data);
  delete draft.sections[0].measures[0].form;
  assert.deepEqual(loadDrafts({ getItem: () => JSON.stringify(data) }), data);
  const history = new DraftHistory(draft);
  const next = structuredClone(draft); next.sections[0].measures[1].form = 'D.S.';
  history.update(next); history.undo(); assert.equal(history.current.sections[0].measures[1].form, 'unknown');
  history.redo(); assert.equal(history.current.sections[0].measures[1].form, 'D.S.');
  assert.equal(transposeDraft(draft, 'D').sections[0].measures[1].form, 'unknown');
  draft.sections[0].measures[1].form = {};
  assert.throws(() => loadDrafts({ getItem: () => JSON.stringify(data) }));
});

test('cross-section jumps map structural errors to the correct source location', () => {
  const draft = draftWith(['Segno', 'Fine']);
  draft.sections.push({ name: 'B', measures: draftWith(['D.S.alFine']).sections[0].measures });
  assert.deepEqual(compileDraft(draft).compiled.playOrder, [0,1,2,0,1]);
  draft.sections[0].measures[0].form = '';
  const invalid = compileDraft(draft);
  assert.equal(invalid.compiled, null);
  assert.equal(invalid.errors[0].sectionIndex, 1);
  assert.equal(invalid.errors[0].measureIndex, 0);
});
