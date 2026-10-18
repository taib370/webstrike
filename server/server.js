// WebStrike official Free-For-All server — dependency-free (Node 18+).  Run:  node server.js
// It speaks the same JSON protocol as the in-game "host", so the game just connects with a WebSocket.
const http = require('http'), crypto = require('crypto');
const PORT = +process.env.PORT || 8080;
const MAX = +process.env.ROOM_SIZE || 8, MAXROOMS = +process.env.MAX_ROOMS || 10, KILLS = +process.env.KILLS_TO_WIN || 15;
const MAPLIST = (process.env.MAPS || '4').split(',').map(Number);               // 4 = Kick Arena (official map)
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);  // optional: restrict to your site
const CONNS = new Set();
const ADMIN_KEY = process.env.ADMIN_KEY || '';   // secret for the in-game dev console (type  :Admin: <key>  in chat). Empty = admin disabled.
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ---------- tiny RFC 6455 WebSocket implementation ---------- */
function frame(str) {
  const p = Buffer.from(str), n = p.length;
  let h;
  if (n < 126) h = Buffer.from([0x81, n]);
  else if (n < 65536) h = Buffer.from([0x81, 126, n >> 8, n & 255]);
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeUInt32BE(n, 6); }
  return Buffer.concat([h, p]);
}
class Conn {
  constructor(sock, onMsg, onClose) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.alive = true; this.last = Date.now(); this.rate = 0; this.rt = Date.now(); this.frag = null;
    sock.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.parse(onMsg); });
    sock.on('close', () => { this.alive = false; onClose(); });
    sock.on('error', () => { this.alive = false; try { sock.destroy(); } catch (e) {} });
    sock.setNoDelay(true); CONNS.add(this); sock.on('close', () => CONNS.delete(this));
  }
  parse(onMsg) {
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = !!(b[0] & 128), op = b[0] & 15, masked = !!(b[1] & 128); let len = b[1] & 127, o = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); o = 4; }
      else if (len === 127) { if (b.length < 10) return; len = b.readUInt32BE(6); o = 10; }
      if (len > 65536) return this.sock.destroy();
      const mk = masked ? 4 : 0; if (b.length < o + mk + len) return;
      let payload = Buffer.from(b.slice(o + mk, o + mk + len));
      if (masked) { const m = b.slice(o, o + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      this.buf = b.slice(o + mk + len);
      if (op === 8) return this.sock.end();
      if (op === 9) { this.sock.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 10) { this.last = Date.now(); continue; }
      if (op === 1 || op === 0) {
        this.frag = op === 1 ? payload : Buffer.concat([this.frag || Buffer.alloc(0), payload]);
        if (!fin) continue; const s = this.frag.toString(); this.frag = null; this.last = Date.now(); onMsg(s);
      }
    }
  }
  send(o) { if (this.alive) try { this.sock.write(frame(JSON.stringify(o))); } catch (e) {} }
  raw(s) { if (this.alive) try { this.sock.write(frame(s)); } catch (e) {} }
  ping() { try { this.sock.write(Buffer.from([0x89, 0])); } catch (e) {} }
}

/* ---------- rooms: same rules as the in-game host ---------- */
const ROOMS = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
const clean = s => String(s || 'Player').replace(/[<>]/g, '').trim().slice(0, 14) || 'Player';
const skin = k => ({ s: clamp(k && k.s, 0, 7) | 0, v: clamp(k && k.v, 0, 5) | 0, h: clamp(k && k.h, 0, 3) | 0, g: clamp(k && k.g, 0, 5) | 0 });
const KEYS = ['ak47','m4','scar','smg','uzi','lmg','dmr','awp','shotgun','spas','deagle','revolver','glock'];
const gsan = o => { const q = {}; if (o && typeof o === 'object') for (const k of KEYS) { const v = o[k] | 0; if (v > 0 && v <= 40) q[k] = v; } return q; };
const arr3 = a => Array.isArray(a) ? [+a[0] || 0, +a[1] || 0, +a[2] || 0] : [0, 0, 0];
function pickRoom() {
  for (const r of ROOMS) if (r.p.size < MAX) return r;
  if (ROOMS.length >= MAXROOMS) return null;
  const r = { id: ROOMS.length + 1, p: new Map(), sb: {}, over: 0, mi: 0, nid: 1, timer: null, map: MAPLIST[0] };
  ROOMS.push(r); return r;
}
const bc = (r, m, ex) => { for (const [id, c] of r.p) if (id !== ex) c.conn.send(m); };
const roster = r => bc(r, { t: 'ro', ro: [...r.p].map(([i, c]) => ({ i, n: c.n, sk: c.sk, gs: c.gs, a: c.adm ? 1 : 0 })) });
function startTimer(r) {
  if (r.timer) return;
  r.timer = setInterval(() => { if (r.p.size < 2) return; const p = {}; for (const [i, c] of r.p) if (c.st) p[i] = c.st; bc(r, { t: 'snap', p }); }, 50);
}
function handle(r, c, d) {
  const t = d.t;
  if (t === 's') c.st = { t: 's', x: +d.x || 0, y: +d.y || 0, z: +d.z || 0, w: +d.w || 0, hp: clamp(d.hp, -999, 999), d: d.d ? 1 : 0, pt: clamp(d.pt, -2, 2), wi: d.wi | 0 };
  else if (t === 'f') bc(r, { t: 'f', i: c.id, w: String(d.w).slice(0, 12), o: arr3(d.o), e: arr3(d.e) }, c.id);
  else if (t === 'gt') bc(r, { t: 'gt', i: c.id, s: d.s ? 1 : 0, p: arr3(d.p), v: arr3(d.v) }, c.id);
  else if (t === 'gr') bc(r, { t: 'gr', i: c.id, s: d.s ? 1 : 0, p: arr3(d.p) }, c.id);
  else if (t === 'em') bc(r, { t: 'em', i: c.id, k: clamp(d.k, 0, 7) | 0 }, c.id);
  else if (t === 'qc') bc(r, { t: 'qc', i: c.id, q: clamp(d.q, 0, 7) | 0 }, c.id);
  else if (t === 'hit') { const to = r.p.get(d.to | 0); if (to && to !== c) to.conn.send({ t: 'hit', d: clamp(d.d, 0, 200), from: c.id }); }
  else if (t === 'cm') {
    const now = Date.now(); if (now - (c.lastCm || 0) < 600) return; c.lastCm = now;
    const m = String(d.m || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120); if (m) bc(r, { t: 'cm', i: c.id, m, a: c.adm ? 1 : 0 }, c.id);
  }
  else if (t === 'adm') {
    if (ADMIN_KEY && d.key === ADMIN_KEY) { c.adm = 1; c.conn.send({ t: 'adm', ok: 1 }); roster(r); }
    else c.conn.send({ t: 'adm', ok: 0, m: ADMIN_KEY ? 'Wrong admin key' : 'Admin is disabled on this server (set ADMIN_KEY)' });
  }
  else if (t === 'ac') {
    if (!c.adm) return; const x = d.x;
    if (d.c === 'map') { r.map = clamp(x, 0, 4) | 0; bc(r, { t: 'ac', c: 'map', x: r.map }, c.id); }
    else if (d.c === 'ann') bc(r, { t: 'cm', sys: 1, m: String(x || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 120) });
    else if (d.c === 'restart') { r.sb = {}; r.over = 0; bc(r, { t: 'go', map: r.map, sb: {} }); }
    else { const to = r.p.get(d.to | 0); if (!to) return; if (d.c === 'kick') { to.conn.send({ t: 'ac', c: 'kick' }); setTimeout(() => { try { to.conn.sock.end(); } catch (e) {} }, 200); } else to.conn.send({ t: 'ac', c: String(d.c).slice(0, 8), x }); }
  }
  else if (t === 'dead') {
    const k = d.by == null ? null : (d.by | 0), a = r.sb; a[c.id] = a[c.id] || [0, 0]; a[c.id][1]++;
    const kk = k !== null && k !== c.id && r.p.has(k) ? k : null;
    if (kk !== null) { a[kk] = a[kk] || [0, 0]; a[kk][0]++; }
    bc(r, { t: 'sb', sb: a, k: kk, v: c.id });
    if (kk !== null && a[kk][0] >= KILLS && !r.over) {
      r.over = 1; bc(r, { t: 'end', w: kk });
      setTimeout(() => { r.over = 0; r.sb = {}; r.mi = (r.mi + 1) % MAPLIST.length; r.map = MAPLIST[r.mi]; bc(r, { t: 'go', map: r.map, sb: {} }); }, 9000);
    }
  }
}


/* ---------- 1v1 rooms: public list, optional password, server-side relay ---------- */
const DUELS = new Map(), MAXDUELS = +process.env.MAX_DUELS || 100;
const nm = (s, def, n) => String(s || def).replace(/[<>]/g, '').trim().slice(0, n) || def;
const duelList = () => [...DUELS.values()].filter(d => d.pub && !d.guest).map(d => ({ id: d.id, name: d.name, host: d.hn, lock: !!d.pw, n: 1, max: 2 })).slice(0, 60);
function dropDuel(d, why) { DUELS.delete(d.id); for (const c of [d.host, d.guest]) if (c && c.duel === d) { c.duel = null; if (why && c.alive) c.send({ c: 'closed', m: why }); } }
function leaveDuel(conn) {
  const d = conn.duel; if (!d) return;
  if (d.host === conn) { d.host = null; dropDuel(d, 'The host left the room'); }
  else { d.guest = null; d.gn = ''; conn.duel = null; if (d.host && d.host.alive) d.host.send({ c: 'peerleft' }); }
}
function duelMsg(conn, d) {
  if (d.c === 'rooms') return conn.send({ c: 'rooms', list: duelList() });
  if (d.c === 'mk') {
    if (conn.duel || DUELS.size >= MAXDUELS) return conn.send({ c: 'err', m: 'The server is busy, try again' });
    let id; do { id = String(1000 + ((Math.random() * 9000) | 0)); } while (DUELS.has(id));
    const hn = nm(d.n, 'Player', 14), room = { id, name: nm(d.name, hn + "'s room", 20), pw: String(d.pw || '').slice(0, 16), pub: !!d.pub, host: conn, guest: null, hn, gn: '' };
    DUELS.set(id, room); conn.duel = room; return conn.send({ c: 'mk', id, name: room.name, lock: !!room.pw, pub: room.pub });
  }
  if (d.c === 'jn') {
    if (conn.duel) return; const room = DUELS.get(String(d.id));
    if (!room || !room.host) return conn.send({ c: 'err', m: 'Room not found' });
    if (room.guest) return conn.send({ c: 'err', m: 'Room is full' });
    if (room.pw && room.pw !== String(d.pw || '')) return conn.send({ c: 'err', m: 'Wrong password' });
    room.guest = conn; room.gn = nm(d.n, 'Player', 14); conn.duel = room;
    room.host.send({ c: 'ready', role: 'host', peer: room.gn, id: room.id }); return conn.send({ c: 'ready', role: 'guest', peer: room.hn, id: room.id });
  }
  if (d.c === 'del' && conn.duel && conn.duel.host === conn) return dropDuel(conn.duel, 'The host deleted the room');
  if (d.c === 'leave') leaveDuel(conn);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ name: 'WebStrike official server', duels: DUELS.size, players: ROOMS.reduce((n, r) => n + r.p.size, 0), rooms: ROOMS.map(r => ({ room: r.id, players: r.p.size, map: r.map })) }));
});
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'], org = req.headers.origin;
  if (!key || (ORIGINS.length && org && !ORIGINS.includes(org))) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  let room = null, me = null;
  const conn = new Conn(sock, s => {
    const now = Date.now(); if (now - conn.rt > 1000) { conn.rt = now; conn.rate = 0; } if (++conn.rate > 200) return;
    if (conn.duel) {                                         // inside a 1v1 room: relay to the other player
      if (s.length > 4096) return;
      if (s.startsWith('{"c":')) { let c; try { c = JSON.parse(s); } catch (e) { return; } return duelMsg(conn, c); }
      const d2 = conn.duel, o = d2.host === conn ? d2.guest : d2.host; if (o) o.raw(s); return;
    }
    let d; try { d = JSON.parse(s); } catch (e) { return; } if (!d || typeof d !== 'object') return;
    if (!me) {
      if (d.c) return duelMsg(conn, d);
      if (d.t !== 'hi') return;
      room = pickRoom(); if (!room) { conn.send({ t: 'full' }); return sock.end(); }
      const id = room.nid++; me = { id, conn, n: clean(d.n), sk: skin(d.sk), gs: gsan(d.gs), st: null }; room.p.set(id, me);
      conn.send({ t: 'wel', id, map: room.map, room: room.id }); roster(room); conn.send({ t: 'go', map: room.map, sb: room.sb }); startTimer(room);
      return;
    }
    handle(room, me, d);
  }, () => {
    leaveDuel(conn);
    if (!room || !me) return; room.p.delete(me.id); roster(room);
    if (!room.p.size) { room.sb = {}; room.over = 0; clearInterval(room.timer); room.timer = null; }
  });
});
// keep-alive: ping every 25 s, drop sockets silent for 70 s (also keeps free hosts from idling the connection)
setInterval(() => { const now = Date.now(); for (const c of CONNS) { if (now - c.last > 70000) c.sock.destroy(); else c.ping(); } }, 25000);
server.listen(PORT, () => console.log('WebStrike official server listening on :' + PORT + '  maps=' + MAPLIST));
