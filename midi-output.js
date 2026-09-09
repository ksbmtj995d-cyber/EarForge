'use strict';
(function(root,factory){const api=factory(root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null),root.EarForgeInstruments||(typeof require==='function'?require('./instruments.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeMidiOutput=api})(typeof globalThis!=='undefined'?globalThis:this,function(Events,Instruments){
  const route=e=>JSON.stringify([Events.voiceKey(e),Instruments.toProgram(e.instrument).program]);
  function supported(e){
    if(e.releaseTime!==undefined||e.brightness!==undefined||e.colorVelocity!==undefined)throw new Error('Cette sortie MIDI ne réalise pas le filtre et le relâchement contrôlés de cet exercice.');
    if(e.kind!=='note'||e.spectral||e.pitchCurve||!Number.isInteger(e.pitch)||Number(e.cents||0)!==0)throw new Error('Cette sortie restitue seulement les notes chromatiques, sans percussion, glissement continu ni microtonalité.');
    return Instruments.toProgram(e.instrument);
  }
  function intervalKey(e){return route(e)+':'+e.pitch;}
  function validateSegment(plan,channels,programs){
    const ends=new Map();
    for(const e of plan.events){
      const patch=supported(e);if(Events.isSilent(e))continue;
      const key=route(e);
      if(!channels.has(key)){const n=channels.size;if(n>=15)throw new Error('Plus de quinze lignes et instruments MIDI indépendants.');channels.set(key,n<9?n:n+1);programs.set(key,patch);}
      const pitch=intervalKey(e);if((ends.get(pitch)||0)>e.time+1e-8)throw new Error('Notes identiques superposées dans une même ligne MIDI.');ends.set(pitch,e.time+e.duration);
    }
  }
  function validateBoundary(left,right){
    const tails=new Map();for(const e of left.events)if(!Events.isSilent(e)&&e.time+e.duration>left.duration)tails.set(intervalKey(e),Math.max(tails.get(intervalKey(e))||0,e.time+e.duration-left.duration));
    for(const e of right.events)if(!Events.isSilent(e)&&(tails.get(intervalKey(e))||0)>e.time+1e-8)throw new Error('Tenues de même hauteur superposées à la jonction MIDI.');
  }
  class Renderer{
    constructor(port){if(!port||typeof port.send!=='function'||typeof port.clear!=='function')throw new Error('Sortie MIDI sans horodatage ou annulation.');this.port=port;this.channels=new Map();this.active=false;this.id='midi:'+String(port.id||'external');this.cleanupErrors=[];}
    prepare(input,anchor,context,repeat=null){

      const plan=Events.plan(input),loop=repeat?Events.plan(repeat):null,channels=new Map(),programs=new Map();
      validateSegment(plan,channels,programs);
      if(loop){validateSegment(loop,channels,programs);validateBoundary(plan,loop);validateBoundary(loop,loop);}
      if(!Number.isFinite(anchor)||anchor<0||!context||!Number.isFinite(context.currentTime)||context.currentTime<0)throw new Error('Horloge MIDI invalide.');
      if(this.port.state==='disconnected')throw new Error('Sortie MIDI déconnectée.');
      let stamp=null;try{stamp=context.getOutputTimestamp?.()}catch{}
      const calibrated=stamp&&Number.isFinite(stamp.contextTime)&&stamp.contextTime>=0&&Number.isFinite(stamp.performanceTime)&&stamp.performanceTime>0;
      const performanceAnchor=calibrated?stamp.performanceTime+(anchor-stamp.contextTime)*1000:performance.now()+(anchor-context.currentTime)*1000;
      if(!Number.isFinite(performanceAnchor)||performanceAnchor<0)throw new Error('Correspondance des horloges MIDI invalide.');
      this.finish();this.channels=channels;this.programs=programs;this.anchor=anchor;this.performanceAnchor=performanceAnchor;
      this.clockMapping=calibrated?'output-timestamp':'sampled-clock';this.active=true;
      try{for(const [key,ch] of channels){this.port.send([0xb0+ch,64,0]);this.port.send([0xe0+ch,0,64]);this.port.send([0xc0+ch,programs.get(key).program]);}}catch(error){this.finish();throw error;}
      return{programs:[...programs.values()],clockMapping:this.clockMapping,physicalLatencyCalibrated:false};
    }
    render(raw,time){
      if(!this.active||this.port.state==='disconnected')throw new Error('Sortie MIDI indisponible.');
      const e=Events.event(raw);supported(e);if(!Number.isFinite(time)||time<0)throw new Error('Position MIDI invalide.');
      if(Events.isSilent(e))return time+e.duration;
      const ch=this.channels.get(route(e));if(ch===undefined)throw new Error('Ligne ou instrument MIDI non préparé.');
      const at=this.performanceAnchor+(time-this.anchor)*1000;if(!Number.isFinite(at)||at<0)throw new Error('Horodatage MIDI invalide.');
      const velocity=Math.max(1,Math.min(127,Math.round((e.velocity??.72)*127)));
      this.port.send([0x90+ch,e.pitch,velocity],at);this.port.send([0x80+ch,e.pitch,0],at+e.duration*1000);return time+e.duration;
    }
    finish(){
      if(!this.active)return;this.active=false;this.cleanupErrors=[];
      const attempt=fn=>{try{fn()}catch(e){this.cleanupErrors.push(String(e.message||e))}};

      attempt(()=>this.port.clear());for(const ch of this.channels.values())for(const controller of [64,123,120])attempt(()=>this.port.send([0xb0+ch,controller,0]));
    }
    dispose(){this.finish();}
  }
  return{Renderer};
});
