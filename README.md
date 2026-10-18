<p align="center"><img src="docs/icons/icon-192.png" width="120" alt="WebStrike logo"></p>

# WebStrike: Reloaded

A 3D first-person shooter that runs in the browser and installs as an offline app (PWA).
Bot matches, aim range, 4v4, battle royale, 1v1 rooms and an official Free-For-All server, with gun skins,
crates, daily rewards, missions, grenades, emotes, a killcam, **free-text chat**
and a full tabbed **settings** screen (rebindable keys, crosshair editor, graphics, audio, touch).

## Repository layout
| Folder | What it is |
|---|---|
| `docs/` | The game itself (single `index.html` + PWA files). Host this folder anywhere. |
| `server/` | Optional Node.js server for the official Free-For-All and the public 1v1 room list. No dependencies. |

## 1. Publish the game on GitHub Pages (free)
1. Create a new GitHub repository and upload everything from this zip (or `git push` it).
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs` → Save.**
3. After a minute the game is live at `https://<your-user>.github.io/<repo>/`.
4. Open it once while online, then use **Install** (⬇ button in the lobby, or your browser menu). iPhone: Share → Add to Home Screen.

## 2. Run the server (rooms + official Free-For-All)
The server is what makes the **public room list**, **room passwords** and the **24/7 official Free-For-All** possible.
Without it the game still works: bot modes, 1v1 with a code, and community Free-For-All rooms.

* **Render (easy):** New + → Blueprint → select this repo (`render.yaml` is included). Copy the `https://…onrender.com` address.
* **Anywhere else:** `cd server && node server.js` (Node 18+). A Dockerfile is included.
* Free hosts sleep after ~15 minutes without traffic. For true 24/7 use an always-on plan, or ping the address every 5 minutes with a free monitor.
* Browsers need the secure form of the address: `wss://your-server.onrender.com`.

## 3. Tell the game where the server is (pick one)
1. In the game: **Free For All → Advanced**, or **1v1 → Host / Browse rooms**, paste the `wss://…` address (it is remembered).
2. For everybody: edit `docs/index.html`, find `const OFFICIAL_WS_DEFAULT=''` and put your address between the quotes.
3. For testing: open the game with `?server=ws://localhost:8080` after the address.

## Controls (PC)
`WASD` move · `Shift` sprint · `Space` jump · mouse aim · `LMB` fire · `RMB` scope · `R` reload · `1-9`/wheel weapons ·
`H` medkit · `V` optic · `G` grenade · `X` smoke · `B` emotes · `T` quick chat · **`Enter` type a message** · `Esc` pause / back.
Every key can be changed in **Settings → Controls**.
Mobile: on-screen controls (movable and resizable in Settings).

## Chat
Press `Enter` (or the 💬 button on phones), type any message and press `Enter` again. Works in 1v1 and Free For All; in bot modes the bots may answer.

## Server owner key (optional)
Set the environment variable `ADMIN_KEY` on the server (Render: Environment tab) to enable owner tools for yourself only. Without it the server refuses all owner commands.

## Slide, touch controls and automatic updates
* **Slide:** run, then press `C` (or the **SLIDE** button on phones). Other players see you slide too.
* **Fewer buttons on phones:** the layout shows only the essentials (fire, jump, slide, reload, scope, swap, grenade). The **☰** button opens a tray with heal, optic, smoke, emote and chat. **Hold** the grenade button to throw a smoke grenade.
* **Auto-update:** every time the game opens (and when the app is resumed after 5+ minutes) it compares its `BUILD` with `docs/version.json`. If a newer build exists it clears the old offline cache and reloads itself once. For every release, upload the whole new `docs/` folder (index.html, sw.js and version.json change together).
* **Cinematic look:** Settings → Graphics → *Cinematic sky & color* adds a painted sky with a sun glow, per-map lighting and a soft color grade. It costs almost nothing (one sphere, one small texture, one CSS overlay) and can be turned off.

## Guns and muzzle effects
* **Real-shaped guns:** all 13 weapons use side-profile models (curved AK magazine, tapered stocks, round barrels, scopes' rails) instead of plain blocks. Each gun is merged into a few meshes and shared by every soldier, so it stays light on phones. If a gun model ever fails to build, the game falls back to the old block model automatically.
* **Muzzle flash:** a star-burst flash with two crossed flame streaks, plus sparks, a small smoke puff and an ejected shell (brass for rifles and pistols, red for shotguns). The sparks, smoke and shells follow *Settings → Graphics → Particles & effects*.

## TV remote and reload animation
* **TV remote mode:** turns on by itself on smart TVs (Android TV / Google TV, Fire TV, Samsung Tizen, LG webOS...). You can also force it in *Settings → TV remote*, or open the game with `?tv=1` to test it on a PC with the arrow keys and Enter.
  * Menus: arrows move a green focus ring, **OK** selects, **Back** goes back (sliders: ◀ ▶ change the value).
  * In a match: **▲ ▼** move, **◀ ▶** turn, **OK** fire (hold = auto-fire), double-tap **▲** = auto-run, **Back** opens the action bar (pause, jump, slide, reload, grenade, smoke, heal, swap, scope, auto-run, look mode, sprint). A built-in aim assist (adjustable) helps shots land because a remote cannot look up and down.
  * If the remote has them: Vol+ jump, Vol− reload, CH+/− weapon switch, Red grenade, Green jump, Yellow reload, Blue slide, Play reload, Menu/Info action bar. Many TVs keep the volume keys for themselves, so everything is also in the action bar.
* **Reload animation:** the gun comes toward you and tilts, your left hand pulls the magazine out, bullets are pushed in one by one, the magazine goes back in. Shotguns and the revolver load shells one at a time. The gun now sits closer to the camera.

## Notes
* Progress (coins, XP, skins, settings) is saved in the browser of each player.
* Everything is plain HTML/JS: edit `docs/index.html` and refresh. Bump the cache name in `docs/sw.js` (`webstrike-v9`) when you publish an update so installed copies refresh.
* Multiplayer uses WebRTC / WebSocket; the matchmaking code service in 1v1 uses the free public PeerJS cloud.
