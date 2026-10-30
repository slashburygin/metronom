import { normalizeSeed } from './arrangement.js';

export function seedControl({ prefix, lang, seed, onChange }) {
  const label = document.createElement('label');
  label.textContent = lang === 'ru' ? 'Вариант исполнения' : 'Performance variation';
  const input = document.createElement('input');
  input.type = 'number'; input.min = 0; input.max = 4294967295; input.step = 1;
  input.id = `${prefix}-seed`; input.value = normalizeSeed(seed);
  input.title = lang === 'ru' ? 'Одинаковый номер сохраняет те же вариации громкости.' : 'The same number preserves the same velocity variations.';
  input.addEventListener('change', () => {
    const value = normalizeSeed(input.value === '' ? NaN : Number(input.value));
    input.value = value; onChange(value);
  });
  label.append(input);
  return label;
}
