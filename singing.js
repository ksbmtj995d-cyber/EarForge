'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeSinging=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const REVISION=1, MAX_NOTES=24, MAX_ROWS=240;
 const median=a=>{const x=[...a].sort((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:NaN;};
 const midi=f=>69+12*Math.log2(f/440);
 const finiteNote=n=>Number.isFinite(n)&&n>=36&&n<=84;
 const observedNote=n=>Number.isFinite(n)&&n>=35.5&&n<=84.5;
 function capability(unit){const p=unit?.params||{};return unit?.kind==='direction'||(unit?.kind==='interval'&&p.mode!=='harm')||unit?.kind==='scale'||unit?.kind==='chord'||unit?.kind==='melody';}
 function range(raw={}){let low=Math.round(Number(raw.low)),high=Math.round(Number(raw.high));if(!finiteNote(low)||!finiteNote(high)||high-low<5)return{low:48,high:72};return{low,high};}
 function targetFor(unit,spec,settings={}){
  if(!capability(unit))return null;

  let notes=unit.kind==='melody'?spec?.values:spec?.notes;
  if(!Array.isArray(notes)||!notes.length||notes.length>MAX_NOTES||!notes.every(n=>Number.isFinite(n)))return null;
  notes=[...notes];if(unit.kind==='direction'&&unit.params.answer==='same')notes=notes.slice(0,1);
  if(unit.kind!=='chord'&&spec?.mode==='harmonic')return null;
  const {low,high}=range(settings),span=Math.max(...notes)-Math.min(...notes);if(span>high-low)return null;
  const positions=Math.floor(high-low-span)+1,start=low+((Number(spec.seed)>>>0)%positions),shift=start-Math.min(...notes);
  notes=notes.map(n=>n+shift);if(notes.some(n=>!finiteNote(n)||n<low||n>high))return null;
  return{schema:'earforge.singing_target.v1',revision:REVISION,unitId:unit.id,notes,low,high,toleranceCents:50,octavePolicy:'one_global_octave',rhythmEvaluated:false};
 }
 function validTarget(t){return t?.schema==='earforge.singing_target.v1'&&t.revision===REVISION&&typeof t.unitId==='string'&&Array.isArray(t.notes)&&t.notes.length>0&&t.notes.length<=MAX_NOTES&&t.notes.every(n=>finiteNote(n)&&Number.isInteger(n))&&finiteNote(t.low)&&finiteNote(t.high)&&t.high-t.low>=5&&t.notes.every(n=>n>=t.low&&n<=t.high)&&t.toleranceCents===50&&t.octavePolicy==='one_global_octave'&&t.rhythmEvaluated===false;}
 function guide(t,seed=0){if(!validTarget(t))throw new Error('Cible de chant invalide');const events=t.notes.map((n,i)=>({notes:[n],onsetTicks:i*960,durationTicks:640,velocity:.72,gate:1,articulation:'normal',role:'target',timbre:'piano',cents:0}));return{kind:'notes',notes:[...t.notes],mode:'melodic',timbre:'piano',duration:.52,gap:.23,seed,score:{ppq:960,tempo:80,events,endTicks:events.length*960},roomScene:'studio',roomWet:0,effectScene:'clean'};}
 function evaluate(target,observation){
  if(!validTarget(target))throw new Error('Cible de chant invalide');
  const rows=observation?.notes;
  const unknown=reason=>({schema:'earforge.singing_result.v1',revision:REVISION,evaluable:false,correct:null,reason});
  if(['frames','voicedFrames','clippedFrames','invalidFrames','unreliableFrames'].some(k=>observation?.[k]!==undefined&&(!Number.isInteger(observation[k])||observation[k]<0||observation[k]>2000)))return unknown('invalid_observation');
  if(observation?.interrupted)return unknown('interrupted');
  if(observation?.overflow)return unknown('too_long');
  if((observation?.clippedFrames||0)>2||(observation?.invalidFrames||0)>0||(observation?.unreliableFrames||0)>Math.max(8,.35*((observation?.voicedFrames||0)+(observation?.unreliableFrames||0))))return unknown('unreliable_audio');
  if(!Array.isArray(rows)||!rows.length)return unknown('no_stable_pitch');
  if(rows.length>MAX_NOTES+8||rows.some(r=>!observedNote(r.midi)||!Number.isFinite(r.duration)||r.duration<.16||r.duration>45||!Number.isFinite(r.clarity)||r.clarity<.9||r.clarity>1))return unknown('invalid_observation');
  const offset=Math.round((rows[0].midi-target.notes[0])/12)*12;
  const errors=rows.map((r,i)=>i<target.notes.length?(r.midi-target.notes[i]-offset)*100:null);
  const correct=rows.length===target.notes.length&&errors.every(e=>Math.abs(e)<=50);
  return{schema:'earforge.singing_result.v1',revision:REVISION,evaluable:true,correct,reason:rows.length!==target.notes.length?'note_count':correct?'matched':'pitch',expected:target.notes.length,observed:rows.length,octaveOffset:offset,errorsCents:errors};
 }

 function fft(re,im,inverse){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len*=2){const angle=(inverse?2:-2)*Math.PI/len,wr=Math.cos(angle),wi=Math.sin(angle);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,tr=re[b]*ur-im[b]*ui,ti=re[b]*ui+im[b]*ur;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const r=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=r;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
 class Detector{
  constructor(size=4096){if(!Number.isInteger(size)||size<512||size>8192||(size&(size-1)))throw new Error('Taille de trame invalide');this.size=size;this.re=new Float64Array(size*2);this.im=new Float64Array(size*2);this.energy=new Float64Array(size+1);this.nsdf=new Float64Array(size);}
  detect(input,sampleRate){
   const n=this.size;if(input.length!==n||!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('Trame audio invalide');
   let mean=0,clipped=0;for(let i=0;i<n;i++){const x=input[i];if(!Number.isFinite(x))return{frequency:0,clarity:0,rms:0,reason:'invalid'};mean+=x;if(Math.abs(x)>=.98)clipped++;}mean/=n;
   const {re,im,energy,nsdf}=this;re.fill(0);im.fill(0);energy[0]=0;for(let i=0;i<n;i++){re[i]=input[i]-mean;energy[i+1]=energy[i]+re[i]*re[i];}
   const rms=Math.sqrt(energy[n]/n),empty=reason=>({frequency:0,clarity:0,rms,reason});if(rms<.008)return empty('silence');let recentEnergy=0,recentSum=0;const recent=Math.min(n,Math.ceil(sampleRate*.025));for(let i=n-recent;i<n;i++){recentSum+=input[i];recentEnergy+=input[i]**2;}if(Math.sqrt(Math.max(0,recentEnergy/recent-(recentSum/recent)**2))<.008)return empty('silence');if(clipped>n*.01)return empty('clipped');
   fft(re,im,false);for(let i=0;i<re.length;i++){re[i]=re[i]*re[i]+im[i]*im[i];im[i]=0;}fft(re,im,true);
   const maxLag=Math.min(n/2-1,Math.ceil(sampleRate/60)+1),minLag=Math.max(2,Math.floor(sampleRate/1100)-1);for(let lag=0;lag<=maxLag+1;lag++){const denominator=energy[n-lag]+energy[n]-energy[lag];nsdf[lag]=denominator>0?2*re[lag]/denominator:0;}
   const peaks=[];let positive=false,best=-1;for(let i=1;i<=maxLag;i++){if(nsdf[i]<=0){if(positive&&best>=minLag)peaks.push(best);positive=false;best=-1;}else if(nsdf[i-1]<=0){positive=true;best=i;}else if(positive&&(best<0||nsdf[i]>nsdf[best]))best=i;}
   if(positive&&best>=minLag&&best<maxLag&&nsdf[best]>nsdf[best+1])peaks.push(best);
   if(!peaks.length)return empty('aperiodic');const maximum=Math.max(...peaks.map(i=>nsdf[i]));if(maximum<.9)return empty('aperiodic');const at=peaks.find(i=>nsdf[i]>=Math.max(.9,maximum*.93));if(at===undefined)return empty('aperiodic');
   const y0=nsdf[at-1],y1=nsdf[at],y2=nsdf[at+1],d=y0-2*y1+y2,delta=d?(y0-y2)/(2*d):0,lag=at+Math.max(-.5,Math.min(.5,delta)),frequency=sampleRate/lag;
   if(frequency<60||frequency>1100)return empty('range');return{frequency,clarity:Math.min(1,y1),rms,reason:'voiced'};
  }
 }
 class Segmenter{
  constructor(){this.notes=[];this.pending=[];this.current=null;this.lastTime=-Infinity;this.silentSince=null;this.frames=0;this.voiced=0;this.clipped=0;this.invalid=0;this.unreliable=0;this.overflow=false;}
  flush(){const c=this.current;if(c&&c.end-c.start>=.16&&c.values.length>=4)this.notes.push({midi:median(c.values),duration:c.end-c.start,clarity:Math.min(...c.clarities)});this.current=null;if(this.notes.length>MAX_NOTES+8)this.overflow=true;}
  push(frame,time){
   if(!Number.isFinite(time)||time<=this.lastTime)return;const gap=time-this.lastTime;this.lastTime=time;if(gap>.25){this.flush();this.pending=[];}this.frames++;if(frame?.reason==='clipped')this.clipped++;if(frame?.reason==='invalid')this.invalid++;if(['aperiodic','clipped','range'].includes(frame?.reason))this.unreliable++;
   const note=frame?.frequency>0&&frame.clarity>=.9?midi(frame.frequency):NaN;
   if(!observedNote(note)){this.pending=[];if(this.silentSince===null)this.silentSince=time;if(time-this.silentSince>=.10-1e-9)this.flush();return;}this.voiced++;this.silentSince=null;
   if(this.current&&Math.abs(note-median(this.current.values.slice(-7)))<=.65){this.current.values.push(note);this.current.clarities.push(frame.clarity);this.current.end=time;this.pending=[];return;}
   if(this.pending.length&&Math.abs(note-median(this.pending.map(x=>x.note)))>.55)this.pending=[];
   this.pending.push({note,time,clarity:frame.clarity});if(this.pending.length>=4&&time-this.pending[0].time>=.12){this.flush();this.current={start:this.pending[0].time,end:time,values:this.pending.map(x=>x.note),clarities:this.pending.map(x=>x.clarity)};this.pending=[];}
  }
  finish(){this.flush();return{notes:this.notes.map(x=>({...x})),schema:'earforge.singing_observation.v1',frames:this.frames,voicedFrames:this.voiced,clippedFrames:this.clipped,invalidFrames:this.invalid,unreliableFrames:this.unreliable,overflow:this.overflow};}
 }
 function cleanRow(row,catalog){if(!row||typeof row.id!=='string'||!/^sing:[A-Za-z0-9:._-]{1,160}$/.test(row.id)||!Number.isFinite(row.time)||row.time<0||!capability(catalog?.byId?.[row.unitId])||row.revision!==REVISION||!validTarget(row.target)||row.target.unitId!==row.unitId)return null;const result=evaluate(row.target,row.observation);if(!result.evaluable)return null;return{id:row.id,time:row.time,unitId:row.unitId,revision:REVISION,target:{schema:row.target.schema,revision:REVISION,unitId:row.unitId,notes:[...row.target.notes],low:row.target.low,high:row.target.high,toleranceCents:50,octavePolicy:'one_global_octave',rhythmEvaluated:false},observation:{schema:'earforge.singing_observation.v1',...Object.fromEntries(['frames','voicedFrames','clippedFrames','invalidFrames','unreliableFrames'].map(k=>[k,Math.max(0,Math.min(2000,Math.round(Number(row.observation[k])||0)))])),notes:row.observation.notes.map(r=>({midi:r.midi,duration:r.duration,clarity:r.clarity}))},result};}
 function sanitizeRows(rows,catalog){const seen=new Set();return(Array.isArray(rows)?rows:[]).slice(-MAX_ROWS).map(x=>cleanRow(x,catalog)).filter(x=>x&&!seen.has(x.id)&&seen.add(x.id));}
 function record(state,catalog,target,observation,id,time=Date.now()){const row=cleanRow({id,time,unitId:target?.unitId,revision:REVISION,target,observation},catalog);if(!row)return null;const old=state.singingAttempts||[];if(old.some(x=>x.id===id))return null;state.singingAttempts=[...old,row].slice(-MAX_ROWS);return row;}
 return{REVISION,MAX_NOTES,MAX_ROWS,capability,range,targetFor,guide,evaluate,Detector,Segmenter,sanitizeRows,record};
});
