import { KEY_NAMES, INSTRUMENTS } from './transposition.js';
import { normalizeTraining, trainingState } from './training.js';

export function trainingLabel(state, lang) {
  const ru = lang === 'ru';
  return `${ru ? 'Звучит' : 'Concert'}: ${state.key} · ${ru ? 'Партия' : 'Written'}: ${state.writtenKey} (${state.instrument === 'C' ? 'C' : state.instrument === 'Bb' ? 'B♭' : state.instrument === 'Eb' ? 'E♭' : state.instrument}) · ${state.bpm} BPM`;
}
export function createTrainingControls({ prefix, getLang, settings, sourceKey, bpm, onChange }) {
  const ru = getLang() === 'ru';
  const root = document.createElement('fieldset'); root.className = 'training-controls';
  const legend = document.createElement('legend'); legend.textContent = ru ? 'Тональность и практика' : 'Key and practice'; root.append(legend);
  const grid = document.createElement('div'); grid.className = 'song-fields'; root.append(grid);
  const field = (name, label) => {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    grid.append(wrapper); return { wrapper, id: `${prefix}-${name}` };
  };
  const select = (name, label, values, labels) => {
    const { wrapper, id } = field(name, label), input = document.createElement('select'); input.id = id;
    values.forEach((value, i) => { const option = document.createElement('option'); option.value = value; option.textContent = labels[i]; option.selected = String(settings[name]) === String(value); input.append(option); });
    input.addEventListener('change', () => onChange(name, name === 'keyStep' || name === 'repeatsPerKey' ? Number(input.value) : input.value));
    wrapper.append(input);
  };
  select('targetKey', ru ? 'Тональность звучания' : 'Concert key', ['', ...KEY_NAMES], [ru ? 'Исходная' : 'Original', ...KEY_NAMES]);
  select('instrument', ru ? 'Строй инструмента' : 'Instrument', Object.keys(INSTRUMENTS), ['C','B♭','E♭','F','G']);
  select('keyStep', ru ? 'Смена тональности' : 'Key cycle', [0,1,5,-1,-5], ru ? ['Без смены','Вверх на полутон','Вверх на кварту','Вниз на полутон','Вниз на кварту'] : ['No change','Up a semitone','Up a fourth','Down a semitone','Down a fourth']);
  select('repeatsPerKey', ru ? 'Кругов в тональности' : 'Choruses per key', [1,2,3,4,6,8], ['1','2','3','4','6','8']);
  for (const [name, label, min, max] of [['tempoIncrement',ru ? '+ BPM за круг' : '+ BPM per chorus',0,20], ['maxBpm',ru ? 'Предел BPM' : 'BPM limit',30,300]]) {
    const { wrapper, id } = field(name, label), input = document.createElement('input'); input.type = 'number'; input.id = id; input.min = min; input.max = max; input.step = 1; input.value = settings[name];
    input.addEventListener('change', () => onChange(name, Math.max(min,Math.min(max,Math.round(Number(input.value) || min))))); wrapper.append(input);
  }
  const summary = document.createElement('p'); summary.className = 'textbook-help';
  try { summary.textContent = trainingLabel(trainingState(sourceKey,1,bpm,settings),getLang()); }
  catch { summary.textContent = ru ? 'Укажите исходную тональность: C, F♯, B♭m…' : 'Enter a source key: C, F♯, B♭m…'; }
  root.append(summary);
  const hint = document.createElement('p'); hint.className = 'textbook-help';
  hint.textContent = ru ? `Для всех 12 тональностей выберите смену и не менее ${12 * settings.repeatsPerKey} кругов или играйте до остановки. Предел BPM не снижает начальный темп. Изменение настроек останавливает игру.` : `For all 12 keys, enable cycling and play at least ${12 * settings.repeatsPerKey} choruses or play until stopped. The BPM limit does not lower the starting tempo. Changing settings stops playback.`;
  root.append(hint); return root;
}

// Shared schema for both players; unknown/invalid fields fall back safely.
export function readTraining(storage, key) {
  try { return normalizeTraining(JSON.parse(storage.getItem(key))); } catch { return normalizeTraining(); }
}
