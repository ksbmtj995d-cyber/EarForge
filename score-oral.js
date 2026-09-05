'use strict';
(function(root,factory){const api=factory(root.EarForgeScoreModel||(typeof require==='function'?require('./score-model.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeScoreOral=api})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  const low=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
  function integer(n){n=Number(n);if(!Number.isSafeInteger(n))return String(n).replace(/\d/g,d=>low[Number(d)]+' ');if(n<0)return'moins '+integer(-n);if(n<17)return low[n];if(n<20)return'dix-'+low[n-10];if(n<70){const d=['','','vingt','trente','quarante','cinquante','soixante'][Math.floor(n/10)],r=n%10;return d+(r===1?' et un':r?'-'+integer(r):'')}if(n<80)return'soixante'+(n===71?' et ':'-')+integer(n-60);if(n<100)return'quatre-vingt'+(n===80?'s':'-'+integer(n-80));if(n<1000){const h=Math.floor(n/100),r=n%100;return(h===1?'cent':integer(h)+' cent'+(!r?'s':''))+(r?' '+integer(r):'')}if(n<1000000){const h=Math.floor(n/1000),r=n%1000;return(h===1?'mille':integer(h)+' mille')+(r?' '+integer(r):'')}const h=Math.floor(n/1000000),r=n%1000000;return integer(h)+' million'+(h>1?'s':'')+(r?' '+integer(r):'')}
  function natural(value){return String(value??'').replace(/-?\d+(?:[.,]\d+)?/g,s=>{const [a,b]=s.split(/[.,]/);return integer(Number(a))+(b?' virgule '+b.split('').map(x=>low[Number(x)]).join(' '):'')})}
  function rational(value){const [n,d]=M.q(value).split('/').map(Number);return d===1?integer(n):integer(n)+' sur '+integer(d)}
  function quantity(value){const[n,d]=M.q(value).split('/').map(Number);if(n===0)return'zéro noire';if(d===1)return(n===1?'une':integer(n))+' noire'+(n===1?'':'s');const fractions={2:'demi',3:'tiers',4:'quart',6:'sixième',8:'huitième',16:'seizième'};if(n===1&&fractions[d])return(d===2?'une demi-noire':'un '+fractions[d]+' de noire');return rational(value)+' noires'}
  const names={C:'do',D:'ré',E:'mi',F:'fa',G:'sol',A:'la',B:'si'};
  function pitch(w){if(!w)return'hauteur indéterminée';const a=M.num(w.alter||0),alt=a===0?'':a===1?' dièse':a===-1?' bémol':a===2?' double dièse':a===-2?' double bémol':a===.5?' demi-dièse':a===-.5?' demi-bémol':' altéré de '+natural(a*100)+' cents';return(names[w.step]||w.step)+alt+' '+integer(w.octave)}
  const durations={maxima:'maxime',long:'longue',breve:'carrée',whole:'ronde',half:'blanche',quarter:'noire',eighth:'croche','16th':'double croche','32nd':'triple croche','64th':'quadruple croche','128th':'quintuple croche','256th':'sextuple croche','512th':'septuple croche','1024th':'octuple croche'};
  function duration(e){const n=e.notated;let s=n.type?durations[n.type]||natural(n.type):'durée '+quantity(e.duration);if(n.dots)s+=n.dots===1?' pointée':n.dots===2?' doublement pointée':' avec '+integer(n.dots)+' points';if(n.ratio)s+=' ; groupe de '+natural(n.ratio.actual)+' pour '+natural(n.ratio.normal);if(n.grace)s='agrément, '+s+' ; sans durée métrique attribuée';return s}
  const technique={staccato:'staccato',staccatissimo:'staccatissimo',tenuto:'tenuto',accent:'accent', 'strong-accent':'accent marqué','detached-legato':'détaché lié', 'breath-mark':'respiration',caesura:'césure',upBow:'coup d’archet vers le haut',downBow:'coup d’archet vers le bas','up-bow':'archet poussé','down-bow':'archet tiré','trill-mark':'trille',turn:'gruppetto','inverted-turn':'gruppetto renversé',mordent:'mordant','inverted-mordent':'mordant renversé','wavy-line':'ligne ondulée','tremolo':'trémolo','shake':'tremblement',harmonic:'harmonique','open-string':'corde à vide','stopped':'son bouché','snap-pizzicato':'pizzicato claqué','bend':'inflexion de hauteur'};
  const finger={1:'pouce',2:'index',3:'majeur',4:'annulaire',5:'auriculaire'};
  function fingering(e,score,value){const p=score.parts.find(p=>p.id===e.part),ins=p?.instruments.find(x=>x.id===e.instrument)||p?.instruments[0],keyboard=(ins?.program>=1&&ins?.program<=8)||/^(piano|pianoforte|clavier|organ|orgue|clavecin|harpsichord)$/i.test(p?.name||'');return keyboard?(finger[value]||natural(value)):natural(value)+' ; désignation anatomique non déduite'}
  const dynamic={pppp:'quadruple piano',ppp:'triple piano',pp:'pianissimo',p:'piano',mp:'mezzo piano',mf:'mezzo forte',f:'forte',ff:'fortissimo',fff:'triple forte',ffff:'quadruple forte',sf:'sforzando',sfz:'sforzato',fp:'forte piano',rfz:'rinforzando'};
  const chordKinds={major:'majeur',minor:'mineur',augmented:'augmenté',diminished:'diminué',dominant:'septième de dominante','major-seventh':'septième majeure','minor-seventh':'septième mineure','diminished-seventh':'septième diminuée','augmented-seventh':'septième augmentée','half-diminished':'demi-diminué','major-minor':'mineur avec septième majeure','major-sixth':'sixte majeure','minor-sixth':'sixte mineure','dominant-ninth':'neuvième de dominante','major-ninth':'neuvième majeure','minor-ninth':'neuvième mineure','dominant-11th':'onzième de dominante','major-11th':'onzième majeure','minor-11th':'onzième mineure','dominant-13th':'treizième de dominante','major-13th':'treizième majeure','minor-13th':'treizième mineure','suspended-second':'suspendu sur la seconde','suspended-fourth':'suspendu sur la quarte',power:'quinte sans tierce',pedal:'pédale',Tristan:'accord de Tristan',other:'type particulier'};
  const pitchClass=(step,alter=0)=>pitch({step,alter,octave:0}).replace(/ zéro$/,'');
  function harmonyText(v){if(v.components?.length>1)return'harmonies superposées : '+v.components.map(x=>harmonyText(x)).join(' ; puis ');if(v.kind==='none')return'sans accord';
    let out='harmonie '+(v.root?pitchClass(v.root,v.alter):v.function?'fonction '+natural(v.function):v.numeral?'degré '+natural(v.numeral):'fondamentale non précisée');
    if(v.kind)out+=' '+(chordKinds[v.kind]||'type non traduit '+natural(v.kind));if(v.label&&v.kind==='other')out+=' ; libellé '+natural(v.label);
    if(v.inversion!==null&&v.inversion!==undefined)out+=Number(v.inversion)===0?' ; état fondamental':' ; renversement '+natural(v.inversion);
    if(v.bass)out+=' ; basse '+pitchClass(v.bass,v.bassAlter);
    for(const d of v.degrees||[]){if(d.value!==undefined)out+=' ; '+({add:'ajout',alter:'altération',subtract:'retrait'}[d.type]||natural(d.type))+' du degré '+natural(d.value)+(Number(d.alter)?' de '+natural(d.alter)+' demi-tons':'');else out+=' ; degré conservé '+natural(d.text||'non interprété')}
    return out;
  }
  function metricText(v){if(v.free)return'sans mesure';if(v.pairs.length!==1)return stateText({kind:'meter',value:v});const p=v.pairs[0],n=Number(p.beats),unit=Number(p.unit),base=stateText({kind:'meter',value:v});
    if(unit===8&&[6,9,12].includes(n))return base+' ; '+integer(n)+' croches ; regroupement usuel en '+integer(n/3)+' pulsations de noire pointée';return base;
  }
  function position(score,head,index,t,style){if(style!=='oral')return'À '+quantity(t)+' depuis le début : ';const meter=M.stateAt(score,head.part,'meter',index,t,head.staff,head.voice)?.value;
    if(!meter||meter.free||meter.pairs.length!==1)return'À '+quantity(t)+' depuis le début : ';const p=meter.pairs[0],unit=Number(p.unit),beats=Number(p.beats);if(!Number.isFinite(unit)||unit<=0)return'À '+quantity(t)+' depuis le début : ';
    const compound=unit===8&&[6,9,12].includes(beats),pulse=compound?'3/2':M.div(4,unit),q=M.div(t,pulse),whole=Math.floor(M.num(q)),rest=M.sub(q,whole);
    return(compound?'Pulsation ':'Temps ')+integer(whole+1)+(M.cmp(rest,0)?', décalage de '+rational(rest)+(compound?' de pulsation':' de temps'):'')+' : ';
  }
  function stateText(s){const v=s.value;switch(s.kind){
    case'meter':return v.free?'sans mesure':v.pairs.map(p=>natural(p.beats).replace(/\+/g,' plus ')+' sur '+natural(p.unit)).join(' puis ');
    case'key':return v.fifths!==null?Number(v.fifths)===0?'armure sans dièse ni bémol':'armure de '+integer(Math.abs(Number(v.fifths)))+(Number(v.fifths)>0?' dièses':' bémols'):'armure non traditionnelle ; valeurs conservées';
    case'clef':return'clé de '+({G:'sol',F:'fa',C:'ut',percussion:'percussion',TAB:'tablature',none:'aucune'}[v.sign]||natural(v.sign))+(v.line?' sur ligne '+natural(v.line):'')+(v.octave!=='0'?' ; décalage de clé de '+natural(v.octave)+' octave':'');
    case'transpose':return v.semitones===null?'transposition indéterminée':'sons entendus transposés de '+rational(v.semitones)+' demi-tons par rapport aux hauteurs encodées';
    case'tempo':return'noire à '+rational(v.bpm)+' par minute';
    case'dynamics':return'nuance '+v.values.map(x=>dynamic[x]||natural(x)).join(', ');
    case'sound-dynamics':return'vélocité relative '+natural(v.value)+' pour cent';
    case'words':case'rehearsal':return(s.kind==='rehearsal'?'repère ':'indication ')+natural(v.text);
    case'harmony':return harmonyText(v);
    case'octave-shift':return v.type==='stop'?'fin du déplacement d’octave graphique':'déplacement graphique '+(v.type==='down'?'vers le bas':'vers le haut')+' de '+natural(v.size)+' ; hauteur sonore déjà encodée';
    case'wedge':return({crescendo:'début de crescendo',diminuendo:'début de diminuendo',stop:'fin du soufflet'}[v.type]||'soufflet '+natural(v.type));
    case'pedal':return'pédale '+({start:'enfoncée',stop:'relevée',change:'changée',continue:'maintenue'}[v.type]||natural(v.type));
    case'staff-details':return v.tuning.length?'accordage '+v.tuning.map(t=>'corde '+natural(t.line)+' '+pitch({step:t.step,alter:t.alter,octave:Number(t.octave)})).join(', '):'détails de portée conservés';
    default:return natural(s.kind);
  }}
  function noteText(e,score){let name=e.payload.kind==='rest'?'silence':e.payload.kind==='pitch'?pitch(e.payload.written):e.payload.kind==='unpitched'?('percussion '+natural(score.parts.find(p=>p.id===e.part)?.instruments.find(x=>x.id===e.instrument)?.name||'non spécifiée')):'hauteur inconnue';
    if(e.tieRoot)name='prolongation de '+name+' ; sans nouvelle attaque';let out=name+', '+duration(e);if(e.cue)out+=' ; petite note de repérage';if(e.ties.includes('start'))out+=' ; liée par prolongation à la note suivante';
    for(const a of [...e.articulations,...e.ornaments])out+=' ; '+(technique[a.tag]||natural(a.tag))+(a.text?' '+natural(a.text):'');
    for(const a of e.technical){if(a.tag==='fingering')out+=' ; doigt '+fingering(e,score,a.text);else if(a.tag==='string')out+=' ; corde '+natural(a.text);else if(a.tag==='fret')out+=' ; case '+natural(a.text);else out+=' ; '+(technique[a.tag]||natural(a.tag))+(a.text?' '+natural(a.text):'')}
    for(const a of e.marks){const label={slur:'liaison de phrasé',tied:'liaison notée',tuplet:'groupe irrégulier',glissando:'glissando',slide:'glissé',fermata:'point d’orgue',arpeggiate:'accord arpégé','non-arpeggiate':'accord non arpégé'}[a.kind];if(label&&a.kind!=='tied')out+=' ; '+(a.type==='start'?'début de ':a.type==='stop'?'fin de ':'')+label}
    for(const l of e.lyrics)out+=' ; paroles'+(l.verse?' couplet '+natural(l.verse):'')+' : '+natural(l.text)+(l.syllabic?' ; syllabe '+({begin:'initiale',middle:'médiane',end:'finale',single:'entière'}[l.syllabic]||natural(l.syllabic)):'')+(l.extend?' ; prolongation des paroles':'');
    if(e.accidental&&(['yes'].includes(e.accidental.attributes?.cautionary)||['yes'].includes(e.accidental.attributes?.editorial)))out+=' ; altération de précaution ou éditoriale';return out;
  }
  function measure(score,index,options={}){const m=score.measures[index];if(!m)return'Mesure absente.';const lines=['Mesure '+natural(m.number)+'.'];const idx=M.getIndex(score),states=idx.measureStates.get(index)||[],oral=options.style==='oral';
    const selected=(idx.measureEvents.get(index)||[]).filter(e=>(!options.part||e.part===options.part)&&(!options.staff||e.staff===options.staff)&&(!options.voice||e.voice===options.voice));const groups=new Map();
    for(const e of selected){const k=e.part+'|'+e.staff+'|'+e.voice;if(!groups.has(k))groups.set(k,{head:e,events:[]});groups.get(k).events.push(e)}
    // An indication-only measure must not vanish merely because it has no notes.
    if(!selected.length){lines.push('Aucun événement dans la sélection.');for(const st of states){if(options.part&&st.scope.part!==options.part||options.staff&&st.scope.staff&&st.scope.staff!==options.staff||options.voice&&st.scope.voice&&st.scope.voice!==options.voice)continue;const h={part:st.scope.part,staff:st.scope.staff||options.staff||'1',voice:st.scope.voice||options.voice||'1'},k=h.part+'|'+h.staff+'|'+h.voice;if(!groups.has(k))groups.set(k,{head:h,events:[]})}}
    for(const {head,events:es} of groups.values()){es.sort((a,b)=>M.cmp(a.t,b.t)||a.sourceOrder-b.sourceOrder);const part=score.parts.find(p=>p.id===head.part);lines.push('Partie '+natural(part.name)+', portée '+natural(head.staff)+', voix '+natural(head.voice)+'.');
      const pm=part.measures.find(x=>x.index===index),meter=M.stateAt(score,head.part,'meter',index,'0/1',head.staff,head.voice)?.value;
      if(oral&&pm?.implicit&&meter?.capacity&&M.cmp(pm.extent,meter.capacity)<0)lines.push('Anacrouse ou mesure implicite incomplète : '+quantity(pm.extent)+' observée ; aucune durée manquante n’est ajoutée.');
      const active=[];for(const k of ['meter','key','clef','transpose','tempo','dynamics','sound-dynamics','staff-details','octave-shift','pedal','wedge','harmony']){const st=M.stateAt(score,head.part,k,index,'0/1',head.staff,head.voice);if(st&&!(oral&&options.continuous&&index>0&&st.from.measure<index))active.push(oral&&k==='meter'?metricText(st.value):stateText(st))}if(active.length)lines.push('État actif au début : '+active.join(' ; ')+'.');
      const inScope=st=>st.scope.part===head.part&&(!st.scope.staff||st.scope.staff===head.staff)&&(!st.scope.voice||st.scope.voice===head.voice);
      for(const st of states.filter(st=>inScope(st)&&M.cmp(st.from.t,0)===0&&['words','rehearsal'].includes(st.kind)))lines.push(stateText(st)+'.');
      const rows=[];for(const st of states.filter(st=>inScope(st)&&M.cmp(st.from.t,0)>0))rows.push({t:st.from.t,order:-1,st});for(const e of es)rows.push({t:e.t,order:e.sourceOrder,e});rows.sort((a,b)=>M.cmp(a.t,b.t)||a.order-b.order);
      const spoken=new Set();let prev=null;for(const row of rows){const pos=position(score,head,index,row.t,options.style);if(row.st){lines.push(pos+stateText(row.st)+'.');continue}const e=row.e;if(spoken.has(e.id))continue;
        if(oral&&e.chord){const chord=es.filter(x=>x.chord===e.chord);if(chord.length>1){lines.push(pos+'Accord simultané : '+chord.map(x=>{spoken.add(x.id);return noteText(x,score)}).join(' ; avec ')+'.');prev=e;continue}}
        const prefix=e.chord&&prev?.chord===e.chord?'Simultanément : ':pos;lines.push(prefix+noteText(e,score)+'.');spoken.add(e.id);prev=e;
      }
    }
    const forms=(idx.measureForms.get(index)||[]).filter(f=>f.source.measure===index&&(!options.part||f.source.part===options.part));for(const f of forms){let s;if(f.kind==='repeat')s=f.attrs.attributes.direction==='forward'?'début de reprise':'fin de reprise';else if(f.kind==='ending')s='volta '+natural(f.condition||'non numérotée')+' '+natural(f.attrs.attributes.type||'');else s=({dacapo:'retour au début',dalsegno:'retour au segno',tocoda:'aller à la coda',fine:'fin',segno:'segno',coda:'coda'}[f.kind]||natural(f.kind));lines.push('Forme : '+s+'.')}
    const us=(idx.measureWarnings.get(index)||[]).filter(u=>u.location.measure===index&&(!options.part||!u.location.part||u.location.part===options.part));if(us.length)lines.push('Réserves : '+[...new Set(us.map(u=>natural(u.message)))].join(' '));
    return lines.join('\n\n');
  }
  function all(score,options={}){return[natural(score.title||score.sourceName||'Partition'),score.composer?'Compositeur : '+natural(score.composer)+'.':'','Hauteurs écrites et états actifs. Lecture dans l’ordre écrit ; reprises et sauts non déployés. Les inconnus sont signalés, sans complétion inventée.','Convention des octaves : le do central est do quatre.',...score.measures.map(m=>measure(score,m.index,{...options,continuous:options.style==='oral'}))].filter(Boolean).join('\n\n')}
  return{integer,natural,rational,quantity,pitch,duration,stateText,noteText,metricText,harmonyText,measure,all};
});
