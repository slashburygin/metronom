function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
}

export function taskExamples(harmony, step, task, lang) {
  const ru = lang === 'ru';
  const n = harmony.notes;
  const chord = harmony.chords[1];
  const dominantThird = harmony.progression[1].notes[1];
  const progression = harmony.progression.map((item) => item.symbol).join(' → ');
  const join = (notes) => notes.join(' – ');
  const scale = [...n, n[0]];
  const thirds = n.map((note, index) => `${note}–${n[(index + 2) % 7]}`).join('  ');
  const blocks = [
    [
      [[ru ? 'Вверх и вниз' : 'Up and down', `${join(scale)}\n${join([...scale].reverse())}`],
        [ru ? 'Как играть' : 'How to play', ru ? 'Спойте первые три ноты, затем сыграйте и сравните. Продолжите по всей гамме. По одной ноте на щелчок, 60 BPM.' : 'Sing the first three notes, then play and compare. Continue through the scale. One note per click at 60 BPM.']],
      [[ru ? 'С другой ступени' : 'From another degree', join([...n.slice(1), n[0], n[1]])],
        [ru ? 'Терциями' : 'In thirds', thirds],
        [ru ? 'Как играть' : 'How to play', ru ? 'Играйте вверх, переходя в следующую октаву. Обратно начните с последней ноты и двигайтесь вниз. Затем начните с третьей ступени.' : 'Ascend into the next octave as needed. Reverse the sequence to descend. Then start on the third degree.']],
      [],
    ],
    [
      [[chord.symbol, `${join(chord.notes)} – ${join([...chord.notes].reverse())}`],
        [ru ? 'Следующий аккорд' : 'Next chord', `${harmony.chords[4].symbol}: ${join(harmony.chords[4].notes)}`],
        [ru ? 'Как играть' : 'How to play', ru ? 'По одной ноте на щелчок. Сначала вверх и вниз на одном аккорде, затем переходите к следующему. Повторите для всех семи ступеней.' : 'One note per click. Ascend and descend on one chord before moving on. Repeat for all seven degrees.']],
      (() => {
        const a = chord.notes;
        return [[`${chord.symbol} · 3–5–7–1`, join([a[1], a[2], a[3], a[0]])],
          [`${chord.symbol} · 5–7–1–3`, join([a[2], a[3], a[0], a[1]])],
          [`${chord.symbol} · 7–1–3–5`, join([a[3], a[0], a[1], a[2]])],
          [ru ? 'Регистр' : 'Register', ru ? 'Каждая последовательность идёт вверх: при переходе через основной тон поднимайте следующие ноты на октаву. Затем сыграйте каждую последовательность в обратном порядке.' : 'Each sequence ascends: raise notes an octave when crossing the root. Then play each sequence in reverse.']];
      })(),
      [[ru ? 'Терция / септима' : 'Third / seventh', harmony.chords.map((item) => `${item.symbol}: ${item.notes[1]} / ${item.notes[3]}`).join('\n')],
        [ru ? 'Сначала слух' : 'Listen first', ru ? 'Сыграйте основной тон аккорда, спойте терцию, проверьте. Снова сыграйте основной тон, спойте септиму и проверьте. Повторите для следующего аккорда.' : 'Play the root, sing the third, then check it. Play the root again, sing the seventh and check. Repeat on the next chord.']],
    ],
    [
      [[ru ? 'Цикл из четырёх тактов' : 'Four-bar loop', `| ${harmony.progression[0].symbol} | ${harmony.progression[1].symbol} | ${harmony.progression[2].symbol} | ${harmony.progression[2].symbol} |`],
        [ru ? 'Основные тоны' : 'Roots', `| ${n[1]} — — — | ${n[4]} — — — | ${n[0]} — — — | ${n[0]} — — — |`],
        [ru ? 'Счёт' : 'Count', ru ? 'Каждый такт: 1–2–3–4. Держите ноту четыре доли. Повторите цикл, затем замените основные тоны арпеджио.' : 'Count 1–2–3–4 in each bar. Hold each note for four beats. Repeat, then replace roots with arpeggios.']],
      [[progression, harmony.guideTones.map((line) => `| ${line[0]} — — — | ${line[1]} — — — | ${line[2]} — — — | ${line[2]} — — — |`).join('\n')],
        [ru ? 'Как слушать' : 'How to listen', ru ? 'Сыграйте первую строку, затем вторую. Одинаковые ноты сохраняйте в одном регистре. Слушайте, как меняется роль общего звука при смене аккорда.' : 'Play the first line, then the second. Keep repeated notes in the same register. Hear how a common tone changes its role over the next chord.']],
      [[ru ? 'Связать опорные ноты' : 'Connect guide tones', `| ${n[3]} ${n[4]} ${n[5]} ${n[4]} | ${n[3]} ${n[2]} ${n[1]} ${n[3]} | ${n[2]} — — — | ${n[2]} — — — |`],
        [ru ? 'Арпеджио через тактовую черту' : 'Arpeggios across bar lines', harmony.progression.map((item) => `| ${join(item.notes)} `).join('') + `| ${join(harmony.chords[0].notes)} |`],
        [ru ? 'Как играть' : 'How to play', ru ? 'В примерах каждая отдельная нота — четверть, — продлевает звук на одну долю. Сначала сыграйте написанное, затем измените середину такта, сохранив опорную ноту следующего аккорда.' : 'Each separate note is a quarter note; — extends it by one beat. Play the example, then vary the middle of each bar while keeping the next target tone.']],
    ],
    [
      [[ru ? 'Только аккордовые звуки' : 'Chord tones only', `| ${join(harmony.progression[0].notes)} | ${join(harmony.progression[1].notes)} | ${join(harmony.progression[2].notes)} | ${n[2]} ${n[4]} ${n[2]} ${n[0]} |`],
        [ru ? 'Свой вариант' : 'Your variation', ru ? 'По четверти на ноту. Сыграйте пример, затем поменяйте порядок звуков каждого аккорда. В следующем круге добавьте паузы. Сохраняйте четыре доли в такте.' : 'One quarter note per note. Play the example, then reorder each chord’s tones. Add rests on the next loop. Keep four beats per bar.']],
      [[ru ? 'Мотив с проходящей нотой' : 'Motif with a passing tone', `| ${n[1]} ${n[2]} ${n[3]} — | ${n[4]} ${n[5]} ${dominantThird} — | ${n[0]} ${n[1]} ${n[2]} — | ${n[2]} — · · |`],
        [ru ? 'Развитие' : 'Development', ru ? 'Каждая позиция — четверть, — продолжает ноту, · означает паузу. Здесь один ритм переносится на новые аккорды. Смените ритм во втором круге, сохранив направления мелодии.' : 'Each position is a quarter note; — holds, · is a rest. The same rhythm moves over new chords. Change the rhythm on the next loop while keeping the melodic direction.']],
      [[ru ? 'Фраза на слух' : 'A phrase by ear', ru ? 'Выберите в записи короткую фразу на 1–2 такта. Прослушайте несколько раз, спойте, затем подберите на саксофоне. Сверьте ритм и последнюю ноту с записью.' : 'Choose a one- or two-bar phrase from a recording. Listen several times, sing it, then find it on the saxophone. Check the rhythm and final note against the recording.'],
        [ru ? 'Проверка своего соло' : 'Review your solo', ru ? 'Запишите четыре круга ii–V–I. При прослушивании отметьте: слышна ли смена аккордов, есть ли повторяющийся мотив и паузы? Выберите один фрагмент и переиграйте его лучше.' : 'Record four ii–V–I loops. Listen for clear chord changes, a recurring motif and space. Pick one passage and improve it.']],
    ],
  ];
  return blocks[step][task];
}

export function createTaskHelp(harmony, step, task, lang) {
  const ru = lang === 'ru';
  const trigger = node('button', '?', 'rhythm-help-button');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', ru ? 'Примеры к заданию' : 'Task examples');
  trigger.setAttribute('aria-expanded', 'false');
  const id = `practice-help-${step}-${task}`;
  trigger.setAttribute('popovertarget', id);
  const popup = node('div', '', 'rhythm-examples');
  popup.id = id;
  popup.setAttribute('popover', 'auto');
  popup.setAttribute('role', 'region');
  popup.setAttribute('aria-labelledby', `${id}-title`);
  const header = node('div', '', 'rhythm-examples-header');
  const title = node('strong', ru ? 'Примеры' : 'Examples');
  title.id = `${id}-title`;
  const close = node('button', '×', 'rhythm-help-button');
  close.type = 'button';
  close.setAttribute('aria-label', ru ? 'Закрыть примеры' : 'Close examples');
  close.addEventListener('click', () => { popup.hidePopover(); trigger.focus(); });
  header.append(title, close);
  popup.append(header);
  if (step === 0 && task === 2) {
    const [a, b, c] = harmony.notes;
    popup.append(node('p', ru
      ? `Играйте на ${a}–${b}–${c} при 60 BPM. Колонка — одна восьмая; щелчки метронома — на цифрах. — продолжайте звук, · пауза.`
      : `Play on ${a}–${b}–${c} at 60 BPM. Each column is an eighth note; clicks fall on numbers. — hold the note, · rest.`));
    const examples = [[a, '—', b, '—', c, '—', '—', '—'], [a, b, c, '—', b, '—', a, '—'], [a, '—', '·', '·', b, c, b, '—'], ['·', a, b, '—', '·', c, b, '—']];
    const names = ru ? ['Длинное окончание', 'Восьмые в начале', 'С паузой', 'Между ударами'] : ['Long ending', 'Eighth-note opening', 'With a rest', 'Offbeat opening'];
    examples.forEach((notes, index) => {
      const table = node('table');
      table.append(node('caption', `${index + 1}. ${names[index]}`));
      const head = node('thead');
      const counts = node('tr');
      for (const count of ['1', ru ? 'и' : '&', '2', ru ? 'и' : '&', '3', ru ? 'и' : '&', '4', ru ? 'и' : '&']) {
        const cell = node('th', count); cell.scope = 'col'; counts.append(cell);
      }
      head.append(counts);
      const body = node('tbody');
      const row = node('tr');
      for (const note of notes) row.append(node('td', note));
      body.append(row); table.append(head, body); popup.append(table);
    });
    popup.append(node('p', ru ? 'Повторите каждый пример 4 раза. Сохраните ритм и поменяйте порядок нот. Затем сыграйте такт примера и такт своего ответа.' : 'Repeat each example 4 times. Keep the rhythm and change the note order. Then play one bar of the example and one bar of your answer.'));
  } else {
    for (const [name, example] of taskExamples(harmony, step, task, lang)) {
      popup.append(node('h4', name), node('p', example.replaceAll('ii–V–I', harmony.progressionLabel), 'practice-example-text'));
    }
  }
  popup.addEventListener('toggle', (event) => {
    trigger.setAttribute('aria-expanded', event.newState === 'open');
    if (event.newState !== 'open') return;
    const bounds = trigger.getBoundingClientRect();
    popup.style.left = `${Math.max(12, Math.min(bounds.left, innerWidth - popup.offsetWidth - 12))}px`;
    popup.style.top = `${Math.max(12, Math.min(bounds.bottom + 8, innerHeight - popup.offsetHeight - 12))}px`;
  });
  return [trigger, popup];
}
