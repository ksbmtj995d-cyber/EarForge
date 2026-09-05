'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeMusicEvents=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const trusted=new WeakSet(),LIMITS=Object.freeze({events:100000,seconds:7200,noteSeconds:60,polyphony:64});
  function number(value,label,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(label+' invalide');return value}
  function event(raw){
    if(!raw||!['note','spectral','drum'].includes(raw.kind))throw new Error('Type d’événement inconnu');
    const e={...raw};number(e.time,'Position',0,LIMITS.seconds);number(e.duration,'Durée',Number.MIN_VALUE,LIMITS.noteSeconds);
    if(typeof e.instrument!=='string'||!e.instrument||e.instrument.length>80)throw new Error('Instrument absent ou invalide');
    if(e.kind!=='drum'){number(e.pitch,'Hauteur',0,127);e.cents=e.cents===undefined?0:e.cents;number(e.cents,'Altération',-4800,4800);}
    if(e.level!==undefined)number(e.level,'Niveau',0,4);if(e.velocity!==undefined)number(e.velocity,'Vélocité',0,1);
    e.role=String(e.role??'target');if(e.role.length>128)throw new Error('Voix invalide');
    if(e.source&&typeof e.source==='object')e.source=Object.freeze({...e.source});
    if(e.spectral&&typeof e.spectral==='object')e.spectral=Object.freeze({...e.spectral});
    return Object.freeze(e);
  }
  function plan(input){
    if(input&&trusted.has(input))return input;
    if(!input||!Array.isArray(input.events)||input.events.length>LIMITS.events)throw new Error('Liste d’événements invalide');
    number(input.duration,'Durée totale',Number.MIN_VALUE,LIMITS.seconds);
    const events=input.events.map(event).sort((a,b)=>a.time-b.time),sweep=[];
    for(const e of events){if(e.time>=input.duration+1e-7)throw new Error('Attaque après la fin musicale');sweep.push([e.time,1],[e.time+e.duration,-1]);}
    sweep.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,peakPolyphony=0;for(const [,delta]of sweep){active+=delta;peakPolyphony=Math.max(peakPolyphony,active);}
    if(peakPolyphony>LIMITS.polyphony)throw new Error('Plus de soixante-quatre voix simultanées.');
    if(input.markers!==undefined&&!Array.isArray(input.markers))throw new Error('Repères invalides');
    const markers=(input.markers||[]).map(m=>{number(m.time,'Repère',0,input.duration);return Object.freeze({...m})}).sort((a,b)=>a.time-b.time);
    const result=Object.freeze({...input,events:Object.freeze(events),markers:Object.freeze(markers),peakPolyphony});trusted.add(result);return result;
  }
  function concatenate(inputs){
    if(!Array.isArray(inputs)||!inputs.length)throw new Error('Séquence vide');let cursor=0;const events=[],markers=[],phases=[];
    for(const [index,input]of inputs.entries()){const p=plan(input);markers.push({time:cursor,index,spec:p.spec});phases.push(Object.freeze({index,time:cursor,duration:p.duration}));for(const e of p.events)events.push({...e,time:e.time+cursor});cursor+=p.duration;if(cursor>LIMITS.seconds||events.length>LIMITS.events)throw new Error('Séquence trop longue');}
    return plan({events,duration:cursor,markers,phases:Object.freeze(phases)});
  }
  function voiceKey(e){return e.part!=null?String(e.part)+'|'+(e.staff!=null?'staff:'+String(e.staff)+'|':'')+String(e.voice??e.role):String(e.voice??e.role)}
  function voices(input){const p=plan(input),groups=new Map();for(const e of p.events){if(e.kind==='drum')continue;const key=voiceKey(e);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}return groups;}
  function slice(input,from,to){const p=plan(input);number(from,'Début',0,p.duration);number(to,'Fin',Number.MIN_VALUE,p.duration);if(to<=from)throw new Error('Extrait vide');return plan({events:p.events.filter(e=>e.time>=from-1e-9&&e.time<to-1e-9).map(e=>({...e,time:Math.max(0,e.time-from)})),duration:to-from,markers:[]});}
  return Object.freeze({LIMITS,plan,event,concatenate,voiceKey,voices,slice});
});
