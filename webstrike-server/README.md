# WebStrike official server (24/7 Free For All)

A tiny dependency-free Node.js server (Node 18+). It runs the same rules the in-game host runs:
rooms of up to 8 players, first to 15 kills wins, the official **Kick Arena** map, scoreboard, grenades,
emotes and quick chat. Players press **PLAY · OFFICIAL SERVER**, type a name, and they are in.

## Run it
    node server.js              # listens on PORT (default 8080)

Health check / stats: open `http://localhost:8080/` in a browser (JSON with players per room).

Options (environment variables): `PORT`, `ROOM_SIZE` (8), `MAX_ROOMS` (10), `KILLS_TO_WIN` (15),
`MAPS` (comma list of map numbers, default `4` = Kick Arena), `ALLOWED_ORIGINS` (comma list of site URLs, optional).

## Put it online so it runs 24/7
The server must live on a machine that is always on. Any of these work (the folder already has a Dockerfile):
* **Render / Railway / Fly.io / Koyeb**: create a new "Web Service" from this folder (or a Git repo of it).
  Build command: none. Start command: `node server.js`. They give you an https address.
* **A VPS** (any $4–5/month Linux box): `node server.js` under `pm2` or `systemd`, with Caddy/nginx for https.
* Free tiers usually **sleep after ~15 min without traffic**. For true 24/7 use a paid/always-on plan, or ping
  the address every 5 minutes with a free monitor (UptimeRobot) to keep it awake.

Browsers only allow secure sockets from an https page, so give the game the **wss://** form of your address,
e.g. `wss://webstrike-official.onrender.com`.

## Tell the game where the server is (pick one)
1. In the game: Free For All screen -> **Advanced: official server address** -> paste the `wss://...` address.
2. Permanently for everybody: open `index.html`, find `const OFFICIAL_WS_DEFAULT=''` and put your address
   between the quotes, then redeploy the PWA.
3. For testing: open the game with `?server=ws://localhost:8080` at the end of the address.

If the server cannot be reached, the game automatically falls back to community rooms, so players are never stuck.
