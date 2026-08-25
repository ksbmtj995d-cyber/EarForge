'use strict';
(function(root,factory){
  const api=factory(
    typeof module==='object'&&module.exports?require('./audio-kernel.js'):root.EarForgeAudioKernel
  );
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EarForgeAudio=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Kernel){
  if(!Kernel)throw new Error('EarForgeAudioKernel requis');
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  const midiToHz=(note,cents=0)=>440*Math.pow(2,(Number(note)+Number(cents)/100-69)/12);
  const variant=(seed,count=4)=>Kernel.hashSeed(seed)%Math.max(1,count);
  class PCMCache{
    constructor(maxBytes=12*1024*1024){this.maxBytes=maxBytes;this.bytes=0;this.map=new Map()}
    get(key,factory){
      if(this.map.has(key)){const hit=this.map.get(key);this.map.delete(key);this.map.set(key,hit);return hit.value}
      const value=factory(),bytes=value.byteLength||value.length*4||0;this.map.set(key,{value,bytes});this.bytes+=bytes;
      while(this.bytes>this.maxBytes&&this.map.size>1){const [old,item]=this.map.entries().next().value;this.map.delete(old);this.bytes-=item.bytes}
      return value;
    }
    clear(){this.map.clear();this.bytes=0}
    stats(){return{entries:this.map.size,bytes:this.bytes,maxBytes:this.maxBytes}}
  }
  function makeCurve(size=4096,drive=1.18){const x=new Float32Array(size),norm=Math.tanh(drive);for(let i=0;i<size;i++){const v=i*2/(size-1)-1;x[i]=Math.tanh(v*drive)/norm}return x}
  class AudioEngine{
    constructor({volume=.64,maxCacheBytes=12*1024*1024}={}){
      this.volume=clamp(volume,.05,.95);this.cache=new PCMCache(maxCacheBytes);this.context=null;this.input=null;this.master=null;this.compressor=null;this.room=null;this.roomGain=null;this.active=new Set();this.timers=new Set();this.token=0;
    }
    async ensure(){
      if(!this.context){
        const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw new Error('Audio Web indisponible');
        try{this.context=new C({latencyHint:'interactive'})}catch{this.context=new C()}
        const ctx=this.context,input=ctx.createGain(),subsonic=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),high=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),shape=ctx.createWaveShaper(),master=ctx.createGain();
        subsonic.type='highpass';subsonic.frequency.value=24;subsonic.Q.value=.5;
        low.type='lowshelf';low.frequency.value=125;low.gain.value=-.4;high.type='highshelf';high.frequency.value=8500;high.gain.value=-.5;
        comp.threshold.value=-8;comp.knee.value=10;comp.ratio.value=2;comp.attack.value=.008;comp.release.value=.18;
        shape.curve=makeCurve();try{shape.oversample='2x'}catch{}
        master.gain.value=this.volume;input.connect(subsonic).connect(low).connect(high).connect(comp).connect(shape).connect(master).connect(ctx.destination);
        this.input=input;this.master=master;this.compressor=comp;
        if(typeof ctx.createConvolver==='function'){
          const room=ctx.createConvolver(),roomGain=ctx.createGain(),impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*.34),ctx.sampleRate),r=Kernel.rng('earforge-room-v5');
          for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<d.length;i++){const t=i/d.length;d[i]=(r()*2-1)*Math.pow(1-t,3.4)*(.72-.12*c)}}
          room.buffer=impulse;roomGain.gain.value=.045;high.connect(room).connect(roomGain).connect(comp);this.room=room;this.roomGain=roomGain;
        }
      }
      this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.018);if(this.context.state!=='running')await this.context.resume();return this.context;
    }
    setVolume(value){this.volume=clamp(value,.05,.95);if(this.master&&this.context)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.018)}
    track(node){this.active.add(node);return node}
    cleanupGraph(nodes,endTime){
      const delay=Math.max(0,(endTime-(this.context?.currentTime||0)+.015)*1000);const timer=setTimeout(()=>{this.timers.delete(timer);for(const n of nodes){try{n.disconnect()}catch{}this.active.delete(n)}},delay);this.timers.add(timer);
    }
    stop(){this.token++;for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const n of this.active){try{n.stop?.()}catch{}try{n.disconnect?.()}catch{}}this.active.clear()}
    generatedBuffer(key,factory){
      const cacheKey=`audio:${this.context.sampleRate}:${key}`;return this.cache.get(cacheKey,()=>{const pcm=factory(),b=this.context.createBuffer(1,pcm.length,this.context.sampleRate);b.copyToChannel(pcm,0);return b});
    }
    envelope(gain,start,peak,duration,attack=.01,release=.25,sustain=.45){
      const g=gain.gain,end=start+duration;g.cancelScheduledValues(start);g.setValueAtTime(.0001,start);g.exponentialRampToValueAtTime(Math.max(.0002,peak),start+Math.max(.003,attack));g.exponentialRampToValueAtTime(Math.max(.0002,peak*sustain),Math.min(end,start+attack+duration*.42));g.setValueAtTime(Math.max(.0002,peak*sustain),end);g.exponentialRampToValueAtTime(.0001,end+release);return end+release;
    }
    oscillator(freq,start,duration,{type='sine',ratio=1,detune=0,level=.1,attack=.01,release=.25,sustain=.4,destination=this.input}={}){
      const ctx=this.context,o=this.track(ctx.createOscillator()),g=this.track(ctx.createGain());o.type=type;o.frequency.setValueAtTime(freq*ratio,start);o.detune.setValueAtTime(detune,start);const end=this.envelope(g,start,level,duration,attack,release,sustain);o.connect(g).connect(destination);o.start(start);o.stop(end+.03);this.cleanupGraph([o,g],end);return end;
    }
    bufferVoice(buffer,start,{level=.5,filter=null,duration=null,destination=this.input}={}){
      const ctx=this.context,src=this.track(ctx.createBufferSource()),gain=this.track(ctx.createGain()),nodes=[src,gain];src.buffer=buffer;gain.gain.setValueAtTime(level,start);let out=src;
      if(filter){const f=this.track(ctx.createBiquadFilter());Object.assign(f,{type:filter.type||'lowpass'});f.frequency.setValueAtTime(filter.frequency||4200,start);f.Q.value=filter.Q||.7;out.connect(f);out=f;nodes.push(f)}
      out.connect(gain).connect(destination);src.start(start);const end=start+(duration||buffer.duration);src.stop(end+.02);this.cleanupGraph(nodes,end);return end;
    }
    noiseBuffer(seconds,seed){
      const sr=this.context.sampleRate,v=variant(seed,4),key=`noise:${seconds.toFixed(2)}:${v}`;return this.generatedBuffer(key,()=>{const n=Math.ceil(sr*seconds),pcm=new Float32Array(n),r=Kernel.rng(`noise:${v}`);for(let i=0;i<n;i++)pcm[i]=r()*2-1;return pcm})
    }
    piano(freq,start,duration,level,seed){
      const sr=this.context.sampleRate,v=variant(seed,4),key=`piano:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.pianoAttackPCM(freq,sr,.40,v,clamp(level*1.2,.3,1))),register=clamp(Math.log2(Math.max(27.5,freq)/27.5)/7,0,1),B=.00005+.0015*register*register;let end=this.bufferVoice(buffer,start,{level:level*.78,filter:{type:'lowpass',frequency:Math.min(10400,1900+freq*9.5)}});
      for(let k=1;k<=5;k++){const ratio=k*Math.sqrt(1+B*k*k),amp=[0,.50,.19,.085,.038,.017][k]*Math.exp(-register*k*.08),detune=k===1?0:(k%2?.6:-.6);end=Math.max(end,this.oscillator(freq,start,duration,{ratio,level:level*amp,type:k<3?'sine':'triangle',detune,attack:.004,release:.25+k*.035,sustain:.09}))}return end;
    }
    guitar(freq,start,duration,level,seed){
      const sr=this.context.sampleRate,v=variant(seed,6),length=Math.max(1.4,duration+1.2),key=`pluck:${Math.round(freq*100)}:${length.toFixed(2)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.pluckPCM(freq,sr,length,v,.68));return this.bufferVoice(buffer,start,{level:level*.86,filter:{type:'lowpass',frequency:clamp(freq*9,1900,7600)},duration:Math.min(buffer.duration,duration+1.15)});
    }
    strings(freq,start,duration,level,seed){
      const ctx=this.context,filter=this.track(ctx.createBiquadFilter()),gain=this.track(ctx.createGain()),nodes=[filter,gain];filter.type='lowpass';filter.frequency.setValueAtTime(2100,start);filter.frequency.exponentialRampToValueAtTime(4200,start+.24);filter.Q.value=.58;const end=this.envelope(gain,start,level*.64,duration,.14,.36,.78);filter.connect(gain).connect(this.input);
      for(const detune of [-5.2,0,4.1]){const o=this.track(ctx.createOscillator());nodes.push(o);o.type='sawtooth';o.frequency.setValueAtTime(freq,start);o.detune.setValueAtTime(detune,start);o.connect(filter);o.start(start);o.stop(end+.02)}
      const noise=this.track(ctx.createBufferSource()),bp=this.track(ctx.createBiquadFilter()),ng=this.track(ctx.createGain());nodes.push(noise,bp,ng);noise.buffer=this.noiseBuffer(duration+.5,`bow:${seed}`);bp.type='bandpass';bp.frequency.value=2600;bp.Q.value=.7;ng.gain.setValueAtTime(.0001,start);ng.gain.linearRampToValueAtTime(level*.035,start+.16);ng.gain.exponentialRampToValueAtTime(.0001,end);noise.connect(bp).connect(ng).connect(this.input);noise.start(start);noise.stop(end+.02);this.cleanupGraph(nodes,end);return end;
    }
    flute(freq,start,duration,level,seed){
      let end=start;for(const [ratio,amp] of [[1,.64],[2,.11],[3,.035]])end=Math.max(end,this.oscillator(freq,start,duration,{ratio,level:level*amp,type:'sine',attack:.075,release:.28,sustain:.82,detune:(ratio-2)*.25}));
      const ctx=this.context,src=this.track(ctx.createBufferSource()),hp=this.track(ctx.createBiquadFilter()),g=this.track(ctx.createGain());src.buffer=this.noiseBuffer(duration+.4,`breath:${seed}`);hp.type='highpass';hp.frequency.value=2700;const nend=this.envelope(g,start,level*.032,duration,.08,.22,.78);src.connect(hp).connect(g).connect(this.input);src.start(start);src.stop(nend+.02);this.cleanupGraph([src,hp,g],nend);return Math.max(end,nend);
    }
    organ(freq,start,duration,level){let end=start;for(const [ratio,amp,type] of [[1,.46,'sine'],[2,.25,'sine'],[3,.12,'triangle'],[4,.075,'sine'],[6,.035,'triangle']])end=Math.max(end,this.oscillator(freq,start,duration,{ratio,level:level*amp,type,attack:.018,release:.17,sustain:.92}));return end}
    epiano(freq,start,duration,level,seed){
      const ctx=this.context,carrier=this.track(ctx.createOscillator()),mod=this.track(ctx.createOscillator()),mg=this.track(ctx.createGain()),filter=this.track(ctx.createBiquadFilter()),gain=this.track(ctx.createGain()),nodes=[carrier,mod,mg,filter,gain];carrier.type='sine';carrier.frequency.value=freq;mod.type='sine';mod.frequency.value=freq*2.01;mg.gain.setValueAtTime(freq*.52,start);mg.gain.exponentialRampToValueAtTime(Math.max(1,freq*.045),start+duration*.72);mod.connect(mg).connect(carrier.frequency);filter.type='lowpass';filter.frequency.value=6400;const end=this.envelope(gain,start,level*.62,duration,.008,.42,.22);carrier.connect(filter).connect(gain).connect(this.input);carrier.start(start);mod.start(start);carrier.stop(end+.03);mod.stop(end+.03);
      const bell=this.oscillator(freq,start,Math.min(.42,duration),{ratio:3.98,level:level*.12,type:'sine',attack:.003,release:.32,sustain:.04,detune:(Kernel.rng(seed)()-.5)*2});this.cleanupGraph(nodes,Math.max(end,bell));return Math.max(end,bell);
    }
    bass(freq,start,duration,level,seed){
      const sub=this.oscillator(freq,start,duration,{level:level*.44,type:'sine',attack:.008,release:.30,sustain:.48});const body=this.guitar(freq,start,duration,level*.62,seed);return Math.max(sub,body);
    }
    bell(freq,start,duration,level){let end=start;for(const [ratio,amp,decay] of [[1,.34,1],[2.71,.20,.82],[4.08,.13,.65],[5.43,.09,.52],[8.2,.05,.40]])end=Math.max(end,this.oscillator(freq,start,duration*decay,{ratio,level:level*amp,type:'sine',attack:.002,release:.72,sustain:.03}));return end}
    clarinet(freq,start,duration,level,seed){
      const ctx=this.context,filter=this.track(ctx.createBiquadFilter()),gain=this.track(ctx.createGain()),nodes=[filter,gain];filter.type='lowpass';filter.frequency.setValueAtTime(Math.min(5200,freq*11),start);filter.Q.value=1.15;const end=this.envelope(gain,start,level*.62,duration,.045,.24,.78);filter.connect(gain).connect(this.input);
      for(const [ratio,amp] of [[1,.66],[3,.23],[5,.095],[7,.042]]){const o=this.track(ctx.createOscillator()),partialGain=this.track(ctx.createGain());nodes.push(o,partialGain);o.type='sine';o.frequency.value=freq*ratio;o.detune.value=(Kernel.rng(`${seed}:${ratio}`)()-.5)*1.8;partialGain.gain.setValueAtTime(amp,start);o.connect(partialGain).connect(filter);o.start(start);o.stop(end+.02)}this.cleanupGraph(nodes,end);return end;
    }
    brass(freq,start,duration,level,seed){
      const ctx=this.context,filter=this.track(ctx.createBiquadFilter()),gain=this.track(ctx.createGain()),nodes=[filter,gain];filter.type='lowpass';filter.frequency.setValueAtTime(Math.max(900,freq*4),start);filter.frequency.exponentialRampToValueAtTime(Math.min(7200,freq*15),start+.10);filter.Q.value=.72;const end=this.envelope(gain,start,level*.55,duration,.035,.25,.68);filter.connect(gain).connect(this.input);
      for(const [ratio,amp,type] of [[1,.52,'sawtooth'],[2,.16,'sine'],[3,.08,'triangle'],[4,.035,'sine']]){const o=this.track(ctx.createOscillator()),partialGain=this.track(ctx.createGain());nodes.push(o,partialGain);o.type=type;o.frequency.value=freq*ratio;o.detune.value=(Kernel.rng(`${seed}:${ratio}`)()-.5)*4;partialGain.gain.setValueAtTime(amp,start);o.connect(partialGain).connect(filter);o.start(start);o.stop(end+.02)}this.cleanupGraph(nodes,end);return end;
    }
    marimba(freq,start,duration,level){let end=start;for(const [ratio,amp,decay] of [[1,.48,1],[3.99,.20,.56],[9.1,.08,.31],[14.4,.035,.22]])end=Math.max(end,this.oscillator(freq,start,Math.max(.20,duration*decay),{ratio,level:level*amp,type:'sine',attack:.002,release:.30+decay*.28,sustain:.015}));return end}
    harp(freq,start,duration,level,seed){
      const body=this.guitar(freq,start,duration,level*.76,`harp:${seed}`),spark=this.oscillator(freq,start,Math.min(.34,duration),{ratio:2.01,level:level*.13,type:'sine',attack:.002,release:.30,sustain:.025,detune:-.8});return Math.max(body,spark);
    }
    nylon(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,6),length=Math.max(1.3,duration+1.05),key=`nylon:${Math.round(freq*100)}:${length.toFixed(2)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.pluckPCM(freq,sr,length,v,.36));return this.bufferVoice(buffer,start,{level:level*.82,filter:{type:'lowpass',frequency:clamp(freq*7.2,1500,5900)},duration:Math.min(buffer.duration,duration+1.0)})}
    celesta(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,4),length=Math.max(1.0,duration+.55),key=`celesta:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.modalInstrumentPCM('celesta',freq,sr,length,v,.82));return this.bufferVoice(buffer,start,{level:level*.72,filter:{type:'highpass',frequency:180},duration:Math.min(buffer.duration,duration+.48)})}
    vibraphone(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,5),length=Math.max(1.25,duration+.9),key=`vibraphone:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.modalInstrumentPCM('vibraphone',freq,sr,length,v,.82));return this.bufferVoice(buffer,start,{level:level*.70,filter:{type:'highpass',frequency:90},duration:Math.min(buffer.duration,duration+.78)})}
    dulcimer(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,5),length=Math.max(1.0,duration+.58),key=`dulcimer:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.modalInstrumentPCM('dulcimer',freq,sr,length,v,.84));return this.bufferVoice(buffer,start,{level:level*.66,filter:{type:'highpass',frequency:250},duration:Math.min(buffer.duration,duration+.52)})}
    oboe(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,4),length=Math.max(.9,duration+.38),key=`oboe:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.oboePCM(freq,sr,length,v,.82));return this.bufferVoice(buffer,start,{level:level*.56,filter:{type:'lowpass',frequency:clamp(freq*16,3400,9800)},duration:Math.min(buffer.duration,duration+.32)})}
    ney(freq,start,duration,level,seed){const body=this.flute(freq,start,duration,level*.76,`ney:${seed}`),edge=this.oscillator(freq,start,duration*.92,{ratio:3.01,level:level*.045,type:'sine',attack:.09,release:.30,sustain:.62,detune:-1.3});return Math.max(body,edge)}
    oud(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,7),length=Math.max(1.25,duration+.95),key=`oud:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.hybridPluckPCM('oud',freq,sr,length,v,.84));return this.bufferVoice(buffer,start,{level:level*.79,filter:{type:'lowpass',frequency:clamp(freq*6.4,1500,5400)},duration:Math.min(buffer.duration,duration+.82)})}
    qanun(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,7),length=Math.max(1.15,duration+.72),key=`qanun:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.hybridPluckPCM('qanun',freq,sr,length,v,.84)),body=this.bufferVoice(buffer,start,{level:level*.72,filter:{type:'highpass',frequency:120},duration:Math.min(buffer.duration,duration+.66)}),spark=this.oscillator(freq,start,Math.min(.45,duration),{ratio:2.006,level:level*.10,type:'sine',attack:.002,release:.34,sustain:.025,detune:1.1});return Math.max(body,spark)}
    sitar(freq,start,duration,level,seed){const body=this.guitar(freq,start,duration,level*.70,`sitar:${seed}`);let end=body;for(const [ratio,amp] of [[2.01,.075],[3.02,.045],[5.01,.025]])end=Math.max(end,this.oscillator(freq,start,Math.min(duration+.35,1.5),{ratio,level:level*amp,type:'triangle',attack:.002,release:.48,sustain:.035,detune:(ratio-3)*1.2}));return end}
    tanpura(freq,start,duration,level,seed){let end=this.guitar(freq,start,duration,level*.52,`tanpura:${seed}`);for(const [ratio,amp,detune] of [[1,.16,-3.2],[2,.11,2.1],[3,.055,-1.4],[4,.028,3.4]])end=Math.max(end,this.oscillator(freq,start,Math.min(duration+1.2,2.8),{ratio,level:level*amp,type:'sine',attack:.01,release:1.15,sustain:.16,detune}));return end}
    sarangi(freq,start,duration,level,seed){const body=this.strings(freq,start,duration,level*.72,`sarangi:${seed}`),res=this.oscillator(freq,start,duration,{ratio:2.01,level:level*.075,type:'sine',attack:.13,release:.38,sustain:.74,detune:2.4});return Math.max(body,res)}
    bansuri(freq,start,duration,level,seed){const body=this.flute(freq,start,duration,level*.78,`bansuri:${seed}`),edge=this.oscillator(freq,start,duration,{ratio:2.01,level:level*.035,type:'sine',attack:.10,release:.34,sustain:.72,detune:-2});return Math.max(body,edge)}
    duduk(freq,start,duration,level,seed){const body=this.oboe(freq,start,duration,level*.62,`duduk:${seed}`),fund=this.oscillator(freq,start,duration,{ratio:1,level:level*.16,type:'sine',attack:.065,release:.34,sustain:.80,detune:-1});return Math.max(body,fund)}
    kora(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,7),length=Math.max(1.4,duration+1.1),key=`kora:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.hybridPluckPCM('kora',freq,sr,length,v,.84));return this.bufferVoice(buffer,start,{level:level*.82,filter:{type:'lowpass',frequency:clamp(freq*8,1800,7200)},duration:Math.min(buffer.duration,duration+1.0)})}
    koto(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,6),length=Math.max(1.25,duration+.9),key=`koto:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.hybridPluckPCM('koto',freq,sr,length,v,.84));return this.bufferVoice(buffer,start,{level:level*.76,filter:{type:'highpass',frequency:180},duration:Math.min(buffer.duration,duration+.8)})}
    mbira(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,5),length=Math.max(1,duration+.55),key=`mbira:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.modalInstrumentPCM('mbira',freq,sr,length,v,.82));return this.bufferVoice(buffer,start,{level:level*.70,filter:{type:'highpass',frequency:190},duration:Math.min(buffer.duration,duration+.5)})}
    balafon(freq,start,duration,level,seed){const sr=this.context.sampleRate,v=variant(seed,5),length=Math.max(.9,duration+.45),key=`balafon:${Math.round(freq*100)}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.modalInstrumentPCM('balafon',freq,sr,length,v,.84));return this.bufferVoice(buffer,start,{level:level*.72,filter:{type:'lowpass',frequency:clamp(freq*10,2400,8500)},duration:Math.min(buffer.duration,duration+.4)})}
    shakuhachi(freq,start,duration,level,seed){const body=this.flute(freq,start,duration,level*.69,`shakuhachi:${seed}`),air=this.oscillator(freq,start,duration*.88,{ratio:3.02,level:level*.025,type:'sine',attack:.15,release:.45,sustain:.55,detune:-4});return Math.max(body,air)}
    erhu(freq,start,duration,level,seed){const body=this.strings(freq,start,duration,level*.68,`erhu:${seed}`),edge=this.oscillator(freq,start,duration,{ratio:2,level:level*.055,type:'triangle',attack:.10,release:.30,sustain:.68,detune:4});return Math.max(body,edge)}
    note(note,start,duration,timbre='piano',level=.45,cents=0,seed=1){
      const freq=midiToHz(note,cents),voice={piano:this.piano,guitar:this.guitar,strings:this.strings,flute:this.flute,organ:this.organ,epiano:this.epiano,bass:this.bass,bell:this.bell,clarinet:this.clarinet,brass:this.brass,marimba:this.marimba,harp:this.harp,nylon:this.nylon,celesta:this.celesta,vibraphone:this.vibraphone,dulcimer:this.dulcimer,oboe:this.oboe,ney:this.ney,oud:this.oud,qanun:this.qanun,sitar:this.sitar,tanpura:this.tanpura,sarangi:this.sarangi,bansuri:this.bansuri,duduk:this.duduk,kora:this.kora,koto:this.koto,mbira:this.mbira,balafon:this.balafon,shakuhachi:this.shakuhachi,erhu:this.erhu}[timbre]||this.piano;return voice.call(this,freq,start,duration,level,seed);
    }
    chord(notes,start,duration,timbre,seed,level=.42){let end=start;const gain=level/Math.sqrt(Math.max(1,notes.length));for(let i=0;i<notes.length;i++)end=Math.max(end,this.note(notes[i],start,duration,timbre,gain,0,`${seed}:${i}`));return end}
    drum(kind,start,velocity,seed,kit='studio'){
      const sr=this.context.sampleRate,v=variant(seed,5),bucket=Math.round(clamp(velocity,.2,1)*8),key=`drum:${kit}:${kind}:${bucket}:${v}`,buffer=this.generatedBuffer(key,()=>Kernel.drumPCM(kind,sr,bucket/8,v,kit));return this.bufferVoice(buffer,start,{level:.72*clamp(velocity,.2,1),filter:kind.startsWith('hat')||kind==='ride'?{type:'highpass',frequency:3000}:null});
    }
    scheduleScore(spec,start){
      const score=spec.score||{},ppq=score.ppq||960,tempo=Math.max(1,score.tempo||72),secondsPerTick=60/(tempo*ppq);let end=start;
      for(let i=0;i<(score.events||[]).length;i++){
        const e=score.events[i],notes=Array.isArray(e.notes)?e.notes:[],t=start+(Number(e.onsetTicks)||0)*secondsPerTick,gate=clamp(e.gate??.84,.30,1.12),duration=Math.max(.045,(Number(e.durationTicks)||ppq)*secondsPerTick*gate),velocity=clamp(e.velocity??.76,.18,1),level=.54*velocity/Math.sqrt(Math.max(1,notes.length)),cents=e.cents;
        for(let j=0;j<notes.length;j++){const detune=Array.isArray(cents)?Number(cents[j]||0):Number(cents||0);end=Math.max(end,this.note(notes[j],t,duration,spec.timbre,level,detune,`${spec.seed}:score:${i}:${j}`))}
      }
      return Math.max(end,start+(score.endTicks||0)*secondsPerTick+.12)
    }
    scheduleNotes(spec,start){
      const notes=spec.notes||[],duration=spec.duration||1,gap=spec.gap??.18,level=.50/Math.sqrt(Math.max(1,notes.length>3?notes.length/2:1));let end=start;
      if(spec.mode==='harmonic')end=this.chord(notes,start,duration,spec.timbre,spec.seed,.52);
      else for(let i=0;i<notes.length;i++){const t=start+i*(duration+gap),cents=Array.isArray(spec.cents)?spec.cents[i]||0:0;end=Math.max(end,this.note(notes[i],t,duration,spec.timbre,level,cents,`${spec.seed}:${i}`))}
      return end;
    }
    scheduleRhythm(spec,start){
      const ppq=spec.ppq||960,tempoUnitTicks=spec.tempoUnitTicks||ppq,secondsPerTick=60/(Math.max(1,spec.tempo||92)*tempoUnitTicks),swing=spec.swing||0,beatTicks=ppq;
      const swingTick=tick=>{if(!swing)return tick;const pos=((tick%beatTicks)+beatTicks)%beatTicks;return Math.abs(pos-beatTicks/2)<=1?tick+(swing-.5)*beatTicks:tick};
      let end=start,targetStart=start;
      if(spec.countInTicks>0){const n=Math.max(1,Math.round(spec.countInTicks/tempoUnitTicks));for(let i=0;i<n;i++)end=Math.max(end,this.drum('woodblock',start+i*tempoUnitTicks*secondsPerTick,i===0?.62:.42,`${spec.seed}:count:${i}`,'dry'));targetStart=start+(spec.countInTicks+(spec.countInGapTicks||0))*secondsPerTick}
      const layers=[spec.events||[],...(spec.layers||[])],flat=[];
      for(let layer=0;layer<layers.length;layer++)for(let i=0;i<layers[layer].length;i++)flat.push([layers[layer][i],layer,i]);
      for(const [[kind,tick,velocity=.84],layer,i] of flat){const t=targetStart+swingTick(Number(tick)||0)*secondsPerTick;end=Math.max(end,this.drum(kind,t,velocity,`${spec.seed}:${layer}:${i}`,spec.kit||'studio'))}
      return Math.max(end,targetStart+(spec.durationTicks||0)*secondsPerTick+.25);
    }
    scheduleDegree(spec,start){let t=start,end=start;for(let i=0;i<spec.cadence.length;i++){end=this.chord(spec.cadence[i],t,spec.duration,spec.timbre,`${spec.seed}:c${i}`,.40);t+=spec.duration+.15}t+=.15;end=Math.max(end,this.note(spec.target,t,spec.duration*1.12,spec.timbre,.52,0,`${spec.seed}:target`));return end}
    scheduleProgression(spec,start){let t=start,end=start;for(let i=0;i<spec.chords.length;i++){end=this.chord(spec.chords[i],t,spec.duration,spec.timbre,`${spec.seed}:p${i}`,.43);t+=spec.duration+.14}return end}
    scheduleValues(spec,start,cents=false){let t=start,end=start;for(let i=0;i<spec.values.length;i++){const note=cents?spec.root:spec.values[i],detune=cents?spec.values[i]:0;end=Math.max(end,this.note(note,t,spec.duration,spec.timbre,.44,detune,`${spec.seed}:v${i}`));t+=spec.duration+(spec.gap??.06)}return end}
    async play(spec){
      await this.ensure();this.stop();const token=++this.token,start=this.context.currentTime+.075;let end=start;
      if(spec.score?.events?.length&&spec.kind!=='rhythm')end=this.scheduleScore(spec,start);
      else if(spec.kind==='notes')end=this.scheduleNotes(spec,start);
      else if(spec.kind==='rhythm')end=this.scheduleRhythm(spec,start);
      else if(spec.kind==='degree')end=this.scheduleDegree(spec,start);
      else if(spec.kind==='progression')end=this.scheduleProgression(spec,start);
      else if(spec.kind==='melody')end=this.scheduleValues(spec,start,false);
      else if(spec.kind==='cents')end=this.scheduleValues(spec,start,true);
      else throw new Error(`Spécification audio inconnue: ${spec.kind}`);
      return{token,start,end,duration:Math.max(0,end-start),cache:this.cache.stats()};
    }
  }
  return{PCMCache,AudioEngine,midiToHz,makeCurve,variant};
});
