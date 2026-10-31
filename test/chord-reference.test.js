import test from 'node:test';import assert from 'node:assert/strict';
import { chordReference,chordFingerings,TUNINGS } from '../site/src/chord-reference.js';import { parseChord,CHORD_QUALITIES } from '../site/src/chords.js';import { pitchClass } from '../site/src/pitch.js';
test('reference spells chord degrees and guide tones rather than replacing them with enharmonic guesses',()=>{
 assert.deepEqual(chordReference('Cdim7').tones.map(t=>t.note),['C','E♭','G♭','B♭♭']);assert.deepEqual(chordReference('F♯maj7').tones.map(t=>t.note),['F♯','A♯','C♯','E♯']);assert.equal(chordReference('Csus4').tones.some(t=>t.degree===3),false);assert.equal(chordReference('C/E').chord.bass,'E');
 for(const quality of CHORD_QUALITIES)for(const root of ['C','F♯','B♭']){const ref=chordReference(root+quality);assert.deepEqual(ref.tones.map(t=>pitchClass(t.note)),ref.chord.pitchClasses);for(const scale of ref.scales){assert.ok(ref.chord.pitchClasses.every(pc=>scale.pitchClasses.includes(pc)));assert.deepEqual(scale.notes.map(pitchClass),scale.pitchClasses);}}
 assert.deepEqual(chordReference('N.C.').tones,[]);
});
test('scale candidates follow actual chord tones and include standard dominant/minor options',()=>{
 assert.ok(chordReference('Dm7').scales.some(s=>s.id==='dorian'));assert.ok(chordReference('Cmaj7').scales.some(s=>s.id==='lydian'));assert.ok(chordReference('G7alt').scales.some(s=>s.id==='altered'));assert.ok(chordReference('G7b9').scales.some(s=>s.id==='halfWhole'));assert.ok(!chordReference('G7b9').scales.some(s=>s.id==='major'));
});
test('generated guitar/ukulele shapes obey chord tones, bass, fret span and guide tones',()=>{
 for(const instrument of ['guitar','ukulele'])for(const symbol of ['C','Cmaj7','Dm7','G7','F/C','Cdim7','G7b9','Bbmaj9']){
  const ref=chordReference(symbol),shapes=chordFingerings(symbol,instrument);if(['C','Cmaj7','Dm7','G7'].includes(symbol))assert.ok(shapes.length,`${instrument} ${symbol}`);
  for(const shape of shapes){assert.equal(shape.frets.length,TUNINGS[instrument].length);assert.ok(shape.notes.every(midi=>ref.chord.pitchClasses.includes(midi%12)||midi%12===ref.chord.bassPitch));assert.equal(Math.min(...shape.notes)%12,ref.chord.bassPitch);for(const t of ref.tones.filter(t=>[3,7].includes(t.degree)))assert.ok(shape.notes.some(n=>n%12===t.pitch));const frets=shape.frets.filter(f=>f>0);if(frets.length)assert.ok(Math.max(...frets)-Math.min(...frets)<=3);}
 }
 assert.deepEqual(chordFingerings('Break'),[]);
});
test('documented iReal chord qualities and common shorthands parse without losing explicit intervals',()=>{
 const qualities='5 2 add9 + o h sus ^ - ^7 -7 7 7sus h7 o7 ^9 ^13 6 69 ^7#11 ^9#11 ^7#5 -6 -69 -^7 -^9 -9 -11 -7b5 h9 -b6 -#5 9 7b9 7#9 7#11 7b5 7#5 9#11 9b5 9#5 7b13 7#9#5 7#9b5 7#9#11 7b9#11 7b9b5 7b9#5 7b9#9 7b9b13 7alt 13 13#11 13b9 13#9 7b9sus 7susadd3 9sus 13sus 7b13sus 11 min13 min^11 min^13 maj13#11 maj7b5 maj7#9 min7b6 min9b6 maj(add4) min(add4) 7(add13)'.split(' ');
 for(const quality of qualities)assert.ok(parseChord('C'+quality).pitchClasses.length>=2,quality);assert.deepEqual(parseChord('C5').intervals,[0,7]);assert.deepEqual(parseChord('C7b9#9').intervals,[0,4,7,10,13,15]);assert.throws(()=>parseChord('C7b9b9'));
});
