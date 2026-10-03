// WebStrike service worker: offline-first. Bump V to force an update.
const V='webstrike-v5';
const CORE=['index.html','manifest.webmanifest','logo.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','icons/favicon.png'];
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(V);await c.addAll(CORE);
 await Promise.all(LIBS.map(async u=>{try{await c.put(u,await fetch(new Request(u,{mode:'no-cors'})))}catch(_){}}));await self.skipWaiting()})())});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);
 if(q.method!=='GET'||!/^https?:$/.test(u.protocol))return;
 if(u.origin!==location.origin&&!LIBS.includes(q.url))return;      // never cache signalling/other APIs
 e.respondWith((async()=>{const c=await caches.open(V);
  const hit=await c.match(q,{ignoreSearch:q.mode==='navigate'})||(q.mode==='navigate'?await c.match('index.html'):null);
  const net=fetch(q).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(q,r.clone());return r}).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  return(await net)||new Response('Offline',{status:503})})())});
