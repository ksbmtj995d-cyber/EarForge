'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeSustain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const families=Object.freeze({
    bow:{slope:1.16,even:1,noise:.022,attack:.085,release:.24,pressure:.48,position:.13},
    jet:{slope:2.55,even:.85,noise:.038,attack:.055,release:.17,pressure:.70,position:.38},
    cylinder:{slope:1.35,even:.07,noise:.010,attack:.036,release:.14,pressure:.36,position:.26},
    cone:{slope:1.20,even:.85,noise:.024,attack:.045,release:.18,pressure:.65,position:.21},
    double:{slope:1.16,even:.86,noise:.019,attack:.054,release:.19,pressure:.43,position:.20},
    lip:{slope:1.68,even:1,noise:.011,attack:.035,release:.20,pressure:1.05,position:.17},
    free:{slope:1.38,even:.75,noise:.009,attack:.025,release:.13,pressure:.35,position:.31}
  });
  const rows=[
    ['strings','bow',1750,.85,.12,.34],['violin','bow',2800,1.15,.070,.25],['viola','bow',2100,1.05,.083,.28],['cello','bow',1100,1.12,.11,.33],['doubleBass','bow',620,1.0,.14,.40],['sarangi','bow',1650,1.25,.105,.30],['erhu','bow',2350,1.28,.078,.26],
    ['flute','jet',3200,.38,.055,.17],['piccolo','jet',6100,.35,.036,.12],['ney','jet',2500,.60,.075,.23],['bansuri','jet',2200,.42,.080,.22],['shakuhachi','jet',1800,.70,.095,.27],
    ['clarinet','cylinder',1450,.75,.036,.14],['bassClarinet','cylinder',740,.82,.053,.22],['altoSax','cone',2000,1.1,.035,.18],['tenorSax','cone',1450,1.1,.043,.21],['baritoneSax','cone',830,1.2,.060,.25],
    ['bassoon','double',550,1.25,.060,.24],['duduk','double',850,1.40,.070,.26],
    ['brass','lip',1900,.85,.040,.23],['trumpet','lip',2450,1.0,.020,.18],['trombone','lip',1450,.84,.035,.23],['frenchHorn','lip',920,.75,.055,.28],['tuba','lip',480,.70,.075,.30],
    ['accordion','free',1800,.82,.022,.13],['harmonica','free',2350,1.1,.028,.16]
  ];
  const profiles=Object.freeze(Object.fromEntries(rows.map(([id,family,formant,resonance,attack,release])=>[id,Object.freeze({...families[family],id,family,formant,resonance,attack,release})])));
  const caches=new WeakMap(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function coefficients(id,hz,sampleRate,velocity=.84,phaseSeed=0,attack=false){
    const p=profiles[id];if(!p||![hz,sampleRate,velocity].every(Number.isFinite)||hz<=0||sampleRate<8000||hz>=sampleRate*.47)throw new Error('Paramètres de timbre invalides');
    const count=Math.min(64,Math.floor(sampleRate*.47/hz)),real=new Float32Array(count+1),imag=new Float32Array(count+1),v=clamp(velocity,0,1),slope=p.slope+p.pressure*(.70-v)+(attack?-.25:.10),phase=(hash(phaseSeed)%65536)/65536*Math.PI*2;
    let total=0;
    for(let n=1;n<=count;n++){
      const frequency=hz*n,formant=Math.exp(-.5*Math.pow(Math.log(frequency/p.formant)/.52,2)),edge=1/(1+Math.pow(frequency/(p.formant*(1.2+v)),3)),parity=n%2?1:p.even+(p.family==='cylinder'?.18*v:0),position=.65+.35*Math.abs(Math.sin(Math.PI*n*p.position));
      let weight=Math.pow(n,-slope)*parity*(1+p.resonance*formant)*position*edge;
      if(p.family==='jet'&&n>4)weight*=.22;
      if(n===1)weight=Math.max(.5,weight);
      const angle=n*phase+(p.family==='cone'||p.family==='double'?Math.atan(n*.12):0);
      real[n]=weight*Math.cos(angle);imag[n]=weight*Math.sin(angle);total+=weight;
    }
    const scale=.82/total;for(let n=1;n<=count;n++){real[n]*=scale;imag[n]*=scale;}
    return{real,imag,harmonics:count};
  }
  function wave(ctx,id,hz,velocity,seed,attack){
    let cache=caches.get(ctx);if(!cache){cache=new Map();caches.set(ctx,cache);}
    const v=Math.round(clamp(velocity,0,1)*32)/32,variant=hash(seed)%4,key=[id,hz,v,variant,attack?1:0].join(':');
    if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}
    const c=coefficients(id,hz,ctx.sampleRate,v,variant,attack),value=ctx.createPeriodicWave(c.real,c.imag,{disableNormalization:true});cache.set(key,value);if(cache.size>128)cache.delete(cache.keys().next().value);return value;
  }
  function render(engine,id,hz,start,duration,level,seed,velocity=.84){
    const p=profiles[id],ctx=engine.context;if(!p)throw new Error('Timbre inconnu');
    if(![hz,start,duration,level,velocity].every(Number.isFinite)||hz<=0||start<0||duration<=0||duration>60||level<0||velocity<0||velocity>1)throw new Error('Note invalide');
    if(hz>=ctx.sampleRate*.47)throw new Error('Hauteur au-delà de la bande de restitution');if(!level||!velocity)return start+duration;
    const nodes=[],make=name=>{const n=engine.track(ctx[name]());nodes.push(n);return n;},out=make('createGain'),a=Math.min(p.attack*(1.2-.4*velocity),duration*.30),cross=Math.min(duration*.65,a+.09),end=engine.envelope(out,start,level*.84,duration,a,p.release,.88);
    out.connect(engine.input);
    for(const attack of [true,false]){
      const oscillator=make('createOscillator'),mix=make('createGain');oscillator.setPeriodicWave(wave(ctx,id,hz,velocity,seed,attack));oscillator.frequency.setValueAtTime(hz,start);
      mix.gain.setValueAtTime(attack?1:0,start);mix.gain.setValueAtTime(attack?1:0,start+a);mix.gain.linearRampToValueAtTime(attack?0:1,start+cross);
      oscillator.connect(mix).connect(out);oscillator.start(start);oscillator.stop(end+.012);
    }
    if(p.noise>0){
      const src=make('createBufferSource'),filter=make('createBiquadFilter'),gain=make('createGain');
      // A short deterministic exciter loops; note duration does not allocate a long noise buffer.
      src.buffer=engine.noiseBuffer(.37,`${id}:${seed}`);src.loop=true;filter.type='bandpass';filter.frequency.value=Math.min(ctx.sampleRate*.40,Math.max(250,p.formant));filter.Q.value=.70;
      gain.gain.setValueAtTime(p.noise*(.45+.55*velocity),start);gain.gain.linearRampToValueAtTime(p.noise*.40,start+cross);src.connect(filter).connect(gain).connect(out);src.start(start);src.stop(end+.012);
    }
    engine.cleanupGraph(nodes,end+.012);return end;
  }
  function cacheStats(ctx){return{entries:caches.get(ctx)?.size||0,maxEntries:128};}
  return Object.freeze({profiles,ids:Object.freeze(Object.keys(profiles)),coefficients,render,cacheStats});
});
