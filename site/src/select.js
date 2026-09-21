// A dropdown styled like the rest of the site. A native <select> draws its
// popup through the OS, which ignores our tokens, so the list is built here as
// a listbox: a button that opens a panel of options.
//
// Keyboard: Enter/Space/Arrows open, Arrows move, Enter/Space pick, Esc closes.
// Keys it handles stop propagating, so the app's global shortcuts (Space to
// start, arrows for tempo) stay out of the way while a list is open.

const CHEVRON = '<svg class="select-chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none"'
  + ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M4 6.5 8 10.5 12 6.5"/></svg>';

export function createSelect(host, { onChange, label } = {}) {
  host.classList.add('select');
  host.innerHTML = `<button type="button" class="select-button" aria-haspopup="listbox"`
    + ` aria-expanded="false"><span class="select-value"></span>${CHEVRON}</button>`
    + `<ul class="select-menu" role="listbox" hidden></ul>`;

  const button = host.querySelector('.select-button');
  const valueEl = host.querySelector('.select-value');
  const menu = host.querySelector('.select-menu');
  if (label) button.setAttribute('aria-label', label);

  let options = [];
  let value = null;
  let active = 0;

  const isOpen = () => !menu.hidden;

  function render() {
    const i = options.findIndex((o) => String(o.value) === String(value));
    valueEl.textContent = i === -1 ? '' : options[i].label;
    menu.querySelectorAll('.select-option').forEach((el, idx) => {
      el.setAttribute('aria-selected', idx === i);
      el.classList.toggle('active', idx === active);
    });
    const activeEl = menu.children[active];
    button.setAttribute('aria-activedescendant', isOpen() && activeEl ? activeEl.id : '');
  }

  function open() {
    if (isOpen()) return;
    active = Math.max(0, options.findIndex((o) => String(o.value) === String(value)));
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    render();
    menu.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  function close() {
    if (!isOpen()) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
  }

  function pick(index) {
    const option = options[index];
    close();
    button.focus();
    if (!option || String(option.value) === String(value)) return;
    value = option.value;
    render();
    onChange?.(value);
  }

  function move(delta) {
    active = Math.min(options.length - 1, Math.max(0, active + delta));
    render();
    menu.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));

  host.addEventListener('keydown', (e) => {
    const keys = [' ', 'Enter', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab'];
    if (!keys.includes(e.key)) return;
    if (e.key === 'Tab') {
      close();
      return; // let focus move on
    }
    if (e.key !== 'Escape') e.preventDefault();
    e.stopPropagation(); // keep the app's global shortcuts out of the dropdown
    if (!isOpen()) {
      if (e.key !== 'Escape') open();
      return;
    }
    switch (e.key) {
      case 'Escape': close(); button.focus(); break;
      case ' ':
      case 'Enter': pick(active); break;
      case 'ArrowDown': move(1); break;
      case 'ArrowUp': move(-1); break;
      case 'Home': move(-options.length); break;
      case 'End': move(options.length); break;
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!host.contains(e.target)) close();
  });

  return {
    // entries: [[value, label], ...]
    setOptions(entries) {
      options = entries.map(([v, text]) => ({ value: v, label: text }));
      menu.replaceChildren(...options.map((o, i) => {
        const li = document.createElement('li');
        li.id = `${host.id}-option-${i}`;
        li.className = 'select-option';
        li.setAttribute('role', 'option');
        li.textContent = o.label;
        li.addEventListener('click', () => pick(i));
        return li;
      }));
      render();
    },
    setValue(v) {
      value = v;
      render();
    },
    getValue: () => value,
    setLabel(text) { button.setAttribute('aria-label', text); },
  };
}
