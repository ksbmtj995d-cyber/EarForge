'use strict';
const REV='11320', CACHE='earforge-11.32.0-publish.1';
const BASE=new URL('./',self.location.href);
const ASSETS={"apple-touch-icon.png":"68829514e6426cb4846369cc6d032908a9f7d18234de49cd06b709a9574d9140","audio-kernel.js":"6278d9c54f6f3af8e0cedda04bebee552080bcbba610027a16fd1620408a5fbe","audio-sustain.js":"c5f132d98cdfafe89e2c2ff9cedf38b4764fee2362187eb4486493a21a648b6a","audio-timeline.js":"205bab054ac60dfc105fcf94055afd2463a8c2cadb62f832f12fc672f8328659","frontiers.js":"32e5f7a3b4cf4dcca31bae4c397756782c243de67b29d481d81ea7bb16025206","icon-192.png":"b011d61d7af9dda0928dae6f17fb86ba59cb118d07024bf491cbf5ffe2b9a47e","icon-512.png":"855b62eacf7540e8c185b444c8ba734eaa0a5fa57eb03e0372173a6424b7c122","index.html":"d26625b0d4f64b0938d1403153c0ad4da7f66dd6c9ef78e2d5399809bdf202e9","instruments.js":"d59e4e5ded2da80fd034abf2d520f2805193d06b8c2fa13e89d164996d2ca097","labs.js":"138037b766f44b8a07ec92f4cac396f9b93daf2a523a32d9a0abd7fd5ae5b344","loader.js":"2b4cf4e78b9c9a63b317a1d7f1f75754b00b8cf64fa7850a9050daedad6b2b8e","manifest.webmanifest":"0d47bd3ba6ee6542323ed486f2dae3591175d179ba1c1abcec9731879b34917b","maskable-512.png":"3c028fb49f35a277a5ac79436a2d53fc4e8e73399c52fe9e44753688e667c7cb","midi-output.js":"d7f6ff0cbfb30b40bf1f000911f3464c3c2fe774c090d085eaece461fa77440b","music-events.js":"8aff0cdfb8ea0c51303601640dc4c6e1155e73a675cbc1c62fcfa0c91a0bd1da","payload/app/00.txt":"b9180ffe276f98643c3f679c6bb4e41e46b7dadf7ba00cfe5b654eacaaf216c4","payload/app/01.txt":"3d906dac2a0964645f76597421263493b9925fda0f221b0e83f50397e50f212b","payload/app/02.txt":"a71a616165385a4e19ff1cedb1ae2bae6d9b4df72a64d804c02d7ae06504fcec","payload/app/03.txt":"bcf581692b2b67b1433efc0378de560ef38e2698b2fe7ac971a898d162029292","payload/app/04.txt":"84439863fcf4bfdb6b8bf236f369ddf2375b99b62cc424a38a601424182f4075","payload/app/05.txt":"334a496f5f0ef8ad0e47b949a28d9c73addd19ec90ffafb5d2dc07d84c89812d","payload/app/06.txt":"5a974726c97b5be2ae65ce4b75f3dfe1ca6872c420fe587c461e5da1ea9259bc","payload/app/07.txt":"79165ac81b9fcb5f0ac5b64f3c988943265f08b0a74a11510fb155e50e9a293a","payload/app/08.txt":"c3c12d18ae11106261a15ffee83e87807a8e4050216d47cf0e3adab66c65f40b","payload/app/09.txt":"5756750d2ee8ad1ddb5d11d70bda034080712f1a0d55be188076bf1cddcc8cc5","payload/audio/00.txt":"244f4b3bec03ba3859f2e919b6c96d3e954ec337e4e068172b51d76cfc8164c9","payload/audio/01.txt":"fa295e07e8b6996b73128f5abaa0509e734e2239193ff78e3d39fb0e066cf86a","payload/audio/02.txt":"70c4ebfccec4044dc235f4ee5abb2fe96baaaad95fd5f53a1ff00ed22fe0181f","payload/catalog/00.txt":"e543c8dee2252d5b90ff54c076c44911181c8a3f5f810d9bf55fc20e5247df34","payload/catalog/01.txt":"d58eed9fe95504737e2eb3546533ccf49e1bb4efe51ead928a5a932e061b90d8","payload/catalog/02.txt":"12e81db6850f556dfd90038556edd287429ce8db9352269c3232b250cd43c471","payload/catalog/03.txt":"1429e96b1d56cc7f370558ef7711008c038e983dec38089d8f4ec6a811e390b3","payload/catalog/04.txt":"6b01356b1c6dc8aab08daccbfba4d77355b4c1bb36c68bce00c248025a41465f","payload/catalog/05.txt":"3dcc375b399eea75c22b57a0effb28d4557c21a2eacc0eedaa5d223fce290c82","payload/catalog/06.txt":"eac19576d7252c6ca32a2b57c242db910a66c55466e13dc7b1eefba335a891da","payload/learning/00.txt":"b2b5f2c1b3fc93f307a963e4f4cad4516c430b6a8c714e00cffadf433ac4a092","payload/learning/01.txt":"286df5099670b8a4cc47508b4afe6201b934a17cd238c24a6b449f4883518593","payload/learning/02.txt":"1e40a866b61b516f056e3627afc0cf66112bc4b4e0f3be642f6c3af09ffe32a0","payload/learning/03.txt":"a373c67fdc805b9fceb88a5df48779694a8935132890fe1e7cb379b8f6ae9786","payload/learning/04.txt":"66fa2b1e395f42bbd33654db096b10e97c285e3fcdd8bdfa0b2a881898e55b07","payload/learning/05.txt":"777b2e64b52528b79e892abec7f743ca2c138696754194af11bf206f14a07fde","payload/learning/06.txt":"5383db38b7368f351947088bc1ed5f39c199e97054db57211b6721217c607fb6","payload/learning/07.txt":"fa15cfa121dedf5440f908c535ff516529b68bc15bf8b253a0eee3aefe1e6126","payload/learning/08.txt":"216baa5ed676879b5c8aafa9d041f60fafde9f9214fe74a4674a5140c1084647","payload/questions/00.txt":"e4e7f9cc90c0e87890cf2830d950904ba07cc9f974b87279798d77520f99f18d","payload/questions/01.txt":"bbfb4fefc5f10f11b529a5b0cb8c63d59c15a9af136d1fc362f3217e55dfd440","payload/questions/02.txt":"848b2edb1838a03c212afaa07b18419ece1a62aa24d5d94b6cf65787b6598f81","payload/questions/03.txt":"20bbad7c482a4fd60f4e84097dbb2751a4267507334a0939a73376e20390396c","payload/questions/04.txt":"b19659df3096390b880e9538c321b04a78a0e5e00dffd4c9733343c705127468","payload/questions/05.txt":"7aa349455edc93c452165105317d69bf12be0239e6c310638fa570193d054dba","payload/questions/06.txt":"9b69392ac8111c3a2b98552868455a336ee49bd9e30ed8887c777bfdb9510c7f","payload/questions/07.txt":"9f2ad20a3c2dbcedabbfe17eb95a1ba86f30b978cbb9a5a5cfa0e4b355745d3e","payload/questions/08.txt":"1c1be5f6ad203b9565d707aefb0c84d9bc7e440a99bfdcccfaff27027f6b9615","payload/questions/09.txt":"f246bd2d90ad96333c8b16a0bd32be3f870231fefbd893725294b9b7691ce2f4","presentation.js":"b929e5c6888df6c9adf737375330bce3e3ab358d189b913eb0f3f4fb566c2ef7","probe-renderers.js":"2cf58f0189f4667be62e8e0337c3a3d80620122962aa41bd599a90d451977372","production-view.js":"f9ec19800c423bf7e70ee3dffc92ec4668447113deec5d6fabb209e816b40522","production.js":"e394fefae00edf9284d9e364553337c74ef28c2c17bb3feb329a7e307ea538fc","release.json":"4ad9e30eb2f001f510e2018cc6b4e91111193bad31970b8dc97e753c35b2e339","score-import.js":"b68167b39461e114d37cd4f61bc7b21ea6382331b72c6cf06e0a998981854e41","score-model.js":"e6cd3511571f71c09365191a6768f541caa2e8a95323dd93254dc19c2654e8cb","score-oral.js":"7a7e37d5fb88a4b56b2cfc3c229a0fe4a607486d0c48f3c99dcff608c87b4ec1","score-player.js":"6f2e207f0d5d675de0d07d27b79a7bbea1aa0300c81c74eda97ac96385e7d7b5","score-view.js":"29256126fd34743894b0d7637570a7a484b79362470219723039200c1a237857","storage.js":"f64bb2dc7da9902ba3d18b61d62cfb05c0eba23610f50879f00b6eca24a97e9b","styles.css":"c4b503faba53a14ae99ad514902798e71c5b7f126289cf880aa901bcd2ec6fe8"};
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const canonical=path=>new URL(path,BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const entries=Object.entries(ASSETS);
  let cursor=0;
  // Verify every byte before activation. An incomplete release never replaces the old cache.
  await Promise.all(Array.from({length:6},async()=>{
    while(cursor<entries.length){
      const [path,expected]=entries[cursor++];
      const url=new URL(path,BASE);url.searchParams.set('ef',REV);
      const response=await fetch(url.href,{cache:'reload'});
      if(!response.ok)throw new Error('Ressource hors ligne indisponible: '+path);
      const digest=hex(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
      if(digest!==expected)throw new Error('Intégrité hors ligne invalide: '+path);
      await cache.put(canonical(path),response);
    }
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>key.startsWith('earforge-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const path=url.pathname.slice(BASE.pathname.length),revision=url.searchParams.get('ef');
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(request.mode==='navigate'){
      // Refresh HTML online; retain the last verified shell only for an unavailable network.
      try{const response=await fetch(request,{cache:'no-store'});if(response.ok)return response;}catch(_){}
      return await cache.match(canonical('index.html'))||new Response('EarForge est indisponible hors connexion.',{status:503});
    }
    // Never serve an old revision from this release's cache.
    if(revision&&revision!==REV)return fetch(request,{cache:'no-store'});
    if(Object.hasOwn(ASSETS,path)){
      const cached=await cache.match(canonical(path));if(cached)return cached;
      const response=await fetch(request,{cache:'no-cache'});
      if(!response.ok)return response;
      const digest=hex(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer()));
      if(digest!==ASSETS[path])return new Response('Intégrité de ressource invalide.',{status:503});
      await cache.put(canonical(path),response.clone());return response;
    }
    return fetch(request);
  })());
});
