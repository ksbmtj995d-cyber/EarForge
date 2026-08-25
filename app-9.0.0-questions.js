'use strict';
(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports?require('./learning-kernel.js'):root.EarForgeLearning
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EarForgeQuestions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Learning){
  if(!Learning)throw new Error('EarForgeLearning requis');
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  const PROMPTS={direction:'Direction',interval:'Intervalle',chord:'Accord',scale:'Gamme',rhythm:'Rythme',tuning:'Justesse',degree:'Degré',progression:'Progression',modulation:'Modulation',melody:'Mélodie',expression:'Expression',jins:'Jins',maqam:'Maqam'};
  const TIMBRES=['piano','guitar','strings','flute','organ','epiano','bass','bell','clarinet','brass','marimba','harp','nylon','celesta','vibraphone','dulcimer','oboe','ney','oud','qanun','sitar','tanpura','sarangi','bansuri','duduk','kora','koto','mbira','balafon','shakuhachi','erhu'];
  const ROMAN={
    major:{I:[0,4,7],ii:[2,5,9],iii:[4,7,11],IV:[5,9,12],V:[7,11,14],vi:[9,12,16],VII:[11,14,17],Imaj7:[0,4,7,11],ii7:[2,5,9,12],iii7:[4,7,11,14],IVmaj7:[5,9,12,16],IV7:[5,9,12,15],V7:[7,11,14,17],vi7:[9,12,16,19],VII7:[11,15,18,21],Im7:[0,3,7,10],'V/ii':[9,13,16,19],'V/V':[2,6,9,12],subV7:[1,5,8,11],ivm7:[5,8,12,15],ivm6:[5,8,12,14],bVII7:[10,14,17,20],bIII7:[3,7,10,13],bVImaj7:[8,12,15,19]},
    minor:{i:[0,3,7],iv:[5,8,12],V:[7,11,14],VI:[8,12,15],III:[3,7,10],VII:[10,14,17],V7:[7,11,14,17],'iiø7':[2,5,8,12],bVImaj7:[8,12,15,19],bVII7:[10,14,17,20]}
  };
  const SCORE_PPQ=960;
  const ARTICULATION_GATE={staccato:.46,detache:.70,normal:.84,tenuto:.96,legato:1.06};
  function articulationFor(random,unit,state){
    if(!state?.settings?.experiments?.contextTransfer)return'normal';
    if(unit.kind==='chord'||unit.kind==='degree'||unit.kind==='progression'||unit.kind==='modulation'||unit.kind==='tuning')return random()<.72?'tenuto':'normal';
    const bank=unit.stage<4?['normal','legato']:['normal','legato','detache','staccato'];return choiceRandom(random,bank)
  }
  function tempoBand(bpm){return bpm<64?'slow':bpm<88?'moderate':bpm<108?'moving':'fast'}
  function symbolicScore(spec,tempo,articulation='normal'){
    if(!spec||spec.kind==='rhythm')return null;const ppq=SCORE_PPQ,bpm=clamp(tempo,48,132),gate=ARTICULATION_GATE[articulation]||ARTICULATION_GATE.normal,events=[];
    const evt=(notes,onsetBeats,durationBeats,velocity=.78,cents=null,art=articulation)=>events.push({notes:Array.isArray(notes)?notes:[notes],onsetTicks:Math.round(onsetBeats*ppq),durationTicks:Math.max(30,Math.round(durationBeats*ppq)),velocity:clamp(velocity,.18,1),articulation:art,gate:ARTICULATION_GATE[art]||gate,cents});
    if(spec.kind==='notes'){
      if(spec.mode==='harmonic')evt(spec.notes,0,1.5,.82,spec.cents||null,'tenuto');
      else{const step=spec.mode==='arpeggio'?.72:1.30,dur=spec.mode==='arpeggio'?.62:1.12;for(let i=0;i<(spec.notes||[]).length;i++)evt(spec.notes[i],i*step,dur,i===0?.82:.76,Array.isArray(spec.cents)?spec.cents[i]||0:0)}
    }else if(spec.kind==='degree'){
      let t=0;for(const c of spec.cadence||[]){evt(c,t,1.45,.72,null,'tenuto');t+=1.72}evt(spec.target,t+.2,1.55,.88,0,'tenuto')
    }else if(spec.kind==='progression'){
      let t=0;for(const c of spec.chords||[]){evt(c,t,1.45,.76,null,'tenuto');t+=1.72}
    }else if(spec.kind==='melody'){
      const values=spec.values||[];for(let i=0;i<values.length;i++)evt(values[i],i*.86,.78,i===0||i===values.length-1?.84:.73,0,articulation)
    }else if(spec.kind==='expression'){
      const notes=[spec.root,spec.root+2,spec.root+4,spec.root+5,spec.root+7];if(spec.velocities){for(let i=0;i<spec.velocities.length;i++)evt(notes[i%notes.length],i*.92,.82,spec.velocities[i],0,'normal')}else if(Number.isInteger(spec.accent)){for(let i=0;i<4;i++)evt(spec.root,i,Math.max(.62,gate),i===spec.accent?.96:.54,0,'detache')}else{for(let i=0;i<4;i++)evt(notes[i],i*.90,.82,.72,0,spec.articulation||articulation)}
    }else if(spec.kind==='cents'){
      for(let i=0;i<(spec.values||[]).length;i++)evt(spec.root,i*.90,.82,.75,spec.values[i],articulation)
    }
    const endTicks=events.reduce((m,e)=>Math.max(m,e.onsetTicks+e.durationTicks*Math.max(.35,e.gate||gate)),0);return{ppq,tempo:bpm,events,endTicks}
  }
  function choiceRandom(random,a){return a[Math.floor(random()*a.length)]}
  function shuffle(random,a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
  function weightedChoice(random,values,weights){let total=weights.reduce((a,b)=>a+b,0),x=random()*total;for(let i=0;i<values.length;i++){x-=weights[i];if(x<=0)return values[i]}return values.at(-1)}
  function registerRanges(kind){return kind==='bass'?[[36,43,'low']]:kind==='flute'||kind==='bell'?[[60,69,'high'],[55,64,'mid']]:[[46,55,'low'],[52,61,'mid'],[58,67,'high']]}
  function registerFor(random,kind,state){
    const values=registerRanges(kind),hasEvidence=state?.settings?.experiments?.contextTransfer&&values.some(v=>state?.factors?.context?.[`register:${v[2]}`]?.attempts>0),selected=hasEvidence?weightedChoice(random,values,values.map(v=>Learning.contextPriority(state,`register:${v[2]}`))):choiceRandom(random,values);
    const [min,max,name]=selected;return{root:min+Math.floor(random()*(max-min+1)),name};
  }
  function timbreBank(unit){
    let bank=unit.stage<4?['piano','guitar','flute']:unit.family==='rhythm'?['piano']:TIMBRES;
    if(unit.kind==='degree'||unit.kind==='progression'||unit.kind==='modulation')bank=['piano','epiano','organ','strings'];
    if(unit.module==='world'&&unit.musicalProperties?.contextTimbres?.length)bank=[...unit.musicalProperties.contextTimbres,'strings','flute'];else if(unit.kind==='jins'||unit.kind==='maqam')bank=['ney','oud','qanun','sitar','strings','flute'];
    if(unit.kind==='tuning')bank=['organ','strings','flute'];
    if(unit.kind==='expression')bank=['piano','epiano','strings','flute','nylon'];
    return bank;
  }
  function timbreFor(random,unit,state){const bank=timbreBank(unit),hasEvidence=state?.settings?.experiments?.contextTransfer&&bank.some(v=>state?.factors?.context?.[`timbre:${v}`]?.attempts>0);return hasEvidence?weightedChoice(random,bank,bank.map(v=>Learning.contextPriority(state,`timbre:${v}`))):choiceRandom(random,bank)}
  function uniqueByLabel(units){const seen=new Set(),out=[];for(const u of units)if(!seen.has(u.label)){seen.add(u.label);out.push(u)}return out}
  function degreeLabel(state,u){if(u.family!=='degree')return u.label;const code=String(u.params?.degree||''),pretty=code.replace('b','♭'),mode=state?.settings?.degreeNotation||'numeric';if(mode==='numeric')return`Degré ${pretty}`;if(mode==='mobile'){const map={1:'Do',2:'Ré',3:'Mi','3b':'Mi♭',4:'Fa',5:'Sol',6:'La','6b':'La♭',7:'Si','7b':'Si♭'};return`${map[code]||pretty} · mobile`}const fn={1:'Tonique',2:'Sus-tonique',3:'Médiante','3b':'Médiante mineure',4:'Sous-dominante',5:'Dominante',6:'Sus-dominante','6b':'Sixte mineure',7:'Sensible','7b':'Sous-tonique'};return fn[code]||`Degré ${pretty}`}
  function displayLabel(state,u){return degreeLabel(state,u)}
  function candidatesFor(state,catalog,unit,timestamp){
    const readyCache=Object.create(null),familyCache=Object.create(null),preordered=unit._choicePeers,groupUnits=preordered||catalog.byGroup?.[unit.group]||catalog.units,same=groupUnits.filter(u=>Learning.isUnlocked(state,u,catalog,timestamp,readyCache,familyCache));
    const ordered=preordered?same:same.sort((a,b)=>Math.abs(a.stage-unit.stage)-Math.abs(b.stage-unit.stage));let list=unit._choiceLabelsUnique?ordered:uniqueByLabel(ordered);
    if(!list.some(u=>u.id===unit.id))list.unshift(unit);
    if(list.length<2){const familyUnits=catalog.byFamily?.[unit.family]||catalog.units,family=familyUnits.filter(u=>Learning.isUnlocked(state,u,catalog,timestamp,readyCache,familyCache));list=uniqueByLabel([unit,...list,...family])}
    return list;
  }
  function makeChoices(state,catalog,unit,random,timestamp){
    const desired=unit.kind==='direction'||unit.kind==='tuning'?3:4;
    const candidates=candidatesFor(state,catalog,unit,timestamp).filter(u=>u.id!==unit.id&&u.label!==unit.label);
    const row=state.confusions?.[unit.id]||{};
    candidates.sort((a,b)=>(row[b.id]?.weight||0)-(row[a.id]?.weight||0)||Math.abs(a.difficulty-unit.difficulty)-Math.abs(b.difficulty-unit.difficulty));
    const selected=[];
    for(const c of candidates){if(selected.length>=desired-1)break;if((row[c.id]?.weight||0)>0)selected.push(c)}
    const rest=shuffle(random,candidates.filter(c=>!selected.includes(c)));
    while(selected.length<desired-1&&rest.length)selected.push(rest.shift());
    const choices=shuffle(random,[unit,...selected]).map(u=>({id:u.id,label:displayLabel(state,u)}));
    return choices;
  }
  function baseContext(random,unit,state){const timbre=timbreFor(random,unit,state),reg=registerFor(random,timbre,state);return{timbre,register:reg.name,root:reg.root,presentation:'melodic',mode:unit.params?.mode||'major'}}
  function durationOf(spec){
    if(spec?.score?.events?.length){const q=spec.score,sec=60/(Math.max(1,q.tempo||72)*Math.max(1,q.ppq||960));return (q.endTicks||0)*sec+.28}
    const d=spec.duration||1.1,g=spec.gap??.18;
    if(spec.kind==='notes')return spec.mode==='harmonic'?d+.35:spec.notes.length*(d+g)+.15;
    if(spec.kind==='rhythm'){const ticks=(spec.countInTicks||0)+(spec.countInGapTicks||0)+(spec.durationTicks||0),unit=spec.tempoUnitTicks||960;return ticks*(60/(Math.max(1,spec.tempo||92)*unit))+.35;}
    if(spec.kind==='degree')return 3.15+d;
    if(spec.kind==='progression')return spec.chords.length*(d+.14)+.55;
    if(spec.kind==='melody'||spec.kind==='cents')return spec.values.length*(d+g)+.25;
    return 2.2;
  }
  function noteSpec(unit,context,random,soundDuration){
    const p=unit.params||{},root=context.root,d=clamp(soundDuration,.7,2.6);
    if(unit.kind==='direction'){
      const magnitude=choiceRandom(random,p.moves||[3,5,7]),move=p.answer==='same'?0:p.answer==='down'?-magnitude:magnitude;
      context.presentation='melodic';return{kind:'notes',notes:[root,root+move],mode:'melodic',timbre:context.timbre,duration:d,gap:.18,seed:Math.floor(random()*2**31)};
    }
    if(unit.kind==='interval'){
      const mode=p.mode==='harm'?'harmonic':'melodic',second=p.mode==='desc'?root-p.semitones:root+p.semitones;
      context.presentation=p.mode;return{kind:'notes',notes:[root,second],mode,timbre:context.timbre,duration:d,gap:.18,seed:Math.floor(random()*2**31)};
    }
    if(unit.kind==='chord'){
      const presentation=unit.stage>=6&&random()<.28?'arpeggio':'harmonic';context.presentation=presentation;
      return{kind:'notes',notes:p.steps.map(x=>root+x),mode:presentation,timbre:context.timbre,duration:d*1.08,gap:.095,seed:Math.floor(random()*2**31)};
    }
    if(unit.kind==='scale'){
      const descend=unit.stage>=4&&random()<.42,values=descend?[...p.steps,...p.steps.slice(0,-1).reverse()]:p.steps;
      context.presentation=descend?'updown':'ascending';return{kind:'notes',notes:values.map(x=>root+x),mode:'melodic',timbre:context.timbre,duration:Math.min(.72,d*.52),gap:.055,seed:Math.floor(random()*2**31)};
    }
    if(unit.kind==='tuning'){
      context.presentation='comparison';return{kind:'notes',notes:[root,root],cents:[0,p.cents],mode:'melodic',timbre:context.timbre,duration:d,gap:.28,seed:Math.floor(random()*2**31)};
    }
    return null;
  }
  function rhythmKit(unit,random){const g=String(unit.group||''),code=String(unit.params?.code||'');if(g==='world.rhythm.india')return'tabla';if(g==='world.rhythm')return'arabic';if(g==='world.rhythm.cross')return choiceRandom(random,['latin','dry']);if(unit.module==='styles'&&/samba|son|rumba|cumbia|soca|bossa/i.test(code))return'latin';if(unit.module==='styles'&&/afro|highlife/i.test(code))return choiceRandom(random,['latin','arabic','dry']);if(unit.module==='styles'&&/trap|boom|half|dnb/i.test(code))return choiceRandom(random,['dry','studio']);if(unit.module==='jazz'||/swing|shuffle|ride/i.test(code))return choiceRandom(random,['brushes','studio']);if(/clave|latin|bossa/i.test(code)||g.includes('clave'))return'latin';return choiceRandom(random,['studio','dry','brushes'])}
  function rhythmSpec(unit,context,random){
    const p=unit.params||{},ppq=p.ppq||960,subdivision=p.subdivision||2,stepTicks=p.stepTicks||Math.round(ppq/subdivision),tempoUnitTicks=p.tempoUnitTicks||ppq;
    const mapGrid=hits=>(hits||[]).map(h=>[h[0],Math.round(Number(h[1]||0)*stepTicks),h[2]??.84]);
    const mapEvents=events=>(events||[]).map(h=>[h[0],Math.round(Number(h[1]||0)),h[2]??.84,h[3]??0,h[4]||'normal']);
    const events=p.events?.length?mapEvents(p.events):mapGrid(p.hits),layers=(p.layers||[]).map(mapGrid),durationTicks=p.durationTicks||Math.round((p.steps||0)*stepTicks);
    const kit=rhythmKit(unit,random);context.presentation='rhythmic';context.mode=p.axis||'rhythm';context.meter=p.meter||p.grouping||'';context.kit=kit;
    return{kind:'rhythm',events,layers,rests:(p.rests||[]).map(r=>[Math.round(r[0]),Math.round(r[1])]),ppq,stepTicks,durationTicks,tempoUnitTicks,countInTicks:Math.round((p.countIn||0)*tempoUnitTicks),countInGapTicks:p.countIn?Math.round(ppq*.5):0,tempo:p.tempo||92,swing:p.swing||0,axis:p.axis||'rhythm',meter:p.meter||'',grouping:p.grouping||'',kit,seed:Math.floor(random()*2**31)}
  }
  function rhythmEventTicks(spec){const ticks=[];for(const e of spec.events||[])ticks.push(e[1]);for(const layer of spec.layers||[])for(const e of layer)ticks.push(e[1]);return [...new Set(ticks)].sort((a,b)=>a-b)}
  function effectiveTick(spec,tick){const beat=spec.ppq||960,s=spec.swing||0;if(!s)return tick;const pos=((tick%beat)+beat)%beat;if(Math.abs(pos-beat/2)<=1)return tick+(s-.5)*beat;return tick}
  function minRhythmGapTicks(spec){const t=rhythmEventTicks(spec).map(x=>effectiveTick(spec,x)).sort((a,b)=>a-b);let m=Infinity;for(let i=1;i<t.length;i++)if(t[i]-t[i-1]>1)m=Math.min(m,t[i]-t[i-1]);return Number.isFinite(m)?m:spec.stepTicks||spec.ppq||960}
  function tempoCeiling(spec,minSeconds=.18){const gap=minRhythmGapTicks(spec),unit=spec.tempoUnitTicks||spec.ppq||960;return Math.max(30,Math.floor(gap*60/(Math.max(.08,minSeconds)*unit)))}
  function degreeSpec(unit,context,random,soundDuration){
    const p=unit.params,root=context.root,mode=p.mode==='minor'?'minor':'major',tonic=mode==='minor'?[0,3,7]:[0,4,7],dominant=[7,11,14];context.presentation='tonal';context.mode=mode;
    return{kind:'degree',cadence:[tonic.map(x=>root+x),dominant.map(x=>root+x),tonic.map(x=>root+x)],target:root+p.semitones,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.78),seed:Math.floor(random()*2**31)};
  }
  function nearestVoicing(prev,chord){if(!prev||!prev.length)return chord;const out=[];for(let i=0;i<chord.length;i++){const base=chord[i];let best=base,bestD=1e9;for(const shift of [-12,0,12,24]){const n=base+shift,target=prev[Math.min(i,prev.length-1)],d=Math.abs(n-target);if(d<bestD){bestD=d;best=n}}out.push(best)}return out.sort((a,b)=>a-b)}
  function progressionSpec(unit,context,random,soundDuration){
    const p=unit.params,mode=p.mode==='minor'?'minor':'major',map=ROMAN[mode],root=context.root;context.presentation='tonal';context.mode=mode;
    let chords=p.roman.map(r=>(map[r]||map.I||map.i).map(x=>root+x));if(unit.stage>=5&&random()<.72){const led=[];for(const c of chords)led.push(nearestVoicing(led.at(-1),c));chords=led;context.voiceLeading='nearest'}else context.voiceLeading='root';return{kind:'progression',chords,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.75),seed:Math.floor(random()*2**31)};
  }
  function modulationSpec(unit,context,random,soundDuration){
    const p=unit.params||{},root=context.root;context.presentation='modulation';context.mode=`${p.sourceMode||'major'}_to_${p.targetMode||'major'}`;let chords=(p.chords||[]).map(c=>c.map(x=>root+x));const led=[];for(const c of chords)led.push(nearestVoicing(led.at(-1),c));chords=led;return{kind:'progression',chords,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.75),seed:Math.floor(random()*2**31)};
  }
  function melodySpec(unit,context,random,soundDuration){
    const p=unit.params,root=context.root;context.presentation='melodic';context.mode=p.mode||'major';return{kind:'melody',values:p.steps.map(x=>root+x),timbre:context.timbre,duration:Math.min(.78,soundDuration*.52),gap:.055,seed:Math.floor(random()*2**31)};
  }
  function expressionSpec(unit,context,random){
    const p=unit.params||{},root=context.root;context.presentation='expressive';context.mode='expression';
    if(p.articulation)context.articulation=p.articulation;
    return{kind:'expression',root,pattern:p.code,articulation:p.articulation||'normal',velocities:p.velocities||null,accent:Number.isInteger(p.accent)?p.accent:null,timbre:context.timbre,seed:Math.floor(random()*2**31)}
  }
  function centsSpec(unit,context,random,soundDuration){
    const p=unit.params,phrase=p.phrase||p.cents.map((_,i)=>i),values=phrase.map(i=>p.cents[i]);context.presentation='microtonal';context.mode=p.code;
    return{kind:'cents',root:context.root,values,timbre:context.timbre,duration:Math.min(.72,soundDuration*.48),gap:.055,seed:Math.floor(random()*2**31)};
  }
  function buildSpec(unit,context,random,soundDuration){
    return noteSpec(unit,context,random,soundDuration)||
      (unit.kind==='rhythm'?rhythmSpec(unit,context,random):null)||
      (unit.kind==='degree'?degreeSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='progression'?progressionSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='modulation'?modulationSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='melody'?melodySpec(unit,context,random,soundDuration):null)||
      (unit.kind==='expression'?expressionSpec(unit,context,random):null)||
      (unit.kind==='jins'||unit.kind==='maqam'?centsSpec(unit,context,random,soundDuration):null);
  }
  function makeQuestion(state,catalog,unit,{seed=`${Date.now()}:${unit.id}`,timestamp=Date.now(),soundDuration=state.settings.soundDuration}={}){
    if(!catalog.byId[unit.id])throw new Error('Unité hors catalogue');const random=Learning.seeded(seed),context=baseContext(random,unit,state);context.articulation=articulationFor(random,unit,state);const presentationTempo=clamp(state?.settings?.presentationTempo??72,48,132);context.tempoBand=tempoBand(presentationTempo);
    if(!state.settings.experiments.contextTransfer){context.timbre=unit.kind==='tuning'?'organ':'piano';context.register='mid';context.root=55}
    const choices=makeChoices(state,catalog,unit,random,timestamp),spec=buildSpec(unit,context,random,soundDuration);if(spec&&spec.kind!=='rhythm')spec.score=symbolicScore(spec,presentationTempo,context.articulation);
    if(spec?.kind==='rhythm'&&state.settings.experiments.adaptiveTempo){const p=Learning.prediction(state,unit,timestamp),candidate=Math.round(spec.tempo*clamp(.82+.38*p,.82,1.20));spec.tempo=Math.min(candidate,tempoCeiling(spec,.18));spec.tempo=Math.max(36,spec.tempo)}
    if(!spec)throw new Error(`Générateur absent pour ${unit.kind}`);const heardTempo=spec.kind==='rhythm'?spec.tempo:presentationTempo;context.tempoBand=tempoBand(heardTempo);context.tempoBpm=heardTempo;const duration=durationOf(spec);context.durationSeconds=duration;const prompt=PROMPTS[unit.kind]||catalog.familyLabels?.[unit.family]||'Écoute',responseDelayMs=unit.kind==='melody'&&unit.stage>=4?Math.round(250+Math.min(2800,unit.stage*70)+random()*350):0,row=state.confusions?.[unit.id]||{};let distractorCount=0,gapTotal=0,confusion=0;for(let i=0;i<choices.length;i++){const choice=choices[i];if(choice.id===unit.id)continue;const x=catalog.byId[choice.id];if(!x)continue;distractorCount++;gapTotal+=Math.abs(x.difficulty-unit.difficulty);confusion+=row[x.id]?.weight||0}const meanGap=distractorCount?gapTotal/distractorCount:.5,challenge=clamp(.30+.52*(1-clamp(meanGap/.65,0,1))+.18*clamp(Math.log1p(confusion)/2.4,0,1),.1,1),answerLabel=displayLabel(state,unit),category=catalog.familyLabels?.[unit.family]||prompt;
    return{id:`q:${Learning.seeded(seed)().toString(36).slice(2)}`,seed:String(seed),unitId:unit.id,family:unit.family,category,prompt,answer:{id:unit.id,label:answerLabel},choices,spec,context:{timbre:context.timbre,register:context.register,presentation:context.presentation,mode:context.mode,meter:context.meter||'',kit:context.kit||'',articulation:context.articulation||'normal',tempoBand:context.tempoBand||'moderate',tempoBpm:context.tempoBpm||presentationTempo,durationSeconds:duration},diagnostics:{challenge,choiceCount:choices.length,chance:1/Math.max(2,choices.length)},duration,responseDelayMs,spokenAnswer:answerLabel};
  }
  function generate(state,catalog,{mode='practice',focus='adaptive',timestamp=Date.now(),seed=`${timestamp}:${mode}:${state.counters?.[mode]||0}`,mark=true}={}){
    const selection=Learning.selectUnit(state,catalog,{mode,focus,timestamp,seed:`select:${seed}`});if(mark)Learning.markShown(state,selection.unit.id,mode,timestamp);
    const question=makeQuestion(state,catalog,selection.unit,{seed:`question:${seed}:${selection.unit.id}`,timestamp});return{...question,selection:{eligible:selection.eligible,score:selection.score,prediction:selection.prediction}};
  }
  return{PROMPTS,TIMBRES,SCORE_PPQ,ARTICULATION_GATE,makeChoices,makeQuestion,generate,durationOf,rhythmSpec,rhythmKit,minRhythmGapTicks,tempoCeiling,symbolicScore,modulationSpec};
});
