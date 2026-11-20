import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { TRIO_SAMPLES } from '../site/src/backing-samples.js';

test('every bundled recording has pinned provenance, an intact PCM WAV and an included license', async () => {
  const root = new URL('../site/public/samples/trio-v1/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', root)));
  assert.equal(provenance.length, TRIO_SAMPLES.length);
  for (const sample of TRIO_SAMPLES) {
    const source = provenance.find(entry => entry.file === sample.file);
    assert.ok(source);
    assert.match(source.commit, /^[0-9a-f]{40}$/);
    assert.ok(source.source.includes(source.commit));
    const bytes = await readFile(new URL(sample.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.ok(bytes.length > 1000);
    assert.match(await readFile(new URL(`${source.repo}-LICENSE.txt`, root), 'utf8'), /CC0 1.0 Universal/);
  }
});
