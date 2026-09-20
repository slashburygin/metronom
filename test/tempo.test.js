import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BPM, MIN_BPM, SUBDIVISIONS, TIMER_MINUTES, TapTempo, clampBpm, formatClock, nextAccent,
  resizeAccents, tempoMarking,
} from '../site/src/tempo.js';

test('clampBpm rounds and clamps to the supported range', () => {
  assert.equal(clampBpm(120.4), 120);
  assert.equal(clampBpm('95'), 95);
  assert.equal(clampBpm(5), MIN_BPM);
  assert.equal(clampBpm(1000), MAX_BPM);
  assert.equal(clampBpm('abc'), 120);
});

test('tempoMarking maps BPM to Italian tempo names', () => {
  assert.equal(tempoMarking(30), 'Grave');
  assert.equal(tempoMarking(60), 'Larghetto');
  assert.equal(tempoMarking(120), 'Allegro');
  assert.equal(tempoMarking(300), 'Prestissimo');
});

test('nextAccent cycles accent → normal → mute → accent', () => {
  assert.equal(nextAccent('accent'), 'normal');
  assert.equal(nextAccent('normal'), 'mute');
  assert.equal(nextAccent('mute'), 'accent');
});

test('resizeAccents keeps existing beats and accents beat 1', () => {
  assert.deepEqual(resizeAccents([], 3), ['accent', 'normal', 'normal']);
  assert.deepEqual(resizeAccents(['normal', 'mute'], 4), ['normal', 'mute', 'normal', 'normal']);
  assert.deepEqual(resizeAccents(['accent', 'mute', 'normal'], 2), ['accent', 'mute']);
});

test('every subdivision starts on the beat with sorted onsets inside it', () => {
  for (const [name, onsets] of Object.entries(SUBDIVISIONS)) {
    assert.equal(onsets[0], 0, name);
    for (let i = 1; i < onsets.length; i++) {
      assert.ok(onsets[i] > onsets[i - 1] && onsets[i] < 1, name);
    }
  }
});

test('TapTempo averages tap intervals', () => {
  const tapper = new TapTempo();
  assert.equal(tapper.tap(0), null);
  assert.equal(tapper.tap(500), 120);
  assert.equal(tapper.tap(1000), 120);
  assert.equal(tapper.tap(1650), 109); // avg interval 550ms
});

test('TapTempo restarts after a long pause', () => {
  const tapper = new TapTempo({ resetAfterMs: 2000 });
  tapper.tap(0);
  tapper.tap(1000);
  assert.equal(tapper.tap(5000), null);
  assert.equal(tapper.tap(5250), 240);
});

test('TapTempo only keeps the most recent taps', () => {
  const tapper = new TapTempo({ maxTaps: 3 });
  [0, 1000, 2000].forEach((ms) => tapper.tap(ms)); // 60 BPM
  tapper.tap(2500);
  assert.equal(tapper.tap(3000), 120); // window is now 2000, 2500, 3000
});

test('formatClock rounds up to whole seconds', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(0.2), '0:01');
  assert.equal(formatClock(59), '0:59');
  assert.equal(formatClock(60), '1:00');
  assert.equal(formatClock(605), '10:05');
  assert.equal(formatClock(-5), '0:00');
});

test('the practice timer offers "off" plus ascending durations', () => {
  assert.equal(TIMER_MINUTES[0], 0);
  for (let i = 1; i < TIMER_MINUTES.length; i++) {
    assert.ok(TIMER_MINUTES[i] > TIMER_MINUTES[i - 1]);
  }
});
