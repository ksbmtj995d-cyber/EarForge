'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarForgeAudioKernel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const TAU=Math.PI*2;
 function hashSeed(value){let h=2166136261>>>0;const s=String(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
 function rng(seed){let a=(typeof seed==='number'?seed:hashSeed(seed))>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296}}
 function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
 function soft(x,drive=1.4){return Math.tanh(x*drive)/Math.tanh(drive)}
 function normalize(x,peak=.92){let m=0;for(let i=0;i<x.length;i++)m=Math.max(m,Math.abs(x[i]));if(m>0){const g=peak/m;for(let i=0;i<x.length;i++)x[i]*=g}return x}
 function tailFade(x,sr=44100,seconds=.018){const n=Math.min(x.length,Math.max(2,Math.round(Math.max(.001,seconds)*sr)));if(x.length<2)return x;const start=x.length-n,den=Math.max(1,n-1);for(let i=start;i<x.length;i++){const u=(i-start)/den,w=.5*(1+Math.cos(Math.PI*u));x[i]*=w}x[x.length-1]=0;return x}
 function onePoleLP(x,cut,sr){const a=1-Math.exp(-TAU*cut/sr);let y=0;for(let i=0;i<x.length;i++){y+=a*(x[i]-y);x[i]=y}return x}
 function onePoleHP(x,cut,sr){const a=Math.exp(-TAU*cut/sr);let y=0,prev=0;for(let i=0;i<x.length;i++){const v=a*(y+x[i]-prev);prev=x[i];y=v;x[i]=v}return x}
 function onePolePhaseDelay(freq,sr,smooth){const w=TAU*Math.max(.01,freq)/sr;if(Math.abs(w)<1e-9)return smooth/Math.max(1e-9,1-smooth);return Math.atan2(smooth*Math.sin(w),1-smooth*Math.cos(w))/w}
 function bandNoise(n,sr,low,high,random){const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=random()*2-1;onePoleHP(a,low,sr);onePoleLP(a,high,sr);return a}
 function modalAt(t,modes,phase=0){let y=0;for(let i=0;i<modes.length;i++){const [freq,amp,decay]=modes[i];y+=amp*Math.sin(TAU*freq*t+phase*(i+1))*Math.exp(-t/Math.max(.008,decay))}return y}
function envelope(i,sr,attack,decay,curve=3){const t=i/sr;if(t<attack)return Math.pow(t/Math.max(.00001,attack),.65);return Math.exp(-Math.pow((t-attack)/Math.max(.00001,decay),curve===1?1:.85)*curve)}
 function baseDrumPCM(kind,sr=44100,velocity=.85,seed=1){const r=rng(`${kind}:${seed}`),phase=(r()-.5)*.7;const d={kick:.78,snare:.42,clap:.46,hatClosed:.12,hatOpen:.76,tomLow:.78,tomHigh:.60,ride:1.65,cowbell:.62,shaker:.34,woodblock:.36}[kind]||.4,n=Math.ceil(sr*d),x=new Float32Array(n);let oscPhase=0;
  if(kind==='kick')for(let i=0;i<n;i++){const t=i/sr,f=42+118*Math.exp(-t/.032);oscPhase+=TAU*f/sr;const membrane=Math.sin(oscPhase)*Math.exp(-t/.28)+.18*Math.sin(oscPhase*.51)*Math.exp(-t/.38),click=(r()*2-1)*Math.exp(-t/.0055);x[i]=soft((membrane+click*.14)*velocity,1.75)}
  else if(kind==='snare'){const noise=bandNoise(n,sr,820,14200,r),modes=[[182,.22,.125],[342,.14,.090],[516,.075,.062],[748,.036,.046]];for(let i=0;i<n;i++){const t=i/sr,wire=noise[i]*(1.02*Math.exp(-t/.105)+.16*Math.exp(-t/.26)),shell=modalAt(t,modes,phase),attack=(r()*2-1)*Math.exp(-t/.0034)*.24;x[i]=soft((wire*.68+shell+attack)*velocity,1.58)}}
  else if(kind==='clap'){const noise=bandNoise(n,sr,1000,12000,r),bursts=[0,.017,.039,.071];for(let i=0;i<n;i++){const t=i/sr;let e=.13*Math.exp(-t/.31);for(const b of bursts)if(t>=b)e+=Math.exp(-(t-b)/.016);x[i]=soft(noise[i]*e*.57*velocity,1.65)}}
  else if(kind==='hatClosed'||kind==='hatOpen'){const noise=bandNoise(n,sr,5600,18000,r),dec=kind==='hatOpen'?.36:.032,modes=[[5421,.038,.07],[6473,.032,.065],[7311,.028,.058],[8957,.021,.050],[10331,.015,.045]];for(let i=0;i<n;i++){const t=i/sr;x[i]=soft((noise[i]*.70*Math.exp(-t/dec)+modalAt(t,modes,phase))*velocity,1.32)}}
  else if(kind==='tomLow'||kind==='tomHigh'){const f0=kind==='tomLow'?91:151,modes=[[f0,.78,.34],[f0*1.49,.20,.21],[f0*2.03,.095,.14],[f0*2.61,.045,.10]];for(let i=0;i<n;i++){const t=i/sr,attack=(r()*2-1)*Math.exp(-t/.009),bend=Math.sin(TAU*(f0*1.20)*t)*Math.exp(-t/.05)*.18;x[i]=soft((modalAt(t,modes,phase)+bend+attack*.08)*velocity,1.42)}}
  else if(kind==='ride'){const noise=bandNoise(n,sr,3900,18000,r),modes=[[769,.078,1.18],[1127,.070,.96],[1621,.058,.82],[2491,.049,.68],[3697,.037,.55],[5579,.026,.43],[8017,.016,.31]];for(let i=0;i<n;i++){const t=i/sr;x[i]=soft((modalAt(t,modes,phase)+noise[i]*.18*Math.exp(-t/.48))*velocity,1.20)}}
  else if(kind==='cowbell'){const modes=[[562,.52,.24],[845,.36,.19],[1127,.10,.12]];for(let i=0;i<n;i++){const t=i/sr;x[i]=soft(modalAt(t,modes,phase)*velocity,1.30)}}
  else if(kind==='shaker'){const noise=bandNoise(n,sr,4600,17000,r);for(let i=0;i<n;i++){const t=i/sr,e=Math.exp(-t/.082)*(.67+.33*Math.sin(TAU*29*t));x[i]=soft(noise[i]*e*velocity,1.23)}}
  else if(kind==='woodblock'){const modes=[[806,.68,.072],[1279,.28,.049],[2105,.075,.031]];for(let i=0;i<n;i++){const t=i/sr,click=(r()*2-1)*Math.exp(-t/.004);x[i]=soft((modalAt(t,modes,phase)+click*.035)*velocity,1.28)}}
  else {const noise=bandNoise(n,sr,400,8000,r);for(let i=0;i<n;i++)x[i]=noise[i]*Math.exp(-i/sr/.1)*velocity}
  return tailFade(normalize(x,.90),sr,.012)
 }
 const KIT_MAP={
  dry:{kick:'dryKick',snare:'drySnare',hatClosed:'dryHat',hatOpen:'dryHatOpen',tomLow:'dryTomLow',tomHigh:'dryTomHigh',ride:'dryRide',cowbell:'dryBell',shaker:'dryShaker',woodblock:'dryBlock',clap:'dryClap'},
  brushes:{kick:'brushKick',snare:'brushSnare',hatClosed:'brushHat',hatOpen:'brushSweep',tomLow:'brushTomLow',tomHigh:'brushTomHigh',ride:'brushRide',cowbell:'brushBell',shaker:'brushShaker',woodblock:'brushBlock',clap:'brushClap'},
  latin:{kick:'surdo',snare:'congaHigh',hatClosed:'shakerLatin',hatOpen:'guiro',tomLow:'congaLow',tomHigh:'bongo',ride:'cowbellLatin',cowbell:'cowbellLatin',shaker:'shakerLatin',woodblock:'clave',clap:'palmas'},
  arabic:{kick:'darbukaDum',snare:'darbukaTek',hatClosed:'riqClosed',hatOpen:'riqOpen',tomLow:'darbukaDum',tomHigh:'darbukaTek',ride:'riqOpen',cowbell:'riqBell',shaker:'riqShake',woodblock:'darbukaKa',clap:'palmas'},
  tabla:{kick:'bayan',snare:'tablaNa',hatClosed:'manjira',hatOpen:'manjiraOpen',tomLow:'bayan',tomHigh:'tablaTin',ride:'manjiraOpen',cowbell:'manjira',shaker:'khartal',woodblock:'tablaTe',clap:'khartal'},
  electronic:{kick:'eKick',snare:'eSnare',hatClosed:'eHat',hatOpen:'eHatOpen',tomLow:'eTomLow',tomHigh:'eTomHigh',ride:'eRide',cowbell:'eBell',shaker:'eShaker',woodblock:'eClick',clap:'eClap'}
 };
 const PERC={
  timpani:{d:1.35,m:[[82,.72,.82],[123,.24,.52],[181,.10,.34],[248,.045,.22]],noise:.035,band:[140,2600],drive:1.28},cymbal:{d:1.75,m:[[1840,.055,1.10],[2760,.050,.92],[4190,.044,.76],[6120,.035,.60],[8930,.026,.46],[12400,.018,.34]],noise:.46,band:[3200,18500],drive:1.12},
  eKick:{d:.52,m:[[52,.94,.30],[104,.16,.12],[208,.035,.055]],noise:.018,band:[120,1800],drive:1.62},eSnare:{d:.31,m:[[196,.12,.09],[392,.07,.06]],noise:.86,band:[950,14500],drive:1.55},eHat:{d:.075,m:[[7200,.018,.025],[10800,.012,.018]],noise:.92,band:[6800,18500],drive:1.32},eHatOpen:{d:.48,m:[[6100,.022,.22],[9300,.016,.16]],noise:.78,band:[5900,18500],drive:1.25},eTomLow:{d:.44,m:[[112,.78,.24],[224,.13,.12]],noise:.025,band:[250,3600],drive:1.42},eTomHigh:{d:.34,m:[[184,.74,.18],[368,.12,.09]],noise:.028,band:[380,5200],drive:1.42},eRide:{d:1.05,m:[[1180,.06,.62],[2380,.045,.48],[4820,.03,.34],[9100,.018,.23]],noise:.18,band:[4800,18000],drive:1.12},eBell:{d:.40,m:[[760,.48,.23],[1520,.24,.16]],noise:.005,band:[1200,9000],drive:1.25},eShaker:{d:.22,m:[],noise:.94,band:[6900,18500],drive:1.18,trem:34},eClick:{d:.12,m:[[1880,.58,.035],[3760,.16,.022]],noise:.012,band:[1400,10000],drive:1.22},eClap:{d:.28,m:[[1240,.04,.08]],noise:.95,band:[1400,14500],drive:1.48,trem:24},
  dryKick:{d:.32,m:[[54,.82,.18],[108,.12,.10]],noise:.035,band:[120,2600],drive:1.6},drySnare:{d:.22,m:[[188,.20,.08],[356,.10,.055]],noise:.78,band:[1100,10500],drive:1.5},dryHat:{d:.07,m:[[6200,.02,.025],[9100,.015,.020]],noise:.85,band:[6200,17000],drive:1.25},dryHatOpen:{d:.28,m:[[5900,.025,.16],[8200,.018,.13]],noise:.72,band:[5500,17000],drive:1.2},dryTomLow:{d:.34,m:[[104,.75,.18],[165,.15,.12]],noise:.05,band:[500,5000],drive:1.35},dryTomHigh:{d:.28,m:[[174,.72,.15],[275,.16,.10]],noise:.05,band:[700,6000],drive:1.35},dryRide:{d:.72,m:[[940,.08,.46],[1810,.06,.38],[3910,.035,.30],[7200,.02,.22]],noise:.12,band:[4300,17000],drive:1.15},dryBell:{d:.26,m:[[690,.55,.15],[1080,.25,.11]],noise:.01,band:[1000,8000],drive:1.25},dryShaker:{d:.18,m:[],noise:.90,band:[6000,17000],drive:1.15},dryBlock:{d:.18,m:[[980,.72,.05],[1580,.26,.035]],noise:.025,band:[900,7000],drive:1.2},dryClap:{d:.22,m:[],noise:.92,band:[1600,12000],drive:1.35},
  brushKick:{d:.48,m:[[48,.72,.31],[93,.12,.18]],noise:.05,band:[80,2000],drive:1.3},brushSnare:{d:.46,m:[[180,.08,.18],[325,.05,.13]],noise:.78,band:[750,10500],drive:1.12},brushHat:{d:.20,m:[],noise:.72,band:[4500,15000],drive:1.08,trem:23},brushSweep:{d:.72,m:[],noise:.66,band:[1800,13000],drive:1.05,trem:7},brushTomLow:{d:.52,m:[[95,.54,.31],[151,.12,.22]],noise:.08,band:[400,4000],drive:1.18},brushTomHigh:{d:.43,m:[[154,.52,.26],[246,.11,.18]],noise:.08,band:[500,5200],drive:1.18},brushRide:{d:1.25,m:[[760,.05,.86],[1260,.045,.70],[2450,.035,.58],[5150,.025,.43]],noise:.16,band:[3800,16000],drive:1.05},brushBell:{d:.38,m:[[610,.38,.26],[930,.24,.22]],noise:.02,band:[1200,9000],drive:1.15},brushShaker:{d:.34,m:[],noise:.76,band:[3800,15000],drive:1.08,trem:13},brushBlock:{d:.25,m:[[760,.50,.12],[1250,.20,.08]],noise:.03,band:[700,6000],drive:1.15},brushClap:{d:.36,m:[],noise:.82,band:[900,9000],drive:1.2,trem:11},
  surdo:{d:.90,m:[[62,.88,.54],[124,.16,.31],[188,.06,.20]],noise:.035,band:[100,2500],drive:1.35},congaLow:{d:.54,m:[[174,.70,.31],[286,.21,.20],[512,.08,.11]],noise:.10,band:[550,6500],drive:1.32},congaHigh:{d:.42,m:[[244,.63,.24],[392,.23,.15],[760,.10,.09]],noise:.15,band:[800,8000],drive:1.35},bongo:{d:.32,m:[[342,.62,.18],[541,.22,.12],[920,.08,.07]],noise:.12,band:[900,9000],drive:1.35},cowbellLatin:{d:.55,m:[[566,.48,.28],[854,.36,.22],[1240,.12,.14]],noise:.01,band:[1500,10000],drive:1.22},shakerLatin:{d:.30,m:[],noise:.90,band:[5200,17500],drive:1.12,trem:31},clave:{d:.22,m:[[1880,.55,.07],[2860,.22,.05]],noise:.015,band:[1500,10000],drive:1.18},guiro:{d:.55,m:[],noise:.72,band:[1800,9000],drive:1.08,trem:38},palmas:{d:.38,m:[[980,.05,.12]],noise:.88,band:[1200,12000],drive:1.28,trem:19},
  darbukaDum:{d:.62,m:[[138,.78,.36],[273,.16,.22],[515,.07,.13]],noise:.06,band:[350,5000],drive:1.35},darbukaTek:{d:.30,m:[[420,.45,.15],[860,.20,.10],[1680,.08,.07]],noise:.24,band:[1000,10500],drive:1.42},darbukaKa:{d:.25,m:[[610,.32,.11],[1240,.15,.08]],noise:.34,band:[1400,11500],drive:1.38},riqClosed:{d:.18,m:[[4200,.025,.08],[6900,.018,.06]],noise:.72,band:[4800,17000],drive:1.18},riqOpen:{d:.72,m:[[1720,.05,.43],[3550,.035,.35],[7200,.025,.28]],noise:.48,band:[3500,17000],drive:1.12},riqBell:{d:.44,m:[[1160,.18,.25],[2380,.12,.20],[4750,.07,.15]],noise:.06,band:[2200,14000],drive:1.14},riqShake:{d:.32,m:[],noise:.78,band:[4200,16500],drive:1.10,trem:27},
  bayan:{d:.80,m:[[91,.76,.46],[136,.19,.30],[232,.07,.18]],noise:.05,band:[180,3200],drive:1.32},tablaNa:{d:.36,m:[[303,.48,.20],[612,.20,.13],[1110,.08,.08]],noise:.18,band:[800,9000],drive:1.38},tablaTin:{d:.48,m:[[448,.44,.27],[790,.20,.19],[1460,.09,.12]],noise:.12,band:[1000,10500],drive:1.34},tablaTe:{d:.28,m:[[670,.34,.13],[1320,.14,.08]],noise:.22,band:[1200,10000],drive:1.34},manjira:{d:.50,m:[[2850,.08,.30],[4930,.06,.24],[7600,.04,.18],[11200,.025,.14]],noise:.18,band:[5200,18000],drive:1.08},manjiraOpen:{d:1.05,m:[[2440,.08,.72],[4210,.06,.58],[6910,.045,.44],[10400,.03,.31]],noise:.15,band:[4700,18000],drive:1.06},khartal:{d:.30,m:[[1560,.14,.12],[3050,.08,.09]],noise:.52,band:[1800,13000],drive:1.22,trem:15}
 };
 function profilePercPCM(name,sr=44100,velocity=.85,seed=1){const q=PERC[name];if(!q)return null;const r=rng(`${name}:${seed}`),n=Math.ceil(sr*q.d),x=new Float32Array(n),noise=q.noise?bandNoise(n,sr,q.band?.[0]||500,q.band?.[1]||12000,r):null,phase=(r()-.5)*.7;for(let i=0;i<n;i++){const t=i/sr,mod=q.trem?(.66+.34*Math.sin(TAU*q.trem*t)):1,body=modalAt(t,q.m||[],phase),nz=noise?noise[i]*q.noise*Math.exp(-t/(q.d*.38))*mod:0,click=(r()*2-1)*Math.exp(-t/.0035)*(.025+.04*velocity);x[i]=soft((body+nz+click)*velocity,q.drive||1.2)}return tailFade(normalize(x,.90),sr,.012)}
 const SNARE_PROFILES=Object.freeze({crack:{d:.34,band:[1450,15800],m:[[196,.23,.105],[386,.12,.072],[712,.055,.049]],wire:.82,shell:.86,drive:1.62},warm:{d:.48,band:[720,12400],m:[[174,.27,.18],[318,.15,.13],[522,.075,.085]],wire:.68,shell:1.05,drive:1.48},deep:{d:.56,band:[560,10800],m:[[148,.31,.22],[286,.17,.15],[446,.075,.10]],wire:.61,shell:1.12,drive:1.44}});
 function studioSnarePCM(profile='crack',sr=44100,velocity=.85,seed=1){const q=SNARE_PROFILES[profile]||SNARE_PROFILES.crack,r=rng(`studio-snare:${profile}:${seed}`),n=Math.ceil(sr*q.d),x=new Float32Array(n),wire=bandNoise(n,sr,q.band[0],q.band[1],r),phase=(r()-.5)*.6;for(let i=0;i<n;i++){const t=i/sr,wireEnv=Math.exp(-t/(q.d*.24))+.15*Math.exp(-t/(q.d*.60)),shell=modalAt(t,q.m,phase)*q.shell,stick=(r()*2-1)*Math.exp(-t/.0028)*(.22+.13*velocity),air=wire[i]*q.wire*wireEnv;x[i]=soft((air+shell+stick)*velocity,q.drive)}return tailFade(normalize(x,.90),sr,.014)}
 const ROOM_PROFILES=Object.freeze({dry:{duration:.06,decay:8.8,early:[[0,1],[.009,.13],[.019,-.08]]},close:{duration:.16,decay:6.7,early:[[0,1],[.012,.19],[.029,-.12],[.051,.07]]},studio:{duration:.38,decay:5.1,early:[[0,1],[.017,.24],[.041,-.15],[.078,.10],[.121,-.06]]},room:{duration:.72,decay:4.2,early:[[0,1],[.023,.27],[.057,-.18],[.109,.12],[.181,-.08]]},hall:{duration:1.28,decay:3.4,early:[[0,1],[.031,.29],[.083,-.20],[.151,.14],[.247,-.09]]}});
 function roomImpulsePCM(name='studio',sr=44100,channel=0){const q=ROOM_PROFILES[name]||ROOM_PROFILES.studio,n=Math.max(64,Math.round(sr*q.duration)),x=new Float32Array(n),r=rng(`room:${name}:${sr}:${channel}`);for(let i=0;i<n;i++){const t=i/Math.max(1,n-1),density=Math.min(1,i/(sr*.035));x[i]=(r()*2-1)*Math.exp(-q.decay*t)*density*(channel?.82:.88)}for(const [seconds,amp] of q.early){const i=Math.min(n-1,Math.round(seconds*sr));x[i]+=amp*(channel&&i?-.92:1)}onePoleHP(x,90,sr);onePoleLP(x,name==='hall'?10500:14500,sr);return tailFade(normalize(x,.78),sr,.018)}
 function drumPCM(kind,sr=44100,velocity=.85,seed=1,kit='studio'){if(PERC[kind])return profilePercPCM(kind,sr,velocity,seed);if((!kit||kit==='studio')&&kind==='snare'){const names=Object.keys(SNARE_PROFILES),profile=names[hashSeed(`${seed}:${velocity}`)%names.length];return studioSnarePCM(profile,sr,velocity,seed)}if(!kit||kit==='studio')return baseDrumPCM(kind,sr,velocity,seed);const name=KIT_MAP[kit]?.[kind]||KIT_MAP[kit]?.snare;return profilePercPCM(name,sr,velocity,seed)||baseDrumPCM(kind,sr,velocity,seed)}
 const MODAL_PROFILES=Object.freeze({
  celesta:{m:[[1,.52,.75],[2.01,.24,.54],[3.98,.14,.39],[5.43,.08,.30],[8.08,.04,.21]],noise:.035},
  vibraphone:{m:[[1,.56,1.15],[3.96,.22,.82],[9.02,.10,.58],[14.1,.045,.41]],noise:.012,trem:5.4},
  dulcimer:{m:[[1,.44,.72],[2.004,.20,.55],[3.012,.10,.41],[4.025,.055,.31],[6.07,.025,.22]],noise:.065},
  mbira:{m:[[1,.34,.82],[2.72,.28,.67],[5.38,.18,.52],[8.11,.09,.39]],noise:.028,trem:5.1},
  balafon:{m:[[1,.42,.55],[3.01,.24,.44],[6.12,.13,.31],[9.43,.07,.22]],noise:.035},
  koto:{m:[[1,.46,.82],[2.02,.17,.55],[4.05,.10,.39],[6.12,.055,.27]],noise:.045}
 });
 function renderModes(modes,sr,duration,{random=rng(1),noise=0,noiseDecay=.0055,trem=0,attack=.0015,peak=.84}={}){
  if(!Number.isFinite(sr)||sr<8000||sr>192000||!Number.isFinite(duration)||duration<=0||duration>120)throw new Error('Rendu modal hors limites');
  if(!Array.isArray(modes)||modes.length>128||modes.some(m=>!Array.isArray(m)||m.length<3||m.some(v=>!Number.isFinite(v))||m[2]<=0))throw new Error('Modes acoustiques invalides');
  const n=Math.ceil(sr*duration),x=new Float32Array(n),states=modes.filter(m=>m[0]>0&&m[0]<sr*.47).map(([f,a,d,phase=0])=>{
    const r=Math.exp(-1/(sr*Math.max(.008,d))),w=TAU*f/sr;
    return {y:a*Math.sin(phase),previous:a/r*Math.sin(phase-w),c:2*r*Math.cos(w),r2:r*r};
  }),noiseFrames=Math.min(n,Math.ceil(noiseDecay*12*sr)),noiseR=Math.exp(-1/(sr*noiseDecay)),attackFrames=Math.max(1,Math.round(attack*sr));let noiseEnv=noise;
  for(let i=0;i<n;i++){
    let sum=0;for(const st of states){sum+=st.y;const next=st.c*st.y-st.r2*st.previous;st.previous=st.y;st.y=next;}
    if(trem)sum*=.78+.22*Math.sin(TAU*trem*i/sr);
    if(i<noiseFrames){sum+=(random()*2-1)*noiseEnv;noiseEnv*=noiseR;}
    x[i]=sum*(i<attackFrames?.5-.5*Math.cos(Math.PI*i/attackFrames):1);
  }
  return tailFade(normalize(x,peak),sr,.018);
 }
 function modalInstrumentPCM(name,freq,sr=44100,duration=1.4,seed=1,velocity=.8){
   const q=MODAL_PROFILES[name];if(!q)return new Float32Array(1);
   if(!Number.isFinite(freq)||freq<=0)throw new Error('Fréquence invalide');
   const r=rng(`${name}:${freq}:${seed}`),phase=(r()-.5)*.08,v=clamp(velocity,0,1),m=q.m.map(([ratio,amp,dec])=>[freq*ratio*(name==='dulcimer'?1+(r()-.5)*.0018:1),amp*Math.pow(ratio,-.22*(1-v)),dec,phase*ratio]);
   return renderModes(m,sr,duration,{random:r,noise:q.noise*(.35+.65*v),trem:q.trem||0,attack:.0012+(1-v)*.002,peak:.84});
 }
 function oboePCM(freq,sr=44100,duration=1.4,seed=1,velocity=.8){
   const r=rng(`oboe:${freq}:${seed}`),n=Math.ceil(sr*duration),x=new Float32Array(n),vib=4.9+(r()-.5)*.4,partials=[];
   for(let k=1;k<=11&&freq*k<sr*.47;k++){const hz=freq*k,form1=Math.exp(-Math.pow((hz-1050)/720,2)),form2=.75*Math.exp(-Math.pow((hz-2800)/1150,2));partials.push([k,(.58/k)*(.32+form1+form2)])}
   let phase=0,air=0;const step=TAU*freq/sr;
   for(let i=0;i<n;i++){const t=i/sr,env=Math.min(1,t/.055)*Math.exp(-Math.max(0,t-duration*.72)/Math.max(.08,duration*.45)),ramp=Math.min(1,Math.max(0,(t-.10)/.25));let y=0;
     for(const [k,amp]of partials)y+=amp*Math.sin(k*phase+k*.11);
     const noise=r()*2-1;air+=.18*(noise-air);const breath=(noise-air)*.012*Math.min(1,t/.08);
     x[i]=soft((y*.31+breath)*env*velocity,1.18);phase+=step*(1+.0024*ramp*Math.sin(TAU*vib*t));if(phase>TAU)phase-=TAU;
   }
   return tailFade(normalize(x,.80),sr,.018);
 }

 function pluckPCM(freq,sr=44100,duration=2.2,seed=1,brightness=.62){
  if(!Number.isFinite(freq)||freq<=0||!Number.isFinite(sr)||sr<8000||sr>192000||freq>=sr*.47||!Number.isFinite(duration)||duration<=0||duration>120)throw new Error('Paramètres de corde hors plage');
  brightness=clamp(brightness,0,1);
  const r=rng(`${freq}:${seed}:${brightness}`),n=Math.ceil(sr*duration),smooth=.28+.24*(1-brightness),phaseDelay=onePolePhaseDelay(freq,sr,smooth),delay=sr/Math.max(8,freq)-phaseDelay,prime=Math.ceil(delay)+3,x=new Float32Array(n);
  const pick=Math.max(1,Math.floor(delay*(.17+.13*brightness))),exc=new Float32Array(prime);
  for(let i=0;i<prime;i++){const raw=(r()*2-1)*(.50+.38*brightness),cancel=i>=pick?exc[i-pick]*(.30+.18*brightness):0;exc[i]=raw-cancel;x[i]=exc[i]}
  const damp=.9980-clamp(freq/800000,0,.0014);let lp=0;
  for(let i=prime;i<n;i++){
    const pos=i-delay,j=Math.max(0,Math.floor(pos)),f=pos-j,delayed=x[j]*(1-f)+(j+1<x.length?x[j+1]:x[j])*f;
    lp+=(delayed-lp)*(1-smooth);x[i]=lp*damp;
  }
  const modes=[[.50,.075,.62],[1.49,.040,.44],[2.08,.022,.31]].filter(m=>freq*m[0]<sr*.47).map(([ratio,amp,dec])=>{const phase=TAU*freq*ratio/sr,r=Math.exp(-1/(sr*dec));return{re:amp,im:0,c:Math.cos(phase)*r,s:Math.sin(phase)*r}});
  const envRate=Math.exp(-1/(sr*duration*.97));let env=1;
  for(let i=0;i<n;i++){let body=0;for(const m of modes){body+=m.im;const re=m.re*m.c-m.im*m.s;m.im=m.re*m.s+m.im*m.c;m.re=re;}x[i]=soft((x[i]+body)*env,1.22);env*=envRate;}
  return tailFade(normalize(x,.88),sr,.018)
 }
 function pianoAttackPCM(freq,sr=44100,duration=.40,seed=1,velocity=.8){
  if(!Number.isFinite(freq)||freq<=0)throw new Error('Fréquence invalide');
  const r=rng(`${freq}:${seed}:piano`),v=clamp(velocity,0,1),register=clamp(Math.log2(Math.max(27.5,freq)/27.5)/7,0,1),B=.00005+.0015*register*register,modes=[],phase=(r()-.5)*.015;
  for(let k=1;k<=12;k++){
    const ratio=k*Math.sqrt((1+B*k*k)/(1+B)),strike=Math.abs(Math.sin(Math.PI*k*(.105+.025*register))),amp=Math.pow(k,-1.08)*Math.exp(-k*(.11+.19*(1-v)+.10*register))*(.55+.45*strike),decay=(.30+.18*(1-register))/(1+.18*k);
    modes.push([freq*ratio,amp*.34,decay,phase*(k+1)]);
  }
  modes.push([freq*3.15,.075*(.4+.6*v),.022,0]);
  return renderModes(modes,sr,duration,{random:r,noise:.055*(.3+.7*v),noiseDecay:.0045+.004*(1-register),attack:.0007+(1-v)*.0015,peak:.82});
 }
 function bodyIR(name='wood',sr=44100){const presets={wood:[[0,1],[2,.22],[5,-.12],[11,.08],[19,-.045]],gourd:[[0,1],[3,.30],[8,-.18],[15,.10],[27,-.05]],skin:[[0,1],[4,.16],[7,-.11],[13,.07]],metal:[[0,1],[1,.12],[6,-.15],[17,.11],[31,-.07]]},q=presets[name]||presets.wood,n=Math.max(32,Math.round(sr*.0012)),ir=new Float32Array(n);for(const [i,a] of q)if(i<n)ir[i]=a;return ir}
 function applyFIR(input,ir){const y=new Float32Array(input.length),offsets=[],weights=[];for(let k=0;k<Math.min(ir.length,48);k++)if(ir[k]!==0){offsets.push(k);weights.push(ir[k])}const count=offsets.length;for(let i=0;i<input.length;i++){let v=0;for(let j=0;j<count;j++){const k=offsets[j];if(k>i)break;v+=input[i-k]*weights[j]}y[i]=v}return normalize(y,.88)}
 function hybridPluckPCM(name,freq,sr=44100,duration=1.8,seed=1,velocity=.8){const cfg={kora:[.54,'gourd'],koto:[.76,'wood'],oud:[.46,'wood'],qanun:[.70,'wood']}[name]||[.62,'wood'],v=clamp(velocity,0,1),brightness=clamp(cfg[0]+.24*(v-.8),.15,.95),base=pluckPCM(freq,sr,duration,`${name}:${seed}`,brightness);if(v===0)return new Float32Array(base.length);const body=applyFIR(base,bodyIR(cfg[1],sr));return tailFade(normalize(body,.86),sr,.018)}
 function pcmStats(x,sr=44100){let peak=0,sum=0,z=0,prev=x[0]||0,attack=0;for(let i=0;i<x.length;i++){const a=Math.abs(x[i]);if(a>peak){peak=a;attack=i/sr}sum+=x[i]*x[i];if((x[i]>=0)!=(prev>=0))z++;prev=x[i]}return{samples:x.length,duration:x.length/sr,peak,rms:Math.sqrt(sum/Math.max(1,x.length)),zeroCrossRate:z/Math.max(1,x.length-1),attackSeconds:attack}}
 function compileTempoCurve(points){const rows=(points||[]).map(p=>({beat:Number(p.beat),bpm:clamp(Number(p.bpm),20,320)})).filter(p=>Number.isFinite(p.beat)&&Number.isFinite(p.bpm)).sort((a,b)=>a.beat-b.beat);if(!rows.length)rows.push({beat:0,bpm:72});if(rows[0].beat>0)rows.unshift({beat:0,bpm:rows[0].bpm});for(let i=1;i<rows.length;i++)if(!(rows[i].beat>rows[i-1].beat))throw new Error('Courbe de tempo non strictement croissante');return Object.freeze(rows.map(Object.freeze))}
 function tempoAtBeat(curve,beat){const c=compileTempoCurve(curve),x=Math.max(c[0].beat,Number(beat)||0);let i=0;while(i<c.length-1&&x>c[i+1].beat)i++;if(i>=c.length-1)return c.at(-1).bpm;const a=c[i],b=c[i+1],u=(x-a.beat)/(b.beat-a.beat);return a.bpm+(b.bpm-a.bpm)*u}
 function beatToSeconds(curve,beat){const c=compileTempoCurve(curve),target=Math.max(0,Number(beat)||0);let sec=0;for(let i=0;i<c.length;i++){const a=c[i],next=c[i+1],end=Math.min(target,next?next.beat:target);if(end<=a.beat)break;const span=end-a.beat,b0=a.bpm,b1=next?tempoAtBeat([a,next],end):b0,k=next?(b1-b0)/span:0;if(Math.abs(k)<1e-10)sec+=60*span/b0;else sec+=60/k*Math.log((b0+k*span)/b0);if(end>=target)break}return sec}
 function expressiveTempoSchedule(curve,beats){const c=compileTempoCurve(curve),n=Math.max(1,Math.floor(Number(beats)||1)),times=[];for(let b=0;b<=n;b++)times.push({beat:b,timeSeconds:beatToSeconds(c,b),bpm:tempoAtBeat(c,b)});return{schema:'earforge.expressive_tempo.v1',curve:c,times,durationSeconds:times.at(-1).timeSeconds,continuous:true}}
 function generateExpressiveTempoCurve(seed,{beats=12,baseBpm=76,span=26}={}){const n=Math.max(8,Math.round(Number(beats)||12)),base=clamp(Number(baseBpm),44,144),range=clamp(Number(span),8,52),r=rng(`tempo-curve:${seed}`),anchors=[0,.25,.5,.75,1].map(x=>Math.round(x*n)),vals=[base,base+(r()*.75+.25)*range,base-(r()*.65+.15)*range*.72,base+(r()-.5)*range*.55,base+(r()-.5)*range*.18].map(v=>clamp(v,36,176));return compileTempoCurve(anchors.map((beat,i)=>({beat,bpm:Math.round(vals[i]*10)/10})))}
 return{renderModes,hashSeed,rng,drumPCM,studioSnarePCM,roomImpulsePCM,pluckPCM,hybridPluckPCM,bodyIR,applyFIR,pianoAttackPCM,modalInstrumentPCM,oboePCM,pcmStats,normalize,tailFade,onePolePhaseDelay,KIT_MAP,SNARE_PROFILES,ROOM_PROFILES,compileTempoCurve,tempoAtBeat,beatToSeconds,expressiveTempoSchedule,generateExpressiveTempoCurve};
});
