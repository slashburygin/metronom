import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rhythmSvg } from '../site/src/notation.js';
import { SUBDIVISIONS } from '../site/src/tempo.js';

const count = (svg, tag) => svg.split(`<${tag}`).length - 1;

test('every rhythm draws one notehead per click', () => {
  for (const [name, onsets] of Object.entries(SUBDIVISIONS)) {
    const svg = rhythmSvg(onsets);
    assert.ok(svg.startsWith('<svg'), name);
    assert.equal(count(svg, 'ellipse'), onsets.length, name);
  }
});

test('a lone quarter note is a notehead with a stem and no beam', () => {
  const svg = rhythmSvg(SUBDIVISIONS.quarter);
  assert.equal(count(svg, 'ellipse'), 1);
  assert.equal(count(svg, 'rect'), 1); // the stem; nothing to beam to
  assert.equal(count(svg, 'path'), 0); // and no flag either
});

test('beams stack up with shorter notes', () => {
  // Beams are drawn between each pair of neighbours, and the bars abut into a
  // continuous beam: 2 eighths are 2 stems + 1 bar, 4 sixteenths are 4 stems
  // plus 3 bars on each of the two levels.
  assert.equal(count(rhythmSvg(SUBDIVISIONS.eighths), 'rect'), 3);
  assert.equal(count(rhythmSvg(SUBDIVISIONS.sixteenths), 'rect'), 10);
});

test('a partial beam becomes a stub on the shorter note', () => {
  // dotted eighth + sixteenth: 2 stems, 1 shared beam, 1 stub for the 16th
  assert.equal(count(rhythmSvg(SUBDIVISIONS.dotted), 'rect'), 4);
});

test('a dotted rhythm draws the dot', () => {
  assert.equal(count(rhythmSvg(SUBDIVISIONS.dotted), 'circle'), 1);
  assert.equal(count(rhythmSvg(SUBDIVISIONS.eighths), 'circle'), 0);
});

test('tuplets are numbered', () => {
  assert.match(rhythmSvg(SUBDIVISIONS.triplets), />3</);
  assert.match(rhythmSvg(SUBDIVISIONS.sextuplets), />6</);
  assert.match(rhythmSvg(SUBDIVISIONS.swing), />3</);
  assert.doesNotMatch(rhythmSvg(SUBDIVISIONS.sixteenths), />[36]</);
});
