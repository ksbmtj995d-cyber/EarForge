'use strict';
(function(root,factory){const api=factory(root.EarForgeScoreModel||(typeof require==='function'?require('./score-model.js'):null),root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null),root.EarForgeInstruments||(typeof require==='function'?require('./instruments.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeScorePlayer=api})(typeof globalThis!=='undefined'?globalThis:this,function(M,Events,Instruments){
  const instruments=Instruments.ids;
  function instrumentFor(part,id){const x=part.instruments.find(i=>i.id===id)||part.instruments[0];return Instruments.fromProgram(x?.program)}
  const drumMap={35:'kick',36:'kick',37:'rim',38:'snare',39:'clap',40:'snare',41:'tomLow',42:'hatClosed',43:'tomLow',44:'hatClosed',45:'tomMid',46:'hatOpen',47:'tomMid',48:'tomHigh',49:'crash',50:'tomHigh',51:'ride',53:'ride',54:'tambourine',56:'cowbell',59:'ride',76:'woodblock',77:'woodblock'};
  function compile(score,options={}){
    if(!score.validation.ok)throw new Error('La structure musicale n’a pas passé la validation.');const from=options.from??0,to=options.to??score.measures.length-1;
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>=score.measures.length)throw new Error('Sélection de mesures invalide.');
    const starts=['0/1'];for(const m of score.measures)starts.push(M.add(starts.at(-1),m.duration));
    const selected=score.E.filter(e=>(!options.part||e.part===options.part)&&(!options.voice||e.voice===options.voice)),inside=e=>e.measure>=from&&e.measure<=to;
    if(selected.some(e=>inside(e)&&!e.valid)||score.measures.slice(from,to+1).some(m=>!m.timingValid))throw new Error('Lecture refusée : positions ou durées indéterminées dans la sélection.');
    const warnings=[],tempoMap=new Map();let rate=options.tempo==null?null:Number(options.tempo),fallback=Number(options.fallbackTempo||80);
    if(rate!==null&&(!Number.isFinite(rate)||rate<10||rate>600))throw new Error('Tempo d’écoute entre dix et six cents.');if(!Number.isFinite(fallback)||fallback<10||fallback>600)throw new Error('Tempo de repli invalide.');
    for(const s of score.S.filter(s=>s.kind==='tempo').sort((a,b)=>a.from.measure-b.from.measure||M.cmp(a.from.t,b.from.t)||a.order-b.order)){const t=M.add(starts[s.from.measure],s.from.t),b=M.num(s.value.bpm);if(rate===null&&(b<10||b>600))throw new Error('Tempo du fichier hors plage de lecture ; choisir un tempo d’écoute.');if(tempoMap.has(t)&&tempoMap.get(t)!==b){if(rate===null)throw new Error('Tempos simultanés contradictoires : choisir un tempo d’écoute.');warnings.push('Tempos du fichier remplacés par le tempo d’écoute.')}tempoMap.set(t,b)}
    if(!tempoMap.size&&rate===null)warnings.push('Tempo absent : noire à '+fallback+' choisie uniquement pour l’écoute.');
    const changes=rate===null?[...tempoMap].map(([t,bpm])=>({beat:M.num(t),bpm})).sort((a,b)=>a.beat-b.beat):[];const segments=[{beat:0,bpm:rate||fallback,sec:0}];
    for(const c of changes){const prev=segments.at(-1);if(c.beat===prev.beat)prev.bpm=c.bpm;else segments.push({...c,sec:prev.sec+(c.beat-prev.beat)*60/prev.bpm})}
    function seconds(q){const beat=M.num(q);let lo=0,hi=segments.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(segments[mid].beat<=beat)lo=mid;else hi=mid}const s=segments[lo];return s.sec+(beat-s.beat)*60/s.bpm}
    const begin=starts[from],end=starts[to+1],offset=seconds(begin),duration=seconds(end)-offset,timeline=[];if(duration>7200)throw new Error('Écoute limitée à deux heures : sélectionner une partie plus courte.');
    const parts=new Map(score.parts.map(p=>[p.id,p])),partVoices=new Set(selected.map(e=>e.part+'|'+e.staff+'|'+e.voice)),level=.42/Math.sqrt(Math.max(1,Math.min(8,partVoices.size)));
    for(const e of selected){if(e.payload.kind==='rest'||e.cue||e.notated.grace||e.tieRoot)continue;const at=M.add(starts[e.measure],e.t),until=M.add(at,e.sustain);if(M.cmp(until,begin)<=0||M.cmp(at,end)>=0)continue;const a=M.cmp(at,begin)<0?begin:at,b=M.cmp(until,end)>0?end:until,start=seconds(a)-offset,len=seconds(b)-seconds(a);if(len<=0)continue;if(len>60)throw new Error('Note tenue de plus d’une minute : réduire l’extrait ou augmenter le tempo d’écoute.');
      const part=parts.get(e.part),instrument=options.instrument&&options.instrument!=='auto'?options.instrument:instrumentFor(part,e.instrument);if(!instruments.includes(instrument))throw new Error('Instrument inconnu.');
      const named=M.stateAt(score,e.part,'dynamics',e.measure,e.t,e.staff,e.voice),numeric=M.stateAt(score,e.part,'sound-dynamics',e.measure,e.t,e.staff,e.voice);
      const numericCurrent=numeric&&(!named||numeric.from.measure>named.from.measure||numeric.from.measure===named.from.measure&&(M.cmp(numeric.from.t,named.from.t)>0||M.cmp(numeric.from.t,named.from.t)===0));
      const dyn=named?.value.values[0],dynamic={ppp:.26,pp:.34,p:.44,mp:.55,mf:.68,f:.80,ff:.91,fff:1}[dyn]??.68;
      const explicit=e.noteDynamics!==null&&e.noteDynamics!==undefined?Number(e.noteDynamics):numericCurrent?Number(numeric.value.value):null;
      if(explicit!==null&&(!Number.isFinite(explicit)||explicit<0))throw new Error('Nuance numérique invalide.');
      // MusicXML percentages refer to MIDI forte 90, not the maximum velocity 127.
      const velocity=explicit===null?dynamic:Math.min(1,explicit*.9/127);if(velocity===0)continue;let sounding=null,drum=null;
      if(e.payload.kind==='pitch'){if(e.payload.sounding===null)throw new Error('Transposition non résolue.');sounding=M.num(e.payload.sounding);if(sounding<0||sounding>127)throw new Error('Hauteur hors plage MIDI de lecture.');}
      else if(e.payload.kind==='unpitched'){const mapping=part.instruments.find(x=>x.id===e.instrument)?.unpitched;drum=drumMap[mapping];if(!drum){warnings.push('Percussion sans correspondance sonore connue omise.');continue}}
      else continue;
      const has=name=>e.articulations.some(a=>a.tag===name),gate=has('staccatissimo')?.3:has('staccato')?.5:1;
      timeline.push({id:e.id,kind:drum?'drum':'note',time:start,duration:Math.max(.006,len*gate),pitch:sounding,cents:0,instrument:drum||instrument,level:level*velocity/.68,velocity,part:e.part,staff:e.staff,voice:e.voice,role:drum?'percussion':'target',kit:'studio',measure:e.measure,seed:drum?e.id:(score.sourceHash||'score')+':'+e.id,source:{velocity,articulation:'neutral'},clipped:M.cmp(at,begin)<0});
    }
    if(score.F.length)warnings.push('Lecture dans l’ordre écrit, sans dérouler les reprises ni les sauts.');if(selected.some(e=>inside(e)&&(e.cue||e.notated.grace)))warnings.push('Notes d’agrément et petites notes de repérage non jouées.');if(timeline.some(e=>e.clipped))warnings.push('L’extrait commence sur une tenue : son réamorcé pour l’écoute isolée.');if(score.U.some(u=>u.location.measure>=from&&u.location.measure<=to&&/_audio$/.test(u.code)))warnings.push('Certaines nuances d’interprétation sont seulement transcrites, sans réalisation sonore complète.');
    return Events.plan({events:timeline,duration,markers:score.measures.slice(from,to+1).map(m=>({index:m.index,time:seconds(starts[m.index])-offset})),warnings:[...new Set(warnings)],measureStarts:score.measures.slice(from,to+1).map(m=>({index:m.index,time:seconds(starts[m.index])-offset})),tempoSegments:segments,policy:'WRITTEN_ORDER'});
  }
  class Player{
    constructor(audio,{onState=()=>{},onMeasure=()=>{}}={}){this.audio=audio;this.onState=onState;this.onMeasure=onMeasure;this.generation=0;this.running=false;this.stats={};this.playback=null;}
    stop(){this.generation++;if(!this.running)return;Object.assign(this.stats,this.playback?.stats||{});this.running=false;this.audio.stop();this.onState('stopped',this.stats);}
    async play(plan){
      plan=Events.plan(plan);this.stop();const token=++this.generation;this.running=true;this.stats={scheduled:0,late:0,maxActiveNodes:0,completed:false};
      const timeline=Events.plan(plan);
      try{const out=await this.audio.playTimeline(timeline,{lead:.22,onMarker:m=>{if(token===this.generation)this.onMeasure(m.index)}});if(token!==this.generation)return null;this.playback=out;this.onState('playing',{...this.stats,warnings:plan.warnings});
        out.done.then(result=>{if(token!==this.generation)return;Object.assign(this.stats,result,{completed:result.status==='ended'});this.running=false;this.onState(result.status==='ended'?'ended':result.status==='error'?'error':'stopped',{...this.stats,message:result.error});});
        return{anchor:out.start,duration:plan.duration,token};
      }catch(error){if(token!==this.generation||error.code==='EARFORGE_PLAY_CANCELLED')return null;this.running=false;this.onState('error',{...this.stats,message:error.message});throw error;}
    }
    dispose(){this.stop();this.onState=()=>{};this.onMeasure=()=>{}}
  }
  return{compile,Player,instruments,instrumentFor};
});
