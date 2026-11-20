// Local CC0 recordings; source pins, transformations and licenses ship beside them.
export const TRIO_SAMPLES = [
  ...['soft', 'medium'].flatMap(layer => [41,49,57,65,73,81].map(midi =>
    ({ part: 'piano', midi, layer, file: `piano-${midi}-${layer}.wav` }))),
  ...[36,40,44,49,52].flatMap(midi => [1,2].map(rr =>
    ({ part: 'bass', midi, file: `bass-${midi}-${rr}.wav` }))),
  ...['hat','snare','kick'].flatMap(part => [1,2].map(rr => ({ part, file: `${part}-${rr}.wav` }))),
];
const banks = new WeakMap();
export function loadTrioSamples(context) {
  if (!banks.has(context)) {
    const base = `${import.meta.env?.BASE_URL ?? '/'}samples/trio-v1/`;
    const pending = Promise.all(TRIO_SAMPLES.map(async sample => {
      const response = await fetch(base + sample.file);
      if (!response.ok) throw new Error(`Could not load instrument: ${sample.file}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return { ...sample, buffer };
    }));
    banks.set(context, pending);
    pending.catch(() => { if (banks.get(context) === pending) banks.delete(context); });
  }
  return banks.get(context);
}

export function selectSample(bank, event, sound, variation = 0) {
  if (!bank || event.part === 'countIn') return null;
  if (event.part === 'piano' && sound.pianoTone !== 'piano') return null;
  if (event.part === 'bass' && sound.bassTone !== 'acoustic') return null;
  const part = event.part === 'drums' ? event.sound : event.part;
  let candidates = bank.filter(sample => sample.part === part);
  if (part === 'piano') candidates = candidates.filter(sample => sample.layer === (event.velocity < .42 ? 'soft' : 'medium'));
  if (!candidates.length) return null;
  if (Number.isFinite(event.midi)) {
    const distance = Math.min(...candidates.map(sample => Math.abs(sample.midi - event.midi)));
    candidates = candidates.filter(sample => Math.abs(sample.midi - event.midi) === distance);
    // On a tie choose the higher recording consistently, then alternate takes.
    const root = Math.max(...candidates.map(sample => sample.midi));
    candidates = candidates.filter(sample => sample.midi === root);
  }
  const sample = candidates[variation % candidates.length];
  return { buffer: sample.buffer, rate: sample.midi === undefined ? 1 : 2 ** ((event.midi - sample.midi) / 12) };
}
