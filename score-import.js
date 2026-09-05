'use strict';
(function(root,factory){const api=factory(root.EarForgeScoreModel||(typeof require==='function'?require('./score-model.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeScoreImport=api})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  const CAP=8*1024*1024,ZIPCAP=16*1024*1024;let crcTable=null;
  function crc32(bytes){if(!crcTable){crcTable=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c>>>0}}let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
  function safePath(path){if(!path||path.includes('\\')||path.startsWith('/')||path.includes('\0')||/^[a-z]:/i.test(path)||path.split('/').some(p=>p==='..'||p==='.'))throw new Error('Chemin d’archive non sûr.');return path}
  function decode(bytes){let enc='utf-8';if(bytes[0]===0xff&&bytes[1]===0xfe)enc='utf-16le';else if(bytes[0]===0xfe&&bytes[1]===0xff)enc='utf-16be';else{const head=new TextDecoder().decode(bytes.slice(0,200)),decl=head.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)/i);if(decl&&!/^utf-?8$/i.test(decl[1]))throw new Error('Encodage non pris en charge : utiliser UTF huit ou UTF seize avec marque initiale.')}return new TextDecoder(enc,{fatal:true}).decode(bytes)}
  async function unzip(bytes){
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);let end=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break}
    if(end<0)throw new Error('Archive MXL invalide.');const count=u16(end+10),size=u32(end+12),offset=u32(end+16);
    if(u16(end+4)||u16(end+6)||u16(end+8)!==count||count>4096||offset+size>end||count===65535)throw new Error('Archive segmentée, ZIP soixante-quatre ou trop complexe non prise en charge.');
    let p=offset,total=0;const files=new Map();for(let i=0;i<count;i++){
      if(p+46>end||u32(p)!==0x02014b50)throw new Error('Répertoire MXL incomplet.');const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),length=u32(p+24),nl=u16(p+28),extra=u16(p+30),comment=u16(p+32),local=u32(p+42);
      if(p+46+nl+extra+comment>offset+size)throw new Error('Entrée MXL tronquée.');const name=safePath(new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(p+46,p+46+nl)));p+=46+nl+extra+comment;
      if(files.has(name)||flags&1||![0,8].includes(method)||length>CAP||(total+=length)>32*1024*1024||local+30>offset||u32(local)!==0x04034b50)throw new Error('Archive ambiguë, chiffrée ou trop volumineuse.');
      const ln=u16(local+26),le=u16(local+28),begin=local+30+ln+le;
      if(u16(local+6)!==flags||u16(local+8)!==method||begin+compressed>offset||new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(local+30,local+30+ln))!==name)throw new Error('En-têtes MXL incohérents.');
      files.set(name,{method,crc,length,bytes:bytes.slice(begin,begin+compressed)});
    }
    async function extract(name){const f=files.get(name);if(!f)throw new Error('Fichier principal absent de l’archive.');let out;
      if(f.method===0)out=f.bytes;else{
        if(typeof DecompressionStream!=='function')throw new Error('Décompression indisponible : importer le MusicXML décompressé.');
        const reader=new Blob([f.bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let n=0;
        try{while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>f.length||n>CAP){await reader.cancel();throw new Error('Limite de décompression dépassée.')}chunks.push(r.value)}}finally{reader.releaseLock()}
        out=new Uint8Array(n);let o=0;for(const c of chunks){out.set(c,o);o+=c.length}
      }
      if(out.length!==f.length||crc32(out)!==f.crc)throw new Error('Intégrité MXL incorrecte.');return out;
    }
    const manifest=M.xml(decode(await extract('META-INF/container.xml'))),rootfiles=Array.from(manifest.getElementsByTagNameNS('*','rootfile'));if(!rootfiles.length)throw new Error('Fichier racine MXL absent.');const name=safePath(rootfiles[0].getAttribute('full-path'));return{xml:decode(await extract(name)),entry:name,entries:files.size};
  }
  async function load(file){if(!file||typeof file.arrayBuffer!=='function')throw new Error('Sélectionner un fichier MusicXML.');if(file.size>ZIPCAP)throw new Error('Fichier trop volumineux.');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>ZIPCAP)throw new Error('Fichier trop volumineux.');const zipped=bytes[0]===80&&bytes[1]===75,result=zipped?await unzip(bytes):{xml:decode(bytes),entry:null};const score=M.parse(result.xml);score.sourceName=String(file.name||'Partition');if(globalThis.crypto?.subtle)score.sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');score.container={compressed:zipped,entry:result.entry};return score}
  return{load,decode,unzip,crc32,safePath};
});
