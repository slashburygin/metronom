import { randomSequence } from './arrangement.js';

export const PIANO_TONES = ['piano', 'electric', 'organ'];
export const BASS_TONES = ['acoustic', 'electric'];
export function normalizeSound(input) {
  return {
    pianoTone: PIANO_TONES.includes(input?.pianoTone) ? input.pianoTone : 'piano',
    bassTone: BASS_TONES.includes(input?.bassTone) ? input.bassTone : 'acoustic',
    reverb: Number.isFinite(input?.reverb) ? Math.max(0, Math.min(1, input.reverb)) : 0,
  };
}

// Procedural timbres, with no downloaded or third-party sound assets.
export function voiceProfile(part, sound) {
  if (part === 'piano') return {
    piano: { wave: 'sine', partials: [[1,1],[2,0.3],[3,0.12],[4,0.04]], level: 0.1, sustain: 0.22, decay: 0.55 },
    electric: { wave: 'sine', partials: [[1,1],[2,0.12],[3,0.24],[7,0.04]], level: 0.1, sustain: 0.16, decay: 0.65 },
    organ: { wave: 'sine', partials: [[1,0.8],[2,0.35],[3,0.18],[4,0.12]], level: 0.09, sustain: 0.9, decay: 0.8 },
  }[sound.pianoTone];
  if (part === 'bass') return sound.bassTone === 'electric'
    ? { wave: 'sawtooth', partials: [[1,1]], level: 0.26, sustain: 0.5, decay: 0.65, cutoff: 7 }
    : { wave: 'triangle', partials: [[1,1],[2,0.1]], level: 0.32, sustain: 0.25, decay: 0.55, cutoff: 4 };
  return { wave: 'sine', partials: [[1,1]], level: 0.25, sustain: 0.3, decay: 0.6 };
}

export function roomImpulse(context) {
  const length = Math.ceil(context.sampleRate * 1.2);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const random = randomSequence(982451653);
  const delay = Math.round(context.sampleRate * 0.015);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let energy = 0;
    for (let i = delay; i < length; i++) {
      const decay = (1 - (i - delay) / (length - delay)) ** 3;
      data[i] = (random() * 2 - 1) * decay;
      energy += data[i] * data[i];
    }
    const scale = 0.6 / Math.sqrt(energy);
    for (let i = delay; i < length; i++) data[i] *= scale;
  }
  return buffer;
}
