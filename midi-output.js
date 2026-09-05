'use strict';
(function(root,factory){const api=factory(root.EarForgeMusicEvents||(typeof require==='function'?require('./music-events.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeMidiOutput=api})(typeof globalThis!=='undefined'?globalThis:this,function(Events){
  class Renderer{
    constructor(port){if(!port||typeof port.send!=='function'||typeof port.clear!=='function')throw new Error('Sortie MIDI sans horodatage ou annulation.');this.port=port;this.channels=new Map();this.active=false;this.id='midi:'+String(port.id||'external');}
    prepare(plan,anchor,context){
      plan=Events.plan(plan);
      const channels=new Map(),ends=new Map();for(const e of plan.events){if(e.kind!=='note'||e.spectral||!Number.isInteger(e.pitch)||Number(e.cents||0)!==0)throw new Error('Cette sortie restitue seulement les notes chromatiques, sans percussion ni microtonalité.');if(!channels.has(Events.voiceKey(e))){const ch=channels.size;channels.set(Events.voiceKey(e),ch<9?ch:ch+1);}if(channels.size>15)throw new Error('Plus de quinze voix MIDI indépendantes.');const key=Events.voiceKey(e)+':'+e.pitch;if((ends.get(key)||0)>e.time+1e-8)throw new Error('Notes identiques superposées dans une même voix MIDI.');ends.set(key,e.time+e.duration);}
      if(this.port.state==='disconnected')throw new Error('Sortie MIDI déconnectée.');this.finish();this.channels=channels;this.anchor=anchor;
      const stamp=typeof context.getOutputTimestamp==='function'?context.getOutputTimestamp():null;
      if(stamp&&Number.isFinite(stamp.contextTime)&&Number.isFinite(stamp.performanceTime)&&stamp.performanceTime>0){this.performanceAnchor=stamp.performanceTime+(anchor-stamp.contextTime)*1000;this.clockMapping='output-timestamp';}
      else{this.performanceAnchor=performance.now()+(anchor-context.currentTime)*1000;this.clockMapping='sampled-clock';}
      this.active=true;try{for(const ch of channels.values()){this.port.send([0xb0+ch,64,0]);this.port.send([0xe0+ch,0,64]);this.port.send([0xc0+ch,0]);}}catch(e){this.finish();throw e;}
    }
    render(e,time){if(!this.active||this.port.state==='disconnected')throw new Error('Sortie MIDI indisponible.');if(e.level===0||(e.source?.velocity??e.velocity)===0)return time+e.duration;const ch=this.channels.get(Events.voiceKey(e)),at=this.performanceAnchor+(time-this.anchor)*1000,velocity=Math.max(1,Math.min(127,Math.round((e.source?.velocity??e.velocity??.72)*127)));this.port.send([0x90+ch,e.pitch,velocity],at);this.port.send([0x80+ch,e.pitch,0],at+e.duration*1000);return time+e.duration;}
    finish(){if(!this.active)return;this.active=false;try{this.port.clear();for(const ch of this.channels.values()){this.port.send([0xb0+ch,64,0]);this.port.send([0xb0+ch,123,0]);this.port.send([0xb0+ch,120,0]);}}catch{} }
    dispose(){this.finish();}
  }
  return{Renderer};
});
