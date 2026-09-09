'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeScoreModel=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const LIMITS=Object.freeze({bytes:8*1024*1024,nodes:180000,events:60000,measures:6000,parts:64,depth:64});
  const TYPES=Object.freeze({maxima:32,long:16,breve:8,whole:4,half:2,quarter:1,eighth:.5,'16th':.25,'32nd':.125,'64th':.0625,'128th':.03125,'256th':.015625,'512th':.0078125,'1024th':.00390625});
  const STEP={C:0,D:2,E:4,F:5,G:7,A:9,B:11}, indexCache=new WeakMap();
  function fail(message){throw new Error(message)}
  function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){const t=b;b=a%b;a=t}return a||1n}
  function rat(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d)fail('Dénominateur nul.');if(d<0n){n=-n;d=-d}const g=gcd(n,d);return`${n/g}/${d/g}`}
  function q(v){const s=String(v).trim();if(s.length>40)fail('Valeur numérique trop longue.');if(/^-?\d+\/\d+$/.test(s)){const [n,d]=s.split('/');return rat(n,d)}if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))fail('Valeur numérique invalide : '+s);const [a,b='']=s.split('.');return rat(BigInt(a+b),10n**BigInt(b.length))}
  function pair(v){return q(v).split('/').map(BigInt)}
  function add(a,b){const [n,d]=pair(a),[m,e]=pair(b);return rat(n*e+m*d,d*e)}
  function sub(a,b){const [n,d]=pair(a),[m,e]=pair(b);return rat(n*e-m*d,d*e)}
  function mul(a,b){const [n,d]=pair(a),[m,e]=pair(b);return rat(n*m,d*e)}
  function div(a,b){const [n,d]=pair(a),[m,e]=pair(b);return rat(n*e,d*m)}
  function cmp(a,b){const [n,d]=pair(a),[m,e]=pair(b),x=n*e-m*d;return x<0n?-1:x>0n?1:0}
  function num(a){const [n,d]=pair(a);return Number(n)/Number(d)}
  const kids=(n,name)=>Array.from(n?.children||[]).filter(x=>!name||x.localName===name);
  const first=(n,name)=>kids(n,name)[0]||null;
  const text=(n,name,fallback='')=>(name?first(n,name):n)?.textContent?.trim()??fallback;
  const attr=(n,name,fallback='')=>n?.getAttribute(name)??fallback;
  function raw(n){return{tag:n.localName,attributes:Object.fromEntries(Array.from(n.attributes||[],a=>[a.name,a.value])),text:text(n).slice(0,2000)}}
  function xml(textValue){
    if(typeof textValue!=='string'||new TextEncoder().encode(textValue).length>LIMITS.bytes)fail('Fichier trop volumineux : huit mégaoctets maximum.');
    if(/<!ENTITY\b|<!DOCTYPE[^>]*\[/i.test(textValue))fail('Les entités et déclarations XML internes ne sont pas autorisées.');
    if(typeof DOMParser==='undefined')fail('Le lecteur XML du navigateur est indisponible.');
    const clean=textValue.replace(/<!DOCTYPE\s[^>]*>/gi,''),doc=new DOMParser().parseFromString(clean,'application/xml');
    if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.localName==='parsererror')fail('XML mal formé.');
    const all=doc.getElementsByTagName('*');if(all.length>LIMITS.nodes)fail('La partition dépasse la limite de complexité.');
    const stack=[[doc.documentElement,0]];while(stack.length){const [el,depth]=stack.pop();if(depth>LIMITS.depth)fail('XML trop profondément imbriqué.');for(const c of kids(el))stack.push([c,depth+1])}
    return doc;
  }
  const pointCmp=(a,b)=>a.measure-b.measure||cmp(a.t,b.t);
  function getIndex(score){
    if(indexCache.has(score))return indexCache.get(score);
    const idx={states:new Map(),events:new Map(score.E.map(e=>[e.id,e])),byMeasure:new Map(),measureEvents:new Map(),measureStates:new Map(),measureWarnings:new Map(),measureForms:new Map()};
    for(const s of score.S){const k=`${s.scope.part}|${s.kind}`;if(!idx.states.has(k))idx.states.set(k,[]);idx.states.get(k).push(s)}
    for(const rows of idx.states.values())rows.sort((a,b)=>pointCmp(a.from,b.from)||a.order-b.order);
    for(const e of score.E){const k=`${e.part}|${e.measure}`;if(!idx.byMeasure.has(k))idx.byMeasure.set(k,[]);idx.byMeasure.get(k).push(e);if(!idx.measureEvents.has(e.measure))idx.measureEvents.set(e.measure,[]);idx.measureEvents.get(e.measure).push(e)}
    for(const [rows,map,pos]of [[score.S,idx.measureStates,x=>x.from.measure],[score.U,idx.measureWarnings,x=>x.location.measure],[score.F,idx.measureForms,x=>x.source.measure]])for(const x of rows){const m=pos(x);if(!map.has(m))map.set(m,[]);map.get(m).push(x)}
    indexCache.set(score,idx);return idx;
  }
  function stateAt(score,part,kind,measure,t='0/1',staff=null,voice=null){
    const rows=getIndex(score).states.get(`${part}|${kind}`)||[],p={measure,t};let chosen=null;
    let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(pointCmp(rows[mid].from,p)<=0)lo=mid+1;else hi=mid}
    for(let i=lo-1;i>=0;i--){const s=rows[i];if(s.scope.staff&&String(s.scope.staff)!==String(staff))continue;if(s.scope.voice&&String(s.scope.voice)!==String(voice))continue;chosen=s;break}
    return chosen;
  }
  function parse(source){
    const doc=xml(source),root=doc.documentElement,format=root.localName;
    if(!['score-partwise','score-timewise'].includes(format))fail('Le fichier doit contenir une partition MusicXML partwise ou timewise.');
    const score={schema:'earforge.score.v1',format,title:text(first(root,'work'),'work-title')||text(root,'movement-title'),composer:kids(first(root,'identification'),'creator').filter(x=>attr(x,'type')==='composer').map(x=>text(x)).join('; '),X:[],S:[],E:[],R:[],F:[],U:[],parts:[],measures:[],formPolicy:'WRITTEN_ORDER',sourceHash:null};let serial=0,eventCount=0;
    const uid=prefix=>prefix+(++serial);
    const warning=(code,message,location={},observed=null,severity='warning')=>{const u={id:uid('u'),code,message,location,field:code,observed,candidates:[],prov:'UNKNOWN',severity};score.U.push(u);return u};
    const state=(kind,value,part,measure,t,staff=null,voice=null,extra={})=>{const s={id:uid('s'),kind,scope:{part,staff,voice},value,from:{measure,t},to:null,order:serial,prov:'EXPLICIT',...extra};score.S.push(s);return s};
    const listed=kids(first(root,'part-list'),'score-part');if(!listed.length)fail('Liste de parties absente.');if(listed.length>LIMITS.parts)fail('Trop de parties.');
    const usedPartIds=new Set();
    for(const sp of listed){const id=attr(sp,'id');if(!id||usedPartIds.has(id))fail('Identifiant de partie absent ou dupliqué.');usedPartIds.add(id);const instruments=kids(sp,'score-instrument').map(n=>{const iid=attr(n,'id'),mi=kids(sp,'midi-instrument').find(x=>attr(x,'id')===iid);return{id:iid,name:text(n,'instrument-name'),sound:text(n,'instrument-sound'),program:text(mi,'midi-program')?Number(text(mi,'midi-program')):null,unpitched:text(mi,'midi-unpitched')?Number(text(mi,'midi-unpitched'))-1:null,channel:text(mi,'midi-channel')?Number(text(mi,'midi-channel')):null}});const p={id,name:text(sp,'part-name')||id,instruments,measures:[]};score.parts.push(p);score.X.push({id,kind:'part',parent:null,attrs:{name:p.name,instruments},prov:'EXPLICIT'})}
    const blocks=new Map(score.parts.map(p=>[p.id,[]])),seenBlocks=new Set();
    if(format==='score-partwise')for(const pn of kids(root,'part')){const id=attr(pn,'id');if(!blocks.has(id))fail('Partie absente de la liste : '+id);if(seenBlocks.has(id))fail('Partie dupliquée.');seenBlocks.add(id);blocks.set(id,kids(pn,'measure').map((m,i)=>({node:m,meta:m,index:i})))}
    else kids(root,'measure').forEach((m,i)=>{for(const pn of kids(m,'part')){const id=attr(pn,'id');if(!blocks.has(id))fail('Partie inconnue.');const blockKey=id+'|'+i;if(seenBlocks.has(blockKey))fail('Partie dupliquée dans la mesure.');seenBlocks.add(blockKey);blocks.get(id).push({node:pn,meta:m,index:i})}});
    const relationOpen=new Map();
    function span(kind,type,key,event,attrsValue={},parent=null){
      if(type==='start'||type==='crescendo'||type==='diminuendo'||type==='down'||type==='up'){
        if(relationOpen.has(key))warning('span_overlap','Début de relation répété avant sa fin.',{event:event.id},kind);
        const r={id:uid('r'),kind,members:event.id?[event.id]:[],from:event.id||{part:event.part,measure:event.measure,t:event.t,staff:event.staff,voice:event.voice},to:null,parent,attrs:attrsValue,prov:'EXPLICIT'};score.R.push(r);relationOpen.set(key,r);return r;
      }
      const r=relationOpen.get(key);
      if(type==='stop'||type==='discontinue'){if(r){r.to=event.id||{part:event.part,measure:event.measure,t:event.t,staff:event.staff,voice:event.voice};if(event.id&&!r.members.includes(event.id))r.members.push(event.id);relationOpen.delete(key);return r}warning('open_span','Fin de relation sans début déterminable.',{part:event.part,measure:event.measure,event:event.id},kind);return null}
      if(r&&event.id&&!r.members.includes(event.id))r.members.push(event.id);return r||null;
    }
    for(const part of score.parts){let divisions=null;const rows=blocks.get(part.id);if(!rows.length)warning('empty_part','Partie sans mesure.',{part:part.id});
      for(const block of rows){const mi=block.index;if(mi>=LIMITS.measures)fail('Trop de mesures.');const mn=block.meta,measure={id:`${part.id}.m${mi}`,index:mi,number:attr(mn,'number',String(mi+1)),implicit:attr(mn,'implicit')==='yes',nonControlling:attr(mn,'non-controlling')==='yes',events:[],extent:'0/1',timingValid:true};part.measures.push(measure);score.X.push({id:measure.id,kind:'measure',parent:part.id,attrs:{number:measure.number,implicit:measure.implicit},prov:'EXPLICIT'});let cursor='0/1',lastBase=null,chordRelation=null;
        const loc=()=>({part:part.id,measure:mi,t:cursor});
        function duration(n,optional=false){const v=text(n,'duration');if(!v){if(optional)return'0/1';throw new Error('Durée absente.')}if(!divisions)throw new Error('Divisions absentes.');const d=div(q(v),divisions);if(cmp(d,'0')<=0)throw new Error('Durée non positive.');return d}
        for(const n of kids(block.node)){const tag=n.localName;
          if(tag==='attributes'){
            if(first(n,'divisions')){try{divisions=q(text(n,'divisions'));if(cmp(divisions,'0')<=0)throw new Error('Divisions non positives.')}catch(e){divisions=null;measure.timingValid=false;warning('divisions',e.message,loc(),text(n,'divisions'),'error')}}
            for(const a of kids(n)){const k=a.localName,staff=attr(a,'number')||null;if(k==='divisions')continue;
              if(k==='time'){const pairs=[];let beats=null;for(const x of kids(a)){if(x.localName==='beats')beats=text(x);if(x.localName==='beat-type'&&beats!==null){pairs.push({beats,unit:text(x)});beats=null}}let capacity=null;try{if(pairs.length){capacity='0/1';for(const pair of pairs){if(!/^\d+(\+\d+)*$/.test(pair.beats))throw 0;const denominator=q(pair.unit);if(cmp(denominator,0)<=0)throw 0;for(const b of pair.beats.split('+'))capacity=add(capacity,div(mul(b,4),denominator))}}}catch{warning('meter','Métrique non interprétable.',loc(),raw(a))}state('meter',{pairs,free:!!first(a,'senza-misura'),capacity,symbol:attr(a,'symbol')},part.id,mi,cursor,staff)}
              else if(k==='key')state('key',{fifths:text(a,'fifths')||null,mode:text(a,'mode')||null,native:kids(a).map(raw)},part.id,mi,cursor,staff);
              else if(k==='clef')state('clef',{sign:text(a,'sign'),line:text(a,'line'),octave:text(a,'clef-octave-change')||'0'},part.id,mi,cursor,staff);
              else if(k==='transpose'){try{const chromatic=q(text(a,'chromatic')),octave=q(text(a,'octave-change')||'0');state('transpose',{chromatic,octave,diatonic:text(a,'diatonic')||null,semitones:add(chromatic,mul(octave,12))},part.id,mi,cursor,staff);if(first(a,'double'))warning('transpose_double','Doublure transposée conservée mais non synthétisée.',loc(),raw(a))}catch{warning('transpose','Transposition indéterminable.',loc(),raw(a),'error');state('transpose',{semitones:null},part.id,mi,cursor,staff)}}
              else if(k==='staff-details')state('staff-details',{native:kids(a).map(raw),tuning:kids(a,'staff-tuning').map(x=>({line:attr(x,'line'),step:text(x,'tuning-step'),alter:text(x,'tuning-alter')||'0',octave:text(x,'tuning-octave')}))},part.id,mi,cursor,staff);
              else if(!['staves','part-symbol','instruments','footnote','level'].includes(k))warning('attribute','Attribut conservé sans interprétation complète.',loc(),raw(a));
            }
          }else if(tag==='backup'||tag==='forward'){
            try{const d=duration(n);cursor=tag==='backup'?sub(cursor,d):add(cursor,d);if(cmp(cursor,0)<0)throw new Error('Retour avant le début de la mesure.');if(cmp(cursor,measure.extent)>0)measure.extent=cursor}catch(e){measure.timingValid=false;warning('cursor',e.message,loc(),raw(n),'error')}
            lastBase=null;chordRelation=null;
          }else if(tag==='note'){
            if(++eventCount>LIMITS.events)fail('Trop de notes.');const id=`${measure.id}.e${measure.events.length}`,staff=text(n,'staff')||'1',voice=text(n,'voice')||'1',grace=first(n,'grace'),isChord=!!first(n,'chord');let d='0/1',valid=true;
            try{d=duration(n,!!grace)}catch(e){valid=false;measure.timingValid=false;warning('duration',e.message,{...loc(),event:id},raw(n),'error')}
            let onset=cursor;if(isChord){if(!lastBase||lastBase.voice!==voice){warning('chord','Accord sans note de base cohérente.',{...loc(),event:id},null,'error');valid=false;measure.timingValid=false}else onset=lastBase.t}
            const pitch=first(n,'pitch'),unpitched=first(n,'unpitched'),rest=first(n,'rest'),instId=attr(first(n,'instrument'),'id')||part.instruments[0]?.id||null;let payload;
            if(rest)payload={kind:'rest',wholeMeasure:attr(rest,'measure')==='yes'};
            else if(unpitched)payload={kind:'unpitched',instrument:instId,display_position:{step:text(unpitched,'display-step'),octave:text(unpitched,'display-octave')}};
            else if(pitch){const step=text(pitch,'step'),octave=text(pitch,'octave'),alter=text(pitch,'alter')||'0';try{if(!(step in STEP)||!/^\d$/.test(octave))throw 0;payload={kind:'pitch',written:{step,alter:q(alter),octave:Number(octave)},sounding:null,transform:[]}}catch{payload={kind:'unknown'};valid=false;warning('pitch','Hauteur invalide.',{...loc(),event:id},raw(pitch),'error')}}
            else{payload={kind:'unknown'};valid=false;warning('pitch','Hauteur ou silence absent.',{...loc(),event:id},null,'error')}
            const tm=first(n,'time-modification'),notations=kids(n,'notations').flatMap(x=>kids(x)),technical=notations.filter(x=>x.localName==='technical').flatMap(x=>kids(x));
            const event={id,part:part.id,measure:mi,staff,voice,t:onset,advance:isChord||grace?'0/1':d,duration:d,sustain:d,notated:{type:text(n,'type')||null,dots:kids(n,'dot').length,grace:grace?raw(grace):null,ratio:tm?{actual:text(tm,'actual-notes'),normal:text(tm,'normal-notes'),type:text(tm,'normal-type'),dots:kids(tm,'normal-dot').length}:null},payload,prov:'EXPLICIT',instrument:instId,cue:!!first(n,'cue'),valid,sourceOrder:eventCount,accidental:first(n,'accidental')?raw(first(n,'accidental')):null,lyrics:kids(n,'lyric').map(x=>({verse:attr(x,'number')||null,syllabic:text(x,'syllabic')||null,text:kids(x).filter(a=>['text','elision'].includes(a.localName)).map(a=>text(a)).join(''),extend:first(x,'extend')?attr(first(x,'extend'),'type','continue'):null})),technical:technical.map(raw),articulations:notations.filter(x=>x.localName==='articulations').flatMap(x=>kids(x)).map(raw),ornaments:notations.filter(x=>x.localName==='ornaments').flatMap(x=>kids(x)).map(raw),ties:kids(n,'tie').map(x=>attr(x,'type')),marks:[],noteDynamics:attr(n,'dynamics')||null};
            if(technical.length)payload.native={string:text(technical.find(x=>x.localName==='string')),fret:text(technical.find(x=>x.localName==='fret')),fingering:technical.filter(x=>x.localName==='fingering').map(raw),harmonic:technical.find(x=>x.localName==='harmonic')?raw(technical.find(x=>x.localName==='harmonic')):null};
            if(event.payload.native?.harmonic&&!technical.some(x=>x.localName==='harmonic'&&first(x,'sounding-pitch')))warning('harmonic_audio','Harmonique notée : réalisation sonore non déterminée.',{part:part.id,measure:mi,event:id},event.payload.native.harmonic);
            if(isChord&&lastBase){if(!chordRelation){chordRelation={id:uid('r'),kind:'chord',members:[lastBase.id],from:lastBase.id,to:null,parent:null,attrs:{},prov:'EXPLICIT'};score.R.push(chordRelation)}chordRelation.members.push(id);event.chord=chordRelation.id;lastBase.chord=chordRelation.id}
            else {lastBase=event;chordRelation=null;cursor=add(cursor,event.advance)}
            const end=add(onset,d);if(cmp(end,measure.extent)>0)measure.extent=end;measure.events.push(id);score.E.push(event);
            for(const x of notations){const kind=x.localName,type=attr(x,'type'),number=attr(x,'number','1');if(['slur','tied','tuplet','glissando','slide'].includes(kind)){
              const key=kind==='tied'?`${part.id}|tied|${voice}|${JSON.stringify(payload.written)}`:`${part.id}|${kind}|${number}`;
              const parents=kind==='tuplet'?[...relationOpen.values()].filter(r=>r.kind==='tuplet'&&r.attrs.part===part.id&&r.attrs.voice===voice):[];
              span(kind,type,key,event,{number,part:part.id,voice,...raw(x),ratio:event.notated.ratio},parents.at(-1)?.id||null);
              event.marks.push({kind,type,number});
            }else if(['arpeggiate','non-arpeggiate','fermata','dynamics','other-notation'].includes(kind)){event.marks.push({kind,...raw(x)});if(kind!=='dynamics')warning('notation_audio','Indication conservée ; réalisation sonore simplifiée.',{part:part.id,measure:mi,event:id},raw(x))}
            else if(!['articulations','ornaments','technical','footnote','level'].includes(kind))warning('notation','Notation conservée sans interprétation complète.',{part:part.id,measure:mi,event:id},raw(x))}
            for(const r of relationOpen.values())if(r.kind==='tuplet'&&r.attrs.part===part.id&&r.attrs.voice===voice&&!r.members.includes(id))r.members.push(id);
            if(grace)warning('grace_audio','Note d’agrément sans durée métrique : non jouée dans cet aperçu.',{part:part.id,measure:mi,event:id});
            if(event.ornaments.length)warning('ornament_audio','Ornement conservé dans la dictée ; non développé dans cet aperçu.',{part:part.id,measure:mi,event:id},event.ornaments);
            if(attr(n,'attack')||attr(n,'release'))warning('performance_offset','Décalage interprétatif conservé ; aperçu aux durées métriques.',{part:part.id,measure:mi,event:id},raw(n));
          }else if(tag==='direction'||tag==='sound'){
            let dt=cursor;try{if(text(n,'offset')){if(!divisions)throw 0;dt=add(cursor,div(text(n,'offset'),divisions));if(cmp(dt,0)<0)throw 0}}catch{warning('offset','Position d’indication indéterminable.',loc(),raw(n));continue}
            const staff=text(n,'staff')||null,voice=text(n,'voice')||null,at={part:part.id,measure:mi,t:dt,staff,voice},sound=tag==='sound'?n:first(n,'sound');
            // Layout offsets and sounding offsets are distinct MusicXML domains.
            let soundTime=tag==='sound'||attr(first(n,'offset'),'sound')==='yes'?dt:cursor;
            if(tag==='direction'&&first(sound,'offset'))try{if(!divisions)throw 0;soundTime=add(cursor,div(text(sound,'offset'),divisions));if(cmp(soundTime,0)<0)throw 0}catch{warning('sound_offset','Position sonore indéterminable.',loc(),raw(sound),'error');measure.timingValid=false;continue}
            if(attr(sound,'tempo')){try{const v=q(attr(sound,'tempo'));if(cmp(v,0)<=0)throw 0;state('tempo',{bpm:v,unit:'quarter',source:'sound'},part.id,mi,soundTime,null,null)}catch{warning('tempo','Tempo numérique invalide.',at,raw(sound))}}
            if(attr(sound,'dynamics'))state('sound-dynamics',{value:attr(sound,'dynamics')},part.id,mi,soundTime,staff,voice);
            for(const x of kids(n,'direction-type').flatMap(x=>kids(x))){const kind=x.localName;
              if(kind==='metronome'&&!attr(sound,'tempo')){const unit=text(x,'beat-unit'),per=text(x,'per-minute'),dots=kids(x,'beat-unit-dot').length;try{if(!TYPES[unit]||!/^\d+(\.\d+)?$/.test(per))throw 0;const factor=2-1/2**dots;state('tempo',{bpm:mul(per,q(String(TYPES[unit]*factor))),unit,perMinute:per,dots,source:'metronome'},part.id,mi,dt)}catch{warning('tempo_text','Indication métronomique non numérique conservée.',at,raw(x));state('words',{text:text(x)},part.id,mi,dt,staff,voice)}}
              else if(kind==='dynamics')state('dynamics',{values:kids(x).map(a=>a.localName==='other-dynamics'?text(a):a.localName)},part.id,mi,dt,staff,voice);
              else if(['words','rehearsal'].includes(kind))state(kind,{text:text(x)},part.id,mi,dt,staff,voice);
              else if(['wedge','pedal','octave-shift'].includes(kind)){const type=attr(x,'type'),number=attr(x,'number','1');state(kind,{type,size:attr(x,'size','8'),number},part.id,mi,dt,staff,voice);span(kind,type,`${part.id}|${kind}|${staff||'*'}|${number}`,at,{...raw(x),part:part.id,voice});if(kind==='pedal'||kind==='wedge')warning('span_audio','Indication continue conservée ; effet sonore non développé.',at,raw(x))}
              else if(['segno','coda'].includes(kind))score.F.push({id:uid('f'),kind,source:at,target:null,condition:null,attrs:raw(x),prov:'EXPLICIT'});
              else if(kind!=='metronome')warning('direction','Indication conservée sans interprétation complète.',at,raw(x));
            }
            for(const a of ['dacapo','dalsegno','tocoda','fine','segno','coda'])if(attr(sound,a))score.F.push({id:uid('f'),kind:a,source:at,target:attr(sound,a),condition:attr(sound,'time-only')||null,attrs:{},prov:'EXPLICIT'});
          }else if(tag==='barline'){
            for(const x of kids(n)){if(['repeat','ending'].includes(x.localName))score.F.push({id:uid('f'),kind:x.localName,source:{part:part.id,measure:mi,t:cursor},target:null,condition:attr(x,'times')||attr(x,'number')||null,attrs:{...raw(x),location:attr(n,'location','right')},prov:'EXPLICIT'});else if(!['bar-style','footnote','level'].includes(x.localName))warning('barline','Indication de barre conservée.',loc(),raw(x))}
          }else if(tag==='harmony'){
            let ht=cursor;try{if(first(n,'offset')){if(!divisions)throw 0;ht=add(cursor,div(text(n,'offset'),divisions));if(cmp(ht,0)<0)throw 0}}catch{warning('harmony_offset','Position de l’harmonie indéterminable.',loc(),raw(n),'error');continue}
            const components=[];let component=null;
            for(const x of kids(n)){const k=x.localName;if(['root','numeral','function'].includes(k)){component={root:k==='root'?text(x,'root-step'):'',alter:k==='root'?text(x,'root-alter')||'0':'0',function:k==='function'?text(x):'',numeral:k==='numeral'?text(x,'numeral-root'):'',kind:'',label:'',inversion:null,bass:'',bassAlter:'0',degrees:[]};components.push(component)}
              if(!component&&k==='kind'){component={root:'',alter:'0',kind:'',label:'',inversion:null,bass:'',bassAlter:'0',degrees:[]};components.push(component)}if(!component)continue;
              if(k==='kind'){component.kind=text(x);component.label=attr(x,'text')}else if(k==='inversion')component.inversion=text(x);else if(k==='bass'){component.bass=text(x,'bass-step');component.bassAlter=text(x,'bass-alter')||'0'}else if(k==='degree')component.degrees.push({value:text(x,'degree-value'),alter:text(x,'degree-alter'),type:text(x,'degree-type'),...raw(x)})
            }
            state('harmony',{...(components[0]||{root:'',alter:'0',kind:'',degrees:[]}),components},part.id,mi,ht,text(n,'staff')||null);
            warning('harmony_audio','Harmonie notée conservée ; aucun accompagnement n’est inventé.',{part:part.id,measure:mi,t:ht})
          }
          else if(tag==='figured-bass')warning('figured_bass','Basse chiffrée conservée sans réalisation ajoutée.',loc(),raw(n));
          else if(!['print','bookmark','link'].includes(tag))warning('music_data','Élément musical conservé sans interprétation complète.',loc(),raw(n));
        }
      }
    }
    for(const r of relationOpen.values())warning('open_relation','Relation ouverte à la fin de la source.',{relation:r.id},r.kind);
    getIndex(score);
    const measureMaps=score.parts.map(p=>new Map(p.measures.map(m=>[m.index,m]))),len=Math.max(0,...score.parts.flatMap(p=>p.measures.map(m=>m.index+1)));
    for(let i=0;i<len;i++){const ms=measureMaps.map(p=>p.get(i)).filter(Boolean);let duration='0/1';for(const m of ms){if(cmp(m.extent,duration)>0)duration=m.extent}score.measures.push({index:i,number:ms[0]?.number||String(i+1),duration,timingValid:ms.every(m=>m.timingValid)});}
    const starts=['0/1'];for(const m of score.measures)starts.push(add(starts.at(-1),m.duration));
    for(const e of score.E){if(e.payload.kind==='pitch'){
      const w=e.payload.written;e.payload.encoded={...w};const s=stateAt(score,e.part,'transpose',e.measure,e.t,e.staff,e.voice);const base=add((w.octave+1)*12+STEP[w.step],w.alter);
      e.payload.sounding=s?.value.semitones===null?null:add(base,s?.value.semitones||0);if(s)e.payload.transform.push({id:s.id,kind:'transpose',semitones:s.value.semitones,prov:'EXPLICIT'});
      const oct=stateAt(score,e.part,'octave-shift',e.measure,e.t,e.staff,e.voice);if(oct&&['up','down'].includes(oct.value.type)){e.payload.octaveDisplay={state:oct.id,...oct.value};const shift=(Number(oct.value.size)-1)/7;if(Number.isInteger(shift)&&shift>=1&&shift<=3)e.payload.written={...w,octave:w.octave+(oct.value.type==='down'?-shift:shift)};else warning('octave_display','Déplacement d’octave graphique non résolu.',{part:e.part,measure:e.measure,event:e.id},oct.value)}
      // MusicXML octave-shift alters engraving, never the pitch data a second time.
    }}
    const pending=new Map(),events=score.E.slice().sort((a,b)=>a.measure-b.measure||cmp(a.t,b.t)||a.sourceOrder-b.sourceOrder);
    for(const e of events){if(e.payload.kind!=='pitch')continue;const key=`${e.part}|${e.voice}|${e.instrument}|${JSON.stringify(e.payload.encoded)}`,stop=e.ties.includes('stop'),start=e.ties.includes('start');
      if(stop){const prev=pending.get(key);if(prev&&prev.payload.sounding===e.payload.sounding){const rootEvent=prev.tieRoot?getIndex(score).events.get(prev.tieRoot):prev;const a=starts[prev.measure],b=starts[e.measure];if(cmp(add(add(a,prev.t),prev.duration),add(b,e.t))===0){e.tieRoot=rootEvent.id;rootEvent.sustain=add(rootEvent.sustain,e.duration);score.R.push({id:uid('r'),kind:'tie',members:[prev.id,e.id],from:prev.id,to:e.id,parent:null,attrs:{},prov:'EXPLICIT'})}else warning('tie_gap','Liaison de prolongation non contiguë.',{part:e.part,measure:e.measure,event:e.id},null,'error')}else warning('tie_open','Prolongation sans début de même hauteur.',{part:e.part,measure:e.measure,event:e.id});pending.delete(key)}
      if(start)pending.set(key,e);
    }
    for(const [key,e] of pending)warning('tie_unclosed','Prolongation sans fin dans le fichier.',{part:e.part,measure:e.measure,event:e.id});
    for(const part of score.parts)for(const m of part.measures){const meter=stateAt(score,part.id,'meter',m.index,'0/1','1');if(!m.implicit&&meter?.value.capacity&&cmp(m.extent,meter.value.capacity)!==0)warning('measure_extent','Durée observée différente de la capacité métrique ; aucune durée n’est ajoutée.',{part:part.id,measure:m.index},{observed:m.extent,capacity:meter.value.capacity});}
    indexCache.delete(score);const validation=validate(score);score.validation=validation;return score;
  }
  function validate(score){
    const issues=[],ids=new Set();for(const rows of [score.X,score.S,score.E,score.R,score.F,score.U])for(const x of rows){if(ids.has(x.id))issues.push('duplicate:'+x.id);ids.add(x.id)}
    const events=new Map(score.E.map(e=>[e.id,e]));for(const e of score.E){try{if(cmp(e.t,0)<0||cmp(e.duration,0)<0||cmp(e.advance,0)<0)issues.push('time:'+e.id)}catch{issues.push('rational:'+e.id)}if(e.payload.kind==='unpitched'&&('sounding'in e.payload))issues.push('unpitched:'+e.id);if(new Set((e.payload.transform||[]).map(x=>x.id)).size!==(e.payload.transform||[]).length)issues.push('transform:'+e.id)}
    const rel=new Map(score.R.map(r=>[r.id,r]));for(const r of score.R){for(const id of r.members||[])if(!events.has(id))issues.push('reference:'+r.id);if(r.kind==='chord'){const es=r.members.map(id=>events.get(id)).filter(Boolean);if(es.some(e=>e.part!==es[0].part||e.measure!==es[0].measure||e.voice!==es[0].voice||cmp(e.t,es[0].t)!==0))issues.push('chord:'+r.id)}const seen=new Set([r.id]);let parent=r.parent;while(parent){if(seen.has(parent)||!rel.has(parent)){issues.push('hierarchy:'+r.id);break}seen.add(parent);parent=rel.get(parent).parent}}
    return{ok:issues.length===0,issues,events:score.E.length,parts:score.parts.length,measures:score.measures.length,uncertainties:score.U.length};
  }
  return{parse,validate,xml,stateAt,getIndex,kids,first,text,attr,q,add,sub,mul,div,cmp,num,TYPES,LIMITS};
});
