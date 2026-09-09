'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeMusicEvents=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const trusted=new WeakSet(),trustedEvents=new WeakSet(),eventArrays=new WeakMap(),LIMITS=Object.freeze({events:100000,seconds:7200,noteSeconds:60,polyphony:64,metadataDepth:64,metadataNodes:1000000});
  function number(value,label,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(label+' invalide');return value}

  const snapshots=new WeakSet();
  function copier(){
    const memo=new WeakMap(),active=new WeakSet(),pending=[];let count=0;
    function copy(value,depth=0){
      if(value===null||typeof value!=='object'){
        if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')throw new Error('Métadonnée non sérialisable.');
        return value;
      }
      if(snapshots.has(value))return value;
      if(active.has(value))throw new Error('Métadonnées cycliques.');
      if(memo.has(value))return memo.get(value);
      if(depth>LIMITS.metadataDepth||++count>LIMITS.metadataNodes)throw new Error('Métadonnées trop volumineuses.');
      const proto=Object.getPrototypeOf(value);
      if(!Array.isArray(value)&&proto!==null&&Object.getPrototypeOf(proto)!==null)throw new Error('Métadonnée non structurée.');
      if(Array.isArray(value)&&value.length>LIMITS.metadataNodes)throw new Error('Tableau de métadonnées trop volumineux.');
      active.add(value);
      const array=Array.isArray(value),result=array?new Array(value.length):{...value};
      memo.set(value,result);pending.push(result);

      if(Object.getOwnPropertySymbols(array?value:result).some(k=>Object.prototype.propertyIsEnumerable.call(array?value:result,k)))throw new Error('Clé symbolique non sérialisable.');
      for(const key of Object.keys(array?value:result)){
        const v=array?value[key]:result[key],type=typeof v;
        if(type==='function'||type==='symbol'||type==='bigint')throw new Error('Métadonnée non sérialisable.');
        const child=v!==null&&type==='object'?copy(v,depth+1):v;
        if(key==='__proto__')Object.defineProperty(result,key,{value:child,enumerable:true,writable:true,configurable:true});else result[key]=child;
      }
      active.delete(value);return result;
    }
    return {copy,seal(){for(let i=pending.length-1;i>=0;i--){Object.freeze(pending[i]);}}};
  }
  function isSilent(e){return e.level===0||e.velocity===0;}

  function normalizeEvent(value){
    if(trustedEvents.has(value))return value;
    if(!value||!['note','spectral','drum'].includes(value.kind))throw new Error('Type d’événement inconnu');
    const e=snapshots.has(value)?{...value}:value;number(e.time,'Position',0,LIMITS.seconds);number(e.duration,'Durée',Number.MIN_VALUE,LIMITS.noteSeconds);
    if(typeof e.instrument!=='string'||!e.instrument||e.instrument.length>80)throw new Error('Instrument absent ou invalide');
    if(e.kind!=='drum'){number(e.pitch,'Hauteur',0,127);e.cents=e.cents===undefined?0:e.cents;number(e.cents,'Altération',-4800,4800);}
    if(e.pitchCurve!==undefined){
      if(e.kind!=='note'||!Array.isArray(e.pitchCurve)||e.pitchCurve.length<2||e.pitchCurve.length>129)throw new Error('Courbe de hauteur invalide');
      let last=-1;
      e.pitchCurve=Object.freeze(e.pitchCurve.map(p=>{
        if(!p||typeof p!=='object')throw new Error('Point de hauteur invalide');
        number(p.t,'Position de courbe',0,1);number(p.semitones,'Intervalle de courbe',-48,48);
        if(p.t<=last)throw new Error('Courbe de hauteur non croissante dans le temps');
        number(e.pitch+e.cents/100+p.semitones,'Hauteur de courbe',0,127);last=p.t;
        return Object.freeze({t:p.t,semitones:p.semitones});
      }));
      if(e.pitchCurve[0].t!==0||e.pitchCurve.at(-1).t!==1)throw new Error('Extrémités de courbe absentes');
    }
    for(const [key,label,min,max]of [['releaseTime','Relâchement',0,1],['brightness','Brillance',0,1],['colorVelocity','Couleur de vélocité',Number.MIN_VALUE,1]])if(e[key]!==undefined){if(e.kind!=='note')throw new Error('Expression réservée aux notes.');number(e[key],label,min,max);}
    if(e.level!==undefined)number(e.level,'Niveau',0,4);if(e.velocity!==undefined)number(e.velocity,'Vélocité',0,1);
    e.role=String(e.role??'target');if(e.role.length>128)throw new Error('Voix invalide');
    return e;
  }
  function event(raw){const capture=copier(),e=normalizeEvent(capture.copy(raw));capture.seal();Object.freeze(e);snapshots.add(e);trustedEvents.add(e);return e;}
  function plan(input){
    if(input&&trusted.has(input))return input;

    const capture=copier(),captured=capture.copy(input);
    if(!captured||!Array.isArray(captured.events)||captured.events.length>LIMITS.events)throw new Error('Liste d’événements invalide');
    const duration=number(captured.duration,'Durée totale',Number.MIN_VALUE,LIMITS.seconds);
    const cached=eventArrays.get(captured.events);
    const events=cached?captured.events:captured.events.map(normalizeEvent).sort((a,b)=>a.time-b.time);
    let peakPolyphony=cached?.peakPolyphony??0;
    if(cached){if(events.length&&events.at(-1).time>=duration+1e-7)throw new Error('Attaque après la fin musicale');}
    else {
      const starts=[],ends=[];
      for(const e of events){
        if(!e)throw new Error('Événement absent');
        if(e.time>=duration+1e-7)throw new Error('Attaque après la fin musicale');
        if(!isSilent(e)){starts.push(e.time);ends.push(e.time+e.duration);}
      }
      ends.sort((a,b)=>a-b);let ended=0;
      for(let i=0;i<starts.length;i++){
        while(ended<ends.length&&ends[ended]<=starts[i])ended++;
        peakPolyphony=Math.max(peakPolyphony,i+1-ended);
      }
      if(peakPolyphony>LIMITS.polyphony)throw new Error('Plus de soixante-quatre voix simultanées.');
    }
    if(captured.markers!==undefined&&!Array.isArray(captured.markers))throw new Error('Repères invalides');
    const markers=[...(captured.markers||[])];
    for(const m of markers){if(!m||typeof m!=='object')throw new Error('Repère absent');number(m.time,'Repère',0,duration);}
    markers.sort((a,b)=>a.time-b.time);
    capture.seal();

    for(const value of Object.values(captured))if(value&&typeof value==='object')snapshots.add(value);
    for(const marker of markers)snapshots.add(marker);
    if(!cached)for(const e of events){if(!snapshots.has(e)){Object.freeze(e);snapshots.add(e);}trustedEvents.add(e);}
    Object.freeze(events);Object.freeze(markers);snapshots.add(events);snapshots.add(markers);eventArrays.set(events,{peakPolyphony});

    const result=Object.freeze({...captured,events,markers,peakPolyphony});
    snapshots.add(result);trusted.add(result);return result;
  }
  function concatenate(inputs){
    if(!Array.isArray(inputs)||!inputs.length)throw new Error('Séquence vide');
    let cursor=0,first;const events=[],markers=[],phases=[],warnings=[];
    for(const [index,input]of inputs.entries()){
      const p=plan(input);if(index===0)first=p;
      markers.push({time:cursor,index,spec:p.spec,phaseBoundary:true});
      phases.push({index,time:cursor,duration:p.duration});
      for(const marker of p.markers){
        const {index:sourceIndex,...rest}=marker;
        markers.push({...rest,time:cursor+marker.time,phaseIndex:index,...(sourceIndex===undefined?{}:{sourceIndex})});
      }
      for(const warning of p.warnings||[])warnings.push('Séquence '+(index+1)+' : '+String(warning));
      for(const e of p.events)events.push({...e,time:e.time+cursor});
      cursor+=p.duration;
      if(cursor>LIMITS.seconds||events.length>LIMITS.events||markers.length>LIMITS.events)throw new Error('Séquence trop longue');
    }
    return plan({events,duration:cursor,markers,phases,spec:first.spec,warnings});
  }
  function voiceKey(e){return e.part!=null?String(e.part)+'|'+(e.staff!=null?'staff:'+String(e.staff)+'|':'')+String(e.voice??e.role):String(e.voice??e.role)}
  function voices(input){const p=plan(input),groups=new Map();for(const e of p.events){if(e.kind==='drum')continue;const key=voiceKey(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}return groups;}
  function curveAt(curve,t){
    for(let i=1;i<curve.length;i++)if(t<=curve[i].t){const a=curve[i-1],b=curve[i];return a.semitones+(b.semitones-a.semitones)*(t-a.t)/(b.t-a.t);}
    return curve.at(-1).semitones;
  }
  function excerpt(input,from,to,attackPartition=false){
    const p=plan(input);number(from,'Début',0,p.duration);number(to,'Fin',Number.MIN_VALUE,p.duration);if(to<=from)throw new Error('Extrait vide');
    const events=[];let reattack=false;
    for(const e of p.events){
      const end=e.time+e.duration;if(e.time>=to-1e-9||end<=from+1e-9)continue;

      if((e.kind==='drum'||attackPartition)&&e.time<from-1e-9)continue;
      const begin=Math.max(e.time,from),until=attackPartition?end:Math.min(end,to),left=begin>e.time+1e-9,right=until<end-1e-9;
      const out={...e,time:Math.max(0,e.time-from),duration:left||right?until-begin:e.duration};
      if(left||right)out.clipped=true;
      if(left)reattack=true;
      if(e.pitchCurve&&(left||right)){
        const a=(begin-e.time)/e.duration,b=(until-e.time)/e.duration;
        out.pitchCurve=[{t:0,semitones:curveAt(e.pitchCurve,a)},...e.pitchCurve.filter(x=>x.t>a&&x.t<b).map(x=>({t:(x.t-a)/(b-a),semitones:x.semitones})),{t:1,semitones:curveAt(e.pitchCurve,b)}];
      }
      events.push(out);
    }
    const markers=p.markers.filter(m=>m.time>=from-1e-9&&m.time<to-1e-9).map(m=>({...m,time:Math.max(0,m.time-from)}));
    const activeScene=p.markers.filter(m=>m.time<=from&&m.spec).at(-1)?.spec??p.spec;
    const phases=(p.phases||[]).filter(x=>x.time<to&&x.time+x.duration>from).map(x=>({...x,time:Math.max(x.time,from)-from,duration:Math.min(x.time+x.duration,to)-Math.max(x.time,from)}));
    const warnings=[...(p.warnings||[])];if(reattack)warnings.push('Extrait commençant dans une tenue : attaque réamorcée, courbe de hauteur conservée.');
    return plan({events,duration:to-from,markers,phases,spec:activeScene,warnings});
  }
  function slice(input,from,to){return excerpt(input,from,to);}

  function partition(input,boundary){const p=plan(input);return [excerpt(p,0,boundary,true),excerpt(p,boundary,p.duration,true)];}
  return Object.freeze({LIMITS,plan,event,isSilent,concatenate,voiceKey,voices,slice,partition});
});
