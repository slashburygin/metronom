import { KEY_NAMES, INSTRUMENTS, parseKey, keyAt, keyDistance, mod12, transposeArrangement, transposeSong } from './transposition.js';
import { clampBpm } from './tempo.js';
export const TRAINING_DEFAULTS = Object.freeze({ targetKey: '', instrument: 'C', keyStep: 0, repeatsPerKey: 1, tempoIncrement: 0, maxBpm: 300 });
export function normalizeTraining(input = {}) {
  const result = { ...TRAINING_DEFAULTS };
  if (KEY_NAMES.includes(input?.targetKey)) result.targetKey = input.targetKey;
  if (Object.hasOwn(INSTRUMENTS, input?.instrument)) result.instrument = input.instrument;
  if ([0,1,5,-1,-5].includes(input?.keyStep)) result.keyStep = input.keyStep;
  if (Number.isInteger(input?.repeatsPerKey) && input.repeatsPerKey >= 1 && input.repeatsPerKey <= 8) result.repeatsPerKey = input.repeatsPerKey;
  if (Number.isInteger(input?.tempoIncrement) && input.tempoIncrement >= 0 && input.tempoIncrement <= 20) result.tempoIncrement = input.tempoIncrement;
  if (Number.isInteger(input?.maxBpm) && input.maxBpm >= 30 && input.maxBpm <= 300) result.maxBpm = input.maxBpm;
  return result;
}
export function trainingState(sourceKey, pass, bpm, input = {}) {
  if (!Number.isSafeInteger(pass) || pass < 1) throw new RangeError('Invalid pass');
  const settings = normalizeTraining(input);
  const source = parseKey(sourceKey);
  const initial = settings.targetKey || source.tonic;
  const group = Math.floor((pass - 1) / settings.repeatsPerKey);
  const shift = mod12(group * settings.keyStep);
  const key = shift === 0 ? initial : keyAt(parseKey(initial).pitch + shift, source.minor);
  const semitones = keyDistance(sourceKey, key);
  const written = INSTRUMENTS[settings.instrument];
  return { pass, group, key, writtenKey: written === 0 ? key : keyAt(parseKey(key).pitch + written, source.minor), semitones,
    writtenSemitones: semitones + written, instrument: settings.instrument,
    bpm: Math.min(Math.max(clampBpm(bpm), settings.maxBpm), clampBpm(bpm) + (pass - 1) * settings.tempoIncrement) };
}
export function displaySong(source, state) {
  return transposeSong(source, state.writtenSemitones, state.writtenKey);
}
export function trainingArrangement(compiled, state) {
  return transposeArrangement(compiled, state.semitones, state.key);
}
