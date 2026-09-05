'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./audio-timeline.js'):root.EarForgeTimeline,typeof module==='object'&&module.exports?require('./music-events.js'):root.EarForgeMusicEvents);if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeProbeRenderers=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Timeline,Events){
 const VERSION=String(globalThis.EarForgeRelease?.version||'unknown'),clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),mtof=m=>440*Math.pow(2,(m-69)/12);
 function valid(x,a,b,label){if(typeof x!=='number'||!Number.isFinite(x)||x<a||x>b)throw new Error(label+' invalide');return x;}
 class IndependentRenderer{
  constructor(){this.context=null;this.master=null;this.nodes=new Set();this.transport=null;this.epoch=0;this.disposed=false;}
  async ensure(){
   if(this.disposed)throw new Error('Lecteur fermé');
   if(!this.context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw new Error('Web Audio indisponible');this.context=new C({latencyHint:'interactive'});this.master=this.context.createGain();this.master.gain.value=.72;this.master.connect(this.context.destination);}
   const c=this.context;if(c.state!=='running')await c.resume();if(this.disposed||c!==this.context)throw new Error('Lecture annulée');return c;
  }
  track(n){this.nodes.add(n);return n;}
  own(nodes,sources){let pending=sources.length;const remove=()=>{if(--pending>0)return;for(const n of nodes){try{n.disconnect()}catch{}this.nodes.delete(n);}};for(const s of sources)s.onended=remove;}
  voice(midi,start,duration=.34,level=.55,dest=null,carrierVariant=0){
   const c=this.context,nodes=[],make=method=>{const n=this.track(c[method]());nodes.push(n);return n;},g=make('createGain'),f=make('createBiquadFilter'),hz=mtof(midi),end=start+duration,v=Math.abs(Math.floor(carrierVariant))%3,types=[['triangle','sine','square'],['sine','triangle','sawtooth'],['square','sine','triangle']][v],ratios=[[1,2.003,3.997],[1,1.501,2.997],[1,2.497,4.011]][v],sources=[];
   f.type='lowpass';f.frequency.value=Math.min(c.sampleRate*.43,6800,hz*(10+v*2));g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(level,start+Math.min(.012,duration*.3));g.gain.exponentialRampToValueAtTime(.0001,end+.07);f.connect(g).connect(dest||this.master);
   for(let i=0;i<3;i++){if(hz*ratios[i]>=c.sampleRate*.47)continue;const o=make('createOscillator');o.type=types[i];o.frequency.value=hz*ratios[i];o.connect(f);o.start(start);o.stop(end+.09);sources.push(o);}
   if(dest)nodes.push(dest);this.own(nodes,sources);return end+.09;
  }
  spatialVoice(midi,azimuth,start,duration=.38,level=.42,carrierVariant=0){
   const c=this.context,p=this.track(c.createPanner()),rad=azimuth*Math.PI/180;p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1;p.maxDistance=8;p.rolloffFactor=.25;const x=Math.sin(rad),z=-Math.cos(rad);if(p.positionX){p.positionX.setValueAtTime(x,start);p.positionY.setValueAtTime(0,start);p.positionZ.setValueAtTime(z,start);}else p.setPosition(x,0,z);p.connect(this.master);return this.voice(midi,start,duration,level,p,carrierVariant);
  }
  click(frequency,start){const c=this.context,o=this.track(c.createOscillator()),g=this.track(c.createGain());o.type='square';o.frequency.value=frequency;g.gain.setValueAtTime(.0001,start);g.gain.linearRampToValueAtTime(.34,start+.002);g.gain.exponentialRampToValueAtTime(.0001,start+.035);o.connect(g).connect(this.master);o.start(start);o.stop(start+.04);this.own([o,g],[o]);return start+.04;}
  release(){for(const n of this.nodes){try{n.stop?.()}catch{}try{n.disconnect?.()}catch{}}this.nodes.clear();}
  async play(plan){
   plan=Events.plan(plan);const band=c=>{if(c&&plan.events.some(e=>e.kind==='note'&&mtof(e.pitch)>=c.sampleRate*.47))throw new Error('Hauteur au-delà de la bande de restitution');};band(this.context);this.stop();const epoch=this.epoch,c=await this.ensure();if(epoch!==this.epoch)throw new Error('Lecture annulée');band(c);
   const transport=new Timeline.Transport(c,{render:(e,at)=>e.kind==='drum'?this.click(e.frequency,at):e.azimuth==null?this.voice(e.pitch,at,e.duration,e.level,null,e.carrierVariant):this.spatialVoice(e.pitch,e.azimuth,at,e.duration,e.level,e.carrierVariant),onEnd:r=>{if(r.status!=='ended')this.release();}});
   this.transport=transport;const result=transport.start(plan,{anchor:c.currentTime+.12});result.startPerformanceMs=performance.now()+(result.start-c.currentTime)*1000;result.clockMapping='sampled-currentTime';return result;
  }
  async wait(play){const r=await play.done;return r.status==='ended';}
  async playDirection({direction='up',root=60,interval=4,gap=.10}={}){
   if(!['up','down','same'].includes(direction))throw new Error('Direction invalide');valid(root,0,127,'Note');valid(interval,0,24,'Intervalle');valid(gap,0,5,'Pause');const delta=direction==='down'?-interval:direction==='same'?0:interval,d=.32,p=await this.play({duration:2*d+gap,events:[root,root+delta].map((pitch,i)=>({kind:'note',pitch,time:i*(d+gap),duration:d,level:.54,instrument:'independent',carrierVariant:0}))});return Object.assign(p,{renderer:'independent-v1',direction,root,interval,independentProfiles:true});
  }
  async playSpatialTrial({separationDeg=8,mutationPresent=true,root=60,carrierVariant=0,centerAzimuth=0}={}){
   valid(separationDeg,0,130,'Séparation');valid(root,0,114,'Note');valid(carrierVariant,0,1024,'Variante');valid(centerAzimuth,-48,48,'Position');if(typeof mutationPresent!=='boolean')throw new Error('Changement invalide');const d=.28,g=.07,a=separationDeg/2,c0=centerAzimuth,positions=[c0-a,c0-a/3,c0+a/3,c0+a].map(x=>clamp(x,-65,65)),notes=[root,root+4,root+7,root+12],levels=[.34,.28,.30,.32],events=[];
   for(let part=0;part<2;part++)for(let i=0;i<4;i++)events.push({kind:'note',pitch:notes[i]+(part&&mutationPresent&&i===2?1:0),time:part*(d+g),duration:d,level:levels[i],azimuth:positions[i],carrierVariant:(carrierVariant+i)%3,instrument:'independent'});
   const p=await this.play({events,duration:2*d+g});return Object.assign(p,{renderer:'hrtf-v3',panningModel:'HRTF',voiceCount:4,targetVoice:2,separationDeg,mutationPresent,carrierVariant,centerAzimuth:c0,azimuths:positions,visualRequired:false});
  }
  async playClicks(timesMs,{frequency=1350,tailMs=80}={}){
   valid(frequency,40,8000,'Fréquence');valid(tailMs,40,2000,'Fin');if(!Array.isArray(timesMs)||!timesMs.length||timesMs.length>100000)throw new Error('Pulsations absentes ou trop nombreuses');timesMs.forEach((t,i)=>{valid(t,0,7198000,'Position');if(i&&t<=timesMs[i-1])throw new Error('Pulsations non croissantes');});
   const p=await this.play({events:timesMs.map(ms=>({kind:'drum',instrument:'click',frequency,time:ms/1000,duration:.04,velocity:.84})),duration:(timesMs.at(-1)+tailMs)/1000});return Object.assign(p,{renderer:'probe-click-v1'});
  }
  stop(){this.epoch++;this.transport?.cancel();this.transport=null;this.release();}
  dispose(){this.disposed=true;this.stop();const c=this.context;try{this.master?.disconnect()}catch{}this.context=null;this.master=null;try{const p=c?.close?.();p?.catch?.(()=>{});}catch{}}
 }
 return Object.freeze({VERSION,IndependentRenderer,contract:Object.freeze({schema:'earforge.probe_renderer.v2',independentFromEarForgeAudio:true,profileReuse:false,sharedTransport:true,externalRecordingEquivalent:false,hrtf:true,visualRequired:false})});
});
