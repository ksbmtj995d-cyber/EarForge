'use strict';
(async()=>{
  const packed={
    catalog:['00','01','02','03'],
    learning:['00','01','02','03','04','05','06'],
    questions:['00','01a','01b','02','03'],
    audio:['00','01'],
    app:['00','01a','01b','02','03','04','05']
  };
  const loadDirect=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Chargement impossible : '+src));document.head.append(s)});
  async function loadPacked(name){
    const names=packed[name];
    const parts=await Promise.all(names.map(i=>fetch(`./payload/${name}/${i}.txt`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Charge utile indisponible : '+name+'/'+i);return r.text()})));
    const raw=atob(parts.join(''));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    if(typeof DecompressionStream!=='function')throw new Error('Ce navigateur ne prend pas en charge la décompression nécessaire.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const code=await new Response(stream).text();
    await new Promise((resolve,reject)=>{const blob=new Blob([code],{type:'text/javascript'}),url=URL.createObjectURL(blob),s=document.createElement('script');s.src=url;s.onload=()=>{URL.revokeObjectURL(url);resolve()};s.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Module impossible à exécuter : '+name))};document.head.append(s)});
  }
  try{
    await loadPacked('catalog');
    await loadPacked('learning');
    await loadDirect('./app-10.5.0-storage.js');
    await loadPacked('questions');
    await loadDirect('./app-10.5.0-audio-kernel.js');
    await loadPacked('audio');
    await loadPacked('app');
  }catch(error){const app=document.getElementById('app');if(app)app.innerHTML='<div class="screen"><h1>EarForge</h1><p>Le chargement de l’application a échoué. Rechargez la page.</p></div>';console.error(error)}
})();