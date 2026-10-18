import test from 'node:test';
import assert from 'node:assert/strict';
import { SCALE_TYPES, keysFor, scaleHarmony } from '../site/src/harmony.js';
import { taskExamples } from '../site/src/practice-help.js';

test('task examples are available in both languages for all keys and scale types', () => {
  for (const type of SCALE_TYPES) for (const key of keysFor(type)) for (const lang of ['ru', 'en']) {
    const harmony = scaleHarmony(key, type);
    for (let step = 0; step < 4; step++) for (let task = 0; task < 3; task++) {
      if (step === 0 && task === 2) continue; // This task uses the rhythm grid.
      const examples = taskExamples(harmony, step, task, lang);
      assert.ok(examples.length > 0, `${type} ${key} ${step} ${task}`);
      for (const [name, content] of examples) {
        assert.equal(typeof name, 'string');
        assert.equal(typeof content, 'string');
        assert.ok(content.length > 0);
        assert.ok(!content.includes('undefined'));
      }
    }
  }
});
