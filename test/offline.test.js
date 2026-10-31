import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { offlinePlugin } from '../scripts/offline-plugin.js';

const worker = await readFile(new URL('../scripts/service-worker.js', import.meta.url), 'utf8');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const origin = 'https://practice.test/';
function harness() {
  const resources = [{ url: 'index.html', hash: hash('release') }, { url: 'assets/main.js', hash: hash('javascript') }];
  const stores = new Map([['other-app', new Map()], ['metronom-offline-old', new Map()]]);
  const handlers = {};
  let broken = false;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name);
      return {
        async put(key, value) { values.set(key, value.clone()); },
        async match(key) { return values.get(key)?.clone(); },
        async keys() { return [...values.keys()].map((url) => new Request(url)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  vm.runInNewContext(`const VERSION = 'new'; const RESOURCES = ${JSON.stringify(resources)};\n${worker}`, {
    self: { registration: { scope: origin }, location: new URL(origin), addEventListener(type, fn) { handlers[type] = fn; } },
    caches, URL, Request, crypto: webcrypto, Uint8Array,
    async fetch(request) {
      return new Response(broken ? 'wrong deployment' : request.url.endsWith('index.html') ? 'release' : 'javascript');
    },
  });
  function dispatch(type, fields = {}) {
    let promise;
    handlers[type]({ ...fields, waitUntil(value) { promise = value; }, respondWith(value) { promise = value; } });
    return promise;
  }
  return { stores, dispatch, breakDownload() { broken = true; } };
}

test('offline installation verifies a complete release and activation preserves unrelated caches', async () => {
  const h = harness();
  await h.dispatch('install');
  assert.equal(h.stores.get('metronom-offline-new').size, 2);
  assert.ok(h.stores.has('metronom-offline-old'));
  await h.dispatch('activate');
  assert.ok(!h.stores.has('metronom-offline-old'));
  assert.ok(h.stores.has('other-app'));
});

test('mixed deployment never installs and leaves the previous release intact', async () => {
  const h = harness();
  h.breakDownload();
  await assert.rejects(h.dispatch('install'), /version mismatch/);
  assert.ok(!h.stores.has('metronom-offline-new'));
  assert.ok(h.stores.has('metronom-offline-old'));
});

test('offline routing serves only known GET resources and home navigations', async () => {
  const h = harness();
  await h.dispatch('install');
  h.breakDownload();
  const response = await h.dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: origin + '?practice=1' } });
  assert.equal(await response.text(), 'release');
  const asset = await h.dispatch('fetch', { request: new Request(origin + 'assets/main.js') });
  assert.equal(await asset.text(), 'javascript');
  for (const request of [new Request(origin + 'api/core/'), new Request(origin + 'unknown'), new Request(origin + 'assets/main.js?v=other'), new Request('https://external.test/index.html'), new Request(origin, { method: 'POST' })]) {
    assert.equal(h.dispatch('fetch', { request }), undefined);
  }
});

test('evicted cache status is false and mismatched live assets cannot poison it', async () => {
  const h = harness();
  await h.dispatch('install');
  const store = h.stores.get('metronom-offline-new');
  store.delete(origin + 'assets/main.js');
  let status;
  await h.dispatch('message', { data: { type: 'CHECK_OFFLINE' }, ports: [{ postMessage(value) { status = value.ready; } }] });
  assert.equal(status, false);
  h.breakDownload();
  await assert.rejects(h.dispatch('fetch', { request: new Request(origin + 'assets/main.js') }), /version mismatch/);
  assert.equal(store.size, 1);
});

test('production offline manifest is deterministic, includes public lessons and changes with their contents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'metronom-offline-test-'));
  try {
    await mkdir(join(directory, 'assets'));
    await mkdir(join(directory, 'lessons/haimovich'), { recursive: true });
    await writeFile(join(directory, 'index.html'), 'home');
    await writeFile(join(directory, 'assets/app.js'), 'code');
    await writeFile(join(directory, 'lessons/haimovich/schedule.json'), '{}');
    await writeFile(join(directory, 'robots.txt'), 'robots');
    const plugin = offlinePlugin();
    plugin.configResolved({ build: { outDir: directory } });
    await plugin.closeBundle();
    const first = await readFile(join(directory, 'sw.js'), 'utf8');
    assert.match(first, /lessons\/haimovich\/schedule.json/);
    assert.ok(!first.includes('robots.txt'));
    await plugin.closeBundle();
    assert.equal(await readFile(join(directory, 'sw.js'), 'utf8'), first);
    await writeFile(join(directory, 'lessons/haimovich/schedule.json'), '{"changed":true}');
    await plugin.closeBundle();
    assert.notEqual(await readFile(join(directory, 'sw.js'), 'utf8'), first);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
