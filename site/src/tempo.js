// Pure helpers for tempo math — no DOM or audio, so they can be unit-tested in Node.

export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const DEFAULT_BPM = 120;

export const MAX_BEATS = 32;
export const DENOMINATORS = [1, 2, 4, 8, 16, 32];

export const ACCENT_LEVELS = ['accent', 'normal', 'mute'];

// Rhythm patterns within one beat, as click onsets in fractions of the beat.
export const SUBDIVISIONS = {
  quarter: [0],
  eighths: [0, 1 / 2],
  triplets: [0, 1 / 3, 2 / 3],
  sixteenths: [0, 1 / 4, 2 / 4, 3 / 4],
  eighthTwoSixteenths: [0, 1 / 2, 3 / 4],
  twoSixteenthsEighth: [0, 1 / 4, 1 / 2],
  sixteenthEighthSixteenth: [0, 1 / 4, 3 / 4],
  dotted: [0, 3 / 4],
  reverseDotted: [0, 1 / 4],
  swing: [0, 2 / 3],
  sextuplets: [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6],
};

export const SOUNDS = ['click', 'beep', 'wood', 'drum', 'tick', 'cowbell', 'hihat', 'ping'];

export const PITCHES = { veryLow: 0.5, low: 0.75, normal: 1, high: 1.33, veryHigh: 2 };

// Practice timer: how long a run lasts before it stops itself. 0 means off.
export const TIMER_MINUTES = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60];

export const DEFAULTS = Object.freeze({
  bpm: DEFAULT_BPM,
  beatsPerBar: 4,
  noteValue: 4,
  subdivision: 'quarter',
  sound: 'click',
  pitch: 'normal',
  volume: 0.8,
  timerMinutes: 0,
});

// Seconds as m:ss, rounded up so a running countdown only shows 0:00 at the end.
export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function clampBpm(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, n));
}

const MARKINGS = [
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [168, 'Allegro'],
  [177, 'Vivace'],
  [200, 'Presto'],
  [Infinity, 'Prestissimo'],
];

export function tempoMarking(bpm) {
  return MARKINGS.find(([upper]) => bpm < upper)[1];
}

export function nextAccent(level) {
  const i = ACCENT_LEVELS.indexOf(level);
  return ACCENT_LEVELS[(i + 1) % ACCENT_LEVELS.length];
}

// Resize an accent pattern, keeping existing entries. Beat 1 defaults to an accent.
export function resizeAccents(accents, beats) {
  const out = accents.slice(0, beats);
  while (out.length < beats) out.push(out.length === 0 ? 'accent' : 'normal');
  return out;
}

// Averages the intervals between recent taps. Returns a BPM once there are
// at least two taps; a pause longer than resetAfterMs starts a new sequence.
export class TapTempo {
  constructor({ maxTaps = 8, resetAfterMs = 2000 } = {}) {
    this.maxTaps = maxTaps;
    this.resetAfterMs = resetAfterMs;
    this.taps = [];
  }

  tap(timeMs) {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && timeMs - last > this.resetAfterMs) this.taps = [];
    this.taps.push(timeMs);
    if (this.taps.length > this.maxTaps) this.taps.shift();
    if (this.taps.length < 2) return null;
    const span = this.taps[this.taps.length - 1] - this.taps[0];
    const avgInterval = span / (this.taps.length - 1);
    return clampBpm(60000 / avgInterval);
  }
}
