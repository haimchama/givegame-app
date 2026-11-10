// GiveGame web app: home, player (phone), screen (projector), host panel, and an offline demo.
import * as G from './shared/game.js';
import qrcode from './vendor/qrcode.mjs';

// ---------------- utilities ----------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const nf = new Intl.NumberFormat('he-IL');
const money = (n, cur = '₪') => `${nf.format(Math.round(n))} ${cur}`;
let clockOffset = 0;
const now = () => Date.now() + clockOffset;
const mmss = ms => { const s = Math.ceil(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s); };
const SHAPES = ['★', '♥', '◆', '●'];
const uid = () => (crypto.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)));

// ---------------- i18n ----------------
const DICT = {
  he: {
    tagline: 'ערב גיוס שהוא משחק', joinEvent: 'הצטרפות לאירוע', code: 'קוד אירוע', join: 'הצטרפות',
    newEvent: 'יצירת אירוע חדש', demo: 'צפייה בדמו', myEvents: 'האירועים שלי', creating: 'יוצר…',
    yourName: 'השם שלך (כפי שיופיע על המסך)', pickTeam: 'לאיזה שולחן/קבוצה?', letsGo: 'יאללה, נכנסים!',
    waitHost: 'מחכים שהמנחה יתחיל…', youreIn: 'אתם בפנים!', howMuch: 'כמה תרצו לתרום?', other: 'סכום אחר',
    give: 'תרומה', note: 'זו התחייבות לתרומה. הגבייה תתבצע לאחר האירוע.', youGave: 'התחייבת', confirmQ: 'לתרום {a}?',
    yes: 'כן, אני תורם!', cancel: 'ביטול', thanks: 'תודה {n}!', match: 'מאצ\'ינג ×{m}', matchNote: 'כל תרומה מוכפלת ×{m}!',
    question: 'שאלה {i}/{n}', answered: 'התשובה נקלטה! מחכים לכולם…', correct: 'נכון!', wrong: 'לא הפעם…',
    points: 'נק\'', yourPoints: 'סה"כ נקודות: {p}', rightAnswer: 'התשובה הנכונה: {a}', finale: 'הגמר!',
    goal: 'יעד', raised: 'נאסף', donors: 'תורמים', players: 'משתתפים', scan: 'סרקו והצטרפו!',
    joinAt: 'הצטרפו ב-', sponsorQ: 'תשובה נכונה משחררת {a} מהספונסר!', answersIn: '{n} ענו',
    teamsWon: 'הקבוצות שזכו', topPlayers: 'מובילי החידון', thankYou: 'תודה רבה לכולם!', together: 'ביחד גייסנו',
    soundOn: '🔊 הפעלת צליל', fullscreen: '⛶ מסך מלא', offline: 'אין חיבור… מתחבר מחדש',
    notFound: 'לא מצאנו אירוע עם הקוד הזה', back: 'חזרה', errSlow: 'רגע… נסו שוב בעוד שנייה',
    errNotOpen: 'התרומות עוד לא נפתחו', errAmount: 'סכום לא תקין', errOffline: 'אין חיבור, נסו שוב', errGeneric: 'משהו השתבש, נסו שוב',
    errName: 'נא למלא שם',
    // host
    host: 'לוח מנחה', control: 'שליטה', pledges: 'תרומות', trivia: 'חידון', settings: 'הגדרות',
    openScreen: 'פתיחת מסך המקרן', copyJoin: 'העתקת קישור למשתתפים', copyHost: 'העתקת קישור מנחה', copied: 'הועתק!',
    phase: 'מצב', ph_lobby: 'לובי', ph_open: 'תרומות פתוחות', ph_challenge: 'אתגר', ph_trivia: 'חידון', ph_finale: 'גמר',
    openGiving: '▶ פתיחת תרומות', startChallenge: '⚡ התחלת אתגר', chTitle: 'כותרת האתגר', chMinutes: 'דקות', chMult: 'הכפלה',
    chCap: 'תקרת מאצ\'ינג (0 = ללא)', startQ: '❓ הצגת שאלה', reveal: '👁 חשיפת התשובה', nextQ: 'השאלה הבאה ▶',
    backGiving: 'חזרה לתרומות', toFinale: '🎉 גמר חגיגי', toLobby: 'חזרה ללובי', endChallenge: 'סיום האתגר',
    manual: 'רישום תרומה ידנית', name: 'שם', team: 'קבוצה', amount: 'סכום', add: 'הוספה', exportCsv: '⬇ ייצוא לאקסל (CSV)',
    del: 'מחיקה', sure: 'בטוח?', noPledges: 'עוד אין תרומות', save: 'שמירה', saved: 'נשמר ✔',
    title: 'שם האירוע', currency: 'מטבע', presets: 'סכומים מוכנים (מופרדים בפסיק)', showNames: 'להציג שמות תורמים על המסך',
    screenLang: 'שפת מסך המקרן', teams: 'קבוצות / שולחנות', addTeam: '+ קבוצה', addQ: '+ שאלה', qText: 'השאלה',
    opt: 'תשובה {i}', isCorrect: 'נכונה', sponsor: 'ספונסר (₪)', secs: 'שניות', resetAll: 'איפוס כל התרומות והחידון',
    hostLinkNote: 'קישור המנחה נותן שליטה מלאה באירוע. לא לשתף.', noKey: 'אין לך הרשאת מנחה לאירוע הזה במכשיר הזה.',
    errQuestion: 'יש שאלה לא מלאה', mins: 'דק\'', autoBots: 'משתתפים מדומים', screen: 'מקרן', phone: 'טלפון',
    demoNote: 'דמו: הכול רץ בדפדפן עם משתתפים מדומים. התחילו ב"לוח מנחה" ← "פתיחת תרומות", ואז נסו אתגר, חידון וגמר. בטלפון: תרמו בעצמכם.',
  },
  en: {
    tagline: 'A fundraiser that plays like a game', joinEvent: 'Join an event', code: 'Event code', join: 'Join',
    newEvent: 'Create a new event', demo: 'Watch the demo', myEvents: 'My events', creating: 'Creating…',
    yourName: 'Your name (as shown on screen)', pickTeam: 'Which table / team?', letsGo: "Let's go!",
    waitHost: 'Waiting for the host to start…', youreIn: "You're in!", howMuch: 'How much would you like to give?', other: 'Other amount',
    give: 'Give', note: 'This is a pledge. Payment is collected after the event.', youGave: 'You pledged', confirmQ: 'Give {a}?',
    yes: "Yes, I'm in!", cancel: 'Cancel', thanks: 'Thank you {n}!', match: 'Matching ×{m}', matchNote: 'Every gift is multiplied ×{m}!',
    question: 'Question {i}/{n}', answered: 'Answer received! Waiting for everyone…', correct: 'Correct!', wrong: 'Not this time…',
    points: 'pts', yourPoints: 'Total points: {p}', rightAnswer: 'Correct answer: {a}', finale: 'Finale!',
    goal: 'Goal', raised: 'Raised', donors: 'Donors', players: 'Players', scan: 'Scan to join!',
    joinAt: 'Join at ', sponsorQ: 'A correct answer unlocks {a} from our sponsor!', answersIn: '{n} answered',
    teamsWon: 'Teams that won', topPlayers: 'Trivia leaders', thankYou: 'Thank you all!', together: 'Together we raised',
    soundOn: '🔊 Sound on', fullscreen: '⛶ Full screen', offline: 'Offline… reconnecting',
    notFound: 'No event with this code', back: 'Back', errSlow: 'One moment… try again in a second',
    errNotOpen: 'Giving has not opened yet', errAmount: 'Invalid amount', errOffline: 'Offline, try again', errGeneric: 'Something went wrong, try again',
    errName: 'Please enter a name',
    host: 'Host panel', control: 'Control', pledges: 'Pledges', trivia: 'Trivia', settings: 'Settings',
    openScreen: 'Open projector screen', copyJoin: 'Copy player link', copyHost: 'Copy host link', copied: 'Copied!',
    phase: 'Phase', ph_lobby: 'Lobby', ph_open: 'Giving open', ph_challenge: 'Challenge', ph_trivia: 'Trivia', ph_finale: 'Finale',
    openGiving: '▶ Open giving', startChallenge: '⚡ Start challenge', chTitle: 'Challenge title', chMinutes: 'Minutes', chMult: 'Multiplier',
    chCap: 'Matching cap (0 = none)', startQ: '❓ Show question', reveal: '👁 Reveal answer', nextQ: 'Next question ▶',
    backGiving: 'Back to giving', toFinale: '🎉 Grand finale', toLobby: 'Back to lobby', endChallenge: 'End challenge',
    manual: 'Record a pledge manually', name: 'Name', team: 'Team', amount: 'Amount', add: 'Add', exportCsv: '⬇ Export to Excel (CSV)',
    del: 'Delete', sure: 'Sure?', noPledges: 'No pledges yet', save: 'Save', saved: 'Saved ✔',
    title: 'Event name', currency: 'Currency', presets: 'Preset amounts (comma separated)', showNames: 'Show donor names on screen',
    screenLang: 'Projector language', teams: 'Teams / tables', addTeam: '+ Team', addQ: '+ Question', qText: 'Question',
    opt: 'Answer {i}', isCorrect: 'Correct', sponsor: 'Sponsor', secs: 'Seconds', resetAll: 'Reset all pledges and trivia',
    hostLinkNote: 'The host link gives full control of the event. Do not share it.', noKey: "This device doesn't have host access to this event.",
    errQuestion: 'A question is incomplete', mins: 'min', autoBots: 'Simulated players', screen: 'Projector', phone: 'Phone',
    demoNote: 'Demo: runs in your browser with simulated players. Start in "Host panel" → "Open giving", then try a challenge, trivia and the finale. On "Phone": give yourself.',
  },
};
let deviceLang = LS.get('gg.lang', 'he');
const makeT = l => (k, vars) => {
  let s = DICT[l]?.[k] ?? DICT.he[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll('{' + a + '}', b);
  return s;
};
const dirOf = l => (l === 'he' ? 'rtl' : 'ltr');
function langToggle() { return `<button class="lang" data-lang>${deviceLang === 'he' ? 'EN' : 'עב'}</button>`; }
document.addEventListener('click', e => {
  if (e.target.closest('[data-lang]')) {
    deviceLang = deviceLang === 'he' ? 'en' : 'he';
    LS.set('gg.lang', deviceLang);
    route();
  }
});

// ---------------- sound & confetti ----------------
const Sound = {
  ctx: null, on: false,
  enable() { try { this.ctx ??= new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); this.on = true; } catch {} },
  notes(seq, type = 'triangle', vol = 0.18) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    seq.forEach(([f, at, dur]) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    });
  },
  coin() { this.notes([[988, 0, 0.12], [1319, 0.08, 0.35]], 'square', 0.08); },
  big() { this.notes([[523, 0, .2], [659, .1, .2], [784, .2, .2], [1047, .3, .6]], 'triangle', 0.2); },
  fanfare() { this.notes([[392, 0, .25], [523, .18, .25], [659, .36, .25], [784, .54, .5], [659, .9, .2], [784, 1.05, .9]], 'sawtooth', 0.08); },
  tick() { this.notes([[1200, 0, 0.05]], 'sine', 0.05); },
};

function confetti(host, power = 1) {
  let cv = host.querySelector(':scope > canvas.confetti');
  if (!cv) { cv = document.createElement('canvas'); cv.className = 'confetti'; host.appendChild(cv); }
  const r = host.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const n = Math.round(90 * power);
  const parts = Array.from({ length: n }, () => ({
    x: r.width * (0.2 + Math.random() * 0.6), y: r.height * 0.55, vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 12 * Math.min(1.6, power),
    s: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: G.COLORS[(Math.random() * G.COLORS.length) | 0],
  }));
  let frame = 0;
  cancelAnimationFrame(cv._raf);
  const step = () => {
    c.clearRect(0, 0, r.width, r.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.vx *= 0.99; p.rot += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore();
    }
    if (++frame < 160) cv._raf = requestAnimationFrame(step); else c.clearRect(0, 0, r.width, r.height);
  };
  step();
}

function tween(el, to, ms = 900, fmt = v => nf.format(Math.round(v))) {
  const from = el._v ?? 0; el._v = to;
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  cancelAnimationFrame(el._raf);
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

// Live countdowns
setInterval(() => {
  for (const el of $$('[data-ends]')) {
    const ms = Math.max(0, +el.dataset.ends - now());
    el.textContent = mmss(ms);
    el.classList.toggle('urgent', ms < 10000 && ms > 0);
  }
  for (const el of $$('[data-ring]')) {
    const s = +el.dataset.start, e = +el.dataset.ring;
    el.style.setProperty('--f', Math.max(0, Math.min(1, (e - now()) / Math.max(1, e - s))));
  }
}, 200);

function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}
function joinUrl(code) { return code === 'DEMO' ? 'https://givegame.tkb-pro.com' : `${location.origin}/${code}`; }
function joinHost(code) { return code === 'DEMO' ? 'givegame.tkb-pro.com' : location.host; }

function toast(root, msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}
async function copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

// ---------------- connections ----------------
class WsConn {
  constructor(code, params) {
    const qs = new URLSearchParams(params).toString();
    this.url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${code}/ws?${qs}`;
    this.h = {}; this.last = {}; this.refs = new Map(); this.n = 0; this.tries = 0; this.closed = false;
    this.open();
    this.ping = setInterval(() => { if (this.ws?.readyState === 1) this.ws.send('{"t":"ping"}'); }, 30000);
  }
  on(t, f) { (this.h[t] ??= []).push(f); if (t in this.last) f(this.last[t]); }
  emit(t, d) { this.last[t] = d; (this.h[t] || []).forEach(f => f(d)); }
  open() {
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => { this.tries = 0; this.emit('status', true); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'ok' || m.t === 'err') {
        const r = this.refs.get(m.ref);
        if (r) { this.refs.delete(m.ref); r(m.t === 'ok' ? { ok: true } : { error: m.e }); }
        return;
      }
      if (m.t === 'pong') return;
      if (m.t === 'pub') clockOffset = m.d.now - Date.now();
      this.emit(m.t, m.d);
    };
    ws.onclose = () => {
      this.emit('status', false);
      if (this.closed) return;
      this.timer = setTimeout(() => this.open(), Math.min(8000, 500 * 2 ** this.tries++));
    };
  }
  send(msg) {
    return new Promise(res => {
      if (this.ws?.readyState !== 1) return res({ error: 'offline' });
      const ref = ++this.n; this.refs.set(ref, res);
      this.ws.send(JSON.stringify({ ...msg, ref }));
      setTimeout(() => { if (this.refs.delete(ref)) res({ error: 'offline' }); }, 8000);
    });
  }
  close() { this.closed = true; clearTimeout(this.timer); clearInterval(this.ping); try { this.ws?.close(); } catch {} }
}

// In-browser server for the demo: same rules, no network.
class LocalServer {
  constructor() {
    this.s = G.createRoom({ code: 'DEMO', hostKey: 'demo', now: Date.now() });
    this.s.settings.title = 'ערב גיוס לבית הכנסת';
    this.s.settings.goal = 50000;
    this.s.trivia.questions.push(
      { q: 'כמה נרות מדליקים בסך הכול בחנוכה (בלי השמש)?', options: ['36', '44', '8', '40'], correct: 0, sponsor: 1800, secs: 20 },
    );
    this.conns = new Set();
    this.bots = true;
    setInterval(() => { if (G.tick(this.s, Date.now())) this.broadcast(); }, 250);
    this.botLoop();
  }
  connect(role, pid) { const c = new LocalConn(this, role, pid); this.conns.add(c); setTimeout(() => this.sendAll(c), 0); return c; }
  handle(c, msg) {
    const t = Date.now();
    const ticked = G.tick(this.s, t);
    const res = G.apply(this.s, { role: c.role, pid: c.pid }, msg, t);
    if (res.changed || ticked) this.broadcast(); else this.sendAll(c, true);
    return res.error ? { error: res.error } : { ok: true };
  }
  sendAll(c, privOnly) {
    if (!privOnly) c.emit('pub', structuredClone(G.publicView(this.s, Date.now())));
    if (c.role === 'host') c.emit('host', structuredClone(G.hostView(this.s)));
    if (c.role === 'player') c.emit('me', structuredClone(G.playerView(this.s, c.pid)));
  }
  broadcast() { for (const c of this.conns) this.sendAll(c); }
  botLoop() {
    const names = ['משפחת כהן', 'יוסי ל.', 'רחל ומשה', 'דוד אברהם', 'נועה', 'משפחת לוי', 'אבי פרץ', 'שירה', 'הרב מנחם', 'משפחת ביטון',
      'אלי ושרה', 'תמר ג.', 'משפחת מזרחי', 'אורי', 'חנה ויעקב', 'משפחת פרידמן'];
    const bots = names.map((n, i) => ({ pid: 'demo-bot-' + String(i).padStart(4, '0'), n }));
    const amounts = [18, 36, 36, 50, 100, 180, 180, 360, 360, 500, 1000, 1800];
    const act = (b, msg) => G.apply(this.s, { role: 'player', pid: b.pid }, msg, Date.now());
    const loop = () => {
      setTimeout(loop, 900 + Math.random() * 2200);
      if (!this.bots) return;
      const s = this.s, b = bots[(Math.random() * bots.length) | 0];
      let changed = false;
      if (!s.players[b.pid]) changed = !!act(b, { t: 'join', name: b.n, team: s.teams[(Math.random() * s.teams.length) | 0].id }).changed;
      else if (s.phase === 'trivia' && s.trivia.stage === 'question') {
        for (const x of bots) if (s.players[x.pid] && !s.trivia.answers[x.pid] && Math.random() < 0.35) {
          const q = s.trivia.questions[s.trivia.idx];
          act(x, { t: 'answer', opt: Math.random() < 0.6 ? q.correct : (Math.random() * q.options.length) | 0 }); changed = true;
        }
      } else if (s.phase !== 'lobby' && Math.random() < (s.phase === 'challenge' ? 0.9 : 0.55)) {
        changed = !!act(b, { t: 'pledge', amount: amounts[(Math.random() * amounts.length) | 0] }).changed;
      }
      if (changed) this.broadcast();
    };
    loop();
  }
}
class LocalConn {
  constructor(server, role, pid) { this.server = server; this.role = role; this.pid = pid; this.h = {}; this.last = {}; }
  on(t, f) { (this.h[t] ??= []).push(f); if (t in this.last) f(this.last[t]); }
  emit(t, d) { this.last[t] = d; (this.h[t] || []).forEach(f => f(d)); }
  send(msg) { return Promise.resolve(this.server.handle(this, msg)); }
  close() { this.server.conns.delete(this); }
}
let demoServer = null;

function playerId() {
  let pid = LS.get('gg.pid', null);
  if (!pid || !/^[a-zA-Z0-9-]{8,40}$/.test(pid)) { pid = uid(); LS.set('gg.pid', pid); }
  return pid;
}

// ---------------- router ----------------
let cleanup = [];
function route() {
  cleanup.forEach(f => { try { f(); } catch {} }); cleanup = [];
  const app = $('#app');
  app.innerHTML = ''; app.className = '';
  document.documentElement.lang = deviceLang; document.documentElement.dir = dirOf(deviceLang);
  const m = location.pathname.match(/^\/(\d{5})\/?$/);
  if (m) { history.replaceState(null, '', '/#/p/' + m[1]); }
  const parts = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [view, code, key] = parts;
  if (view === 'demo' || window.GG_DEMO_ONLY) return viewDemo(app);
  if (view && /^\d{5}$/.test(code ?? '')) {
    if (view === 'p') return withRoom(app, code, () => { const c = new WsConn(code, { role: 'player', pid: playerId() }); cleanup.push(() => c.close()); viewPlayer(app, c, code); });
    if (view === 'screen') return withRoom(app, code, () => { const c = new WsConn(code, { role: 'screen' }); cleanup.push(() => c.close()); viewScreen(app, c, code); });
    if (view === 'host') {
      if (key) { const hs = LS.get('gg.hosts', {}); hs[code] = key; LS.set('gg.hosts', hs); history.replaceState(null, '', '#/host/' + code); }
      const k = LS.get('gg.hosts', {})[code];
      if (!k) return message(app, makeT(deviceLang)('noKey'));
      return withRoom(app, code, () => { const c = new WsConn(code, { role: 'host', key: k }); cleanup.push(() => c.close()); viewHost(app, c, code, k); });
    }
  }
  viewHome(app);
}
window.addEventListener('hashchange', route);

async function withRoom(app, code, go) {
  app.innerHTML = '<div class="center"><div class="spinner"></div></div>';
  try {
    const r = await fetch(`/api/rooms/${code}`);
    if (r.status === 404) return message(app, makeT(deviceLang)('notFound'));
  } catch {}
  app.innerHTML = '';
  go();
}
function message(app, text) {
  const t = makeT(deviceLang);
  app.innerHTML = `<div class="center col"><div class="logo">Give<b>Game</b></div><p class="big-msg">${esc(text)}</p><a class="btn" href="#/">${t('back')}</a></div>`;
}

// ---------------- home ----------------
function viewHome(app) {
  const t = makeT(deviceLang);
  app.className = 'home';
  const hosts = Object.keys(LS.get('gg.hosts', {}));
  app.innerHTML = `
    <div class="home-top">${langToggle()}</div>
    <div class="hero">
      <div class="logo">Give<b>Game</b></div>
      <p class="tagline">${t('tagline')}</p>
    </div>
    <form class="card join-card">
      <label>${t('joinEvent')}</label>
      <input name="code" inputmode="numeric" pattern="\\d{5}" maxlength="5" placeholder="${t('code')}" autocomplete="off" required>
      <button class="btn primary">${t('join')}</button>
    </form>
    <div class="home-actions">
      <button class="btn" data-new>${t('newEvent')}</button>
      <a class="btn ghost" href="#/demo">${t('demo')}</a>
    </div>
    ${hosts.length ? `<div class="card"><label>${t('myEvents')}</label><div class="chips">${hosts.map(c => `<a class="chip" href="#/host/${c}">${c}</a>`).join('')}</div></div>` : ''}
    <footer>TKB · Tech Knowledge Base</footer>`;
  $('.join-card', app).addEventListener('submit', e => {
    e.preventDefault();
    const c = e.target.code.value.trim();
    if (/^\d{5}$/.test(c)) location.hash = '#/p/' + c;
  });
  $('[data-new]', app).addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = t('creating');
    try {
      const r = await fetch('/api/rooms', { method: 'POST' });
      const d = await r.json();
      if (!d.code) throw 0;
      const hs = LS.get('gg.hosts', {}); hs[d.code] = d.hostKey; LS.set('gg.hosts', hs);
      location.hash = '#/host/' + d.code;
    } catch { b.disabled = false; b.textContent = t('newEvent'); toast(app, t('errGeneric'), 'bad'); }
  });
}

// ---------------- player (phone) ----------------
function viewPlayer(root, conn, code, opts = {}) {
  const t = makeT(deviceLang);
  root.classList.add('player');
  root.dir = dirOf(deviceLang);
  let pub = null, me = null, mode = '';
  root.innerHTML = `
    <div class="p-top"><div class="brand-sm">Give<b>Game</b></div><div class="p-me"></div>${opts.noLang ? '' : langToggle()}</div>
    <div class="p-banner"></div>
    <main class="p-main"><div class="center"><div class="spinner"></div></div></main>
    <div class="offline-bar">${t('offline')}</div>`;
  const elMe = $('.p-me', root), elBanner = $('.p-banner', root), elMain = $('.p-main', root);
  conn.on('pub', d => { pub = d; update(); });
  conn.on('me', d => { me = d; update(); });
  conn.on('status', ok => root.classList.toggle('offline', !ok));
  const cur = () => pub?.settings.currency ?? '₪';
  const team = id => pub?.teams.find(x => x.id === id);

  function key() {
    if (!pub || !me) return 'load';
    if (!me.joined) return 'join:' + pub.teams.map(x => x.id + x.name).join();
    if (pub.phase === 'lobby') return 'lobby';
    if (pub.phase === 'trivia' && pub.trivia) {
      const tr = pub.trivia;
      return tr.stage === 'question' ? `q${tr.idx}:${tr.startedAt}:${me.answer}` : `r${tr.idx}:${tr.startedAt}`;
    }
    return 'give:' + pub.settings.presets.join();
  }
  function update() {
    const k = key();
    if (k !== mode) { mode = k; renderMain(); }
    renderBits();
  }
  function renderBits() {
    if (!pub || !me?.joined) { elMe.innerHTML = ''; elBanner.innerHTML = ''; return; }
    const tm = team(me.team);
    elMe.innerHTML = `<span class="tchip" style="--c:${tm?.color}">${esc(tm?.name)}</span><span class="me-name">${esc(me.name)}</span>`;
    const pct = Math.min(100, Math.round(pub.raised / pub.settings.goal * 100));
    let b = `<div class="mini-goal"><div style="width:${pct}%"></div><span>${money(pub.raised, cur())} · ${pct}%</span></div>`;
    if (pub.phase === 'challenge' && pub.challenge && !pub.challenge.ended && pub.challenge.mult > 1)
      b = `<div class="ch-banner">⚡ ${esc(pub.challenge.title || t('match', { m: pub.challenge.mult }))} · ×${pub.challenge.mult} · <span data-ends="${pub.challenge.endsAt}"></span></div>` + b;
    if (pub.phase === 'finale') b = `<div class="ch-banner fin">🎉 ${t('finale')}</div>` + b;
    if (me.total) b += `<div class="my-total">${t('youGave')}: <b>${money(me.total, cur())}</b></div>`;
    elBanner.innerHTML = b;
  }
  function renderMain() {
    elMain.onclick = null;
    if (mode === 'load') return;
    if (mode.startsWith('join')) return renderJoin();
    if (mode === 'lobby') {
      elMain.innerHTML = `<div class="center col"><div class="pulse">🎉</div><h2>${t('youreIn')}</h2><p class="muted">${t('waitHost')}</p></div>`;
      return;
    }
    if (mode.startsWith('q')) return renderQuestion();
    if (mode.startsWith('r')) return renderReveal();
    renderGive();
  }
  function renderJoin() {
    const saved = LS.get('gg.name', '');
    elMain.innerHTML = `
      <form class="join-form">
        <label>${t('yourName')}</label>
        <input name="name" maxlength="${G.LIMITS.name}" value="${esc(saved)}" autocomplete="name" required>
        <label>${t('pickTeam')}</label>
        <div class="teams-pick">${pub.teams.map((x, i) => `<label class="tpick" style="--c:${x.color}"><input type="radio" name="team" value="${x.id}" ${i === 0 ? 'checked' : ''}><span>${esc(x.name)}</span></label>`).join('')}</div>
        <button class="btn primary big">${t('letsGo')}</button>
      </form>`;
    $('form', elMain).addEventListener('submit', async e => {
      e.preventDefault();
      const name = e.target.name.value.trim(), tm = e.target.team.value;
      if (!name) return toast(root, t('errName'), 'bad');
      LS.set('gg.name', name);
      const r = await conn.send({ t: 'join', name, team: tm });
      if (r.error) toast(root, errText(t, r.error), 'bad');
    });
  }
  function renderGive() {
    elMain.innerHTML = `
      <h2 class="ask">${t('howMuch')}</h2>
      <div class="amounts">${pub.settings.presets.map((a, i) => `<button class="amt c${i % 6}" data-a="${a}">${money(a, cur())}</button>`).join('')}</div>
      <form class="custom"><input name="a" inputmode="numeric" placeholder="${t('other')}" maxlength="7"><button class="btn">${t('give')}</button></form>
      <p class="note">${t('note')}</p>`;
    elMain.onclick = onAmt;
    $('form.custom', elMain).addEventListener('submit', e => {
      e.preventDefault();
      const a = parseInt(e.target.a.value.replace(/\D/g, ''), 10);
      if (a > 0) confirmGive(a); else toast(root, t('errAmount'), 'bad');
    });
  }
  function onAmt(e) { const b = e.target.closest('.amt'); if (b) confirmGive(+b.dataset.a); }
  function confirmGive(a) {
    $('.sheet', root)?.remove();
    const ch = pub.phase === 'challenge' && pub.challenge && !pub.challenge.ended && pub.challenge.mult > 1;
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="sheet-card"><div class="sheet-amt">${money(a, cur())}</div>
      ${ch ? `<div class="sheet-match">⚡ ${t('matchNote', { m: pub.challenge.mult })}</div>` : ''}
      <p>${t('confirmQ', { a: money(a, cur()) })}</p>
      <button class="btn primary big" data-yes>${t('yes')}</button><button class="btn ghost" data-no>${t('cancel')}</button></div>`;
    root.appendChild(sh);
    sh.addEventListener('click', async e => {
      if (e.target === sh || e.target.closest('[data-no]')) return sh.remove();
      if (!e.target.closest('[data-yes]')) return;
      e.target.disabled = true;
      const r = await conn.send({ t: 'pledge', amount: a });
      sh.remove();
      if (r.error) return toast(root, errText(t, r.error), 'bad');
      const done = document.createElement('div');
      done.className = 'sheet thanks';
      done.innerHTML = `<div class="thanks-in"><div class="big-emoji">🎉</div><h2>${t('thanks', { n: esc(me.name) })}</h2><div class="sheet-amt">${money(a, cur())}</div></div>`;
      root.appendChild(done);
      confetti(done, 1.2);
      navigator.vibrate?.(60);
      setTimeout(() => done.remove(), 2600);
      done.addEventListener('click', () => done.remove());
    });
  }
  function renderQuestion() {
    const tr = pub.trivia;
    const head = `<div class="q-head"><span>${t('question', { i: tr.idx + 1, n: tr.total })}</span><span class="timer" data-ends="${tr.endsAt}"></span></div><div class="q-text">${esc(tr.q)}</div>`;
    if (me.answer != null) {
      elMain.innerHTML = head + `<div class="center col"><div class="opt o${me.answer} chosen"><span class="shape">${SHAPES[me.answer]}</span><span>${esc(tr.options[me.answer])}</span></div><p class="muted">${t('answered')}</p></div>`;
      return;
    }
    elMain.innerHTML = head + `<div class="opts">${tr.options.map((o, i) => `<button class="opt o${i}" data-o="${i}"><span class="shape">${SHAPES[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
    $('.opts', elMain).addEventListener('click', async e => {
      const b = e.target.closest('.opt'); if (!b) return;
      $$('.opt', elMain).forEach(x => x.disabled = true);
      b.classList.add('chosen');
      const r = await conn.send({ t: 'answer', opt: +b.dataset.o });
      if (r.error && r.error !== 'answered') { toast(root, errText(t, r.error), 'bad'); $$('.opt', elMain).forEach(x => x.disabled = false); }
    });
  }
  function renderReveal() {
    const tr = pub.trivia;
    const ok = me.answer === tr.correct;
    const myTeam = tr.result?.teamAwards.find(a => a.team === me.team);
    elMain.innerHTML = `<div class="reveal ${ok ? 'good' : 'bad'}">
      <div class="big-emoji">${ok ? '✅' : '🙈'}</div>
      <h2>${ok ? t('correct') : t('wrong')}</h2>
      ${ok ? `<div class="gain">+${me.gained} ${t('points')}</div>` : `<p>${t('rightAnswer', { a: esc(tr.options[tr.correct]) })}</p>`}
      ${myTeam ? `<div class="team-win">🏆 ${esc(team(me.team)?.name)} +${money(myTeam.amount, cur())}</div>` : ''}
      <p class="muted">${t('yourPoints', { p: nf.format(me.points) })}</p></div>`;
    if (ok) confetti(root, 0.8);
  }
}

function errText(t, e) {
  return ({ slow: t('errSlow'), notOpen: t('errNotOpen'), amount: t('errAmount'), offline: t('errOffline'), name: t('errName'), question: t('errQuestion') })[e] ?? t('errGeneric');
}

// ---------------- screen (projector) ----------------
function viewScreen(root, conn, code, opts = {}) {
  root.classList.add('screen');
  let pub = null, mode = '', t = makeT('he'), seen = new Set(), lastPct = -1, first = true;
  const refs = {};
  root.innerHTML = `<div class="s-stage"></div>
    <div class="s-tools">${opts.embedded ? '' : `<button data-sound>${makeT(deviceLang)('soundOn')}</button><button data-fs>${makeT(deviceLang)('fullscreen')}</button>`}</div>
    <div class="s-pops"></div><div class="offline-bar">${makeT(deviceLang)('offline')}</div>`;
  const stage = $('.s-stage', root), pops = $('.s-pops', root);
  root.addEventListener('click', e => {
    if (e.target.closest('[data-sound]')) { Sound.enable(); Sound.coin(); e.target.closest('[data-sound]').remove(); }
    if (e.target.closest('[data-fs]')) document.documentElement.requestFullscreen?.().catch(() => {});
  });
  conn.on('status', ok => root.classList.toggle('offline', !ok));
  conn.on('pub', d => { pub = d; update(); });
  const cur = () => pub.settings.currency;
  const team = id => pub.teams.find(x => x.id === id);

  function key() {
    if (pub.phase === 'trivia' && pub.trivia) return `tr:${pub.trivia.stage}:${pub.trivia.idx}:${pub.trivia.startedAt}`;
    return pub.phase + ':' + pub.settings.lang + ':' + pub.teams.map(x => x.id).join();
  }
  function update() {
    t = makeT(pub.settings.lang);
    root.dir = dirOf(pub.settings.lang);
    const k = key();
    if (k !== mode) { mode = k; render(); }
    refresh();
    feedEvents();
  }
  function header(withQr = true) {
    return `<header class="s-head"><div class="s-title">${esc(pub.settings.title)}</div>
      ${withQr ? `<div class="s-join"><div><div class="s-join-l">${t('joinAt')}<b>${esc(joinHost(code))}</b></div><div class="s-code">${t('code')}: <b>${esc(code)}</b></div></div><div class="qr sm">${qrSvg(joinUrl(code))}</div></div>` : ''}</header>`;
  }
  function render() {
    const ph = pub.phase;
    if (ph === 'lobby') {
      stage.innerHTML = `${header(false)}<div class="lobby">
        <div class="lobby-qr"><div class="qr">${qrSvg(joinUrl(code))}</div></div>
        <div class="lobby-info"><h1>${t('scan')}</h1>
          <div class="s-join-l">${t('joinAt')}<b>${esc(joinHost(code))}</b></div>
          <div class="lobby-code">${esc(code)}</div>
          <div class="lobby-count"><b data-r="players">0</b> ${t('players')}</div>
          <div class="lobby-teams" data-r="lteams"></div></div></div>`;
    } else if (ph === 'trivia' && pub.trivia) {
      const tr = pub.trivia;
      if (tr.stage === 'question') {
        stage.innerHTML = `${header()}<div class="sq">
          <div class="sq-top"><span class="sq-num">${t('question', { i: tr.idx + 1, n: tr.total })}</span>
            <div class="ring" data-ring="${tr.endsAt}" data-start="${tr.startedAt}"><span data-ends="${tr.endsAt}"></span></div>
            <span class="sq-ans" data-r="answered"></span></div>
          <div class="sq-text">${esc(tr.q)}</div>
          ${tr.sponsor ? `<div class="sq-sponsor">🎁 ${t('sponsorQ', { a: money(tr.sponsor, cur()) })}</div>` : ''}
          <div class="sq-opts">${tr.options.map((o, i) => `<div class="sopt o${i}"><span class="shape">${SHAPES[i]}</span>${esc(o)}</div>`).join('')}</div></div>`;
        Sound.tick();
      } else {
        const res = tr.result, max = Math.max(1, ...res.perOption);
        stage.innerHTML = `${header()}<div class="sq reveal-s">
          <div class="sq-text">${esc(tr.q)}</div>
          <div class="bars">${tr.options.map((o, i) => `<div class="bar-col ${i === tr.correct ? 'right' : 'wrongc'}"><div class="bar-n">${res.perOption[i]}</div><div class="bar o${i}" style="height:${10 + 90 * res.perOption[i] / max}%"></div><div class="bar-l"><span class="shape">${SHAPES[i]}</span>${esc(o)} ${i === tr.correct ? '✔' : ''}</div></div>`).join('')}</div>
          <div class="reveal-row">
            <div class="panel"><h3>${t('teamsWon')}</h3>${res.teamAwards.length ? res.teamAwards.map(a => `<div class="award" style="--c:${team(a.team)?.color}"><span>${esc(team(a.team)?.name)}</span><b>+${money(a.amount, cur())}</b></div>`).join('') : '<div class="muted">—</div>'}</div>
            <div class="panel"><h3>${t('topPlayers')}</h3>${pub.leaders.map((l, i) => `<div class="leader"><span>${i + 1}. ${esc(l.name)}</span><b>${nf.format(l.pts)}</b></div>`).join('') || '<div class="muted">—</div>'}</div>
          </div></div>`;
        if (res.teamAwards.length) { Sound.big(); confetti(root, 0.8); }
      }
    } else {
      const fin = ph === 'finale';
      stage.innerHTML = `${header(!fin)}<div class="board ${fin ? 'fin' : ''}">
        <div class="b-main">
          <div class="ch" data-r="ch"></div>
          ${fin ? `<div class="fin-t">${t('together')}</div>` : `<div class="raised-l">${t('raised')}</div>`}
          <div class="raised"><span data-r="raised">0</span> <small>${esc(cur())}</small></div>
          <div class="goalbar"><div class="goalfill" data-r="fill"></div><div class="goalmarks"><i></i><i></i><i></i></div></div>
          <div class="goal-l"><span data-r="pct"></span><span class="stats"><span><b data-r="donors">0</b> ${t('donors')}</span><span><b data-r="players">0</b> ${t('players')}</span></span><span>${t('goal')}: ${money(pub.settings.goal, cur())}</span></div>
          <div class="race" data-r="race"></div>
          ${fin ? `<div class="fin-thanks">${t('thankYou')}</div>` : ''}
        </div>
        ${fin ? '' : `<aside class="feed" data-r="feed"></aside>`}</div>`;
      if (fin) { Sound.fanfare(); setTimeout(() => confetti(root, 2), 300); setTimeout(() => confetti(root, 1.6), 1800); }
    }
    for (const el of $$('[data-r]', stage)) refs[el.dataset.r] = el;
    for (const k of Object.keys(refs)) if (!stage.contains(refs[k])) delete refs[k];
    if (refs.raised) refs.raised._v = 0;
    if (refs.feed) refs.feed._built = false;
  }
  function refresh() {
    const r = refs;
    if (r.players) r.players.textContent = nf.format(pub.players);
    if (r.donors) r.donors.textContent = nf.format(pub.donors);
    if (r.answered) r.answered.textContent = t('answersIn', { n: pub.trivia?.answered ?? 0 });
    if (r.lteams) r.lteams.innerHTML = pub.teams.map(x => `<span class="tchip" style="--c:${x.color}">${esc(x.name)} · ${x.players}</span>`).join('');
    if (r.raised) tween(r.raised, pub.raised, 1200);
    const pct = pub.raised / pub.settings.goal * 100;
    if (r.fill) r.fill.style.width = Math.min(100, pct) + '%';
    if (r.pct) r.pct.textContent = Math.floor(pct) + '%';
    if (r.ch) {
      const c = pub.challenge;
      r.ch.innerHTML = pub.phase === 'challenge' && c && !c.ended
        ? `<div class="ch-box"><div class="ch-t">⚡ ${esc(c.title || t('match', { m: c.mult }))}</div>
           ${c.mult > 1 ? `<div class="ch-m">${t('matchNote', { m: c.mult })}</div>` : ''}<div class="ch-time" data-ends="${c.endsAt}"></div></div>` : '';
    }
    if (r.race) {
      const max = Math.max(1, ...pub.teams.map(x => x.total));
      const sorted = [...pub.teams].sort((a, b) => b.total - a.total);
      for (const x of pub.teams) {
        let row = r.race.querySelector(`[data-t="${x.id}"]`);
        if (!row) { row = document.createElement('div'); row.className = 'race-row'; row.dataset.t = x.id; row.innerHTML = `<div class="race-name"></div><div class="race-track"><div class="race-bar"></div></div><div class="race-amt"></div>`; r.race.appendChild(row); }
        row.style.setProperty('--c', x.color);
        $('.race-name', row).textContent = x.name;
        $('.race-bar', row).style.width = (4 + 96 * x.total / max) + '%';
        $('.race-amt', row).textContent = money(x.total, cur());
        row.style.order = sorted.indexOf(x);
        row.classList.toggle('lead', sorted[0] === x && x.total > 0);
      }
    }
    // milestones
    const step = Math.floor(Math.min(pct, 100) / 25);
    if (!first && step > lastPct && lastPct >= 0 && pub.phase !== 'lobby') {
      Sound.fanfare(); confetti(root, step === 4 ? 2.2 : 1.2);
      bigPop(step === 4 ? '🏆 100%!' : `🎯 ${step * 25}%`);
    }
    lastPct = step;
  }
  function feedEvents() {
    const f = refs.feed;
    const fresh = pub.feed.filter(x => !seen.has(x.id));
    for (const x of pub.feed) seen.add(x.id);
    if (f && !f._built) { f._built = true; f.innerHTML = ''; pub.feed.forEach(x => addFeed(f, x, false)); }
    else if (f) fresh.forEach(x => addFeed(f, x, true));
    if (!first) for (const x of fresh) {
      if (x.k !== 'p') continue;
      const tot = x.amount + x.match;
      Sound[tot >= 1000 ? 'big' : 'coin']();
      if (tot >= 1000) confetti(root, Math.min(2, tot / 1500));
      pop(x);
    }
    first = false;
  }
  function addFeed(f, x, anim) {
    const tm = team(x.team);
    const el = document.createElement('div');
    el.className = 'feed-i' + (anim ? ' new' : '');
    el.style.setProperty('--c', tm?.color ?? '#888');
    el.innerHTML = x.k === 'a'
      ? `<span class="fi-n">🎁 ${esc(tm?.name)}</span><b>+${money(x.amount, cur())}</b>`
      : `<span class="fi-n">${esc(x.name || '❤')} <small>${esc(tm?.name)}</small></span><b>${money(x.amount, cur())}${x.match ? ` <em>+${money(x.match, cur())}</em>` : ''}</b>`;
    f.prepend(el);
    while (f.children.length > 14) f.lastChild.remove();
  }
  function pop(x) {
    const tm = team(x.team);
    const el = document.createElement('div');
    el.className = 'pop';
    el.style.setProperty('--c', tm?.color ?? '#fff');
    el.innerHTML = `<div class="pop-amt">+${money(x.amount + x.match, cur())}</div><div class="pop-n">${esc(x.name || '')} ${tm ? '· ' + esc(tm.name) : ''}</div>`;
    pops.appendChild(el);
    while (pops.children.length > 3) pops.firstChild.remove();
    setTimeout(() => el.remove(), 3200);
  }
  function bigPop(text) {
    const el = document.createElement('div'); el.className = 'bigpop'; el.textContent = text;
    root.appendChild(el); setTimeout(() => el.remove(), 3000);
  }
}

// ---------------- host panel ----------------
function viewHost(root, conn, code, key, opts = {}) {
  const t = makeT(deviceLang);
  root.classList.add('hostv');
  root.dir = dirOf(deviceLang);
  let pub = null, hv = null, tab = 'control', ctlMode = '', builtSettings = false, builtTrivia = false;
  const armed = new Set();
  root.innerHTML = `
    <div class="h-top"><div><div class="brand-sm">Give<b>Game</b> · ${t('host')}</div><div class="h-title" data-h="title"></div></div>${opts.noLang ? '' : langToggle()}</div>
    <div class="h-stats" data-h="stats"></div>
    ${opts.embedded ? '' : `<div class="h-links">
      <a class="btn sm" href="#/screen/${code}" target="_blank" rel="noopener">${t('openScreen')}</a>
      <button class="btn sm" data-copy="join">${t('copyJoin')}</button>
      <button class="btn sm ghost" data-copy="host">${t('copyHost')}</button></div>`}
    <nav class="tabs">${['control', 'pledges', 'trivia', 'settings'].map(x => `<button data-tab="${x}" class="${x === tab ? 'on' : ''}">${t(x)}</button>`).join('')}</nav>
    <section class="h-body"></section>
    <div class="offline-bar">${t('offline')}</div>`;
  const body = $('.h-body', root);
  conn.on('status', ok => root.classList.toggle('offline', !ok));
  conn.on('pub', d => { pub = d; update(); });
  conn.on('host', d => { hv = d; update(true); });
  const cur = () => pub?.settings.currency ?? '₪';
  const team = id => pub.teams.find(x => x.id === id);
  async function send(msg, okText) {
    const r = await conn.send(msg);
    if (r.error) toast(root, errText(t, r.error), 'bad'); else if (okText) toast(root, okText, 'good');
    return r;
  }

  root.addEventListener('click', async e => {
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; $$('[data-tab]', root).forEach(b => b.classList.toggle('on', b === tb)); ctlMode = ''; builtSettings = builtTrivia = false; renderTab(); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const txt = cp.dataset.copy === 'join' ? joinUrl(code) : `${location.origin}/#/host/${code}/${key}`;
      if (cp.dataset.copy === 'host') toast(root, t('hostLinkNote'));
      if (await copy(txt)) toast(root, t('copied'), 'good'); else prompt('', txt);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (a) {
      const act = a.dataset.act;
      if (a.dataset.confirm && !a.classList.contains('armed')) { a.classList.add('armed'); a.dataset.orig = a.textContent; a.textContent = t('sure'); setTimeout(() => { a.classList.remove('armed'); a.textContent = a.dataset.orig; }, 3000); return; }
      if (act === 'challenge') {
        const f = $('.ch-form', root);
        return send({ t: 'challenge', title: f.title.value, minutes: f.minutes.value, mult: f.mult.value, cap: f.cap.value || 0 });
      }
      if (act === 'triviaStart') return send({ t: 'triviaStart', idx: +($('[name=qsel]', root)?.value ?? a.dataset.idx) });
      if (act === 'next') return send({ t: 'triviaStart', idx: pub.trivia.idx + 1 });
      if (act === 'removePledge') {
        const id = a.dataset.id;
        if (!armed.has(id)) { armed.add(id); renderPledges(); setTimeout(() => { armed.delete(id); if (tab === 'pledges') renderPledges(); }, 3000); return; }
        armed.delete(id);
        return send({ t: 'removePledge', id });
      }
      if (act === 'csv') return downloadCsv();
      return send({ t: act });
    }
  });

  function update(hostOnly) {
    if (!pub) return;
    $('[data-h=title]', root).textContent = `${pub.settings.title} · ${t('code')} ${code}`;
    const pct = Math.round(pub.raised / pub.settings.goal * 100);
    $('[data-h=stats]', root).innerHTML = `
      <div><b>${money(pub.raised, cur())}</b><span>${t('raised')} · ${pct}%</span></div>
      <div><b>${nf.format(pub.donors)}</b><span>${t('donors')}</span></div>
      <div><b>${nf.format(pub.players)}</b><span>${t('players')}</span></div>
      <div><b class="ph ph-${pub.phase}">${t('ph_' + pub.phase)}</b><span>${t('phase')}</span></div>`;
    renderTab(hostOnly);
  }

  function renderTab() {
    if (!pub) return;
    if (tab === 'control') return renderControl();
    if (tab === 'pledges') return renderPledges();
    if (tab === 'trivia' && hv && !builtTrivia) { builtTrivia = true; return renderTrivia(); }
    if (tab === 'settings' && !builtSettings) { builtSettings = true; return renderSettings(); }
  }

  function renderControl() {
    const tr = pub.trivia;
    const m = `${pub.phase}:${tr?.stage}:${tr?.idx}:${pub.challenge?.ended}:${hv?.questions.length}`;
    if (m !== ctlMode) {
      ctlMode = m;
      const qs = hv?.questions ?? [];
      const ph = pub.phase;
      let main = '';
      if (ph === 'trivia' && tr) {
        main = `<div class="card now"><div class="muted">${t('question', { i: tr.idx + 1, n: tr.total })}</div><h3>${esc(tr.q)}</h3>
          ${tr.stage === 'question'
            ? `<div class="row"><span class="timer" data-ends="${tr.endsAt}"></span><span data-c="ans"></span></div><button class="btn primary big" data-act="triviaReveal">${t('reveal')}</button>`
            : `<div class="row">${tr.result.teamAwards.map(a => `<span class="tchip" style="--c:${team(a.team)?.color}">${esc(team(a.team)?.name)} +${money(a.amount, cur())}</span>`).join('')}</div>
               ${tr.idx + 1 < tr.total ? `<button class="btn primary big" data-act="next">${t('nextQ')}</button>` : ''}
               <button class="btn" data-act="open">${t('backGiving')}</button>`}</div>`;
      } else if (ph === 'challenge' && pub.challenge && !pub.challenge.ended) {
        main = `<div class="card now"><h3>⚡ ${esc(pub.challenge.title || t('ph_challenge'))} ×${pub.challenge.mult}</h3>
          <div class="row"><span class="timer" data-ends="${pub.challenge.endsAt}"></span><span data-c="cap"></span></div>
          <button class="btn" data-act="open">${t('endChallenge')}</button></div>`;
      }
      body.innerHTML = `${main}
        <div class="grid2">
          <div class="card"><button class="btn primary big" data-act="open" ${ph === 'open' ? 'disabled' : ''}>${t('openGiving')}</button></div>
          <form class="card ch-form" onsubmit="return false">
            <label>${t('chTitle')}<input name="title" maxlength="60" placeholder="${t('match', { m: 2 })}"></label>
            <div class="row3"><label>${t('chMinutes')}<input name="minutes" type="number" min="1" max="30" value="5"></label>
              <label>${t('chMult')}<select name="mult"><option value="1">×1</option><option value="2" selected>×2</option><option value="3">×3</option></select></label>
              <label>${t('chCap')}<input name="cap" type="number" min="0" value="0"></label></div>
            <button class="btn" data-act="challenge">${t('startChallenge')}</button></form>
          <div class="card"><label>${t('trivia')}<select name="qsel">${qs.map((q, i) => `<option value="${i}">${i + 1}. ${esc(q.q)}</option>`).join('')}</select></label>
            <button class="btn" data-act="triviaStart" ${qs.length ? '' : 'disabled'}>${t('startQ')}</button></div>
          <div class="card"><button class="btn gold big" data-act="finale">${t('toFinale')}</button>
            <button class="btn ghost sm" data-act="lobby">${t('toLobby')}</button></div>
        </div>
        <div class="card"><div class="team-list" data-c="teams"></div></div>`;
    }
    const ans = $('[data-c=ans]', body); if (ans) ans.textContent = t('answersIn', { n: tr?.answered ?? 0 });
    const cap = $('[data-c=cap]', body); if (cap && pub.challenge?.cap) cap.textContent = `${money(pub.challenge.used, cur())} / ${money(pub.challenge.cap, cur())}`;
    const tl = $('[data-c=teams]', body);
    if (tl) tl.innerHTML = [...pub.teams].sort((a, b) => b.total - a.total).map(x => `<div class="tl-row" style="--c:${x.color}"><span>${esc(x.name)} <small>(${x.players})</small></span><b>${money(x.total, cur())}</b></div>`).join('');
  }

  function renderPledges() {
    if (!$('.manual', body)) {
      body.innerHTML = `
        <form class="card manual"><label>${t('manual')}</label>
          <div class="row3"><input name="name" placeholder="${t('name')}" maxlength="30" required>
          <select name="team">${pub.teams.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
          <input name="amount" type="number" min="1" placeholder="${t('amount')}" required></div>
          <button class="btn">${t('add')}</button></form>
        <button class="btn ghost" data-act="csv">${t('exportCsv')}</button>
        <div class="plist" data-c="plist"></div>`;
      $('.manual', body).addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.target;
        const r = await send({ t: 'manualPledge', name: f.name.value, team: f.team.value, amount: f.amount.value });
        if (!r.error) { f.name.value = ''; f.amount.value = ''; }
      });
    }
    const list = $('[data-c=plist]', body);
    if (!hv) return;
    list.innerHTML = hv.pledges.length ? hv.pledges.map(p => `<div class="prow" style="--c:${team(p.team)?.color ?? '#888'}">
        <span class="pn">${esc(p.name)} <small>${esc(team(p.team)?.name ?? '')} · ${new Date(p.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</small></span>
        <b>${money(p.amount, cur())}${p.match ? ` <em>+${money(p.match, cur())}</em>` : ''}</b>
        <button class="x ${armed.has(p.id) ? 'armed' : ''}" data-act="removePledge" data-id="${p.id}">${armed.has(p.id) ? t('sure') : '✕'}</button></div>`).join('') : `<p class="muted">${t('noPledges')}</p>`;
  }

  function downloadCsv() {
    const csv = G.pledgesCsv({ teams: pub.teams, pledges: [...hv.pledges].reverse() });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `givegame-${code}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function renderTrivia() {
    const qs = structuredClone(hv.questions);
    const draw = () => {
      body.innerHTML = `<div class="qlist">${qs.map((q, i) => `
        <div class="card qedit" data-i="${i}">
          <div class="row"><b>${i + 1}</b><button class="x" data-del="${i}">✕</button></div>
          <input data-f="q" value="${esc(q.q)}" placeholder="${t('qText')}" maxlength="160">
          ${[0, 1, 2, 3].map(j => `<div class="optrow o${j}"><span class="shape">${SHAPES[j]}</span><input data-f="o${j}" value="${esc(q.options[j] ?? '')}" placeholder="${t('opt', { i: j + 1 })}" maxlength="60">
            <label class="rad"><input type="radio" name="c${i}" value="${j}" ${q.correct === j ? 'checked' : ''}>${t('isCorrect')}</label></div>`).join('')}
          <div class="row3"><label>${t('sponsor')}<input data-f="sponsor" type="number" min="0" value="${q.sponsor}"></label>
            <label>${t('secs')}<input data-f="secs" type="number" min="5" max="120" value="${q.secs}"></label></div>
        </div>`).join('')}</div>
        <div class="row"><button class="btn" data-addq>${t('addQ')}</button><button class="btn primary" data-saveq>${t('save')}</button></div>`;
    };
    const collect = () => $$('.qedit', body).forEach(el => {
      const q = qs[+el.dataset.i];
      q.q = $('[data-f=q]', el).value;
      q.options = [0, 1, 2, 3].map(j => $(`[data-f=o${j}]`, el).value.trim()).filter((o, j, arr) => o || j < 2 || arr.slice(j).some(Boolean));
      while (q.options.length && !q.options[q.options.length - 1]) q.options.pop();
      q.correct = +($('input[type=radio]:checked', el)?.value ?? 0);
      q.sponsor = +$('[data-f=sponsor]', el).value || 0;
      q.secs = +$('[data-f=secs]', el).value || 20;
    });
    draw();
    body.onclick = async e => {
      if (tab !== 'trivia') return;
      if (e.target.closest('[data-addq]')) { collect(); qs.push({ q: '', options: ['', '', '', ''], correct: 0, sponsor: 0, secs: 20 }); draw(); }
      const d = e.target.closest('[data-del]'); if (d) { collect(); qs.splice(+d.dataset.del, 1); draw(); }
      if (e.target.closest('[data-saveq]')) {
        collect();
        const r = await send({ t: 'questions', questions: qs }, t('saved'));
        if (!r.error) { ctlMode = ''; }
      }
    };
  }

  function renderSettings() {
    const s = pub.settings;
    const teams = structuredClone(pub.teams);
    body.innerHTML = `<form class="card set">
      <label>${t('title')}<input name="title" value="${esc(s.title)}" maxlength="60"></label>
      <div class="row3"><label>${t('goal')}<input name="goal" type="number" min="1" value="${s.goal}"></label>
        <label>${t('currency')}<input name="currency" value="${esc(s.currency)}" maxlength="4"></label>
        <label>${t('screenLang')}<select name="lang"><option value="he" ${s.lang === 'he' ? 'selected' : ''}>עברית</option><option value="en" ${s.lang === 'en' ? 'selected' : ''}>English</option></select></label></div>
      <label>${t('presets')}<input name="presets" value="${s.presets.join(', ')}"></label>
      <label class="chk"><input type="checkbox" name="showNames" ${s.showNames ? 'checked' : ''}> ${t('showNames')}</label>
      <label>${t('teams')}</label><div class="teams-ed"></div>
      <button type="button" class="btn sm ghost" data-addt>${t('addTeam')}</button>
      <button class="btn primary">${t('save')}</button></form>
      <div class="card danger"><button class="btn ghost" data-act="reset" data-confirm="1">${t('resetAll')}</button></div>`;
    const ed = $('.teams-ed', body);
    const drawTeams = () => ed.innerHTML = teams.map((x, i) => `<div class="trow"><input type="color" value="${x.color}" data-ti="${i}" data-tf="color"><input value="${esc(x.name)}" data-ti="${i}" data-tf="name" maxlength="24"><button type="button" class="x" data-tdel="${i}">✕</button></div>`).join('');
    drawTeams();
    ed.addEventListener('input', e => { const i = e.target.dataset.ti; if (i != null) teams[i][e.target.dataset.tf] = e.target.value; });
    body.querySelector('form.set').addEventListener('click', e => {
      if (e.target.closest('[data-addt]')) { teams.push({ name: (deviceLang === 'he' ? 'שולחן ' : 'Table ') + (teams.length + 1), color: G.COLORS[teams.length % G.COLORS.length] }); drawTeams(); }
      const d = e.target.closest('[data-tdel]'); if (d && teams.length > 1) { teams.splice(+d.dataset.tdel, 1); drawTeams(); }
    });
    $('form.set', body).addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      send({
        t: 'settings', title: f.title.value, goal: f.goal.value, currency: f.currency.value, lang: f.lang.value,
        presets: f.presets.value.split(/[,\s]+/).filter(Boolean), showNames: f.showNames.checked, teams,
      }, t('saved'));
    });
  }
}

// ---------------- demo ----------------
function viewDemo(app) {
  const t = makeT(deviceLang);
  demoServer ??= new LocalServer();
  app.className = 'demo';
  app.innerHTML = `
    <div class="d-top"><div class="brand-sm">Give<b>Game</b> · Demo</div>
      <label class="chk"><input type="checkbox" data-bots ${demoServer.bots ? 'checked' : ''}> ${t('autoBots')}</label>${langToggle()}</div>
    <p class="d-note">${t('demoNote')}</p>
    <nav class="tabs d-tabs"><button data-pane="screen" class="on">${t('screen')}</button><button data-pane="phone">${t('phone')}</button><button data-pane="host">${t('host')}</button></nav>
    <div class="d-grid">
      <div class="d-pane d-screen on" data-p="screen"><div class="screen-frame"></div></div>
      <div class="d-pane d-phone" data-p="phone"><div class="phone-frame"></div></div>
      <div class="d-pane d-host" data-p="host"><div class="host-frame"></div></div>
    </div>`;
  const pid = 'demo-me-' + playerId().slice(0, 12);
  const cs = demoServer.connect('screen'), cp = demoServer.connect('player', pid), ch = demoServer.connect('host');
  cleanup.push(() => { cs.close(); cp.close(); ch.close(); });
  viewScreen($('.screen-frame', app), cs, 'DEMO', { embedded: true });
  viewPlayer($('.phone-frame', app), cp, 'DEMO', { noLang: true });
  viewHost($('.host-frame', app), ch, 'DEMO', 'demo', { embedded: true, noLang: true });
  app.addEventListener('click', e => {
    Sound.enable();
    const b = e.target.closest('[data-pane]');
    if (b) {
      $$('.d-tabs [data-pane]', app).forEach(x => x.classList.toggle('on', x === b));
      $$('.d-pane', app).forEach(p => p.classList.toggle('on', p.dataset.p === b.dataset.pane));
    }
  });
  $('[data-bots]', app).addEventListener('change', e => { demoServer.bots = e.target.checked; });
}

route();
