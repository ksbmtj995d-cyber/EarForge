'use strict';
(function(root,factory){const api=factory(root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeTimeline=api})(typeof globalThis!=='undefined'?globalThis:this,function(Events){
  const finite=(v,label)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(label+' invalide');return n};
  const positive=(v,label)=>{const n=finite(v,label);if(n<=0)throw new Error(label+' doit être positif');return n};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  function compile(spec,{countIn=true}={}){
    if(!spec||typeof spec!=='object')throw new Error('Spécification audio absente');
    const events=[],seed=String(spec.seed??0),base=spec.timbre||'piano';let duration=0;
    const note=(pitch,time,length,instrument,level,cents,id,role='target',source=null,spectral=null)=>{
      pitch=finite(pitch,'Hauteur');time=finite(time,'Position');length=positive(length,'Durée');cents=finite(cents??0,'Altération');
      if(time<0||pitch<0||pitch>127||length>60)throw new Error('Position ou hauteur hors plage');
      events.push({kind:spectral?'spectral':'note',pitch,time,duration:length,instrument:instrument||base,level,cents,seed:id,role,source,spectral,velocity:source?.velocity??.84});
    };
    const chord=(notes,time,length,instrument,id,level,role='target')=>{
      if(!Array.isArray(notes)||!notes.length)throw new Error('Accord vide');
      notes.forEach((n,j)=>note(n,time,length,instrument,level/Math.sqrt(notes.length),0,`${id}:${j}`,role));
    };
    const drum=(instrument,time,velocity,id,kit='studio',role='percussion',source=null)=>{
      time=finite(time,'Position');if(time<0)throw new Error('Position négative');events.push({kind:'drum',instrument,time,duration:.24,velocity:clamp(velocity,0,1),seed:id,kit,role,source});
    };
    if(spec.score?.events?.length&&spec.kind!=='rhythm'){
      const score=spec.score,ppq=positive(score.ppq||960,'PPQ'),sec=60/(positive(score.tempo||72,'Tempo')*ppq);
      spec.score.events.forEach((e,i)=>{
        const time=finite(e.onsetTicks??0,'Position')*sec,raw=positive(e.durationTicks||ppq,'Durée')*sec,length=Math.max(.045,raw*clamp(e.gate??.84,.30,1.12)),velocity=clamp(e.velocity??.76,0,1),notes=e.notes||[],role=e.role||'target';
        duration=Math.max(duration,time+raw);
        if(e.type==='percussion'||e.instrument&&!Array.isArray(e.notes))drum(e.instrument||'percussion',time,velocity,`${seed}:score:${i}:drum`,spec.kit||'studio',role==='target'?'percussion':role,e);
        else notes.forEach((n,j)=>note(n,time,length,e.timbre||e.instrument||base,.54*velocity/Math.sqrt(Math.max(1,notes.length)),Array.isArray(e.cents)?e.cents[j]||0:e.cents||0,`${seed}:score:${i}:${j}`,role,e,e.spectralProfile||null));
      });
      duration=Math.max(duration,finite(score.endTicks||0,'Fin')*sec);
    }else if(spec.kind==='rhythm'){
      const ppq=positive(spec.ppq||960,'PPQ'),unit=positive(spec.tempoUnitTicks||ppq,'Pulsation'),sec=60/(positive(spec.tempo||92,'Tempo')*unit),lead=countIn?finite(spec.countInTicks||0,'Décompte'):0,gap=lead?finite(spec.countInGapTicks||0,'Pause'):0;
      if(lead>0){const n=Math.max(1,Math.round(lead/unit));for(let i=0;i<n;i++)drum('woodblock',i*unit*sec,i===0?.62:.42,`${seed}:count:${i}`,'dry','target');}
      const shift=(lead+gap)*sec,swing=Number(spec.swing)||0;
      [spec.events||[],...(spec.layers||[])].forEach((layer,l)=>layer.forEach(([kind,tick,velocity=.84,offset=0,role='target',root=null],i)=>{
        tick=finite(tick,'Position');offset=finite(offset,'Décalage');const pos=((tick%ppq)+ppq)%ppq,warped=swing&&Math.abs(pos-ppq/2)<=1?tick+(swing-.5)*ppq:tick,time=shift+Math.max(0,warped+offset)*sec,id=`${seed}:${l}:${i}`;
        if(kind==='bassPulse')note(root??spec.contextRoot??36,time,.34,'bass',.34*velocity,0,id+':bass','context');
        else if(kind==='chordPulse'){const n=Number(root??spec.contextRoot??48);chord([n,n+4,n+7],time,.30,'epiano',id+':chord',.31*velocity,'context');}
        else drum(kind,time,velocity,id,spec.kit||'studio',role==='context'?'context':'percussion');
      }));
      duration=shift+positive(spec.durationTicks||ppq,'Durée rythmique')*sec;
    }else{
      const d=positive(spec.duration||1,'Durée');
      if(spec.kind==='notes'){
        const ns=spec.notes||[];if(!ns.length)throw new Error('Notes absentes');
        if(spec.mode==='harmonic'){chord(ns,0,d,base,seed,.52);duration=d;}
        else {const gap=finite(spec.gap??.18,'Pause');if(gap<0)throw new Error('Pause négative');const level=.50/Math.sqrt(Math.max(1,ns.length>3?ns.length/2:1));ns.forEach((n,i)=>note(n,i*(d+gap),d,base,level,Array.isArray(spec.cents)?spec.cents[i]||0:0,`${seed}:${i}`));duration=(ns.length-1)*(d+gap)+d;}
      }else if(spec.kind==='degree'){
        let t=0;for(let i=0;i<spec.cadence.length;i++){chord(spec.cadence[i],t,d,base,`${seed}:c${i}`,.40);t+=d+.15;}t+=.15;note(spec.target,t,d*1.12,base,.52,0,`${seed}:target`);duration=t+d*1.12;
      }else if(spec.kind==='progression'){
        spec.chords.forEach((ns,i)=>chord(ns,i*(d+.14),d,base,`${seed}:p${i}`,.43));duration=(spec.chords.length-1)*(d+.14)+d;
      }else if(spec.kind==='melody'||spec.kind==='cents'){
        const gap=finite(spec.gap??.06,'Pause');if(gap<0)throw new Error('Pause négative');spec.values.forEach((n,i)=>note(spec.kind==='cents'?spec.root:n,i*(d+gap),d,base,.44,spec.kind==='cents'?n:0,`${seed}:v${i}`));duration=(spec.values.length-1)*(d+gap)+d;
      }else throw new Error('Spécification audio inconnue : '+spec.kind);
    }
    if(!events.length||events.length>100000||!Number.isFinite(duration)||duration<=0||duration>7200)throw new Error('Séquence vide ou hors limites de lecture');
    return Events.plan({events,duration,markers:[],spec});
  }
  const concatenate=Events.concatenate;
  class Transport{
    constructor(context,{render,onMarker=()=>{},onEnd=()=>{},setTimer=(f,ms)=>setTimeout(f,ms),clearTimer=id=>clearTimeout(id),lookahead=.55,intervalMs=25,requireRunning=false}={}){
      if(!context||typeof render!=='function')throw new Error('Transport audio incomplet');this.context=context;this.requireRunning=requireRunning;this.render=render;this.onMarker=onMarker;this.onEnd=onEnd;this.setTimer=setTimer;this.clearTimer=clearTimer;this.lookahead=clamp(lookahead,.10,1);this.intervalMs=clamp(intervalMs,10,100);this.timer=null;this.running=false;this.waiters=[];
    }
    start(plan,{anchor=this.context.currentTime+.18,repeat=null}={}){
      plan=Events.plan(plan);if(repeat)repeat=Events.plan(repeat);if(!Number.isFinite(anchor)||anchor<this.context.currentTime)throw new Error('Timeline invalide');this.cancel();
      this.plan=plan;this.current=plan;this.repeat=repeat;this.anchor=anchor;this.cycleStart=anchor;this.cycle=0;this.i=0;this.mi=0;this.markerCycle=0;this.markerStart=anchor;this.markerPlan=plan;this.running=true;this.tail=anchor+plan.duration;
      this.stats={scheduled:0,late:0,cycles:0,maxBatch:0,maxDispatchMs:0};let resolve;const done=new Promise(r=>resolve=r);this.resolve=resolve;
      const result={start:anchor,end:this.tail,transportEnd:this.tail,duration:plan.duration,done,stats:this.stats};this.result=result;this.tick();return result;
    }
    waitUntil(time){if(!this.running)return Promise.resolve(false);if(this.context.currentTime>=time)return Promise.resolve(true);return new Promise(resolve=>this.waiters.push({time,resolve}));}
    finish(status,error=null){
      if(!this.running)return;this.running=false;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;
      const now=this.context.currentTime;for(const w of this.waiters)w.resolve(status==='ended'&&now>=w.time);this.waiters=[];
      this.result.end=this.tail;const record={status,error:error?String(error.message||error):null,...this.stats,end:this.tail};this.resolve(record);this.onEnd(record);
    }
    cancel(){this.finish('cancelled');}
    tick(){
      if(!this.running)return;this.timer=null;
      try{
        const now=this.context.currentTime;if(this.context.state==='closed')throw new Error('Périphérique audio fermé');if(this.requireRunning&&['suspended','interrupted'].includes(this.context.state))throw new Error('Sortie externe arrêtée : horloge audio suspendue. Relancez après reprise.');
        let batch=0;
        for(;;){
          while(this.i<this.current.events.length&&this.cycleStart+this.current.events[this.i].time<=now+this.lookahead){
            const event=this.current.events[this.i],at=this.cycleStart+event.time;
            if(at<this.context.currentTime-.02){this.stats.late++;throw new Error('L’horloge audio a décroché. Relancez la lecture ou réduisez la densité.');}
            const before=typeof performance!=='undefined'?performance.now():0,end=this.render(event,at);
            if(!Number.isFinite(end))throw new Error('Fin sonore invalide');this.tail=Math.max(this.tail,end);this.stats.maxDispatchMs=Math.max(this.stats.maxDispatchMs,(typeof performance!=='undefined'?performance.now():0)-before);
            this.i++;batch++;this.stats.scheduled++;if(batch>=2048)throw new Error('Densité audio hors budget');
          }
          if(this.i<this.current.events.length||!this.repeat||this.cycleStart+this.current.duration>now+this.lookahead)break;
          this.cycleStart=this.anchor+this.plan.duration+this.cycle*this.repeat.duration;this.current=this.repeat;this.i=0;this.cycle++;this.stats.cycles=this.cycle;this.tail=Math.max(this.tail,this.cycleStart+this.current.duration);
        }
        this.stats.maxBatch=Math.max(this.stats.maxBatch,batch);this.result.end=this.tail;
        // Marker observation follows the audio clock, not the lookahead scheduling cursor.
        let markerBudget=0;for(;;){while(this.mi<this.markerPlan.markers.length&&this.markerStart+this.markerPlan.markers[this.mi].time<=now+1e-9){if(++markerBudget>2048)throw new Error('Densité de repères hors budget');this.onMarker(this.markerPlan.markers[this.mi++]);}
          if(!this.repeat||this.markerStart+this.markerPlan.duration>now+1e-9)break;
          if(++markerBudget>2048)throw new Error('Cycles de repères hors budget');this.markerStart=this.anchor+this.plan.duration+this.markerCycle*this.repeat.duration;this.markerCycle++;this.markerPlan=this.repeat;this.mi=0;
        }
        const pending=[];for(const w of this.waiters){if(now>=w.time)w.resolve(true);else pending.push(w);}this.waiters=pending;
        if(!this.repeat&&this.i===this.current.events.length&&now>=this.tail+.03){this.finish('ended');return;}
        this.timer=this.setTimer(()=>this.tick(),this.intervalMs);
      }catch(error){this.finish('error',error);}
    }
  }
  return{compile,concatenate,Transport};
});
