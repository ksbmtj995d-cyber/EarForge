'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeStorage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const DB_NAME='earforge.history.v1',STORE='events',DB_VERSION=1,RECENT={attempt:24,session:8,performance:16,placement:8},MAX_ROW_BYTES=1048576;
 function stable(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return'['+value.map(stable).join(',')+']';return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';}
 function hash(value){let h=2166136261>>>0,s=typeof value==='string'?value:stable(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
 function cleanTime(v){const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n):0;}
 function eventId(type,row){const time=cleanTime(row?.time??row?.created??row?.due);return`${type}:${time.toString(36)}:${hash(row)}`;}
 function record(type,row){if(!row||typeof row!=='object')return null;const data=JSON.parse(JSON.stringify(row)),time=cleanTime(data.time??data.created??data.due);return{id:eventId(type,data),type,time,data};}
 function recordsFromState(state,{recent=false}={}){const out=[],push=(type,rows,limit)=>{const a=Array.isArray(rows)?rows:[],use=recent?a.slice(-limit):a;for(const row of use){const r=record(type,row);if(r)out.push(r);}};push('attempt',state?.attempts,RECENT.attempt);push('session',state?.sessions,RECENT.session);push('performance',state?.performance,RECENT.performance);push('placement',state?.placement?.history,RECENT.placement);return out;}
 function normalizeRecords(rows){const by=new Map();for(const raw of Array.isArray(rows)?rows:[]){const r=raw?.id&&raw?.type&&raw?.data?{id:String(raw.id),type:String(raw.type),time:cleanTime(raw.time),data:JSON.parse(JSON.stringify(raw.data))}:record(raw?.type||'event',raw?.data||raw);if(r)by.set(r.id,r);}return[...by.values()].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));}
 async function streamBytes(stream,limit){const reader=stream.getReader(),chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Historique décompressé hors limites');}chunks.push(value);}}finally{reader.releaseLock();}const all=new Uint8Array(size);let at=0;for(const part of chunks){all.set(part,at);at+=part.byteLength;}return all;}
 async function encodeRecord(row){const raw=new TextEncoder().encode(JSON.stringify(row.data));if(raw.byteLength>MAX_ROW_BYTES)throw new Error('Événement d’historique trop volumineux');if(raw.byteLength<768||typeof CompressionStream!=='function')return row;
  const bytes=await streamBytes(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip')),MAX_ROW_BYTES+4096);
  if(bytes.byteLength+96>=raw.byteLength)return row;return{id:row.id,type:row.type,time:row.time,codec:'gzip-json-v1',rawBytes:raw.byteLength,payload:bytes};
 }
 async function decodeRecord(row){if(row?.data&&typeof row.data==='object')return normalizeRecords([row])[0];
  if(row?.codec!=='gzip-json-v1'||!Number.isInteger(row.rawBytes)||row.rawBytes<1||row.rawBytes>MAX_ROW_BYTES||!(row.payload instanceof Uint8Array)||row.payload.byteLength>MAX_ROW_BYTES+4096)throw new Error('Événement d’historique illisible');
  if(typeof DecompressionStream!=='function')throw new Error('Décompression de l’historique indisponible');
  const raw=await streamBytes(new Blob([row.payload]).stream().pipeThrough(new DecompressionStream('gzip')),row.rawBytes);if(raw.byteLength!==row.rawBytes)throw new Error('Historique tronqué');const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(!data||typeof data!=='object')throw new Error('Données d’historique invalides');return normalizeRecords([{id:row.id,type:row.type,time:row.time,data}])[0];
 }
 class HistoryQueue{
  constructor(){this.recentIds=new Set();this.syncQueue=Promise.resolve();this.retryRows=new Map();this.pendingOperations=0;this.lastError=null;}
  enqueue(work){this.pendingOperations++;const next=this.syncQueue.then(work,work);this.syncQueue=next.then(()=>{this.pendingOperations--;},error=>{this.pendingOperations--;this.lastError=String(error?.message||error);});return next;}
  async persist(rows){const next=new Map(this.retryRows);for(const row of rows)next.set(row.id,row);if(!next.size)return 0;try{const n=await this.writeRows([...next.values()]);this.retryRows.clear();this.lastError=null;return n;}catch(error){this.retryRows=next;throw error;}}
  async putMany(rows){if(!Array.isArray(rows))throw new Error('Historique invalide');const clean=normalizeRecords(rows);return this.enqueue(()=>this.persist(clean));}
  async bootstrap(state){const all=recordsFromState(state),recent=recordsFromState(state,{recent:true});return this.enqueue(async()=>{const n=await this.persist(all);this.recentIds=new Set(recent.map(r=>r.id));return n;});}
  async syncRecent(state){const rows=recordsFromState(state,{recent:true});return this.enqueue(async()=>{const fresh=rows.filter(r=>!this.recentIds.has(r.id)),n=await this.persist(fresh);this.recentIds=new Set(rows.map(r=>r.id));return n;});}
  async count(){return this.enqueue(()=>this.countRows());}
  async exportAll(){return this.enqueue(async()=>{await this.persist([]);return this.readRows();});}
  async replaceAll(rows){if(!Array.isArray(rows))throw new Error('Historique invalide');const clean=normalizeRecords(rows);return this.enqueue(async()=>{const n=await this.replaceRows(clean);this.recentIds.clear();this.retryRows.clear();this.lastError=null;return n;});}
  clear(){return this.replaceAll([]);}
 }
 class MemoryHistoryStore extends HistoryQueue{
  constructor(){super();this.map=new Map();this.available=true;this.durable=false;this.backend='memory';}
  async open(){return this;}
  async writeRows(rows){for(const r of rows)this.map.set(r.id,r);return rows.length;}
  async countRows(){return this.map.size;}
  async readRows(){return normalizeRecords([...this.map.values()]);}
  async replaceRows(rows){this.map=new Map(rows.map(r=>[r.id,r]));return this.map.size;}
  async status(){const count=await this.count();return{available:true,durable:false,backend:this.backend,count,persistenceSupported:false,persisted:false,usage:null,quota:null,pendingOperations:this.pendingOperations,unsavedRecords:this.retryRows.size,lastError:this.lastError};}
  async requestPersistence(){return{supported:false,persisted:false};}
 }
 class NullHistoryStore{
  constructor(){this.available=false;this.durable=false;this.backend='none';}async open(){return this;}async bootstrap(){return 0;}async syncRecent(){return 0;}async count(){return 0;}async exportAll(){return[];}async replaceAll(){return 0;}async clear(){}async status(){return{available:false,durable:false,backend:'none',count:0,persistenceSupported:false,persisted:false,usage:null,quota:null};}async requestPersistence(){return{supported:false,persisted:false};}
 }
 class IndexedHistoryStore extends HistoryQueue{
  constructor(idb,indexedNavigator){super();this.idb=idb;this.nav=indexedNavigator||null;this.dbPromise=null;this.available=true;this.durable=true;this.backend='indexeddb';}
  open(){if(this.dbPromise)return this.dbPromise;let pending;pending=new Promise((resolve,reject)=>{let req,settled=false;const fail=e=>{settled=true;if(this.dbPromise===pending)this.dbPromise=null;reject(e);};try{req=this.idb.open(DB_NAME,DB_VERSION);}catch(e){fail(e);return;}req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('type_time',['type','time'],{unique:false});}};req.onsuccess=()=>{const db=req.result;if(settled){db.close();return;}settled=true;db.onversionchange=()=>{db.close();if(this.dbPromise===pending)this.dbPromise=null;};resolve(db);};req.onerror=()=>fail(req.error||new Error('IndexedDB indisponible'));req.onblocked=()=>fail(new Error('IndexedDB bloquée'));});this.dbPromise=pending;pending.catch(()=>{if(this.dbPromise===pending)this.dbPromise=null;});return pending;}
  async transaction(mode,fn){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),s=tx.objectStore(STORE);let result;tx.oncomplete=()=>resolve(typeof result==='function'?result():result);tx.onerror=()=>reject(tx.error||new Error('Archive locale indisponible'));tx.onabort=()=>reject(tx.error||new Error('Archive locale annulée'));try{result=fn(s,tx);}catch(e){try{tx.abort();}catch{}reject(e);}});}
  async prepared(rows){const encoded=[];for(const r of rows)encoded.push(await encodeRecord(r));return encoded;}
  async writeRows(rows){const encoded=await this.prepared(rows);if(!encoded.length)return 0;await this.transaction('readwrite',s=>{for(const r of encoded)s.put(r);});return rows.length;}
  async countRows(){return this.transaction('readonly',s=>{const request=s.count();return()=>request.result;});}
  async readRows(){const raw=await this.transaction('readonly',s=>{const request=s.getAll();return()=>request.result;});const decoded=[];for(const r of raw)decoded.push(await decodeRecord(r));return normalizeRecords(decoded);}
  async replaceRows(rows){const encoded=await this.prepared(rows);await this.transaction('readwrite',s=>{s.clear();for(const r of encoded)s.put(r);});return rows.length;}
  async status(){let count=null,usage=null,quota=null,persisted=false;try{count=await this.count();}catch{}try{const e=await this.nav?.storage?.estimate?.();usage=Number.isFinite(e?.usage)?e.usage:null;quota=Number.isFinite(e?.quota)?e.quota:null;}catch{}try{persisted=Boolean(await this.nav?.storage?.persisted?.());}catch{}return{available:true,durable:true,backend:this.backend,count,persistenceSupported:typeof this.nav?.storage?.persist==='function',persisted,usage,quota,pendingOperations:this.pendingOperations,unsavedRecords:this.retryRows.size,lastError:this.lastError};}
  async requestPersistence(){if(typeof this.nav?.storage?.persist!=='function')return{supported:false,persisted:false};try{return{supported:true,persisted:Boolean(await this.nav.storage.persist())};}catch{return{supported:true,persisted:false};}}
 }
 function storageCapabilities(scope=typeof globalThis!=='undefined'?globalThis:{}){const nav=scope.navigator;return{indexedDB:Boolean(scope.indexedDB),estimate:typeof nav?.storage?.estimate==='function',persist:typeof nav?.storage?.persist==='function'};}
 function createHistoryStore(scope=typeof globalThis!=='undefined'?globalThis:{}){return scope.indexedDB?new IndexedHistoryStore(scope.indexedDB,scope.navigator):new NullHistoryStore();}
 return{DB_NAME,STORE,RECENT,eventId,record,recordsFromState,normalizeRecords,encodeRecord,decodeRecord,MAX_ROW_BYTES,MemoryHistoryStore,IndexedHistoryStore,NullHistoryStore,storageCapabilities,createHistoryStore};
});
