'use strict';
(function(root,factory){const api=factory(root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgePresentation=api})(typeof globalThis!=='undefined'?globalThis:this,function(Events){
  function cancelled(){const e=new Error('Lecture annulée');e.code='EARFORGE_PLAY_CANCELLED';return e;}
  class Speaker{
    constructor({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms),clearTimer=id=>globalThis.clearTimeout(id)}={}){this.synth=synth;this.Utterance=Utterance;this.setTimer=setTimer;this.clearTimer=clearTimer;this.pending=new Map();this.serial=0;}
    cancel(reason='cancelled'){this.serial++;const pending=[...this.pending.values()];for(const finish of pending)finish(false,reason);try{this.synth?.cancel()}catch{}}
    async read(text,options={}){
      const serial=this.serial,chunks=String(text||'').match(/[^]{1,250}(?:\s|$)|[^]{1,250}/g)||[];let count=0;
      for(const chunk of chunks){if(serial!==this.serial)return{spoken:false,reason:'cancelled',chunks:count};const result=await this.say(chunk.trim(),options);if(!result.spoken)return{...result,chunks:count};count++;}return{spoken:count>0,reason:'end',chunks:count};
    }
    say(text,{rate=.9,voice=null,timeout=null}={}){
      const message=String(text||''),synth=this.synth,serial=this.serial;
      if(!message||!synth||typeof this.Utterance!=='function')return Promise.resolve({spoken:false,started:false,reason:message?'unsupported':'empty',voice:''});
      if(message.length>4000)return Promise.resolve({spoken:false,started:false,reason:'too-long',voice:''});
      return new Promise(resolve=>{
        const u=new this.Utterance(message);u.lang=voice?.lang||'fr-FR';if(voice)u.voice=voice;u.rate=Math.max(.5,Math.min(3.5,Number(rate)||.9));u.pitch=1;u.volume=1;
        let done=false,started=false,watch,hard;
        const finish=(spoken,reason='end')=>{if(done)return;done=true;this.clearTimer(watch);this.clearTimer(hard);this.pending.delete(u);u.onstart=u.onend=u.onerror=null;resolve({spoken:Boolean(spoken&&serial===this.serial),started,reason,voice:voice?.name||''});};
        this.pending.set(u,finish);u.onstart=()=>{started=true};u.onend=()=>finish(true);u.onerror=e=>finish(false,e?.error||'error');
        watch=this.setTimer(()=>{if(!done&&serial===this.serial)try{synth.resume?.()}catch{}},900);
        const budget=timeout===null?Math.max(8000,Math.min(60000,2500+message.length*100/u.rate)):Math.max(100,Math.min(30000,Number(timeout)||8000));
        hard=this.setTimer(()=>{if(!done&&serial===this.serial)this.cancel(started?'end-timeout':'start-timeout')},budget);
        try{synth.resume?.();synth.speak(u)}catch{finish(false,'exception');try{synth.cancel()}catch{}}
      });
    }
  }
  function comparisonParts(plan,spec){
    const parts=spec?.operationParts;if(!Array.isArray(parts)||parts.length!==2)return[Events.plan(plan)];
    const rhythm=spec.kind==='rhythm',ppq=rhythm?(spec.tempoUnitTicks||spec.ppq||960):(spec.score?.ppq||960),tempo=rhythm?(spec.tempo||92):(spec.score?.tempo||72),sec=60/(tempo*ppq),lead=rhythm?((spec.countInTicks||0)+(spec.countInTicks?spec.countInGapTicks||0:0))*sec:0;
    for(const p of parts)if(!Number.isFinite(p.startTicks)||!Number.isFinite(p.endTicks)||p.endTicks<=p.startTicks)throw new Error('Repères de comparaison invalides');
    const split=lead+(parts[0].endTicks+parts[1].startTicks)*.5*sec;
    if(!(split>0&&split<plan.duration)||parts[1].startTicks<parts[0].endTicks)throw new Error('Exemples de comparaison superposés');
    return[Events.slice(plan,0,split),Events.slice(plan,split,plan.duration)];
  }
  class Presenter{
    constructor(audio,speaker){this.audio=audio;this.speaker=speaker;this.serial=0;}
    cancel(){this.serial++;this.speaker.cancel();this.audio.stop();}
    async present(question,{announceQuestion=false,announceComparisons=false,rate=.9,voice=null}={}){
      this.cancel();const serial=this.serial,check=()=>{if(serial!==this.serial)throw cancelled();},spec=question.spec,plan=this.audio.preparePlan(spec),parts=announceComparisons?comparisonParts(plan,spec):[plan],speech=[];
      const say=async text=>{const r=await this.speaker.say(text,{rate,voice});check();speech.push(r);};
      await this.audio.ensure();check();
      if(announceQuestion)await say(question.prompt);
      let out;for(let i=0;i<parts.length;i++){check();if(parts.length===2)await say(i===0?'Premier exemple.':'Deuxième exemple.');check();out=await this.audio.playTimeline(parts[i],{lead:this.audio.schedulerLead(spec)});check();await this.audio.wait(out,0);check();}
      question.presentation={announcedQuestion:!!announceQuestion,announcedComparisons:parts.length===2,spoken:speech.filter(r=>r.spoken).length,failures:speech.filter(r=>!r.spoken).map(r=>r.reason)};return out;
    }
  }
  return Object.freeze({Speaker,Presenter,comparisonParts});
});
