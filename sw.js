const CACHE='private-news-app-v3-push';
const ASSETS=['./','./index.html','./app.js','./push-ui.js','./push-config.js','./app-data.mjs','./reader.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('private-news-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname)||u.pathname.endsWith('/feed.json'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return;}
 if(ASSETS.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
// Always display a visible notification, including malformed/empty pushes.
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{};}catch{}
 const scope=new URL(self.registration.scope);let url=new URL('#home',scope);
 try{const candidate=new URL(data.url,scope);if(candidate.origin===scope.origin&&candidate.pathname===scope.pathname)url=candidate;}catch{}
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title:'私享新闻',{body:typeof data.body==='string'?data.body:'收到一条新消息，点击打开私享新闻。',icon:new URL('icon-192.png',scope).href,badge:new URL('icon-192.png',scope).href,tag:typeof data.tag==='string'?data.tag:undefined,data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const scope=new URL(self.registration.scope);let target=new URL('#home',scope);
 try{const u=new URL(event.notification.data?.url);if(u.origin===scope.origin&&u.pathname===scope.pathname)target=u;}catch{}
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){const u=new URL(client.url);if(u.origin===scope.origin&&u.pathname===scope.pathname){try{await client.navigate(target.href);await client.focus();return;}catch{}}}
 await self.clients.openWindow(target.href);
})());});
