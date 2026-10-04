// WebStrike official Free-For-All server — dependency-free (Node 18+).  Run:  node server.js
// It speaks the same JSON protocol as the in-game "host", so the game just connects with a WebSocket.
const http = require('http'), crypto = require('crypto');
const PORT = +process.env.PORT || 8080;
const MAX = +process.env.ROOM_SIZE || 8, MAXROOMS = +process.env.MAX_ROOMS || 10, KILLS = +process.env.KILLS_TO_WIN || 15;
const MAPLIST = (process.env.MAPS || '4').split(',').map(Number);               // 4 = Kick Arena (official map)
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);  // optional: restrict to your site
const CONNS = new Set();
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
  ping() { try { this.sock.write(Buffer.from([0x89, 0])); } catch (e) {} }
}

/* ---------- rooms: same rules as the in-game host ---------- */
const ROOMS = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
const clean = s => String(s || 'Player').replace(/[<>]/g, '').trim().slice(0, 14) || 'Player';
const skin = k => ({ s: clamp(k && k.s, 0, 7) | 0, v: clamp(k && k.v, 0, 5) | 0, h: clamp(k && k.h, 0, 3) | 0, g: clamp(k && k.g, 0, 5) | 0 });
const arr3 = a => Array.isArray(a) ? [+a[0] || 0, +a[1] || 0, +a[2] || 0] : [0, 0, 0];
function pickRoom() {
  for (const r of ROOMS) if (r.p.size < MAX) return r;
  if (ROOMS.length >= MAXROOMS) return null;
  const r = { id: ROOMS.length + 1, p: new Map(), sb: {}, over: 0, mi: 0, nid: 1, timer: null, map: MAPLIST[0] };
  ROOMS.push(r); return r;
}
const bc = (r, m, ex) => { for (const [id, c] of r.p) if (id !== ex) c.conn.send(m); };
const roster = r => bc(r, { t: 'ro', ro: [...r.p].map(([i, c]) => ({ i, n: c.n, sk: c.sk })) });
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

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ name: 'WebStrike official server', players: ROOMS.reduce((n, r) => n + r.p.size, 0), rooms: ROOMS.map(r => ({ room: r.id, players: r.p.size, map: r.map })) }));
});
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'], org = req.headers.origin;
  if (!key || (ORIGINS.length && org && !ORIGINS.includes(org))) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  let room = null, me = null;
  const conn = new Conn(sock, s => {
    const now = Date.now(); if (now - conn.rt > 1000) { conn.rt = now; conn.rate = 0; } if (++conn.rate > 200) return;
    let d; try { d = JSON.parse(s); } catch (e) { return; } if (!d || typeof d !== 'object') return;
    if (!me) {
      if (d.t !== 'hi') return;
      room = pickRoom(); if (!room) { conn.send({ t: 'full' }); return sock.end(); }
      const id = room.nid++; me = { id, conn, n: clean(d.n), sk: skin(d.sk), st: null }; room.p.set(id, me);
      conn.send({ t: 'wel', id, map: room.map, room: room.id }); roster(room); conn.send({ t: 'go', map: room.map, sb: room.sb }); startTimer(room);
      return;
    }
    handle(room, me, d);
  }, () => {
    if (!room || !me) return; room.p.delete(me.id); roster(room);
    if (!room.p.size) { room.sb = {}; room.over = 0; clearInterval(room.timer); room.timer = null; }
  });
});
// keep-alive: ping every 25 s, drop sockets silent for 70 s (also keeps free hosts from idling the connection)
setInterval(() => { const now = Date.now(); for (const c of CONNS) { if (now - c.last > 70000) c.sock.destroy(); else c.ping(); } }, 25000);
server.listen(PORT, () => console.log('WebStrike official server listening on :' + PORT + '  maps=' + MAPLIST));
