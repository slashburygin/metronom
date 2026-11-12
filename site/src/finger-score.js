import { scaleHarmony } from './harmony.js';
import { FINGER_LEVELS, fingerExercise } from './finger-exercises.js';

// Uses the existing exercise degrees and diatonic spelling, never MIDI pitch
// classes, to retain both octave crossings and enharmonic spelling.
// Reference reviewed (GPL; no code copied): CoderLine/alphaTab,
// 3984b321854a532f3456bbcdceac7abaa02c7381,
// packages/alphatab/src/rendering/utils/AccidentalHelper.ts:258-268.
// This renderer is original and deliberately limited to our three note values.
const LETTERS = 'CDEFGAB';
const BOTTOM = 100; // E4, bottom line of a treble staff; line spacing is 10.
const yFor = step => BOTTOM - (step - 30) * 5;
const round = n => Math.round(n * 100) / 100;

function stemGroups(notes, perBeat) {
  return Array.from({ length: notes.length / perBeat }, (_, i) => {
    const group = notes.slice(i * perBeat, (i + 1) * perBeat);
    const up = group.reduce((sum, note) => sum + note.y, 0) / group.length >= 80;
    const beamY = up ? Math.min(...group.map(note => note.y)) - 32 : Math.max(...group.map(note => note.y)) + 32;
    return { notes: group, up, beamY };
  });
}

export function fingerScore(key, direction, level, tonicOctave = 4) {
  if (!Object.hasOwn(FINGER_LEVELS, level) || ![3, 4, 5].includes(tonicOctave)) throw new RangeError('Invalid score settings');
  const exercise = fingerExercise(key, direction);
  const scale = scaleHarmony(key).notes;
  const tonicStep = tonicOctave * 7 + LETTERS.indexOf(key[0]);
  const sharps = scale.some(note => note.includes('♯'));
  const order = sharps ? ['F5','C5','G5','D5','A4','E5','B4'] : ['B4','E5','A4','D5','G4','C5','F4'];
  const keySignature = order.filter(note => scale.some(name => name[0] === note[0] && name.length > 1)).map(note => ({
    symbol: sharps ? '♯' : '♭', step: Number(note[1]) * 7 + LETTERS.indexOf(note[0]),
  }));
  const perBeat = FINGER_LEVELS[level].notesPerBeat;
  const perBar = perBeat * 4;
  const beams = Math.log2(perBeat);
  return exercise.map((row, rowIndex) => {
    const start = 64 + keySignature.length * 10 + (rowIndex === 0 ? 28 : 8);
    const notes = row.notes.map((note, index) => {
      const step = tonicStep + (note.degree - 1) + note.octave * 7;
      const absoluteIndex = rowIndex * 8 + index;
      return { ...note, step, label: `${note.name}${Math.floor(step / 7)}`, y: yFor(step),
        x: start + index * 24 + Math.floor(((rowIndex * 8) % perBar + index) / perBar) * 10,
        barAfter: (absoluteIndex + 1) % perBar === 0 };
    });
    const finalRest = rowIndex === exercise.length - 1 && 56 % perBar !== 0;
    const stems = stemGroups(notes, perBeat);
    return { ...row, notes, keySignature, beams, perBeat, showTime: rowIndex === 0, finalRest, last: rowIndex === exercise.length - 1,
      width: notes.at(-1).x + (finalRest ? 70 : 26),
      // Include the clef and the actual stem directions, with a small margin.
      top: Math.min(32, ...notes.map(note => note.y - 6), ...stems.map(group => group.beamY - 5)),
      bottom: Math.max(136, ...notes.map(note => note.y + 6), ...stems.map(group => group.beamY + 5)),
    };
  });
}

// Reflow the same 56 notes into continuous systems, keeping beats intact and
// preferring measure boundaries whenever a complete measure fits the screen.
export function fingerScoreSystems(key, direction, level, tonicOctave = 4, availableWidth = 800, showNames = false) {
  const source = fingerScore(key, direction, level, tonicOctave);
  const template = source[0];
  const notes = source.flatMap(row => row.notes.map((note, index) => ({
    ...note, degreeLabel: index === 0 ? `${row.start} · ${row.chord}` : null,
  })));
  const width = Math.max(240, availableWidth);
  const perBar = template.perBeat * 4;
  const systems = [];
  let offset = 0;
  while (offset < notes.length) {
    const showTime = offset === 0;
    const start = 64 + template.keySignature.length * 10 + (showTime ? 28 : 8);
    // Fit up to three measures instead of leaving the unused part of a
    // measure empty. Keep a readable minimum spacing on narrow screens.
    const targetCount = Math.min(perBar * 3, notes.length - offset);
    const targetRest = offset + targetCount === notes.length && source.at(-1).finalRest;
    const barGaps = Math.floor(((offset % perBar) + targetCount - 1) / perBar) * 10;
    const spacing = Math.max(14, (width - start - barGaps - (targetRest ? 70 : 26)) / (targetCount - 1));
    const xFor = index => start + index * spacing + Math.floor(((offset % perBar) + index) / perBar) * 10;
    let count = 0;
    while (count < targetCount && xFor(count + template.perBeat - 1) + 26 <= width + 0.001) count += template.perBeat;
    count = Math.max(template.perBeat, count);
    if (count >= perBar && offset + count < notes.length) count -= (offset + count) % perBar;
    // Reserve the final half-note rest; move a whole beat to the next system
    // if it would otherwise collide with the closing barline.
    if (offset + count === notes.length && source.at(-1).finalRest && count > template.perBeat && xFor(count - 1) + 70 > width + 0.001) count -= template.perBeat;
    const systemNotes = notes.slice(offset, offset + count).map((note, index) => ({ ...note, x: xFor(index) }));
    const last = offset + count === notes.length;
    const finalRest = last && source.at(-1).finalRest;
    const stems = stemGroups(systemNotes, template.perBeat);
    const labelY = Math.min(42, ...systemNotes.map(note => note.y - 16), ...stems.map(group => group.beamY - 12));
    const bottom = Math.max(136, ...systemNotes.map(note => note.y + 6), ...stems.map(group => group.beamY + 5));
    systems.push({ ...template, notes: systemNotes, showTime, last, finalRest, showNames, labelY,
      width: Math.max(width, systemNotes.at(-1).x + (finalRest ? 70 : 26)),
      top: labelY - 16, bottom: bottom + (showNames ? 16 : 0), nameY: bottom + 10 });
    offset += count;
  }
  return systems;
}

// An original vector clef, avoiding a dependency on system music fonts.
const clef = '<path class="staff-clef" d="M29 105 C10 101 9 83 22 73 C36 62 38 51 31 39 C28 33 23 41 24 51 L34 115 C37 129 20 134 19 123 C18 114 29 113 29 120 C29 126 22 127 22 122 M19 87 C22 74 40 79 38 90 C36 103 18 102 15 91" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
const line = (x1,y1,x2,y2,cls) => `<line class="${cls}" x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="currentColor"/>`;

export function fingerStaffSvg(row) {
  const parts = [];
  for (let y = 60; y <= 100; y += 10) parts.push(line(8,y,row.width-8,y,'staff-line'));
  parts.push(line(8,60,8,100,'staff-bar'));
  parts.push(clef);
  row.keySignature.forEach((accidental, index) => {
    const x = 50 + index * 10, y = yFor(accidental.step);
    if (accidental.symbol === '♯') {
      // The gap between the two crossbars is centred on the note's exact y.
      // A text glyph's baseline does not reliably locate that gap across fonts.
      parts.push(`<g class="staff-accidental" data-symbol="♯" transform="translate(${x} ${y})"><path d="M2 -11V11 M7 -13V9" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M0 -3 9 -6V-3L0 0Z M0 3 9 0V3L0 6Z"/></g>`);
    } else {
      parts.push(`<text class="staff-accidental" x="${x}" y="${y + 6}" font-family="serif" font-size="21">${accidental.symbol}</text>`);
    }
  });
  if (row.showTime) {
    const x = 54 + row.keySignature.length * 10;
    parts.push(`<text x="${x}" y="77" font-family="serif" font-weight="bold" font-size="22">4</text><text x="${x}" y="97" font-family="serif" font-weight="bold" font-size="22">4</text>`);
  }
  for (const note of row.notes) {
    if (note.degreeLabel) parts.push(`<text class="staff-degree" x="${note.x - 5}" y="${row.labelY}" font-size="11">${note.degreeLabel}</text>`);
    if (row.showNames) parts.push(`<text class="staff-name" x="${note.x}" y="${row.nameY}" text-anchor="middle" font-size="9">${note.label}</text>`);
    for (let y = 110; y <= note.y; y += 10) parts.push(line(note.x-9,y,note.x+9,y,'staff-ledger'));
    for (let y = 50; y >= note.y; y -= 10) parts.push(line(note.x-9,y,note.x+9,y,'staff-ledger'));
    parts.push(`<ellipse class="staff-note" data-note="${note.label}" cx="${note.x}" cy="${note.y}" rx="5.2" ry="3.7" transform="rotate(-18 ${note.x} ${note.y})"/>`);
    if (note.barAfter) parts.push(line(note.x+12,60,note.x+12,100,'staff-bar'));
  }
  for (const { notes: group, up, beamY } of stemGroups(row.notes, row.perBeat)) {
    for (const note of group) parts.push(line(note.x+(up?4.6:-4.6),note.y,note.x+(up?4.6:-4.6),beamY,'staff-stem'));
    for (let beam = 0; beam < row.beams; beam++) {
      const x = group[0].x+(up?4.6:-4.6);
      const y = beamY + (up ? beam*5 : -beam*5-3);
      parts.push(`<rect class="staff-beam" x="${x}" y="${y}" width="${group.at(-1).x-group[0].x}" height="3"/>`);
    }
  }
  if (row.finalRest) {
    const x = row.notes.at(-1).x+35;
    parts.push(`<rect class="staff-rest" x="${x}" y="76" width="12" height="4"/>`);
    parts.push(line(row.width-14,60,row.width-14,100,'staff-bar'));
  }
  const end = row.notes.at(-1);
  if (end.barAfter || row.finalRest) {
    const x = row.finalRest ? row.width-10 : end.x+16;
    if (row.last) parts.push(line(x,60,x,100,'staff-bar'));
  }
  return `<svg viewBox="0 ${row.top} ${row.width} ${row.bottom-row.top}" fill="currentColor" role="img" xmlns="http://www.w3.org/2000/svg"><title>${row.notes.map(note=>note.label).join(' ')}</title>${parts.join('')}</svg>`;
}
