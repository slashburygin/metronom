import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const base = new URL('../site/lessons/haimovich/', import.meta.url);
const schedule = JSON.parse(await readFile(new URL('schedule.json', base), 'utf8'));

test('practice covers Monday to Saturday once and includes daily chromatic pages', async () => {
  const days = schedule.sessions.flatMap((session) => session.days).sort();
  assert.deepEqual(days, [1, 2, 3, 4, 5, 6]);
  const pages = [...schedule.sessions.flatMap((session) => session.pages), ...schedule.daily.pages];
  assert.deepEqual(pages, Array.from({ length: 24 }, (_, index) => index + 35));
  assert.deepEqual(schedule.daily.pages, [57, 58]);
  for (const page of pages) await access(new URL(`page-${page}.webp`, base));
});
