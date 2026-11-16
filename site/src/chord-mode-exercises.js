import { scaleHarmony } from './harmony.js';

// One-based degrees are relative to the selected modal tonic. Keep compound
// degrees (8, 9) until presentation so the ninth cannot collapse into a second.
export function chordModeExercises(key = 'C', type = 'major', start = 0) {
  if (!Number.isInteger(start) || start < 0 || start > 6) throw new RangeError('Invalid mode degree');
  const harmony = scaleHarmony(key, type);
  const notes = Array.from({ length: 7 }, (_, i) => harmony.notes[(start + i) % 7]);
  const up = Array.from({ length: 8 }, (_, i) => i + 1);
  const thirdsUp = Array.from({ length: 6 }, (_, i) => [i + 1, i + 3]).flat();
  const thirdsDown = Array.from({ length: 6 }, (_, i) => [8 - i, 6 - i]).flat();
  const patterns = [
    [1], [1,2], [1,2,3], [1,2,3,4,5], [1,3,5], [1,3,5,7], [1,3,5,7,9],
    [...up, ...up.slice(0,-1).reverse()], [1,3,5,6],
    [...up,9,7,5,3,1], [1,3,5,7,9,8,7,6,5,4,3,2,1],
    [...thirdsUp, ...thirdsDown.slice(1)],
  ];
  return { tonic: notes[0], chord: harmony.chords[start].symbol, notes,
    exercises: patterns.map((degrees, index) => ({ id: index + 1, degrees,
      notes: degrees.map(degree => ({ name: notes[(degree - 1) % 7], octave: Math.floor((degree - 1) / 7), degree })) })) };
}

export function createChordModeMaterial({ key, type, start, lang, completed = {}, onComplete }) {
  const ru = lang === 'ru', data = chordModeExercises(key, type, start);
  const labels = ru ? [
    'Основание аккорда / тоника лада', 'Первые две ноты лада', 'Первые три ноты лада', 'Первые пять нот лада',
    'Трезвучие', 'Септаккорд', 'Нонаккорд', 'Весь лад вверх и вниз', 'Аккорд с добавленной секстой',
    'Вверх по ладу до IX, вниз по аккордовым звукам', 'Вверх по нонаккорду, вниз по ладу', 'Ломаные терции вверх и вниз',
  ] : [
    'Chord root / mode tonic', 'First two mode notes', 'First three mode notes', 'First five mode notes',
    'Triad', 'Seventh chord', 'Ninth chord', 'Full mode up and down', 'Chord with an added sixth',
    'Mode up to the ninth, chord tones down', 'Ninth arpeggio up, mode down', 'Broken thirds up and down',
  ];
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const root = node('div', '', 'chord-mode-material');
  root.append(node('p', `${data.chord} · ${data.notes.join(' — ')}`, 'scale-notes'),
    node('p', ru ? 'Ступени считаются от тоники выбранного лада. Играйте звуки аккордов последовательно. ↑ — следующая октава; IX — II ступень октавой выше. Начните с 60 BPM и одной ноты на щелчок. Повторите каждый рисунок четыре раза.'
      : 'Degrees are relative to the selected mode tonic. Play chord tones one after another. ↑ means the next octave; the ninth is the second one octave higher. Start at 60 BPM, one note per click. Repeat each pattern four times.', 'textbook-help'));
  const list = node('ol', '', 'chord-mode-plan');
  for (const exercise of data.exercises) {
    const item = node('li');
    const details = node('details'); details.open = exercise.id === 1;
    details.append(node('summary', labels[exercise.id - 1]));
    details.append(node('p', exercise.degrees.join(' – '), 'field-label'),
      node('p', exercise.notes.map(n => n.name + (n.octave ? '↑' : '')).join(' – '), 'chord-mode-notes'));
    const label = node('label', '', 'check'); const check = node('input');
    check.type = 'checkbox'; check.checked = completed[exercise.id] === true;
    check.addEventListener('change', () => onComplete?.(exercise.id, check.checked));
    label.append(check, node('span', ru ? 'Упражнение освоено' : 'Exercise mastered'));
    details.append(label); item.append(details); list.append(item);
  }
  root.append(list); return root;
}
