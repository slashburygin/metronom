import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChord, CHORD_QUALITIES } from '../site/src/chords.js';
import { newDraft, parseMeasure, compileDraft, DraftHistory, loadDrafts, DRAFT_STORAGE } from '../site/src/song-draft.js';
import { arrangeSong } from '../site/src/song-arrangement.js';
import { fraction as f, add, compare } from '../site/src/musical-time.js';

const pc = chord => parseChord(chord).pitchClasses;
test('chord parser distinguishes qualities, alterations, extensions and slash basses', () => {
  assert.deepEqual(pc('Cm7'), [0,3,7,10]);
  assert.deepEqual(pc('Cø7'), [0,3,6,10]);
  assert.deepEqual(pc('Cdim7'), [0,3,6,9]);
  assert.deepEqual(pc('Csus4'), [0,5,7]);
  assert.deepEqual(pc('C7b9#11'), [0,4,7,10,1,6]);
  assert.deepEqual(pc('Cmaj9'), [0,4,7,11,2]);
  assert.equal(parseChord('Bbmaj7/D').bassPitch, 2);
  assert.equal(parseChord('F/C').bassPitch, 0);
  assert.equal(parseChord('C6/9').bass, 'C');
  assert.equal(parseChord('C6/9/E').bassPitch, 4);
  assert.equal(parseChord('N.C.').silent, 'harmony');
  assert.equal(parseChord('Break').silent, 'all');
  for (const quality of CHORD_QUALITIES) for (const root of ['C','F#','Bb','E♯','B♭♭']) assert.ok(parseChord(root + quality).pitchClasses.length >= 3);
  for (const bad of ['Cunknown','Cconstructor','H7','C7b9#9','C/E4','Cmaj7oops']) assert.throws(() => parseChord(bad));
});

test('measure input supports equal and explicit rational durations without guessing unknown input', () => {
  assert.deepEqual(parseMeasure('Dm7 G7').chords.map(c => c.duration), [f(1,2), f(1,2)]);
  assert.deepEqual(parseMeasure('C:1/2 Dm7:1/2 G7:3').chords.map(c => c.duration), [f(1,8), f(1,8), f(3,4)]);
  assert.equal(parseMeasure('').chords.length, 0);
  for (const text of ['C:1 G7:2','C:0 G7:4','C:2 G7','Cgarbage','C:1/0']) assert.throws(() => parseMeasure(text));
});

test('invalid drafts remain unchanged and report exact bar locations', () => {
  const draft = newDraft(); draft.sections[0].measures[2].chords = 'Cmystery';
  const { compiled, errors } = compileDraft(draft);
  assert.equal(compiled, null);
  assert.equal(errors[0].measureIndex, 2);
  assert.equal(draft.sections[0].measures[2].chords, 'Cmystery');
  draft.sections[0].measures[2] = { meter: '3/4', chords: 'F/C', alternate: 'Dm7', text: 'Quietly' };
  const valid = compileDraft(draft).compiled;
  assert.equal(valid.song.sections[0].measures[2].text, 'Quietly');
  assert.equal(valid.song.sections[0].measures[2].chords[0].alternate, 'Dm7');
});

test('history groups typing and preserves invalid edits through undo and redo', () => {
  const history = new DraftHistory(newDraft());
  for (const title of ['B','Bl','Blues']) { const next = structuredClone(history.current); next.title = title; history.update(next, 'title'); }
  assert.equal(history.past.length, 1);
  history.undo(); assert.equal(history.current.title, '');
  history.redo(); assert.equal(history.current.title, 'Blues');
  const next = structuredClone(history.current); next.sections[0].measures[0].chords = 'unknown'; history.update(next);
  history.undo(); assert.equal(history.current.sections[0].measures[0].chords, '');
  history.redo(); assert.equal(history.current.sections[0].measures[0].chords, 'unknown');
  history.undo(); history.update(newDraft()); assert.equal(history.future.length, 0);
});

test('saved collections retain invalid drafts and reject corrupt versions without overwriting', () => {
  const draft = newDraft(); draft.sections[0].measures[0].chords = 'invalid';
  const data = { version: 1, currentId: 'one', documents: [{id:'one',draft}] };
  assert.deepEqual(loadDrafts({getItem: key => { assert.equal(key,DRAFT_STORAGE); return JSON.stringify(data); }}), data);
  for (const raw of ['{','{"version":2}',JSON.stringify({...data,documents:[{id:'one',draft:{}}]})]) assert.throws(() => loadDrafts({getItem:()=>raw}));
});

test('custom-song accompaniment respects intra-pulse changes, slash bass, pauses and mixed meters', () => {
  const draft = newDraft();
  draft.sections[0].measures = [
    { meter:'4/4', chords:'F/C:1/2 G7:7/2', alternate:'Am7 Dm7', text:'' },
    { meter:'3/4', chords:'N.C.', alternate:'', text:'' },
    { meter:'6/8', chords:'Break', alternate:'', text:'' },
  ];
  const compiled = compileDraft(draft).compiled;
  const result = arrangeSong(compiled.song);
  const first = result.steps[0].events.filter(e => e.part === 'bass');
  assert.equal(first[0].midi % 12,0);
  assert.equal(first[1].midi % 12,7);
  assert.deepEqual(first[1].offset,f(1,8));
  assert.ok(result.steps.filter(s=>s.barIndex===1).every(s=>s.events.filter(e=>e.part).every(e=>e.part==='drums')));
  assert.ok(result.steps.filter(s=>s.barIndex===2).every(s=>s.events.every(e=>!e.part)));
  for (const step of result.steps) for (const e of step.events.filter(e=>e.part)) assert.ok(compare(add(e.offset,e.duration),step.duration)<=0);
  assert.equal(result.steps[0].events.some(e=>e.symbol==='Am7'),false);
});

test('a break inside a pulse cuts drum tails at its exact onset', () => {
  const draft = newDraft();
  draft.sections[0].measures = [{meter:'4/4',chords:'C:1/8 Break:31/8',alternate:'',text:''}];
  const result = arrangeSong(compileDraft(draft).compiled.song);
  const drums = result.steps[0].events.filter(e=>e.part==='drums');
  assert.ok(drums.length>0);
  for (const event of drums) assert.ok(compare(add(event.offset,event.duration),f(1,32))<=0);
});
