'use strict';
(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports?require('./app-9.0.0-learning.js'):root.EarForgeLearning
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EarForgeQuestions=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Learning){
  if(!Learning)throw new Error('EarForgeLearning requis');
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  const PROMPTS={direction:'Direction',interval:'Intervalle',chord:'Accord',scale:'Gamme',rhythm:'Rythme',tuning:'Justesse',degree:'Degré',progression:'Progression',modulation:'Modulation',melody:'Mélodie',expression:'Expression',jins:'Jins',maqam:'Maqam',raga:'Raga'};
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
  function symbolicScore(spec,tempo,articulation='normal',noteDurationScale=1){
    if(!spec||spec.kind==='rhythm')return null;const ppq=SCORE_PPQ,bpm=Number.isFinite(Number(tempo))&&Number(tempo)>0?Number(tempo):72,gate=ARTICULATION_GATE[articulation]||ARTICULATION_GATE.normal,durationScale=Number.isFinite(Number(noteDurationScale))&&Number(noteDurationScale)>0?Number(noteDurationScale):1,events=[];
    const evt=(notes,onsetBeats,durationBeats,velocity=.78,cents=null,art=articulation)=>events.push({notes:Array.isArray(notes)?notes:[notes],onsetTicks:Math.round(onsetBeats*ppq),durationTicks:Math.max(30,Math.round(durationBeats*durationScale*ppq)),velocity:clamp(velocity,.18,1),articulation:art,gate:ARTICULATION_GATE[art]||gate,cents});
    if(spec.kind==='notes'){
      if(spec.mode==='harmonic')evt(spec.notes,0,1.5,.82,spec.cents||null,'tenuto');
      else{const step=spec.mode==='arpeggio'?.72:1.30,dur=spec.mode==='arpeggio'?.62:1.12;for(let i=0;i<(spec.notes||[]).length;i++)evt(spec.notes[i],i*step,dur,i===0?.82:.76,Array.isArray(spec.cents)?spec.cents[i]||0:0)}
    }else if(spec.kind==='degree'){
      let t=0;for(const c of spec.cadence||[]){evt(c,t,1.45,.72,null,'tenuto');t+=1.72}evt(spec.target,t+.2,1.55,.88,0,'tenuto')
    }else if(spec.kind==='progression'){
      let t=0;for(const c of spec.chords||[]){evt(c,t,1.45,.76,null,'tenuto');t+=1.72}
    }else if(spec.kind==='melody'){
      const values=spec.values||[],ioi=spec.ioiBeats||[],dur=spec.durationBeats||[];let t=0;for(let i=0;i<values.length;i++){evt(values[i],t,Number(dur[i]??.78),i===0||i===values.length-1?.84:.73,0,articulation);t+=Number(ioi[i]??.86)}
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
  const TIMBRE_RANGES=Object.freeze({piano:[36,88],guitar:[40,76],strings:[43,88],flute:[60,91],organ:[36,88],epiano:[36,88],bass:[28,60],bell:[60,91],clarinet:[50,89],brass:[45,79],marimba:[48,84],harp:[40,88],nylon:[40,76],celesta:[60,91],vibraphone:[53,84],dulcimer:[48,84],oboe:[58,88],ney:[60,84],oud:[43,74],qanun:[48,84],sitar:[48,84],tanpura:[40,64],sarangi:[50,82],bansuri:[60,91],duduk:[55,78],kora:[48,84],koto:[48,80],mbira:[48,78],balafon:[48,80],shakuhachi:[60,84],erhu:[55,88]});
  const HARMONIC_TIMBRES=Object.freeze(['piano','guitar','strings','organ','epiano','harp','nylon','celesta','vibraphone','dulcimer','qanun','kora','koto']);
  function pitchEnvelope(unit){const p=unit.params||{},flat=x=>(Array.isArray(x)?x.flat(Infinity):[]).map(Number).filter(Number.isFinite);let values=[0];if(unit.kind==='direction'){const m=Math.max(0,...flat(p.moves||[3,5,7]));values=p.answer==='down'?[-m,0]:p.answer==='same'?[0]:[0,m]}else if(unit.kind==='interval'){const s=Math.abs(Number(p.semitones)||0);values=p.mode==='desc'?[-s,0]:[0,s]}else if(unit.kind==='chord'||unit.kind==='scale')values=flat(p.steps);else if(unit.kind==='degree')values=[0,4,7,11,14,Number(p.semitones)||0];else if(unit.kind==='progression'){const mode=p.mode==='minor'?'minor':'major',map=ROMAN[mode];values=flat((p.roman||[]).map(r=>map[r]||map.I||map.i))}else if(unit.kind==='modulation')values=flat(p.chords);else if(unit.kind==='melody')values=[-12,12];else if(unit.kind==='expression')values=[0,7];if(!values.length)values=[0];return{min:Math.min(...values),max:Math.max(...values)}}
  function timbreRange(timbre){return TIMBRE_RANGES[timbre]||[43,84]}
  function timbreCanFit(timbre,unit){const e=pitchEnvelope(unit),r=timbreRange(timbre);return e.max-e.min<=r[1]-r[0]}
  function registerRanges(timbre,unit){const [lo,hi]=timbreRange(timbre),e=pitchEnvelope(unit),min=Math.ceil(lo-e.min),max=Math.floor(hi-e.max);if(min>max)return[];const width=max-min+1,a=min+Math.floor(width/3),b=min+Math.floor(2*width/3);return[[min,Math.max(min,a-1),'low'],[a,Math.max(a,b-1),'mid'],[b,max,'high']].filter(v=>v[0]<=v[1])}
  function registerFor(random,timbre,state,unit){
    const values=registerRanges(timbre,unit);if(!values.length)throw new Error(`Tessiture insuffisante pour ${unit.id} avec ${timbre}`);const hasEvidence=state?.settings?.experiments?.contextTransfer&&values.some(v=>state?.factors?.context?.[`register:${v[2]}`]?.attempts>0),selected=hasEvidence?weightedChoice(random,values,values.map(v=>Learning.contextPriority(state,`register:${v[2]}`))):choiceRandom(random,values);
    const [min,max,name]=selected;return{root:min+Math.floor(random()*(max-min+1)),name,range:timbreRange(timbre)};
  }
  function timbreBank(unit,presentation='melodic'){
    let bank=unit.stage<4?['piano','guitar','flute']:unit.family==='rhythm'?['piano']:TIMBRES;
    if(unit.kind==='chord'&&presentation==='harmonic')bank=[...HARMONIC_TIMBRES];
    else if(unit.kind==='chord')bank=TIMBRES.filter(x=>x!=='bass'&&x!=='tanpura');
    else if(unit.kind==='interval'&&unit.params?.mode==='harm')bank=[...HARMONIC_TIMBRES];
    if(unit.kind==='degree'||unit.kind==='progression'||unit.kind==='modulation')bank=['piano','epiano','organ','strings','guitar','harp','nylon'];
    if(unit.module==='world'&&unit.musicalProperties?.contextTimbres?.length)bank=[...unit.musicalProperties.contextTimbres,'strings','flute'];else if(unit.kind==='jins'||unit.kind==='maqam'||unit.kind==='raga')bank=['ney','oud','qanun','sitar','strings','flute'];
    if(unit.kind==='tuning')bank=['organ','strings','flute'];
    if(unit.kind==='expression')bank=['piano','epiano','strings','flute','nylon'];
    const fitted=[...new Set(bank)].filter(t=>TIMBRE_RANGES[t]&&timbreCanFit(t,unit));return fitted.length?fitted:['piano'];
  }
  function timbreFor(random,unit,state,presentation='melodic'){const bank=timbreBank(unit,presentation),hasEvidence=state?.settings?.experiments?.contextTransfer&&bank.some(v=>state?.factors?.context?.[`timbre:${v}`]?.attempts>0);return hasEvidence?weightedChoice(random,bank,bank.map(v=>Learning.contextPriority(state,`timbre:${v}`))):choiceRandom(random,bank)}
  function uniqueByLabel(units){const seen=new Set(),out=[];for(const u of units)if(!seen.has(u.label)){seen.add(u.label);out.push(u)}return out}
  function degreeLabel(state,u){if(u.family!=='degree')return u.label;const code=String(u.params?.degree||''),pretty=code.replace('b','♭'),mode=state?.settings?.degreeNotation||'numeric';if(mode==='numeric')return`Degré ${pretty}`;if(mode==='mobile'){const map={1:'Do',2:'Ré',3:'Mi','3b':'Mi♭',4:'Fa',5:'Sol',6:'La','6b':'La♭',7:'Si','7b':'Si♭'};return`${map[code]||pretty} · mobile`}const fn={1:'Tonique',2:'Sus-tonique',3:'Médiante','3b':'Médiante mineure',4:'Sous-dominante',5:'Dominante',6:'Sus-dominante','6b':'Sixte mineure',7:'Sensible','7b':'Sous-tonique'};return fn[code]||`Degré ${pretty}`}
  function displayLabel(state,u){return degreeLabel(state,u)}
  function choicePeerDistance(unit,peer){let d=Math.abs((peer.stage??0)-(unit.stage??0))+.35*Math.abs((peer.difficulty??0)-(unit.difficulty??0)),a=unit.params||{},b=peer.params||{};for(const key of ['mode','axis','meter','grouping'])if(a[key]!=null&&b[key]!=null&&a[key]!==b[key])d+=2;const av=Math.abs(Number(a.threshold??a.cents)),bv=Math.abs(Number(b.threshold??b.cents));if(Number.isFinite(av)&&Number.isFinite(bv)&&av+bv>0)d+=Math.abs(av-bv)/Math.max(1,av,bv);return d}
  function candidatesFor(state,catalog,unit){const groupUnits=unit._choicePeers||catalog.byGroup?.[unit.group]||catalog.units,targetLabel=displayLabel(state,unit),best=new Map();for(const peer of groupUnits){if(peer.id===unit.id||!Learning.moduleEnabled(state,peer))continue;const label=displayLabel(state,peer);if(label===targetLabel)continue;const distance=choicePeerDistance(unit,peer),prior=best.get(label);if(!prior||distance<prior.distance||(distance===prior.distance&&String(peer.id)<String(prior.unit.id)))best.set(label,{unit:peer,distance})}return[...best.values()].sort((a,b)=>a.distance-b.distance||String(a.unit.id).localeCompare(String(b.unit.id))).map(x=>x.unit)}
  function makeChoices(state,catalog,unit,random){
    const desired=unit.kind==='direction'||unit.kind==='tuning'?3:4,candidates=candidatesFor(state,catalog,unit),row=state.confusions?.[unit.id]||{};if(!candidates.length)throw new Error(`Espace de réponses insuffisant pour ${unit.id}`);
    candidates.sort((a,b)=>(row[b.id]?.weight||0)-(row[a.id]?.weight||0)||choicePeerDistance(unit,a)-choicePeerDistance(unit,b)||String(a.id).localeCompare(String(b.id)));const selected=[];for(const c of candidates){if(selected.length>=desired-1)break;if((row[c.id]?.weight||0)>0)selected.push(c)}const rest=shuffle(random,candidates.filter(c=>!selected.includes(c)));while(selected.length<desired-1&&rest.length)selected.push(rest.shift());const choices=shuffle(random,[unit,...selected]).map(u=>({id:u.id,label:displayLabel(state,u)}));if(choices.length<2||new Set(choices.map(x=>x.label)).size!==choices.length)throw new Error(`Question non évaluable pour ${unit.id}`);return choices;
  }
  function baseContext(random,unit,state){let presentation='melodic';if(unit.kind==='chord')presentation=unit.stage>=6&&random()<.28?'arpeggio':'harmonic';else if(unit.kind==='interval'&&unit.params?.mode==='harm')presentation='harmonic';else if(unit.kind==='degree'||unit.kind==='progression'||unit.kind==='modulation')presentation='tonal';const timbre=timbreFor(random,unit,state,presentation),reg=registerFor(random,timbre,state,unit);return{timbre,register:reg.name,root:reg.root,timbreRange:reg.range,presentation,mode:unit.params?.mode||'major'}}
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
      const presentation=context.presentation==='arpeggio'?'arpeggio':'harmonic';let notes=p.steps.map(x=>root+x);if(presentation==='arpeggio'&&unit.stage>=6){const orders=[x=>x,x=>[...x].reverse(),x=>[x[0],...x.slice(1).reverse()],x=>[...x.slice(1),x[0]]],order=Math.floor(random()*orders.length);notes=orders[order](notes);context.arpeggioOrder=order}context.presentation=presentation;
      return{kind:'notes',notes,mode:presentation,timbre:context.timbre,duration:d*1.08,gap:.095,seed:Math.floor(random()*2**31)};
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
  const RHYTHM_CONTEXT_VARIANT_GROUPS=new Set(['rhythm.meter.simple','rhythm.meter.compound','rhythm.subdivision','rhythm.feel','rhythm.accent','rhythm.dynamics','rhythm.groove','rhythm.oddmeter']);
  const RHYTHM_REPEAT_EXCLUDED_AXES=new Set(['microtiming','fill']);
  function rhythmContextLayer(unit,durationTicks,tempoUnitTicks,random){
    if(!RHYTHM_CONTEXT_VARIANT_GROUPS.has(String(unit.group||'')))return null;
    const variant=Math.floor(random()*4);if(!variant)return null;const step=Math.max(1,Math.round(tempoUnitTicks/(variant===3?2:1))),offset=variant===2?Math.round(step/2):0,instrument=variant===1?'woodblock':variant===2?'hatClosed':'shaker',velocity=variant===1?.18:variant===2?.16:.13,out=[];
    for(let tick=offset;tick<durationTicks;tick+=step)out.push([instrument,tick,velocity,0,'context']);return out.length?out:null;
  }
  function rhythmOrganicVariant(base,unit,random){
    const gain=.94+random()*.10,scaleVelocity=e=>{const x=[...e];x[2]=clamp(Number(x[2]??.84)*gain,.06,1);return x},scaled={...base,events:(base.events||[]).map(scaleVelocity),layers:(base.layers||[]).map(layer=>layer.map(scaleVelocity)),organicVelocityGain:gain,cycleRepeats:1};
    if(RHYTHM_REPEAT_EXCLUDED_AXES.has(String(base.axis||''))||!(base.durationTicks>0)||random()>=.58)return scaled;
    const period=base.durationTicks,repeatEvents=(base.events||[]).flatMap(e=>[e,[e[0],e[1]+period,e[2],e[3]??0,e[4]||'normal']]),repeatLayers=(base.layers||[]).map(layer=>layer.flatMap(e=>[e,[e[0],e[1]+period,e[2],e[3]??0,e[4]||'normal']])),repeatRests=(base.rests||[]).flatMap(r=>[r,[r[0]+period,r[1]]]),candidate={...scaled,events:repeatEvents.map(scaleVelocity),layers:repeatLayers.map(layer=>layer.map(scaleVelocity)),rests:repeatRests,durationTicks:period*2,cycleRepeats:2};
    const baseCeil=tempoCeiling(scaled,.18),nextCeil=tempoCeiling(candidate,.18),seconds=candidate.durationTicks/Math.max(1,candidate.tempoUnitTicks||candidate.ppq||960)*60/Math.max(1,candidate.tempo||92);return nextCeil===baseCeil&&seconds<=30?candidate:scaled;
  }
  function rhythmSpec(unit,context,random){
    const p=unit.params||{},ppq=p.ppq||960,subdivision=p.subdivision||2,stepTicks=p.stepTicks||Math.round(ppq/subdivision),tempoUnitTicks=p.tempoUnitTicks||ppq;
    const mapGrid=hits=>(hits||[]).map(h=>[h[0],Math.round(Number(h[1]||0)*stepTicks),h[2]??.84]);
    const mapEvents=events=>(events||[]).map(h=>[h[0],Math.round(Number(h[1]||0)),h[2]??.84,h[3]??0,h[4]||'normal']);
    const events=p.events?.length?mapEvents(p.events):mapGrid(p.hits),layers=(p.layers||[]).map(mapGrid),durationTicks=p.durationTicks||Math.round((p.steps||0)*stepTicks);
    const kit=rhythmKit(unit,random),contextLayer=rhythmContextLayer(unit,durationTicks,tempoUnitTicks,random);if(contextLayer)layers.push(contextLayer);context.presentation='rhythmic';context.mode=p.axis||'rhythm';context.meter=p.meter||p.grouping||'';context.kit=kit;
    const base={kind:'rhythm',events,layers,rests:(p.rests||[]).map(r=>[Math.round(r[0]),Math.round(r[1])]),ppq,stepTicks,durationTicks,tempoUnitTicks,countInTicks:Math.round((p.countIn||0)*tempoUnitTicks),countInGapTicks:p.countIn?Math.round(ppq*.5):0,tempo:p.tempo||92,swing:p.swing||0,axis:p.axis||'rhythm',meter:p.meter||'',grouping:p.grouping||'',kit,seed:Math.floor(random()*2**31)};return rhythmOrganicVariant(base,unit,random)
  }
  function rhythmEventTicks(spec){const ticks=[];for(const e of spec.events||[])ticks.push(e[1]);for(const layer of spec.layers||[])for(const e of layer)if(e[4]!=='context')ticks.push(e[1]);return [...new Set(ticks)].sort((a,b)=>a-b)}
  function effectiveTick(spec,tick){const beat=spec.ppq||960,s=spec.swing||0;if(!s)return tick;const pos=((tick%beat)+beat)%beat;if(Math.abs(pos-beat/2)<=1)return tick+(s-.5)*beat;return tick}
  function minRhythmGapTicks(spec){const t=rhythmEventTicks(spec).map(x=>effectiveTick(spec,x)).sort((a,b)=>a-b);let m=Infinity;for(let i=1;i<t.length;i++)if(t[i]-t[i-1]>1)m=Math.min(m,t[i]-t[i-1]);return Number.isFinite(m)?m:spec.stepTicks||spec.ppq||960}
  function tempoCeiling(spec,minSeconds=.18){const gap=minRhythmGapTicks(spec),unit=spec.tempoUnitTicks||spec.ppq||960;return Math.max(30,Math.floor(gap*60/(Math.max(.08,minSeconds)*unit)))}
  function degreeSpec(unit,context,random,soundDuration){
    const p=unit.params,root=context.root,mode=p.mode==='minor'?'minor':'major',tonic=mode==='minor'?[0,3,7]:[0,4,7],dominant=[7,11,14];context.presentation='tonal';context.mode=mode;
    return{kind:'degree',cadence:[tonic.map(x=>root+x),dominant.map(x=>root+x),tonic.map(x=>root+x)],target:root+p.semitones,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.78),seed:Math.floor(random()*2**31)};
  }
  function nearestVoicing(prev,chord,range=[36,88]){const [lo,hi]=range,candidates=[],shifts=[-24,-12,0,12,24];function walk(i,row){if(i===chord.length){const sorted=[...row].sort((a,b)=>a-b);if(new Set(sorted).size===sorted.length)candidates.push(sorted);return}for(const shift of shifts){const n=chord[i]+shift;if(n>=lo&&n<=hi)walk(i+1,[...row,n])}}walk(0,[]);if(!candidates.length)return chord;const target=prev&&prev.length?[...prev].sort((a,b)=>a-b):null,cost=x=>{let movement=0;if(target){for(let i=0;i<x.length;i++){const j=x.length===1?0:Math.round(i*(target.length-1)/Math.max(1,x.length-1));movement+=Math.abs(x[i]-target[j])}}else{const a=x.reduce((s,n)=>s+n,0)/x.length,b=chord.reduce((s,n)=>s+n,0)/chord.length;movement=Math.abs(a-b)}const span=x.at(-1)-x[0],center=Math.abs((x[0]+x.at(-1))/2-(lo+hi)/2);return movement+.035*span+.006*center};candidates.sort((a,b)=>cost(a)-cost(b)||a.join(',').localeCompare(b.join(',')));return candidates[0]}
  function progressionSpec(unit,context,random,soundDuration){
    const p=unit.params,mode=p.mode==='minor'?'minor':'major',map=ROMAN[mode],root=context.root;context.presentation='tonal';context.mode=mode;
    let chords=p.roman.map(r=>(map[r]||map.I||map.i).map(x=>root+x));if(unit.stage>=5&&random()<.72){const led=[];for(const c of chords)led.push(nearestVoicing(led.at(-1),c,context.timbreRange));chords=led;context.voiceLeading='nearest'}else context.voiceLeading='root';return{kind:'progression',chords,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.75),seed:Math.floor(random()*2**31)};
  }
  function modulationSpec(unit,context,random,soundDuration){
    const p=unit.params||{},root=context.root;context.presentation='modulation';context.mode=`${p.sourceMode||'major'}_to_${p.targetMode||'major'}`;let chords=(p.chords||[]).map(c=>c.map(x=>root+x));const led=[];for(const c of chords)led.push(nearestVoicing(led.at(-1),c,context.timbreRange));chords=led;return{kind:'progression',chords,timbre:context.timbre,duration:Math.min(1.05,soundDuration*.75),seed:Math.floor(random()*2**31)};
  }
  const BASIC_MELODY_CODES=new Set(['rise','fall','arch','valley','repeat','leaps','triad','sequence','minorArc','chromatic','question','answer']);
  const MAJOR_DEGREES=[0,2,4,5,7,9,11,12],MINOR_DEGREES=[0,2,3,5,7,8,10,12];
  function sampleSortedDegrees(random,pool,minCount,maxCount,{includeStart=true,includeEnd=null}={}){const n=Math.max(minCount,Math.min(maxCount,minCount+Math.floor(random()*(maxCount-minCount+1)))),inside=pool.filter(x=>(!includeStart||x!==pool[0])&&(includeEnd===null||x!==includeEnd)),picked=[];while(picked.length<Math.max(0,n-(includeStart?1:0)-(includeEnd===null?0:1))&&inside.length){const i=Math.floor(random()*inside.length);picked.push(inside.splice(i,1)[0])}const out=[...(includeStart?[pool[0]]:[]),...picked,...(includeEnd===null?[]:[includeEnd])];return [...new Set(out)].sort((a,b)=>a-b)}
  function proceduralBasicMelody(p,random){const code=p?.code;
    if(code==='rise'){const end=choiceRandom(random,[7,9,11,12]),pool=MAJOR_DEGREES.filter(x=>x<=end);return sampleSortedDegrees(random,pool,4,7,{includeStart:true,includeEnd:end})}
    if(code==='fall'){const start=choiceRandom(random,[7,9,11,12]),pool=MAJOR_DEGREES.filter(x=>x<=start);return sampleSortedDegrees(random,pool,4,7,{includeStart:true,includeEnd:start}).reverse()}
    if(code==='arch'||code==='minorArc'){const pool=code==='minorArc'?MINOR_DEGREES:MAJOR_DEGREES,top=choiceRandom(random,pool.filter(x=>x>=5)),asc=sampleSortedDegrees(random,pool.filter(x=>x<=top),3,5,{includeStart:true,includeEnd:top});return [...asc,...asc.slice(0,-1).reverse()]}
    if(code==='valley'){const top=choiceRandom(random,[7,9,11,12]),pool=MAJOR_DEGREES.filter(x=>x<=top),down=sampleSortedDegrees(random,pool,3,5,{includeStart:true,includeEnd:top}).reverse();return [...down,...down.slice(0,-1).reverse()]}
    if(code==='repeat'){const a=choiceRandom(random,[0,2,4]),b=choiceRandom(random,[2,4,5,7].filter(x=>x!==a)),reps=2+Math.floor(random()*2),out=[];for(let i=0;i<reps;i++)out.push(a);for(let i=0;i<reps;i++)out.push(b);if(random()<.6)out.push(a);return out.slice(0,9)}
    if(code==='leaps'){const highs=[5,7,9],lows=[0,1],n=5+Math.floor(random()*3),out=[0];for(let i=1;i<n;i++)out.push(i%2?choiceRandom(random,highs):choiceRandom(random,lows));return out}
    if(code==='triad'){const bank=[0,4,7,12],n=6+Math.floor(random()*4),out=[0];while(out.length<n-1){let x=choiceRandom(random,bank);if(x===out.at(-1))x=bank[(bank.indexOf(x)+1+Math.floor(random()*3))%bank.length];out.push(x)}out.push(0);return out}
    if(code==='sequence'){const a=choiceRandom(random,[1,2]),b=a+choiceRandom(random,[1,2,3]),shift=choiceRandom(random,[1,2,3]),motif=[0,a,b];return [...motif,...motif.map(x=>x+shift).slice(1)]}
    if(code==='chromatic'){const dir=random()<.5?1:-1,span=2+Math.floor(random()*3),up=Array.from({length:span+1},(_,i)=>i*dir);return [...up,...up.slice(0,-1).reverse()]}
    if(code==='question'){const end=choiceRandom(random,[7,9,11]),inside=sampleSortedDegrees(random,MAJOR_DEGREES.filter(x=>x<=end),4,6,{includeStart:true,includeEnd:end});if(inside.length>4&&random()<.5){const i=1+Math.floor(random()*Math.max(1,inside.length-3));[inside[i],inside[i+1]]=[inside[i+1],inside[i]]}return inside}
    if(code==='answer'){const start=choiceRandom(random,[5,7,9,11,12]),pool=MAJOR_DEGREES.filter(x=>x<=start),desc=sampleSortedDegrees(random,pool,4,7,{includeStart:true,includeEnd:start}).reverse();if(desc.at(-1)!==0)desc.push(0);return desc}
    return p.steps
  }
  function melodyPitchSteps(p,random){return BASIC_MELODY_CODES.has(p?.code)?proceduralBasicMelody(p,random):p.steps}
  function melodyTimingGrammar(length,random){const profile=Math.floor(random()*5),ioi=[],dur=[];for(let i=0;i<length;i++){let x=.86;if(profile===1)x=i%2?.98:.70;else if(profile===2)x=i%3===2?1.02:.74;else if(profile===3)x=.66+Math.min(.38,i*.055);else if(profile===4)x=choiceRandom(random,[.66,.72,.80,.88,.96,1.04]);x=clamp(x,.62,1.08);ioi.push(x);dur.push(clamp(x*(i===length-1?1.02:.78),.48,1.10))}return{ioi,dur,profile}}
  function melodySpec(unit,context,random,soundDuration){
    const p=unit.params,root=context.root,steps=melodyPitchSteps(p,random),timing=melodyTimingGrammar(steps.length,random);context.presentation='melodic';context.mode=p.mode||'major';return{kind:'melody',values:steps.map(x=>root+x),relativeSteps:steps,ioiBeats:timing.ioi,durationBeats:timing.dur,phraseProfile:timing.profile,timbre:context.timbre,duration:Math.min(.78,soundDuration*.52),gap:.055,seed:Math.floor(random()*2**31)};
  }
  function expressionSpec(unit,context,random){
    const p=unit.params||{},root=context.root;context.presentation='expressive';context.mode='expression';
    if(p.articulation)context.articulation=p.articulation;
    return{kind:'expression',root,pattern:p.code,articulation:p.articulation||'normal',velocities:p.velocities||null,accent:Number.isInteger(p.accent)?p.accent:null,timbre:context.timbre,seed:Math.floor(random()*2**31)}
  }
  function centsSpec(unit,context,random,soundDuration){
    const p=unit.params,bank=Array.isArray(p.phraseBank)&&p.phraseBank.length?p.phraseBank:null,phrase=bank?bank[Math.floor(random()*bank.length)]:p.phrase||p.cents.map((_,i)=>i),values=phrase.map(i=>p.cents[i]);context.presentation='microtonal';context.mode=p.code;
    return{kind:'cents',root:context.root,values,timbre:context.timbre,duration:Math.min(.72,soundDuration*.48),gap:.055,seed:Math.floor(random()*2**31)};
  }
  function fitSpecToTimbre(spec,context){if(!spec||spec.kind==='rhythm')return spec;const range=context.timbreRange||timbreRange(context.timbre),values=[];if(spec.kind==='notes')values.push(...(spec.notes||[]));else if(spec.kind==='degree'){for(const c of spec.cadence||[])values.push(...c);values.push(spec.target)}else if(spec.kind==='progression'){for(const c of spec.chords||[])values.push(...c)}else if(spec.kind==='melody')values.push(...(spec.values||[]));else if(spec.kind==='expression')values.push(spec.root);else if(spec.kind==='cents')values.push(spec.root);const finiteValues=values.map(Number).filter(Number.isFinite);if(!finiteValues.length)return spec;const min=Math.min(...finiteValues),max=Math.max(...finiteValues),lo=range[0],hi=range[1],kMin=Math.ceil((lo-min)/12),kMax=Math.floor((hi-max)/12);if(kMin>kMax)throw new Error(`Tessiture impossible pour ${context.timbre}: ${min}-${max} hors ${lo}-${hi}`);const k=0<kMin?kMin:0>kMax?kMax:0,shift=12*k;if(!shift)return spec;const move=n=>Number(n)+shift;if(spec.kind==='notes')spec.notes=spec.notes.map(move);else if(spec.kind==='degree'){spec.cadence=spec.cadence.map(c=>c.map(move));spec.target=move(spec.target)}else if(spec.kind==='progression')spec.chords=spec.chords.map(c=>c.map(move));else if(spec.kind==='melody')spec.values=spec.values.map(move);else if(spec.kind==='expression')spec.root=move(spec.root);else if(spec.kind==='cents')spec.root=move(spec.root);context.root=move(context.root);return spec}
  function buildSpec(unit,context,random,soundDuration){
    return noteSpec(unit,context,random,soundDuration)||
      (unit.kind==='rhythm'?rhythmSpec(unit,context,random):null)||
      (unit.kind==='degree'?degreeSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='progression'?progressionSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='modulation'?modulationSpec(unit,context,random,soundDuration):null)||
      (unit.kind==='melody'?melodySpec(unit,context,random,soundDuration):null)||
      (unit.kind==='expression'?expressionSpec(unit,context,random):null)||
      (unit.kind==='jins'||unit.kind==='maqam'||unit.kind==='raga'?centsSpec(unit,context,random,soundDuration):null);
  }
  function makeQuestion(state,catalog,unit,{seed=`${Date.now()}:${unit.id}`,timestamp=Date.now(),soundDuration=state.settings.soundDuration}={}){
    if(!catalog.byId[unit.id])throw new Error('Unité hors catalogue');const random=Learning.seeded(`stimulus:${seed}`),answerRandom=Learning.seeded(`choices:${seed}`),context=baseContext(random,unit,state);context.articulation=articulationFor(random,unit,state);const manualTempo=clamp(state?.settings?.presentationTempo??72,48,132),adaptive=state?.settings?.experiments?.adaptiveTempo!==false;let policy=Learning.stimulusPolicy(state,unit,{baseTempo:manualTempo,context,timestamp}),presentationTempo=adaptive?policy.tempoBpm:manualTempo,noteDurationScale=adaptive?policy.noteDurationScale:1;context.tempoBand=tempoBand(presentationTempo);
    if(!state.settings.experiments.contextTransfer){context.timbre=unit.kind==='tuning'?'organ':'piano';context.register='mid';context.root=55}
    const choices=makeChoices(state,catalog,unit,answerRandom);let spec=fitSpecToTimbre(buildSpec(unit,context,random,soundDuration),context);if(spec&&spec.kind!=='rhythm')spec.score=symbolicScore(spec,presentationTempo,context.articulation,noteDurationScale);
    if(spec?.kind==='rhythm'&&adaptive){policy=Learning.stimulusPolicy(state,unit,{baseTempo:spec.tempo,context,timestamp});const candidate=Math.round(policy.tempoBpm);spec.tempo=Math.min(candidate,tempoCeiling(spec,.18))}
    if(!spec)throw new Error(`Générateur absent pour ${unit.kind}`);const heardTempo=spec.kind==='rhythm'?spec.tempo:presentationTempo;context.tempoBand=tempoBand(heardTempo);context.tempoBpm=heardTempo;const duration=durationOf(spec);context.durationSeconds=duration;if(adaptive){context.stimulusChallenge=policy.stimulusChallenge;context.tempoRatio=policy.tempoRatio;context.noteDurationScale=spec.kind==='rhythm'?1:noteDurationScale}
    const prompt=PROMPTS[unit.kind]||catalog.familyLabels?.[unit.family]||'Écoute',responseDelayMs=unit.kind==='melody'&&unit.stage>=4?Math.round(250+Math.min(2800,unit.stage*70)+random()*350):0,row=state.confusions?.[unit.id]||{};let distractorCount=0,gapTotal=0,confusion=0;for(let i=0;i<choices.length;i++){const choice=choices[i];if(choice.id===unit.id)continue;const x=catalog.byId[choice.id];if(!x)continue;distractorCount++;gapTotal+=Math.abs(x.difficulty-unit.difficulty);confusion+=row[x.id]?.weight||0}const meanGap=distractorCount?gapTotal/distractorCount:.5,choiceChallenge=clamp(.30+.52*(1-clamp(meanGap/.65,0,1))+.18*clamp(Math.log1p(confusion)/2.4,0,1),.1,1),challenge=adaptive?clamp(Math.sqrt(choiceChallenge*clamp(policy.stimulusChallenge,.1,1)),.1,1):choiceChallenge,answerLabel=displayLabel(state,unit),category=catalog.familyLabels?.[unit.family]||prompt;
    const baseContextOut={timbre:context.timbre,register:context.register,presentation:context.presentation,mode:context.mode,meter:context.meter||'',kit:context.kit||'',articulation:context.articulation||'normal',tempoBand:context.tempoBand||'moderate',tempoBpm:context.tempoBpm||presentationTempo,durationSeconds:duration},contextOut=adaptive?{...baseContextOut,stimulusChallenge:context.stimulusChallenge,tempoRatio:context.tempoRatio,noteDurationScale:context.noteDurationScale}:baseContextOut,diagnostics=adaptive?{challenge,choiceChallenge,stimulusChallenge:policy.stimulusChallenge,choiceCount:choices.length,chance:1/choices.length}:{challenge,choiceCount:choices.length,chance:1/choices.length};
    return{id:`q:${Learning.seeded(seed)().toString(36).slice(2)}`,seed:String(seed),unitId:unit.id,family:unit.family,category,prompt,answer:{id:unit.id,label:answerLabel},choices,spec,context:contextOut,diagnostics,duration,responseDelayMs,spokenAnswer:answerLabel};
  }
  function generate(state,catalog,{mode='practice',focus='adaptive',timestamp=Date.now(),seed=`${timestamp}:${mode}:${state.counters?.[mode]||0}`,mark=true}={}){
    const selection=Learning.selectUnit(state,catalog,{mode,focus,timestamp,seed:`select:${seed}`});if(mark)Learning.markShown(state,selection.unit.id,mode,timestamp);
    const question=makeQuestion(state,catalog,selection.unit,{seed:`question:${seed}:${selection.unit.id}`,timestamp});return{...question,selection:{eligible:selection.eligible,score:selection.score,prediction:selection.prediction}};
  }
  return{PROMPTS,TIMBRES,SCORE_PPQ,ARTICULATION_GATE,makeChoices,makeQuestion,generate,durationOf,rhythmSpec,rhythmKit,minRhythmGapTicks,tempoCeiling,symbolicScore,modulationSpec};
});
