import test from 'node:test';
import assert from 'node:assert/strict';
import { recallDeck, nextRecall, rateRecall, normalizeRecall } from '../site/src/recall.js';

const DAY = 86400000;
test('recall answers preserve diatonic spelling and minor chord qualities', () => {
  const major = recallDeck('D');
  assert.equal(major.length, 8);
  assert.deepEqual(major[0].notes, ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯']);
  const minor = recallDeck('F♯', 'harmonicMinor');
  assert.deepEqual(minor[0].notes, ['F♯', 'G♯', 'A', 'B', 'C♯', 'D', 'E♯']);
  assert.equal(minor[5].symbol, 'C♯7');
  assert.deepEqual(minor[5].notes, ['C♯', 'E♯', 'G♯', 'B']);
  assert.equal(new Set([...major, ...minor].map(card => card.id)).size, 16);
});
test('oldest due reviews precede unseen cards; future reviews are withheld', () => {
  const deck = recallDeck();
  const progress = { [deck[1].id]: { due: 90, level: 1 }, [deck[2].id]: { due: 50, level: 1 } };
  assert.equal(nextRecall(deck, progress, 100).id, deck[2].id);
  assert.equal(nextRecall(deck, progress, 40).id, deck[0].id);
  for (const card of deck) progress[card.id] = { due: 200, level: 1 };
  assert.equal(nextRecall(deck, progress, 100), null);
  assert.equal(nextRecall(deck, progress, 200).id, deck[0].id);
});
test('ratings increase intervals, repeat failures soon, and keep hard reviews short', () => {
  let entry;
  for (const days of [1, 3, 7, 14, 30, 30]) {
    entry = rateRecall(entry, 'good', 100);
    assert.equal(entry.due, 100 + days * DAY);
  }
  assert.deepEqual(rateRecall(entry, 'again', 100), { level: 0, due: 60100 });
  assert.deepEqual(rateRecall(entry, 'hard', 100), { level: 5, due: 100 + DAY });
  assert.equal(rateRecall(rateRecall(entry, 'again', 100), 'good', 200).due, 200 + DAY);
  assert.throws(() => rateRecall(entry, 'invalid', 100), RangeError);
});
test('saved progress survives round trips and rejects corrupt or unknown entries', () => {
  const deck = recallDeck();
  const value = { progress: {
    [deck[0].id]: { due: 123, level: 2 },
    [deck[1].id]: { due: '123', level: 2 },
    [deck[2].id]: { due: -1, level: 0 },
    [deck[3].id]: { due: 123, level: 9 },
    unknown: { due: 123, level: 1 },
  } };
  const clean = normalizeRecall(value);
  assert.deepEqual(clean.progress, { [deck[0].id]: { due: 123, level: 2 } });
  assert.deepEqual(normalizeRecall(JSON.parse(JSON.stringify(clean))), clean);
  assert.deepEqual(normalizeRecall(null), { version: 1, progress: {} });
});

import { learningDeck, normalizeLearning, learningQueue, recordRecall, localDay, checkRecallAnswer } from '../site/src/recall.js';
test('triads, inversions and isolated tones have independent identities and correct spelling', () => {
  const cards = learningDeck('F♯', 'harmonicMinor');
  assert.equal(cards.length, 50);
  assert.equal(new Set(cards.map(card => card.id)).size, 50);
  assert.deepEqual(cards.find(card => card.id === 'harmonicMinor:F♯:0:triad').notes, ['F♯', 'A', 'C♯']);
  assert.equal(cards.find(card => card.id === 'harmonicMinor:F♯:0:triad').symbol, 'F♯m');
  assert.deepEqual(cards.find(card => card.id === 'harmonicMinor:F♯:0:inv1').notes, ['A', 'C♯', 'F♯']);
  assert.deepEqual(cards.find(card => card.id === 'harmonicMinor:F♯:4:tone3').notes, ['E♯']);
  assert.equal(cards.find(card => card.id === 'harmonicMinor:F♯:1:triad').symbol, 'G♯dim');
});
test('answer checking handles accidentals, solfege and omissions without cascading errors', () => {
  const scale = learningDeck('D')[0];
  assert.equal(checkRecallAnswer(scale, 'd e f# g a b c#').correct, true);
  assert.equal(checkRecallAnswer(scale, 'ре ми фа# соль ля си до#').correct, true);
  assert.deepEqual(checkRecallAnswer(scale, 'D E G A B C#').issues, [{position: 3, expected: 'F♯', actual: null}]);
  assert.equal(checkRecallAnswer(scale, 'D E Gb G A B C#').correct, false);
  assert.equal(checkRecallAnswer(scale, '').issues.length, 7);
  assert.equal(checkRecallAnswer(scale, 'D E F# G A B C# D').issues.at(-1).expected, null);
  const inv = learningDeck().find(card => card.id === 'major:C:0:inv1');
  assert.equal(checkRecallAnswer(inv, 'E G C').correct, true);
  assert.equal(checkRecallAnswer(inv, 'C E G').correct, false);
  assert.equal(checkRecallAnswer({notes:['B♭','E♭','G♭']}, 'bb eb gb').correct, true);
});
test('migration keeps v1 seventh progress while introducing independent skills and safe settings', () => {
  const state = normalizeLearning({version:1, progress:{'major:C:0':{due:1,level:3}}});
  assert.equal(state.version,2);
  assert.equal(state.progress['major:C:0'].level,3);
  assert.equal(state.progress['major:C:0:triad'],undefined);
  assert.deepEqual(state.collections,[{key:'C',type:'major'}]);
  assert.deepEqual(state.skills,['scale','triad']);
  assert.deepEqual(normalizeLearning(JSON.parse(JSON.stringify(state))), state);
  const invalid=normalizeLearning({collections:[{key:'invalid',type:'major'},null],skills:['unknown'],newLimit:-1,progress:{unknown:{due:1,level:0}}});
  assert.deepEqual(invalid.collections,[]);
  assert.deepEqual(invalid.skills,[]);
  assert.deepEqual(invalid.progress,{});
  assert.equal(invalid.newLimit,5);
});
test('daily new limits persist through reload, reset on a new day, and never block due reviews', () => {
  const now=new Date(2026,10,7,12).getTime();
  let state=normalizeLearning(); state.newLimit=1;
  const card=learningQueue(state,now).card;
  state=recordRecall(state,card,'again',now);
  state=normalizeLearning(JSON.parse(JSON.stringify(state)));
  assert.equal(learningQueue(state,now).card,null);
  assert.equal(learningQueue(state,now+60000).card.id,card.id);
  state=recordRecall(state,card,'good',now+60000);
  assert.equal(state.daily.ids.length,1);
  assert.equal(learningQueue(state,now+86400000).remaining,1);
  assert.equal(state.daily.day,localDay(now));
});
test('mixed queue alternates keys and skills; failure does not reset another skill', () => {
  const now=100000;
  let state=normalizeLearning();
  state.collections.push({key:'D',type:'major'});
  const keys=[];
  for(let i=0;i<4;i++){
    const card=learningQueue(state,now).card; keys.push([card.key,card.skill]);
    state=recordRecall(state,card,'good',now);
  }
  assert.deepEqual(keys,[['C','scale'],['C','triad'],['D','scale'],['D','triad']]);
  const inversion=learningDeck().find(card=>card.skill==='inversion');
  state=recordRecall(state,inversion,'again',now);
  assert.equal(state.progress['major:C:0:triad'].level,1);
  assert.equal(state.progress[inversion.id].level,0);
});
