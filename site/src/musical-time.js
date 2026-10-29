// Exact musical durations in whole notes. Seconds belong only to the audio clock.
const integer = (v) => Number.isSafeInteger(v);
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
export function fraction(n, d = 1) {
  if (!integer(n) || !integer(d) || d <= 0) throw new RangeError('Invalid musical fraction');
  const divisor = gcd(Math.abs(n), d);
  return Object.freeze({ n: n / divisor, d: d / divisor });
}
export function asFraction(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Expected { n, d } musical time');
  return fraction(value.n, value.d);
}
export function add(a, b) { return fraction(a.n * b.d + b.n * a.d, a.d * b.d); }
export function subtract(a, b) { return fraction(a.n * b.d - b.n * a.d, a.d * b.d); }
export function multiply(a, b) { return fraction(a.n * b.n, a.d * b.d); }
export function compare(a, b) { return Math.sign(subtract(a, b).n); }
export function valueOf(a) { return a.n / a.d; }
export const ZERO = fraction(0);
export const QUARTER = fraction(1, 4);
export function secondsFor(duration, bpm, tempoUnit = QUARTER) {
  if (!Number.isFinite(bpm) || bpm <= 0 || tempoUnit.n <= 0) throw new RangeError('Invalid tempo');
  return valueOf(duration) / valueOf(tempoUnit) * 60 / bpm;
}
