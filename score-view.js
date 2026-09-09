'use strict';
(function(root){
  const labels=root.EarForgeInstruments.labels;
  const demo='<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>Exemple à deux voix</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name><score-instrument id="I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><sound tempo="96"/></direction><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note><note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note><note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><tie type="start"/><voice>1</voice><type>half</type><notations><tied type="start"/></notations></note><backup><duration>8</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><voice>2</voice><type>whole</type></note></measure><measure number="2"><note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><tie type="stop"/><voice>1</voice><type>half</type><notations><tied type="stop"/></notations></note><note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><type>half</type></note><backup><duration>8</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>8</duration><voice>2</voice><type>whole</type></note></measure></part></score-partwise>';
  function mount({container,audio,onBack,announce=()=>{},stopSpeech=()=>{},speak=null}){
    const M=root.EarForgeScoreModel,I=root.EarForgeScoreImport,O=root.EarForgeScoreOral,P=root.EarForgeScorePlayer;
    let score=null,index=0,closed=false,loadGeneration=0,speechGeneration=0,page='import';
    const urls=new Set();
    const el=(tag,text='',attrs={})=>{
      const n=document.createElement(tag);if(text)n.textContent=text;
      for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;
    };
    const screen=el('div','',{class:'screen score-screen','data-score-page':'import'});
    const top=el('div','',{class:'topline'}),back=el('button','←',{type:'button',class:'back','aria-label':'Retour'});
    top.append(back,el('div','Partition accessible',{class:'counter'}),el('span'));
    const heading=el('h1','Ouvrir une partition',{tabindex:'-1',id:'score-heading'});
    const status=el('p','Aucune partition ouverte.',{role:'status','aria-live':'polite','aria-atomic':'true',id:'score-status'});
    const importer=el('div','',{id:'score-import-page',class:'score-import-page'}),reader=el('div','',{id:'score-reader-page',class:'score-reader-page'});
    reader.hidden=true;screen.append(top,heading,status,importer,reader);
    function control(parent,label,node,id){
      node.id=id||'score-'+label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]+/g,'-');
      const wrap=el('div','',{class:'score-control'});wrap.append(el('label',label,{for:node.id}),node);parent.append(wrap);return node;
    }
    importer.append(el('p','Choisissez un fichier sur cet appareil. La partition s’ouvrira dans sa propre page, pour écouter et parcourir ses mesures.',{class:'lead'}));
    const input=control(importer,'Fichier MusicXML',el('input','',{type:'file',accept:'.xml,.musicxml,.mxl,application/xml,application/vnd.recordare.musicxml+xml'}));
    const sample=el('button','Ouvrir un exemple',{type:'button',class:'secondary'}),resume=el('button','Revenir à la partition ouverte',{type:'button',class:'secondary'});resume.hidden=true;
    importer.append(sample,resume,el('p','XML et MusicXML : huit mégaoctets maximum. MXL compressé : seize mégaoctets maximum. Le fichier n’est pas envoyé sur Internet. Cet outil ne modifie pas la maîtrise du parcours.',{class:'notice'}));
    const importLimits=el('details'),limitsTitle=el('summary','Formats et limites de lecture');
    importLimits.append(limitsTitle,el('p','L’écoute suit l’ordre écrit par défaut. Un parcours optionnel déroule les reprises, deux branches de fin et les renvois da capo, dal segno, coda et fine explicitement encodés aux frontières des mesures. Aucun renvoi n’est deviné à partir d’un texte libre. Les destinations ambiguës et les durées finales modifiées sont refusées dans ce mode. Les indications non réalisées, comme certains agréments ou pédales, sont signalées. Aucun accompagnement absent du fichier n’est inventé.'));
    importer.append(importLimits);
    const change=el('button','Changer de partition',{type:'button',class:'secondary',id:'score-change'});
    const controls=el('fieldset','',{class:'score-main-controls'});controls.append(el('legend','Parcourir et écouter'));controls.disabled=true;
    const jump=control(controls,'Choisir la mesure',el('select'), 'score-measure-select');
    const nav=el('div','',{class:'score-buttons'}),prev=el('button','Mesure précédente',{type:'button',id:'score-prev'}),next=el('button','Mesure suivante',{type:'button',id:'score-next'});nav.append(prev,next);controls.append(nav);
    const buttons=el('div','',{class:'score-buttons'}),playMeasure=el('button','Écouter la mesure',{type:'button',id:'score-play-measure'}),playAll=el('button','Écouter le morceau',{type:'button',id:'score-play-all'}),stop=el('button','Arrêter',{type:'button',id:'score-stop'});
    buttons.append(playMeasure,playAll,stop);controls.append(buttons);
    const read=el('button','Dicter la mesure à voix haute',{type:'button',id:'score-speak'}),reveal=el('button','Révéler la dictée',{type:'button',id:'score-reveal'});
    controls.append(read,reveal);
    const transcript=el('div','',{id:'score-transcript',tabindex:'0','aria-label':'Dictée de la mesure',class:'score-transcript'});
    const settings=el('details','',{id:'score-settings',class:'score-settings'});settings.append(el('summary','Réglages de lecture et de dictée'));
    const selections=el('fieldset');selections.append(el('legend','Ce que vous écoutez'));settings.append(selections);
    const part=control(selections,'Partie',el('select')),staff=control(selections,'Portée',el('select')),voice=control(selections,'Ligne musicale',el('select'));
    selections.append(el('p','Une partie correspond à un instrument ou à un groupe. Une portée est une ligne de notation. Une ligne musicale, appelée « voix » dans le fichier, permet d’isoler des notes qui évoluent ensemble.',{class:'notice'}));
    const timbre=control(selections,'Instrument',el('select')),tempo=control(selections,'Tempo pour écouter',el('input','',{type:'number',min:10,max:600,step:1,placeholder:'Du fichier, sinon 80','aria-describedby':'score-tempo-info'}));
    selections.append(el('p','Laissez vide pour respecter le fichier. Sans indication, la noire à quatre-vingts est une proposition d’écoute, pas une donnée de la partition.',{id:'score-tempo-info',class:'notice'}));
    const style=control(selections,'Style de dictée',el('select'));
    style.append(el('option','Narrative, phrasé guidé',{value:'narrative'}),el('option','Orale, repères métriques',{value:'oral'}),el('option','Détaillée, positions exactes',{value:'exact'}));
    const route=control(selections,'Parcours d’écoute',el('select'));
    route.append(el('option','Ordre écrit',{value:'written'}),el('option','Reprises, fins et renvois explicites',{value:'repeats'}));
    const afterJump=control(selections,'Reprises après un retour au début ou au signe',el('select'));
    afterJump.append(el('option','Dernier passage, sans rejouer les reprises',{value:'skip'}),el('option','Rejouer les reprises',{value:'repeat'}));afterJump.disabled=true;
    selections.append(el('p','Ce choix s’applique seulement lorsque le fichier ne précise pas la conduite après le renvoi. Une instruction explicite du fichier est prioritaire.',{class:'notice'}));
    const unpitched=control(selections,'Rythmes sans timbre défini',el('select'));
    unpitched.append(el('option','Écouter avec une frappe neutre',{value:'neutral'}),el('option','Omettre les percussions sans correspondance',{value:'omit'}));
    selections.append(el('p','La frappe neutre ne déduit ni hauteur ni instrument de la position graphique. Les instruments automatiques sont synthétisés ; certains programmes utilisent une substitution. La dictée suit toujours l’ordre écrit. Une mesure isolée est écoutée une seule fois.',{class:'notice'}));
    timbre.append(el('option','Automatique selon la partie',{value:'auto'}));for(const name of P.instruments)timbre.append(el('option',labels[name]||name,{value:name}));
    const conceal=control(selections,'Masquer la dictée avant écoute',el('input','',{type:'checkbox'}));
    const exportText=el('button','Exporter la dictée en texte',{type:'button',id:'score-export'});settings.append(exportText);
    const warnings=el('details','',{class:'score-reserves'}),ws=el('summary','Réserves de cette partition'),wt=el('div');warnings.append(ws,wt);
    reader.append(controls,transcript,settings,warnings,change);container.replaceChildren(screen);heading.focus();
    const player=new P.Player(audio,{
      onState:(state,data)=>{
        if(closed)return;
        if(state==='playing')status.textContent='Lecture en cours.'+(data.warnings.length?' '+data.warnings.join(' '):'');
        else if(state==='error')status.textContent=data.message;
        else status.textContent=state==='ended'?'Lecture terminée.':'Lecture arrêtée.';
      },onMeasure:i=>{if(!closed&&i!==index){index=i;render(false)}}
    });
    function cancelSpeech(){speechGeneration++;stopSpeech()}
    function halt(){player.stop();cancelSpeech()}
    function showPage(nextPage){
      if(closed)return;halt();loadGeneration++;
      page=nextPage==='reader'&&score?'reader':'import';
      importer.hidden=page!=='import';reader.hidden=page!=='reader';screen.dataset.scorePage=page;
      resume.hidden=!score;heading.textContent=page==='reader'?(score.title||score.sourceName||'Partition ouverte'):'Ouvrir une partition';
      status.textContent=page==='reader'?scoreSummary():score?'La partition précédente reste disponible.':'Aucune partition ouverte.';
      heading.focus();
    }
    function scoreSummary(){return (score.title||score.sourceName||'Partition')+'. '+score.measures.length+' mesures, '+score.parts.length+' parties. '+score.U.length+' réserves.'}
    function options(){return{style:style.value,part:part.value||null,staff:staff.value||null,route:route.value,afterJump:afterJump.value,unpitched:unpitched.value,voice:voice.value||null,instrument:timbre.value,tempo:tempo.value?Number(tempo.value):null}}
    function fillStaves(){
      staff.replaceChildren(el('option','Toutes les portées',{value:''}));
      for(const st of [...new Set(score.E.filter(e=>!part.value||e.part===part.value).map(e=>e.staff))])staff.append(el('option','Portée '+st,{value:st}));fillVoices();
    }
    function fillVoices(){
      voice.replaceChildren(el('option','Toutes les lignes',{value:''}));
      for(const v of [...new Set(score.E.filter(e=>(!part.value||e.part===part.value)&&(!staff.value||e.staff===staff.value)).map(e=>e.voice))])voice.append(el('option','Ligne '+v,{value:v}));
    }
    function render(say=true){
      if(!score||closed)return;index=Math.max(0,Math.min(score.measures.length-1,index));
      jump.value=String(index);prev.disabled=index===0;next.disabled=index===score.measures.length-1;
      transcript.replaceChildren(...O.measure(score,index,options()).split('\n\n').map(t=>el('p',t)));
      transcript.hidden=conceal.checked;reveal.hidden=!conceal.checked;
      read.disabled=conceal.checked||!root.speechSynthesis||typeof speak!=='function';
      read.title=root.speechSynthesis?'':'Utiliser le lecteur d’écran pour lire la dictée.';
      if(say)announce('Mesure '+O.natural(score.measures[index].number)+'.');
    }
    function commit(s){
      if(!s.validation.ok)throw new Error('Structure de partition incohérente.');
      if(!s.measures.length)throw new Error('Partition sans mesure.');
      score=s;index=0;controls.disabled=false;settings.open=false;
      part.replaceChildren(el('option','Toutes les parties',{value:''}));
      for(const p of score.parts)part.append(el('option',p.name,{value:p.id}));fillStaves();
      const fragment=document.createDocumentFragment();

      score.measures.forEach((m,i)=>fragment.append(el('option','Mesure '+m.number+' — '+(i+1)+' sur '+score.measures.length,{value:i})));
      jump.replaceChildren(fragment);
      wt.replaceChildren(...[...new Set(score.U.map(u=>u.message))].map(t=>el('p',t)));
      ws.textContent=score.U.length?'Réserves et interprétations partielles : '+score.U.length:'Aucune réserve détectée sur les éléments pris en charge';
      render(false);showPage('reader');
    }
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file)return;halt();const token=++loadGeneration;status.textContent='Lecture du fichier…';
      try{const s=await I.load(file);if(!closed&&token===loadGeneration)commit(s)}
      catch(error){if(!closed&&token===loadGeneration)status.textContent='Import refusé : '+error.message+(score?' La partition précédente reste ouverte.':'')}
      finally{input.value=''}
    };
    sample.onclick=()=>{halt();loadGeneration++;try{commit(M.parse(demo))}catch(error){status.textContent=error.message}};
    change.onclick=()=>showPage('import');resume.onclick=()=>showPage('reader');
    back.onclick=()=>{if(page==='reader')showPage('import');else{halt();loadGeneration++;onBack()}};
    style.onchange=()=>{halt();render(false)};
    part.onchange=()=>{halt();fillStaves();render()};staff.onchange=()=>{halt();fillVoices();render()};
    voice.onchange=()=>{halt();render()};route.onchange=()=>{afterJump.disabled=route.value!=='repeats';halt();};afterJump.onchange=unpitched.onchange=timbre.onchange=tempo.onchange=halt;
    prev.onclick=()=>{halt();index--;render()};next.onclick=()=>{halt();index++;render()};
    jump.onchange=()=>{const n=Number(jump.value);if(Number.isInteger(n)&&n>=0&&n<score.measures.length){halt();index=n;render()}};
    conceal.onchange=()=>{cancelSpeech();render(false)};reveal.onclick=()=>{conceal.checked=false;render(false);transcript.focus()};
    async function play(whole){
      cancelSpeech();
      try{
        const plan=P.compile(score,{...options(),route:whole?route.value:'written',from:whole?0:index,to:whole?score.measures.length-1:index});
        if(!plan.events.length){status.textContent='Aucun son pris en charge dans cette sélection.';return}
        await player.play(plan);
      }catch(error){status.textContent=error.message}
    }
    playMeasure.onclick=()=>play(false);playAll.onclick=()=>play(true);stop.onclick=halt;
    read.onclick=async()=>{
      halt();const token=++speechGeneration;status.textContent='Dictée vocale en cours.';
      try{const result=await speak(O.measure(score,index,options()));if(closed||token!==speechGeneration)return;status.textContent=result.spoken?'Dictée vocale terminée.':'Dictée vocale interrompue. Le texte reste accessible.'}
      catch{if(!closed&&token===speechGeneration)status.textContent='Dictée vocale indisponible. Le texte reste accessible.'}
    };
    exportText.onclick=()=>{
      const url=URL.createObjectURL(new Blob([O.all(score,options())],{type:'text/plain;charset=utf-8'}));urls.add(url);
      const a=el('a','',{href:url,download:'dictee-earforge.txt'});screen.append(a);a.click();a.remove();
      setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url)},1000);
    };
    function keydown(e){if(e.key==='Escape'){e.preventDefault();halt()}}screen.addEventListener('keydown',keydown);
    return{
      dispose(){closed=true;loadGeneration++;halt();player.dispose();screen.removeEventListener('keydown',keydown);for(const u of urls)URL.revokeObjectURL(u);urls.clear();score=null},
      getScore:()=>score,getPlayer:()=>player
    };
  }
  root.EarForgeScoreView={mount,example:demo};
})(globalThis);
