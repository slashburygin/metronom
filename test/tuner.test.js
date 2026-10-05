import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, pitchToNote, Tuner } from '../site/src/tuner.js';

function signal(frequency, sampleRate, harmonics = false) {
  return Float32Array.from({ length: 4096 }, (_, i) => {
    const phase = 2 * Math.PI * frequency * i / sampleRate;
    return harmonics ? 0.12 * Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase)
      : 0.3 * Math.sin(phase);
  });
}

test('detects bass, guitar and high notes at common microphone sample rates', () => {
  for (const rate of [44100, 48000]) {
    for (const frequency of [55, 82.4069, 110, 196, 440, 880, 1318.51]) {
      const actual = detectPitch(signal(frequency, rate), rate);
      assert.ok(actual, `${frequency} Hz at ${rate}`);
      assert.ok(Math.abs(1200 * Math.log2(actual / frequency)) < 3, `${actual} vs ${frequency}`);
    }
  }
});

test('finds fundamental with stronger upper harmonics', () => {
  for (const frequency of [82.4069, 196, 440]) {
    const actual = detectPitch(signal(frequency, 48000, true), 48000);
    assert.ok(Math.abs(1200 * Math.log2(actual / frequency)) < 3);
  }
});

test('ignores silence and quiet input', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
  assert.equal(detectPitch(signal(440, 48000).map(x => x * 0.001), 48000), null);
});

test('maps notes, octaves and signed tuning deviation', () => {
  assert.deepEqual(pitchToNote(440), { name: 'A', octave: 4, cents: 0, frequency: 440 });
  const note = pitchToNote(440 * 2 ** (-20 / 1200));
  assert.equal(note.name, 'A');
  assert.ok(Math.abs(note.cents + 20) < 0.0001);
  assert.equal(pitchToNote(261.6256).name, 'C');
  assert.equal(pitchToNote(82.4069).octave, 2);
});

test('cancelling pending microphone access stops a subsequently granted stream', async () => {
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  let grant;
  let stops = 0;
  Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: {
    getUserMedia: () => new Promise(resolve => { grant = resolve; }),
  } }, configurable: true });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: () => {}, configurable: true });
  try {
    const tuner = new Tuner(() => {});
    const pending = tuner.start();
    assert.equal(tuner.state, 'requesting');
    tuner.stop();
    grant({ getTracks: () => [{ stop: () => { stops++; } }] });
    await pending;
    assert.equal(stops, 1);
    assert.equal(tuner.state, 'idle');
  } finally {
    for (const key of ['isSecureContext', 'navigator', 'cancelAnimationFrame']) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
      else delete globalThis[key];
    }
  }
});
