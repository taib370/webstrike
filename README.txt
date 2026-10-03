WebStrike: Reloaded - installable offline app (PWA)

HOW TO USE
1) Put this whole folder on any HTTPS static host (GitHub Pages, Netlify Drop, Cloudflare Pages, Vercel...)
   or test locally:  python3 -m http.server 8080   then open http://localhost:8080
2) Open it ONCE while online. The game and its 3D library are saved on your device.
3) Install: Chrome/Edge/Android -> the ⬇ button in the lobby (or browser menu > Install app).
   iPhone/iPad (Safari) -> Share > Add to Home Screen.
4) After that it opens from your home screen, full screen, and works with NO internet
   (bot modes, battle royale, 4v4, aim range). 1v1 works offline on the same Wi-Fi using the
   long code option (the 6-digit code needs internet).
   Free For All needs internet to connect players (then traffic is peer-to-peer).
   FFA 'Official server' = fixed public rooms on the free PeerJS cloud; the first player in hosts, others join.

CONTROLS: WASD move, Shift sprint, Space jump, LMB fire, RMB scope, R reload, H medkit, V optic, G throw grenade, B emote wheel, T quick chat (💣 and 😀 buttons on mobile). Killcam plays automatically after you die (Enter/Space to skip).

UPDATING: edit the files and bump  const V='webstrike-v5'  in sw.js (e.g. v2).
