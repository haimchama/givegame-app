// GiveGame server: one Worker serves the web app (static assets) and the API.
// Each event room is a Durable Object holding the game state and the WebSockets.
import { DurableObject } from 'cloudflare:workers';
import * as G from '../public/shared/game.js';

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...SEC_HEADERS } });

const randInt = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const randKey = () => [...crypto.getRandomValues(new Uint8Array(18))].map(b => b.toString(16).padStart(2, '0')).join('');
const CODE_RE = /^\d{5}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === '/api/rooms' && req.method === 'POST') {
      for (let i = 0; i < 6; i++) {
        const code = String(10000 + randInt(90000));
        const hostKey = randKey();
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        if (await stub.init(code, hostKey)) return json({ code, hostKey });
      }
      return json({ error: 'busy' }, 503);
    }

    let m = p.match(/^\/api\/rooms\/(\d+)$/);
    if (m && req.method === 'GET') {
      if (!CODE_RE.test(m[1])) return json({ exists: false }, 404);
      const exists = await env.ROOM.get(env.ROOM.idFromName(m[1])).exists();
      return json({ exists }, exists ? 200 : 404);
    }

    m = p.match(/^\/api\/rooms\/(\d+)\/ws$/);
    if (m) {
      if (!CODE_RE.test(m[1])) return json({ error: 'code' }, 404);
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426);
      const origin = req.headers.get('Origin');
      if (origin && new URL(origin).host !== url.host) return json({ error: 'origin' }, 403);
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
    }

    if (p.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};

const ROOM_TTL = 1000 * 60 * 60 * 24 * 45; // rooms are deleted 45 days after creation

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    this.pending = null;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('s')) ?? null; });
  }

  async init(code, hostKey) {
    if (this.s) return false;
    this.s = G.createRoom({ code, hostKey, now: Date.now() });
    await this.ctx.storage.put('s', this.s);
    await this.schedule();
    return true;
  }

  async exists() { return !!this.s; }

  async fetch(req) {
    if (!this.s) return json({ error: 'no room' }, 404);
    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    let pid = null;
    if (role === 'host') {
      if (!safeEqual(url.searchParams.get('key') ?? '', this.s.hostKey)) return json({ error: 'key' }, 403);
    } else if (role === 'player') {
      pid = url.searchParams.get('pid');
      if (!pid || !/^[a-zA-Z0-9-]{8,40}$/.test(pid)) return json({ error: 'pid' }, 400);
    } else if (role !== 'screen') {
      return json({ error: 'role' }, 400);
    }
    if (this.ctx.getWebSockets().length > 2500) return json({ error: 'full' }, 503);

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, pid });
    const now = Date.now();
    if (G.tick(this.s, now)) await this.commit();
    server.send(JSON.stringify({ t: 'pub', d: G.publicView(this.s, now) }));
    this.sendPrivate(server, { role, pid });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 16000) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const actor = ws.deserializeAttachment();
    if (msg.t === 'ping') { ws.send('{"t":"pong","now":' + Date.now() + '}'); return; }
    const now = Date.now();
    const ticked = G.tick(this.s, now);
    const res = G.apply(this.s, actor, msg, now);
    if (res.error) ws.send(JSON.stringify({ t: 'err', e: res.error, ref: msg.ref }));
    else ws.send(JSON.stringify({ t: 'ok', ref: msg.ref }));
    if (res.changed || ticked) await this.commit();
    else this.sendPrivate(ws, actor);
  }

  webSocketClose(ws, code) { try { ws.close(code, 'bye'); } catch {} }
  webSocketError() {}

  async alarm() {
    if (!this.s) return;
    const now = Date.now();
    if (now - this.s.createdAt > ROOM_TTL) {
      for (const ws of this.ctx.getWebSockets()) try { ws.close(1000, 'expired'); } catch {}
      await this.ctx.storage.deleteAll();
      this.s = null;
      return;
    }
    if (G.tick(this.s, now)) await this.commit(); else await this.schedule();
  }

  async commit() {
    await this.ctx.storage.put('s', this.s);
    await this.schedule();
    this.broadcast();
  }

  async schedule() {
    const d = G.nextDeadline(this.s);
    await this.ctx.storage.setAlarm(d > 0 ? d + 50 : this.s.createdAt + ROOM_TTL);
  }

  broadcast() {
    const now = Date.now();
    const pub = JSON.stringify({ t: 'pub', d: G.publicView(this.s, now) });
    let host = null;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(pub);
        const a = ws.deserializeAttachment();
        if (a.role === 'host') ws.send(host ??= JSON.stringify({ t: 'host', d: G.hostView(this.s) }));
        else if (a.role === 'player') ws.send(JSON.stringify({ t: 'me', d: G.playerView(this.s, a.pid) }));
      } catch {}
    }
  }

  sendPrivate(ws, a) {
    if (a.role === 'host') ws.send(JSON.stringify({ t: 'host', d: G.hostView(this.s) }));
    else if (a.role === 'player') ws.send(JSON.stringify({ t: 'me', d: G.playerView(this.s, a.pid) }));
  }
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
