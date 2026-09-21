// Draws a rhythm pattern as musical notation, derived from the same onsets the
// scheduler plays. Each note's duration decides its glyph: how many beams it
// carries, whether it is dotted, and whether it belongs to a tuplet.

const U = 46; // width of one beat
const HEIGHT = 36;
const HEAD_CY = 28;
const HEAD_RX = 4.4;
const STEM_TOP = 14;
const STEM_DX = 4.1; // stems go up on the right-hand side of the notehead
const STEM_W = 1.7;
const BEAM_H = 3.2;
const BEAM_GAP = 5;
const STUB_W = 7;

// duration in fractions of a beat -> how the note is written
const GLYPHS = [
  { d: 1, beams: 0 },
  { d: 3 / 4, beams: 1, dot: true },
  { d: 2 / 3, beams: 0, tuplet: 3 },
  { d: 1 / 2, beams: 1 },
  { d: 1 / 3, beams: 1, tuplet: 3 },
  { d: 1 / 4, beams: 2 },
  { d: 1 / 6, beams: 2, tuplet: 6 },
];

function glyphFor(duration) {
  return GLYPHS.find((g) => Math.abs(g.d - duration) < 1e-6) ?? { beams: 0 };
}

const rect = (x, y, w, h) => `<rect x="${round(x)}" y="${y}" width="${round(w)}" height="${h}"/>`;
const round = (n) => Math.round(n * 100) / 100;

export function rhythmSvg(onsets) {
  // The last note runs to the end of the beat
  const notes = onsets.map((onset, i) => {
    const end = i + 1 < onsets.length ? onsets[i + 1] : 1;
    return { x: onset * U, stem: onset * U + STEM_DX, ...glyphFor(end - onset) };
  });

  const parts = [];
  for (const n of notes) {
    parts.push(`<ellipse cx="${round(n.x)}" cy="${HEAD_CY}" rx="${HEAD_RX}" ry="3.3"`
      + ` transform="rotate(-18 ${round(n.x)} ${HEAD_CY})"/>`);
    if (n.dot) parts.push(`<circle cx="${round(n.x + 9)}" cy="${HEAD_CY - 3}" r="1.6"/>`);
    // Every note here is a quarter or shorter, so they all carry a stem
    parts.push(rect(n.stem - STEM_W / 2, STEM_TOP, STEM_W, HEAD_CY - STEM_TOP));
  }

  // A beam spans two neighbours at every level they share. A level the
  // neighbours don't share becomes a stub, pointing back at the group it
  // belongs to: right for the first note, left for any other.
  let flagged = false;
  notes.forEach((n, i) => {
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const shared = Math.max(prev ? Math.min(n.beams, prev.beams) : 0,
      next ? Math.min(n.beams, next.beams) : 0);
    for (let level = 1; level <= n.beams; level++) {
      const y = STEM_TOP + (level - 1) * BEAM_GAP;
      if (next && Math.min(n.beams, next.beams) >= level) {
        parts.push(rect(n.stem - STEM_W / 2, y, next.stem - n.stem + STEM_W, BEAM_H));
      } else if (prev && Math.min(n.beams, prev.beams) >= level) {
        continue; // already drawn from the previous note
      } else if (shared > 0) {
        const x = i === 0 ? n.stem - STEM_W / 2 : n.stem + STEM_W / 2 - STUB_W;
        parts.push(rect(x, y, STUB_W, BEAM_H));
      } else {
        // Nothing to beam to, so the note gets a flag of its own
        flagged = true;
        parts.push(`<path d="M${round(n.stem)} ${y} c 5.5 2.5 6.5 7 2.5 11"`
          + ` fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
      }
    }
  });

  const tuplet = notes.reduce((max, n) => Math.max(max, n.tuplet ?? 0), 0);
  if (tuplet) {
    const mid = (notes[0].stem + notes[notes.length - 1].stem) / 2;
    parts.push(`<text x="${round(mid)}" y="9" font-size="10" font-style="italic"`
      + ` text-anchor="middle">${tuplet}</text>`);
  }

  const left = Math.min(...notes.map((n) => n.x)) - HEAD_RX - 2;
  const right = Math.max(...notes.map((n) => n.x + (n.dot ? 12 : HEAD_RX + 2)), ...notes.map(
    (n) => n.stem + (flagged ? 9 : STEM_W),
  ));
  return `<svg viewBox="${round(left)} 0 ${round(right - left)} ${HEIGHT}" fill="currentColor"`
    + ` role="presentation">${parts.join('')}</svg>`;
}
