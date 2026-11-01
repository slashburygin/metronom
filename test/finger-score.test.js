import test from 'node:test';
import assert from 'node:assert/strict';
import { MAJOR_KEYS } from '../site/src/harmony.js';
import { fingerExercise } from '../site/src/finger-exercises.js';
import { fingerScore, fingerStaffSvg } from '../site/src/finger-score.js';

test('staff pitches match the existing exercise, including B to C octave crossings', () => {
  const c = fingerScore('C', 'up', 'quarter');
  assert.deepEqual(c[0].notes.map(n=>n.label), ['C4','E4','G4','B4','A4','G4','F4','E4']);
  assert.deepEqual(c[0].notes.map(n=>n.y), [110,100,90,80,85,90,95,100]);
  assert.deepEqual(c[1].notes.map(n=>n.label), ['D4','F4','A4','C5','B4','A4','G4','F4']);
  const bFlat = fingerScore('B♭', 'up', 'eighths');
  assert.deepEqual(bFlat[0].notes.map(n=>n.label), ['B♭4','D5','F5','A5','G5','F5','E♭5','D5']);
});
test('all keys, levels, registers and directions retain note spelling and fit the SVG', () => {
  for (const key of MAJOR_KEYS) for (const direction of ['up','down']) for (const level of ['quarter','eighths','sixteenths']) for (const octave of [3,4,5]) {
    const rows = fingerScore(key, direction, level, octave);
    const exercise = fingerExercise(key, direction);
    rows.forEach((row,i)=>{
      assert.deepEqual(row.notes.map(n=>n.name),exercise[i].notes.map(n=>n.name));
      for (const note of row.notes) {
        assert.ok(note.y-5 > row.top);
        assert.ok(note.y+5 < row.bottom);
      }
      for (let start = 0; start < row.notes.length; start += row.perBeat) {
        const group = row.notes.slice(start, start + row.perBeat);
        const up = group.reduce((sum,n) => sum + n.y,0) / group.length >= 80;
        const stemEnd = up ? Math.min(...group.map(n=>n.y))-32 : Math.max(...group.map(n=>n.y))+32;
        assert.ok(stemEnd - 4 > row.top);
        assert.ok(stemEnd + 4 < row.bottom);
      }
      const svg=fingerStaffSvg(row);
      assert.equal((svg.match(/class="staff-note"/g)||[]).length,8);
      assert.equal((svg.match(/class="staff-line"/g)||[]).length,5);
      assert.ok(!/NaN|undefined|Infinity/.test(svg));
    });
  }
});
test('key signatures preserve sharps, flats and E sharp in F sharp major', () => {
  assert.equal(fingerScore('C','up','quarter')[0].keySignature.length,0);
  const sharp=fingerScore('F♯','up','quarter')[0];
  assert.deepEqual(sharp.keySignature.map(a=>a.symbol),Array(6).fill('♯'));
  assert.ok(sharp.notes.some(n=>n.label==='E♯5'));
  assert.equal(fingerScore('D♭','up','quarter')[0].keySignature.length,5);
  assert.ok(fingerScore('D♭','up','quarter')[0].keySignature.every(a=>a.symbol==='♭'));
});
test('barlines and beams follow 4/4 and the selected durations', () => {
  const count=(row,cls)=>(fingerStaffSvg(row).match(new RegExp(`class="${cls}"`,'g'))||[]).length;
  const quarter=fingerScore('C','up','quarter');
  assert.equal(count(quarter[0],'staff-beam'),0);
  assert.equal(quarter[0].notes.filter(n=>n.barAfter).length,2);
  const eighths=fingerScore('C','up','eighths');
  assert.equal(count(eighths[0],'staff-beam'),4);
  assert.equal(eighths[0].notes.filter(n=>n.barAfter).length,1);
  const sixteenths=fingerScore('C','up','sixteenths');
  assert.equal(count(sixteenths[0],'staff-beam'),4);
  assert.equal(sixteenths[0].notes.filter(n=>n.barAfter).length,0);
  assert.equal(sixteenths[1].notes.filter(n=>n.barAfter).length,1);
  assert.equal(sixteenths.filter(row=>row.finalRest).length,1);
  assert.equal(count(sixteenths.at(-1),'staff-rest'),1);
  assert.equal(quarter.filter(row=>row.finalRest).length,0);
});
test('octave changes move notes seven diatonic steps without changing the key', () => {
  const lower=fingerScore('G','down','quarter',3)[0];
  const upper=fingerScore('G','down','quarter',4)[0];
  assert.deepEqual(lower.keySignature,upper.keySignature);
  lower.notes.forEach((note,i)=>{
    assert.equal(note.step+7,upper.notes[i].step);
    assert.equal(note.y-35,upper.notes[i].y);
  });
  assert.throws(()=>fingerScore('C','up','unknown'),RangeError);
  assert.throws(()=>fingerScore('C','up','quarter',9),RangeError);
});
