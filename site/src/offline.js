const TEXT = {
  ru: {
    preparing: 'Подготовка к работе без сети…',
    ready: 'Приложение и занятия доступны без сети',
    offline: 'Без сети · библиотека сохраняется на этом устройстве',
    failed: 'Офлайн-копия не готова. Подключитесь к сети и откройте сайт снова.',
    update: 'Доступно обновление. Закройте все вкладки приложения и откройте его снова.',
  },
  en: {
    preparing: 'Preparing offline access…',
    ready: 'App and practice materials are available offline',
    offline: 'Offline · library is saved on this device',
    failed: 'Offline copy is not ready. Connect and reopen the site.',
    update: 'Update available. Close all app tabs and reopen the app.',
  },
};

export function initOffline(getLang) {
  const status = document.getElementById('offline-status');
  let state = 'preparing';
  let waiting = false;
  let registration;
  let checkSequence = 0;
  function render() {
    const strings = TEXT[getLang()] || TEXT.en;
    status.textContent = strings[waiting ? 'update' : state === 'ready' && !navigator.onLine ? 'offline' : state];
  }
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return { render() {} };
  status.hidden = false;
  render();

  async function check() {
    const sequence = ++checkSequence;
    waiting = Boolean(registration?.waiting);
    const worker = registration?.active;
    if (!worker || worker.state !== 'activated') { render(); return; }
    const ready = await new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (value) => { clearTimeout(timer); channel.port1.close(); resolve(value); };
      const timer = setTimeout(() => finish(false), 5000);
      channel.port1.onmessage = (event) => finish(event.data?.ready === true);
      try { worker.postMessage({ type: 'CHECK_OFFLINE' }, [channel.port2]); } catch { finish(false); }
    });
    if (sequence !== checkSequence) return;
    state = ready ? 'ready' : 'failed';
    render();
  }
  async function start() {
    try {
      registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' });
      function observe(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant' && !registration.active) state = 'failed';
          void check();
        });
      }
      registration.addEventListener('updatefound', () => observe(registration.installing));
      observe(registration.installing);
      await check();
    } catch { state = 'failed'; render(); }
  }
  window.addEventListener('online', () => { void check(); void registration?.update().catch(() => {}); });
  window.addEventListener('offline', () => { void check(); });
  window.addEventListener('pageshow', () => { void check(); });
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => { void start(); }, { once: true });
  return { render };
}
