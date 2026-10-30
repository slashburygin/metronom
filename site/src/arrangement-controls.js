import { normalizeSeed } from './arrangement.js';
import { normalizeArrangement } from './arrangement-ornaments.js';

export function seedControl({ prefix, lang, seed, onChange }) {
  const label = document.createElement('label');
  label.textContent = lang === 'ru' ? 'Вариант исполнения' : 'Performance variation';
  const input = document.createElement('input');
  input.type = 'number'; input.min = 0; input.max = 4294967295; input.step = 1;
  input.id = `${prefix}-seed`; input.value = normalizeSeed(seed);
  input.title = lang === 'ru' ? 'Одинаковый номер повторяет вариации громкости, краски и сбивки.' : 'The same number repeats velocity variations, colors and fills.';
  input.addEventListener('change', () => {
    const value = normalizeSeed(input.value === '' ? NaN : Number(input.value));
    input.value = value; onChange(value);
  });
  label.append(input);
  return label;
}

export function createArrangementControls({ prefix, lang, arrangement, onChange }) {
  const current = normalizeArrangement(arrangement), ru = lang === 'ru';
  const fieldset = document.createElement('fieldset'); fieldset.className = 'arrangement-controls';
  const legend = document.createElement('legend'); legend.textContent = ru ? 'Аранжировка' : 'Arrangement'; fieldset.append(legend);
  for (const [name, text] of [['colors', ru ? 'Аккордовые краски · 9/13' : 'Chord colors · 9/13'], ['fills', ru ? 'Сбивки и окончания кругов' : 'Fills and chorus endings']]) {
    const label = document.createElement('label'); label.className = 'check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = `${prefix}-${name}`; input.checked = current[name];
    const span = document.createElement('span'); span.textContent = text;
    input.addEventListener('change', () => { current[name] = input.checked; onChange({ ...current }, name); });
    label.append(input, span); fieldset.append(label);
  }
  const help = document.createElement('p'); help.className = 'textbook-help';
  help.textContent = ru ? 'Краски меняют только звучание клавиш. Исходные аккорды сохраняются. Смена настроек останавливает воспроизведение.' : 'Colors affect only the keys; source chords stay unchanged. Changing settings stops playback.';
  fieldset.append(help);
  return fieldset;
}
