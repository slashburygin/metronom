import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('favicon links point to existing icons and the fallback is a valid ICO', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(html, /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="favicon\.svg"\s*>/);
  const svg = await readFile(new URL('../site/public/favicon.svg', import.meta.url), 'utf8');
  assert.match(svg, /<svg\s/);
  const ico = await readFile(new URL('../site/public/favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) > 0);
});
