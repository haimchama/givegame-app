import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/shared/game.js';

const P1 = 'player-aaaa-1111', P2 = 'player-bbbb-2222';
const host = { role: 'host' };
const pl = pid => ({ role: 'player', pid });
const room = () => G.createRoom({ code: '12345', hostKey: 'k', now: 0 });

test('pledges blocked in lobby, counted when open', () => {
  const s = room();
  G.apply(s, pl(P1), { t: 'join', name: 'דנה', team: 't1' }, 1);
  assert.equal(G.apply(s, pl(P1), { t: 'pledge', amount: 100, donor: 'משה' }, 2).error, 'notOpen');
  G.apply(s, host, { t: 'open' }, 3);
  assert.ok(G.apply(s, pl(P1), { t: 'pledge', amount: 100, donor: 'משה' }, 4).changed);
  assert.equal(G.apply(s, pl(P1), { t: 'pledge', amount: 100, donor: 'משה' }, 5).error, 'slow');
  assert.equal(G.totals(s).raised, 100);
  assert.equal(G.totals(s).team.t1, 100);
});

test('challenge matching respects cap and ends on tick', () => {
  const s = room();
  G.apply(s, pl(P1), { t: 'join', name: 'a', team: 't2' }, 0);
  G.apply(s, host, { t: 'challenge', minutes: 1, mult: 2, cap: 150 }, 0);
  G.apply(s, pl(P1), { t: 'pledge', amount: 100, donor: 'משה' }, 1000);
  G.apply(s, pl(P1), { t: 'pledge', amount: 100, donor: 'משה' }, 5000);
  assert.equal(G.totals(s).matched, 150);
  assert.equal(G.totals(s).raised, 350);
  assert.ok(G.tick(s, 61000));
  assert.equal(s.phase, 'open');
});

test('trivia splits sponsor between teams and scores speed', () => {
  const s = room();
  G.apply(s, pl(P1), { t: 'join', name: 'a', team: 't1' }, 0);
  G.apply(s, pl(P2), { t: 'join', name: 'b', team: 't2' }, 0);
  G.apply(s, host, { t: 'triviaStart', idx: 0 }, 0);
  const correct = s.trivia.questions[0].correct;
  G.apply(s, pl(P1), { t: 'answer', opt: correct }, 1000);
  G.apply(s, pl(P2), { t: 'answer', opt: correct }, 19000);
  assert.equal(G.apply(s, pl(P2), { t: 'answer', opt: 0 }, 19500).error, 'answered');
  assert.ok(G.tick(s, 21000));
  assert.equal(s.trivia.stage, 'reveal');
  assert.equal(G.totals(s).awarded, 1000);
  assert.ok(s.points[P1] > s.points[P2]);
  const v = G.publicView(s, 21000);
  assert.equal(v.trivia.result.correctCount, 2);
});

test('host validation and players-only rules', () => {
  const s = room();
  assert.equal(G.apply(s, { role: 'screen' }, { t: 'open' }, 0).error, 'forbidden');
  assert.equal(G.apply(s, pl('bad'), { t: 'join', name: 'x', team: 't1' }, 0).error, 'noPlayer');
  G.apply(s, host, { t: 'settings', teams: [{ id: 't1', name: '<b>A' }], goal: 5000 }, 0);
  assert.equal(s.teams.length, 1);
  assert.equal(s.teams[0].name, 'bA');
  assert.equal(G.apply(s, host, { t: 'questions', questions: [{ q: '', options: ['a', 'b'] }] }, 0).error, 'question');
  const csv = G.pledgesCsv(s);
  assert.ok(csv.startsWith('﻿'));
});

test('pledge needs a donor; donor stays off the public view', () => {
  const s = room();
  G.apply(s, pl(P1), { t: 'join', name: 'גבאי', team: 't1' }, 0);
  G.apply(s, host, { t: 'open' }, 0);
  assert.equal(G.apply(s, pl(P1), { t: 'pledge', amount: 50 }, 5000).error, 'donor');
  assert.ok(G.apply(s, pl(P1), { t: 'pledge', amount: 50, donor: 'סוד' }, 9000).changed);
  assert.ok(!JSON.stringify(G.publicView(s, 9000)).includes('סוד'));
  assert.equal(G.playerView(s, P1).mine[0].donor, 'סוד');
  assert.ok(G.pledgesCsv(s).includes('סוד'));
});

test('accessories are validated per slot', () => {
  const s = room();
  G.apply(s, pl(P1), { t: 'join', name: 'a', team: 't1', avatar: 'pig', acc: { head: 'crown', face: 'crown', neck: 'tie', x: 'y' } }, 0);
  assert.deepEqual(s.players[P1].acc, { head: 'crown', neck: 'tie' });
  G.apply(s, pl(P1), { t: 'join', name: 'a', team: 't1' }, 1);
  assert.deepEqual(s.players[P1].acc, { head: 'crown', neck: 'tie' });
});
