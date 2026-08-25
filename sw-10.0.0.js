'use strict';
const CACHE='earforge-10.0.0';
const ROOT=new URL('./',self.location.href).href;
const SCOPE_PATH=new URL('./',self.location.href).pathname;
const INDEX_PATH=new URL('index.html',ROOT).pathname;
const ASSETS=['','index.html','styles-9.0.0.css','app-9.0.0-catalog.js','app-9.0.0-learning.js','app-9.0.0-questions.js','app-9.0.0-audio-kernel.js','app-9.0.0-audio.js','app-9.0.0.js','app-10.0.0-labs.js','earforge-10.0.0.webmanifest','icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'].map(x=>new URL(x||'./',ROOT).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('earforge-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(SCOPE_PATH))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok&&(u.pathname===SCOPE_PATH||u.pathname===INDEX_PATH))caches.open(CACHE).then(c=>c.put(ROOT,r.clone()));return r}).catch(()=>caches.match(ROOT)));return}e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r})));});
