'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./singing.js'):root.EarForgeSinging);if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeSingingCapture=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Singing){
 const errors={NotAllowedError:'permission',SecurityError:'permission',NotFoundError:'missing',NotReadableError:'device',OverconstrainedError:'device'};
 class Capture{
  constructor({onState=()=>{},onResult=()=>{},env=globalThis}={}){this.env=env;this.onState=onState;this.onResult=onResult;this.state='idle';this.serial=0;this.stream=null;this.context=null;this.source=null;this.analyser=null;this.timer=null;this.limit=null;this.disposed=false;this.listeners=[];this.segmenter=null;}
  emit(state,reason=''){this.state=state;this.onState({state,reason});}
  listen(object,event,fn){object?.addEventListener?.(event,fn);this.listeners.push(()=>object?.removeEventListener?.(event,fn));}
  alive(token){return token===this.serial&&!this.disposed;}
  release(){
   this.env.clearTimeout(this.timer);this.env.clearTimeout(this.limit);this.timer=null;this.limit=null;
   for(const remove of this.listeners.splice(0))remove();
   if(this.stream)for(const t of this.stream.getTracks())try{t.stop();}catch{}this.stream=null;
   for(const n of [this.source,this.analyser])try{n?.disconnect();}catch{}this.source=null;this.analyser=null;
   const c=this.context;this.context=null;if(c)try{Promise.resolve(c.close()).catch(()=>{});}catch{}
  }
  cancel(reason='cancelled'){if(this.disposed)return;const active=['requesting','settling','listening'].includes(this.state);this.serial++;this.release();this.segmenter=null;if(active)this.emit('interrupted',reason);}
  dispose(){this.cancel('navigation');this.disposed=true;this.onState=()=>{};this.onResult=()=>{};}
  async start(){
   if(this.disposed||['requesting','settling','listening'].includes(this.state))return false;
   if(this.env.document?.hidden){this.emit('error','hidden');return false;}
   const env=this.env,devices=env.navigator?.mediaDevices,Context=env.AudioContext||env.webkitAudioContext;
   if(env.isSecureContext===false||!devices?.getUserMedia||!Context){this.emit('error','unsupported');return false;}
   const token=++this.serial;this.segmenter=new Singing.Segmenter();this.emit('requesting');
   this.listen(env.document,'visibilitychange',()=>{if(env.document.hidden)this.cancel('hidden');});this.listen(env,'pagehide',()=>this.cancel('hidden'));
   this.limit=env.setTimeout(()=>this.cancel('permission_timeout'),20000);
   try{
    const stream=await devices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(!this.alive(token)){for(const t of stream.getTracks())t.stop();return false;}
    this.stream=stream;if(!stream.getAudioTracks().length||stream.getAudioTracks().some(t=>t.readyState==='ended'))throw Object.assign(new Error('No audio track'),{name:'NotFoundError'});
    for(const t of stream.getTracks()){this.listen(t,'ended',()=>this.cancel('device_lost'));this.listen(t,'mute',()=>this.cancel('device_lost'));}
    const context=new Context();this.context=context;
    await context.resume();if(!this.alive(token))return false;if(context.state!=='running')throw new Error('context_suspended');
    this.source=context.createMediaStreamSource(stream);this.analyser=context.createAnalyser();this.analyser.fftSize=4096;this.source.connect(this.analyser);
    const input=new Float32Array(4096),detector=new Singing.Detector(4096);this.listen(context,'statechange',()=>{if(context.state!=='running')this.cancel('audio_interrupted');});
    env.clearTimeout(this.limit);this.limit=env.setTimeout(()=>this.cancel('time_limit'),45000);
    this.emit('settling');const ready=context.currentTime+.8;let previous=null;
    const poll=()=>{
     if(!this.alive(token))return;
     try{
      const now=context.currentTime;
      if(now>=ready){if(this.state==='settling')this.emit('listening');if(previous!==null&&now-previous>.30){this.cancel('sampling_interrupted');return;}previous=now;
       this.analyser.getFloatTimeDomainData(input);this.segmenter.push(detector.detect(input,context.sampleRate),now);
       if(this.segmenter.overflow){this.cancel('too_long');return;}
      }
      this.timer=env.setTimeout(poll,50);
     }catch{this.cancel('analysis_error');}
    };poll();return true;
   }catch(error){if(!this.alive(token))return false;this.serial++;this.release();this.segmenter=null;this.emit('error',errors[error?.name]||'audio');return false;}
  }
  stop(reason='user'){
   if(this.state==='requesting'){this.cancel('cancelled');return null;}
   if(this.disposed||!['settling','listening'].includes(this.state))return null;
   const wasListening=this.state==='listening',observation=this.segmenter?.finish()||{notes:[]};
   this.serial++;this.release();this.segmenter=null;
   if(!wasListening){observation.interrupted=true;reason='not_ready';}
   this.emit('stopped',reason);this.onResult(observation);return observation;
  }
 }
 return{Capture};
});
