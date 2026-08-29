'use strict';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('earforge-'))await caches.delete(key);await self.clients.claim();await self.registration.unregister();for(const c of await self.clients.matchAll({type:'window'}))c.navigate(c.url);})()));