import { PARTS } from './accompaniment.js';
export function normalizeMix(input = {}) {
  return Object.fromEntries(PARTS.map(part => [part, {
    volume: Number.isFinite(input?.[part]?.volume) && input[part].volume >= 0 && input[part].volume <= 1 ? input[part].volume : part === 'drums' ? .55 : .75,
    muted: input?.[part]?.muted === true,
  }]));
}
export function createMixer({ prefix, lang, mix, onChange }) {
  const values = normalizeMix(mix), fieldset = document.createElement('fieldset'), legend = document.createElement('legend');
  const ru = lang === 'ru'; fieldset.className = 'backing-mixer'; legend.textContent = ru ? 'Микшер' : 'Mixer'; fieldset.append(legend);
  PARTS.forEach((part,index) => {
    const row = document.createElement('div'), label = document.createElement('label'), volume = document.createElement('input'), muteLabel = document.createElement('label'), mute = document.createElement('input');
    label.textContent = (ru ? ['Бас','Клавиши','Ударные'] : ['Bass','Keys','Drums'])[index];
    volume.type = 'range'; volume.min = 0; volume.max = 1; volume.step = .05; volume.value = values[part].volume; volume.id = `${prefix}-${part}-volume`; volume.setAttribute('aria-label', label.textContent);
    mute.type = 'checkbox'; mute.checked = values[part].muted; mute.id = `${prefix}-${part}-mute`; muteLabel.className = 'check'; muteLabel.append(mute, document.createTextNode(ru ? 'Отключить' : 'Mute'));
    function apply() { values[part] = { volume: Number(volume.value), muted: mute.checked }; onChange(normalizeMix(values),part); }
    volume.addEventListener('input', apply); mute.addEventListener('change',apply);
    label.append(volume); row.append(label,muteLabel); fieldset.append(row);
  });
  return fieldset;
}
