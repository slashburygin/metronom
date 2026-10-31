import { PIANO_TONES, BASS_TONES, normalizeSound } from './backing-sound.js';

export function createSoundControls({ prefix, lang, sound, onChange }) {
  const current = normalizeSound(sound), ru = lang === 'ru';
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  const fieldset = node('fieldset'); fieldset.className = 'backing-mixer sound-controls';
  fieldset.append(node('legend', ru ? 'Звук' : 'Sound'));
  const fields = node('div'); fields.className = 'song-fields';
  function select(label, name, values, labels) {
    const wrapper = node('label', label), input = node('select'); input.id = `${prefix}-${name}`;
    values.forEach((value, i) => { const option = node('option', labels[i]); option.value = value; option.selected = current[name] === value; input.append(option); });
    input.addEventListener('change', () => { current[name] = input.value; onChange({ ...current }); });
    wrapper.append(input); fields.append(wrapper);
  }
  select(ru ? 'Клавиши' : 'Keys', 'pianoTone', PIANO_TONES, ru ? ['Фортепиано', 'Электропиано', 'Орган'] : ['Piano', 'Electric piano', 'Organ']);
  select(ru ? 'Бас' : 'Bass', 'bassTone', BASS_TONES, ru ? ['Контрабас', 'Электробас'] : ['Acoustic bass', 'Electric bass']);
  const label = node('label', ru ? 'Реверберация' : 'Reverb'), range = node('input'), value = node('output');
  range.type = 'range'; range.min = 0; range.max = 1; range.step = 0.05; range.value = current.reverb; range.id = `${prefix}-reverb`;
  value.htmlFor = range.id; value.textContent = Math.round(current.reverb * 100) + '%';
  range.addEventListener('input', () => { current.reverb = Number(range.value); value.textContent = Math.round(current.reverb * 100) + '%'; onChange({ ...current }); });
  label.append(range, value); fields.append(label);
  const help = node('p', ru ? 'Синтезированные тембры. Смена звука останавливает воспроизведение.' : 'Synthesized timbres. Changing sound stops playback.'); help.className = 'textbook-help';
  fieldset.append(fields, help);
  return fieldset;
}
