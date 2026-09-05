'use strict';
(function(root,factory){const api=factory(root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null),root.EarForgeTimeline||(typeof require==='function'?require('./audio-timeline.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeProduction=api})(typeof globalThis!=='undefined'?globalThis:this,function(Events,Timeline){
  const names=['do','do dièse','ré','mi bémol','mi','fa','fa dièse','sol','la bémol','la','si bémol','si'];
  const label={bass:'Basse',tenor:'Ténor',alto:'Alto',soprano:'Soprano',lower:'Voix inférieure',upper:'Voix supérieure'};
  function noteName(n){return Number.isInteger(n)?names[((n%12)+12)%12]+' '+(Math.floor(n/12)-1):String(n)}
  function extract(question){
    const score=question?.spec?.score;if(!score?.events?.length)throw new Error('Cette question ne fournit pas de voix séparables.');const groups=Events.voices(Timeline.compile(question.spec));
    for(const events of groups.values())for(const e of events)if(!Number.isInteger(e.pitch)||e.cents!==0)throw new Error('Voix hors contrat de reconstruction chromatique.');
    const roles=question.spec.roles||[...groups.keys()],voices=[];for(const role of roles){const events=groups.get(role);if(!events)continue;if(events.length>128||events.some((e,i)=>i>0&&e.time===events[i-1].time))throw new Error('Voix ambiguë ou trop longue.');voices.push({id:role,label:label[role]||'Voix '+(voices.length+1),start:events[0].pitch,notes:events.map(e=>e.pitch),events});}
    if(voices.length<1||voices.length>4||voices.length!==groups.size)throw new Error('Nombre de voix non pris en charge.');
    return{schema:'earforge.reconstruction.target.v1',unitId:question.unitId,seed:question.seed,spec:question.spec,voices,masteryMutation:false,referencePolicy:'FIRST_NOTE_GIVEN',pitchConvention:'C4=60'};
  }
  function create({catalog,questions,state,voices=2,seed,timestamp=Date.now()}){
    if(![2,3,4].includes(Number(voices)))throw new Error('Choisir deux, trois ou quatre voix.');
    const candidates=catalog.units.filter(u=>u.family==='voice'&&(Array.isArray(u.params?.voices)?u.params.voices.length:Number(u.params?.voices)||2)===Number(voices));
    if(!candidates.length)throw new Error('Aucune unité compatible.');let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
    const unit=candidates[h%candidates.length],q=questions.makeQuestion(state,catalog,unit,{seed:String(seed),timestamp,mark:false,operation:'IDENTIFY'}),target=extract(q);
    if(target.voices.length!==Number(voices))throw new Error('Le générateur ne respecte pas le nombre de voix.');return target;
  }
  function parse(text,{mode='relative',start=60}={}){
    if(typeof text!=='string'||text.length>4096)throw new Error('Réponse trop longue.');if(!['relative','notes'].includes(mode))throw new Error('Mode de réponse inconnu.');
    const parts=text.trim().split(/[\s,;]+/u).filter(Boolean);if(parts.length>128)throw new Error('Cent vingt-huit notes au maximum.');
    const offsets={do:0,re:2,mi:4,fa:5,sol:7,la:9,si:11,c:0,d:2,e:4,f:5,g:7,a:9,b:11};
    return parts.map(token=>{let n;if(mode==='relative'){if(!/^[+-]?\d{1,3}$/.test(token))throw new Error('Entrer des demi-tons depuis la note de départ : 0 +2 +4, par exemple.');n=Number(start)+Number(token);}else if(/^\d{1,3}$/.test(token))n=Number(token);else{const clean=token.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('♯','#').replaceAll('♭','b'),m=clean.match(/^(do|re|mi|fa|sol|la|si|[a-g])([#b]?)(-?\d)$/);if(!m)throw new Error('Entrer do4 ré4 mi4, do#4, sib3 ou des numéros MIDI.');n=(Number(m[3])+1)*12+offsets[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);}
      if(!Number.isInteger(n)||n<0||n>127)throw new Error('Hauteur hors plage MIDI de zéro à cent vingt-sept.');return n;});
  }
  function align(expected,actual){
    if(expected.length>128||actual.length>128||[...expected,...actual].some(n=>!Number.isInteger(n)||n<0||n>127))throw new Error('Séquence invalide.');const n=expected.length,m=actual.length,w=m+1,d=new Uint16Array((n+1)*w);
    for(let i=0;i<=n;i++)d[i*w]=i;for(let j=0;j<=m;j++)d[j]=j;
    for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)d[i*w+j]=Math.min(d[(i-1)*w+j]+1,d[i*w+j-1]+1,d[(i-1)*w+j-1]+(expected[i-1]===actual[j-1]?0:1));
    const pairs=[];let i=n,j=m;while(i||j){if(i&&j&&d[i*w+j]===d[(i-1)*w+j-1]+(expected[i-1]===actual[j-1]?0:1)){pairs.push([--i,--j]);}else if(i&&d[i*w+j]===d[(i-1)*w+j]+1)pairs.push([--i,null]);else pairs.push([null,--j]);}pairs.reverse();return{distance:d[n*w+m],pairs};
  }
  function score(target,responses,{replays=0,isolated=[],renderers=[],mode='relative'}={}){
    const perVoice=target.voices.map(v=>{const actual=responses[v.id]||[],a=align(v.notes,actual),matched=a.pairs.filter(([i,j])=>i!==null&&j!==null),exact=matched.filter(([i,j])=>v.notes[i]===actual[j]).length,byIndex=new Map(matched),transitions=Math.max(0,v.notes.length-1);let contour=0,held=0,heldTotal=0;
      for(let i=1;i<v.notes.length;i++){const j=byIndex.get(i),previous=byIndex.get(i-1),available=j!==undefined&&previous!==undefined&&j===previous+1;if(available&&Math.sign(v.notes[i]-v.notes[i-1])===Math.sign(actual[j]-actual[previous]))contour++;if(v.notes[i]===v.notes[i-1]){heldTotal++;if(available&&actual[j]===actual[previous])held++;}}
      const swaps=target.voices.filter(other=>other.id!==v.id&&other.notes.length===actual.length&&actual.every((x,i)=>x===other.notes[i])&&!actual.every((x,i)=>x===v.notes[i])).map(other=>other.id);
      return{voice:v.id,label:v.label,expected:v.notes,actual,editDistance:a.distance,editAccuracy:Math.max(0,1-a.distance/Math.max(1,v.notes.length,actual.length)),exact,expectedCount:v.notes.length,meanPitchError:matched.length?matched.reduce((s,[i,j])=>s+Math.abs(v.notes[i]-actual[j]),0)/matched.length:null,contourAccuracy:transitions?contour/transitions:null,commonToneAccuracy:heldTotal?held/heldTotal:null,possibleVoiceSwaps:swaps};
    });
    const count=perVoice.reduce((s,v)=>s+v.expectedCount,0),noteRecall=perVoice.reduce((s,v)=>s+v.exact,0)/Math.max(1,count),accuracy=Math.max(0,1-perVoice.reduce((s,v)=>s+v.editDistance,0)/Math.max(1,perVoice.reduce((s,v)=>s+Math.max(v.expectedCount,v.actual.length),0))),used=[...new Set(renderers)];
    return{schema:'earforge.reconstruction.result.v1',unitId:target.unitId,seed:target.seed,timestamp:Date.now(),perVoice,accuracy,noteRecall,editDistance:perVoice.reduce((s,v)=>s+v.editDistance,0),replays,isolated:[...new Set(isolated)],assisted:isolated.length>0,referencePolicy:target.referencePolicy,mode,renderers:used,rendererCondition:used.length===1?used[0]:used.length?'mixed':'unplayed',functionalDegree:null,timingScore:null,masteryMutation:false,physicalTimingCertified:false};
  }
  function voiceSpec(target,role){if(!target.voices.some(v=>v.id===role))throw new Error('Voix inconnue.');return{...target.spec,score:{...target.spec.score,events:target.spec.score.events.filter(e=>e.role===role)}};}
  return{create,extract,parse,align,score,voiceSpec,noteName};
});
