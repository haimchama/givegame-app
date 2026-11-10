// GiveGame – pure game rules. Shared by the server (Durable Object) and the in-browser demo.
// Every function here is deterministic given (state, input, now). No I/O.

export const LIMITS = {
  name: 30, donor: 40, title: 60, teamName: 24, teams: 12, maxAmount: 1_000_000,
  questions: 40, qText: 160, option: 60, presets: 6, feed: 14, minutes: 30, seconds: 120,
};

export const COLORS = ['#ff5a5f', '#2ec4b6', '#ffb703', '#8f5cff', '#3a86ff', '#ff7ac6',
  '#06d6a0', '#fb8500', '#9ef01a', '#e63946', '#4cc9f0', '#f72585'];

export const AVATARS = ['bag', 'pig', 'dollar', 'coin', 'safe', 'wallet', 'plant', 'diamond', 'coin2', 'bull', 'bear', 'bear2', 'buddy'];

const PID_RE = /^[a-zA-Z0-9-]{8,40}$/;

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const int = (n, min, max) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
};

export function sampleQuestions() {
  return [
    { q: 'כמה ספרים יש בתנ"ך לפי המסורת?', options: ['22', '24', '39', '36'], correct: 1, sponsor: 1000, secs: 20 },
    { q: 'מהי העיר הגבוהה ביותר בישראל?', options: ['צפת', 'ירושלים', 'מצפה רמון', 'חריש'], correct: 0, sponsor: 1000, secs: 20 },
  ];
}

export function createRoom({ code, hostKey, now }) {
  return {
    v: 1, code, hostKey, createdAt: now, seq: 0,
    settings: { title: 'ערב גיוס', goal: 100000, currency: '₪', presets: [18, 36, 180, 360, 1000], lang: 'he', showNames: true },
    teams: [1, 2, 3, 4].map(i => ({ id: 't' + i, name: 'שולחן ' + i, color: COLORS[i - 1] })),
    players: {},
    pledges: [],
    awards: [],
    phase: 'lobby',          // lobby | open | challenge | trivia | finale
    challenge: null,         // { title, endsAt, mult, cap, used }
    trivia: { questions: sampleQuestions(), idx: -1, stage: 'idle', startedAt: 0, endsAt: 0, answers: {}, result: null },
    points: {},              // pid -> trivia points
  };
}

const nextId = (s, p) => p + (++s.seq).toString(36);

// ---------- totals ----------
export function totals(s) {
  const team = Object.fromEntries(s.teams.map(t => [t.id, 0]));
  let raised = 0, pledged = 0, matched = 0, awarded = 0;
  for (const p of s.pledges) {
    raised += p.amount + p.match; pledged += p.amount; matched += p.match;
    if (p.team in team) team[p.team] += p.amount + p.match;
  }
  for (const a of s.awards) {
    raised += a.amount; awarded += a.amount;
    if (a.team in team) team[a.team] += a.amount;
  }
  return { raised, pledged, matched, awarded, team };
}

// ---------- time ----------
/** Advance timers. Returns true if state changed. */
export function tick(s, now) {
  let changed = false;
  if (s.phase === 'challenge' && s.challenge && now >= s.challenge.endsAt) {
    s.phase = 'open'; s.challenge = { ...s.challenge, ended: true }; changed = true;
  }
  const tr = s.trivia;
  if (s.phase === 'trivia' && tr.stage === 'question' && now >= tr.endsAt) {
    reveal(s, now); changed = true;
  }
  return changed;
}

export function nextDeadline(s) {
  if (s.phase === 'challenge' && s.challenge) return s.challenge.endsAt;
  if (s.phase === 'trivia' && s.trivia.stage === 'question') return s.trivia.endsAt;
  return 0;
}

function reveal(s, now) {
  const tr = s.trivia, q = tr.questions[tr.idx];
  const dur = Math.max(1, tr.endsAt - tr.startedAt);
  const perOption = q.options.map(() => 0);
  const correctByTeam = {};
  let correctCount = 0;
  const gained = {};
  for (const [pid, a] of Object.entries(tr.answers)) {
    if (a.opt >= 0 && a.opt < perOption.length) perOption[a.opt]++;
    if (a.opt === q.correct) {
      correctCount++;
      const pl = s.players[pid];
      if (pl) correctByTeam[pl.team] = (correctByTeam[pl.team] || 0) + 1;
      const pts = Math.round(1000 * (1 - 0.5 * Math.min(1, (a.at - tr.startedAt) / dur)));
      s.points[pid] = (s.points[pid] || 0) + pts;
      gained[pid] = pts;
    }
  }
  // Sponsor amount is split between teams by number of correct answers.
  const teamAwards = [];
  if (correctCount > 0 && q.sponsor > 0) {
    let left = q.sponsor;
    const entries = Object.entries(correctByTeam).filter(([t]) => s.teams.some(x => x.id === t));
    const sum = entries.reduce((a, [, c]) => a + c, 0);
    entries.forEach(([team, c], i) => {
      const amount = i === entries.length - 1 ? left : Math.floor(q.sponsor * c / sum);
      left -= amount;
      if (amount > 0) {
        s.awards.push({ id: nextId(s, 'a'), team, amount, label: 'trivia', q: tr.idx, ts: now });
        teamAwards.push({ team, amount, correct: c });
      }
    });
  }
  tr.stage = 'reveal';
  tr.result = { perOption, correctCount, teamAwards, gained };
}

// ---------- actions ----------
/**
 * Apply one message. actor = { role: 'host'|'player'|'screen', pid? }.
 * Returns { changed, error?, event? }.
 */
export function apply(s, actor, msg, now) {
  if (!msg || typeof msg.t !== 'string') return { error: 'bad' };
  const r = actor.role;
  if (r === 'player') return playerAction(s, actor.pid, msg, now);
  if (r === 'host') return hostAction(s, msg, now);
  return { error: 'forbidden' };
}

function playerAction(s, pid, m, now) {
  if (!pid || !PID_RE.test(pid)) return { error: 'noPlayer' };
  if (m.t === 'join') {
    const name = clean(m.name, LIMITS.name);
    if (!name) return { error: 'name' };
    if (!s.teams.some(t => t.id === m.team)) return { error: 'team' };
    const ex = s.players[pid];
    if (!ex && Object.keys(s.players).length >= 2000) return { error: 'full' };
    const avatar = AVATARS.includes(m.avatar) ? m.avatar : (ex?.avatar ?? AVATARS[0]);
    s.players[pid] = { name, team: m.team, avatar, joinedAt: ex?.joinedAt ?? now, last: ex?.last ?? null };
    return { changed: true };
  }
  const pl = s.players[pid];
  if (!pl) return { error: 'noPlayer' };

  if (m.t === 'pledge') {
    if (s.phase === 'lobby') return { error: 'notOpen' };
    const amount = int(m.amount, 1, LIMITS.maxAmount);
    if (!amount) return { error: 'amount' };
    const donor = clean(m.donor, LIMITS.donor);
    if (!donor) return { error: 'donor' };
    if (pl.last != null && now - pl.last < 1500) return { error: 'slow' };
    pl.last = now;
    let match = 0;
    const c = s.challenge;
    if (s.phase === 'challenge' && c && now < c.endsAt && c.mult > 1) {
      match = amount * (c.mult - 1);
      if (c.cap > 0) match = Math.max(0, Math.min(match, c.cap - c.used));
      c.used += match;
    }
    const p = { id: nextId(s, 'p'), pid, name: pl.name, donor, team: pl.team, amount, match, ts: now };
    s.pledges.push(p);
    return { changed: true, event: { t: 'pledge', id: p.id } };
  }

  if (m.t === 'answer') {
    const tr = s.trivia;
    if (s.phase !== 'trivia' || tr.stage !== 'question' || now >= tr.endsAt) return { error: 'closed' };
    if (tr.answers[pid]) return { error: 'answered' };
    const q = tr.questions[tr.idx];
    const opt = int(m.opt, 0, q.options.length - 1);
    if (opt === null) return { error: 'bad' };
    tr.answers[pid] = { opt, at: now };
    return { changed: true };
  }
  return { error: 'bad' };
}

function hostAction(s, m, now) {
  switch (m.t) {
    case 'settings': {
      const st = s.settings;
      if (m.title !== undefined) st.title = clean(m.title, LIMITS.title) || st.title;
      if (m.goal !== undefined) { const g = int(m.goal, 1, 1e9); if (g) st.goal = g; }
      if (m.currency !== undefined) st.currency = clean(m.currency, 4) || '₪';
      if (m.lang === 'he' || m.lang === 'en') st.lang = m.lang;
      if (typeof m.showNames === 'boolean') st.showNames = m.showNames;
      if (Array.isArray(m.presets)) {
        const ps = m.presets.map(x => int(x, 1, LIMITS.maxAmount)).filter(Boolean).slice(0, LIMITS.presets);
        if (ps.length) st.presets = ps;
      }
      if (Array.isArray(m.teams)) {
        const teams = m.teams.slice(0, LIMITS.teams).map((t, i) => ({
          id: typeof t.id === 'string' && /^t[a-z0-9]{1,8}$/.test(t.id) ? t.id : nextId(s, 't'),
          name: clean(t.name, LIMITS.teamName) || ('#' + (i + 1)),
          color: /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : COLORS[i % COLORS.length],
        }));
        if (teams.length) {
          // Players of a removed team move to the first team.
          const ids = new Set(teams.map(t => t.id));
          for (const pl of Object.values(s.players)) if (!ids.has(pl.team)) pl.team = teams[0].id;
          s.teams = teams;
        }
      }
      return { changed: true };
    }
    case 'questions': {
      if (s.phase === 'trivia') return { error: 'busy' };
      if (!Array.isArray(m.questions)) return { error: 'bad' };
      const qs = m.questions.slice(0, LIMITS.questions).map(q => {
        const options = (Array.isArray(q.options) ? q.options : []).slice(0, 4).map(o => clean(o, LIMITS.option));
        if (!clean(q.q, LIMITS.qText) || options.length < 2 || options.some(o => !o)) return null;
        return {
          q: clean(q.q, LIMITS.qText), options,
          correct: int(q.correct, 0, options.length - 1) ?? 0,
          sponsor: int(q.sponsor, 0, LIMITS.maxAmount) ?? 0,
          secs: int(q.secs, 5, LIMITS.seconds) ?? 20,
        };
      });
      if (qs.some(q => !q)) return { error: 'question' };
      s.trivia.questions = qs;
      return { changed: true };
    }
    case 'open':
      if (s.phase === 'trivia') endTrivia(s);
      if (s.phase === 'challenge') s.challenge = { ...s.challenge, ended: true };
      s.phase = 'open';
      return { changed: true };
    case 'challenge': {
      const mins = int(m.minutes, 1, LIMITS.minutes) ?? 5;
      const mult = int(m.mult, 1, 5) ?? 2;
      if (s.phase === 'trivia') endTrivia(s);
      s.challenge = { title: clean(m.title, LIMITS.title), endsAt: now + mins * 60000, mult, cap: int(m.cap, 0, 1e9) ?? 0, used: 0, startedAt: now };
      s.phase = 'challenge';
      return { changed: true };
    }
    case 'triviaStart': {
      const tr = s.trivia;
      const idx = int(m.idx, 0, tr.questions.length - 1);
      if (idx === null || !tr.questions[idx]) return { error: 'question' };
      if (s.phase === 'challenge') s.challenge = { ...s.challenge, ended: true };
      s.phase = 'trivia';
      tr.idx = idx; tr.stage = 'question'; tr.startedAt = now;
      tr.endsAt = now + tr.questions[idx].secs * 1000; tr.answers = {}; tr.result = null;
      return { changed: true };
    }
    case 'triviaReveal':
      if (s.phase !== 'trivia' || s.trivia.stage !== 'question') return { error: 'bad' };
      s.trivia.endsAt = Math.min(s.trivia.endsAt, now);
      reveal(s, now);
      return { changed: true };
    case 'finale':
      if (s.phase === 'trivia') endTrivia(s);
      if (s.phase === 'challenge') s.challenge = { ...s.challenge, ended: true };
      s.phase = 'finale';
      return { changed: true };
    case 'lobby':
      if (s.phase === 'trivia') endTrivia(s);
      s.phase = 'lobby';
      return { changed: true };
    case 'removePledge': {
      const i = s.pledges.findIndex(p => p.id === m.id);
      if (i < 0) return { error: 'bad' };
      s.pledges.splice(i, 1);
      return { changed: true };
    }
    case 'manualPledge': {
      // Host records a pledge given on paper / by phone.
      const amount = int(m.amount, 1, LIMITS.maxAmount);
      const name = clean(m.name, LIMITS.name);
      const donor = clean(m.donor, LIMITS.donor);
      if (!amount || !name || !s.teams.some(t => t.id === m.team)) return { error: 'bad' };
      const p = { id: nextId(s, 'p'), pid: 'host', name, donor, team: m.team, amount, match: 0, ts: now };
      s.pledges.push(p);
      return { changed: true, event: { t: 'pledge', id: p.id } };
    }
    case 'reset':
      s.pledges = []; s.awards = []; s.points = {}; s.challenge = null; s.phase = 'lobby';
      Object.assign(s.trivia, { idx: -1, stage: 'idle', answers: {}, result: null });
      return { changed: true };
  }
  return { error: 'bad' };
}

function endTrivia(s) {
  Object.assign(s.trivia, { stage: 'idle', answers: {}, result: null });
}

// ---------- views ----------
export function publicView(s, now) {
  const tt = totals(s);
  const tr = s.trivia;
  const show = s.settings.showNames;
  const playersByTeam = {};
  for (const pl of Object.values(s.players)) playersByTeam[pl.team] = (playersByTeam[pl.team] || 0) + 1;
  const feed = [
    ...s.pledges.slice(-LIMITS.feed).map(p => ({ id: p.id, k: 'p', name: show ? p.name : '', av: s.players[p.pid]?.avatar ?? null, team: p.team, amount: p.amount, match: p.match, ts: p.ts })),
    ...s.awards.slice(-6).map(a => ({ id: a.id, k: 'a', team: a.team, amount: a.amount, ts: a.ts })),
  ].sort((a, b) => a.ts - b.ts).slice(-LIMITS.feed);

  let trivia = null;
  if (s.phase === 'trivia' && tr.idx >= 0) {
    const q = tr.questions[tr.idx];
    trivia = {
      idx: tr.idx, total: tr.questions.length, stage: tr.stage, q: q.q, options: q.options,
      sponsor: q.sponsor, startedAt: tr.startedAt, endsAt: tr.endsAt,
      answered: Object.keys(tr.answers).length,
      correct: tr.stage === 'reveal' ? q.correct : null,
      result: tr.stage === 'reveal' ? { perOption: tr.result.perOption, correctCount: tr.result.correctCount, teamAwards: tr.result.teamAwards } : null,
    };
  }
  const leaders = Object.entries(s.points).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([pid, pts]) => ({ name: s.players[pid]?.name ?? '?', team: s.players[pid]?.team, pts }));

  // Fundraiser leaderboard
  const byF = {};
  for (const p of s.pledges) {
    const f = byF[p.pid] ??= { total: 0, count: 0 };
    f.total += p.amount + p.match; f.count++;
  }
  const fundraisers = Object.entries(byF).filter(([pid]) => s.players[pid])
    .sort((a, b) => b[1].total - a[1].total).slice(0, 8)
    .map(([pid, f]) => ({ name: show ? s.players[pid].name : '', av: s.players[pid].avatar, team: s.players[pid].team, total: f.total, count: f.count }));
  const roster = Object.values(s.players).sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 40)
    .map(p => ({ name: show ? p.name : '', av: p.avatar, team: p.team }));

  return {
    code: s.code, now, settings: s.settings, phase: s.phase, fundraisers, roster,
    teams: s.teams.map(t => ({ ...t, total: tt.team[t.id] || 0, players: playersByTeam[t.id] || 0 })),
    raised: tt.raised, pledged: tt.pledged, matched: tt.matched, awarded: tt.awarded,
    donors: new Set(s.pledges.map(p => (p.donor || p.pid + '|' + p.name).toLowerCase())).size,
    players: Object.keys(s.players).length,
    challenge: s.challenge && { title: s.challenge.title, endsAt: s.challenge.endsAt, mult: s.challenge.mult, cap: s.challenge.cap, used: s.challenge.used, ended: !!s.challenge.ended },
    trivia, leaders, feed,
  };
}

export function playerView(s, pid) {
  const pl = s.players[pid];
  if (!pl) return { pid, joined: false };
  let total = 0, matched = 0;
  const mine = [];
  for (const p of s.pledges) if (p.pid === pid) { total += p.amount; matched += p.match; mine.push({ id: p.id, donor: p.donor ?? '', amount: p.amount, match: p.match, ts: p.ts }); }
  const a = s.trivia.answers[pid];
  return {
    pid, joined: true, name: pl.name, avatar: pl.avatar, team: pl.team, total, matched, count: mine.length, mine: mine.slice(-30).reverse(), points: s.points[pid] || 0,
    answer: a ? a.opt : null, gained: s.trivia.result?.gained?.[pid] ?? 0,
  };
}

export function hostView(s) {
  return {
    questions: s.trivia.questions,
    pledges: s.pledges.slice(-3000).reverse(),
    players: Object.entries(s.players).map(([pid, p]) => ({ pid, name: p.name, team: p.team })),
  };
}

export function pledgesCsv(s) {
  const team = Object.fromEntries(s.teams.map(t => [t.id, t.name]));
  const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['time', 'donor', 'fundraiser', 'team', 'amount', 'matched']];
  for (const p of s.pledges) rows.push([new Date(p.ts).toISOString(), p.donor ?? '', p.name, team[p.team] ?? p.team, p.amount, p.match]);
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
}
