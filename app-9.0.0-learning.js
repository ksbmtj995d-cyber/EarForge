'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.EarForgeLearning=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SCHEMA=9;
  const VERSION='10.0.1';
  const DAY=86400000;
  const HOUR=3600000;
  const PRIOR_A=1.2;
  const PRIOR_B=1.8;
  const TARGET_RETENTION=.88;
  const MAX_ATTEMPT_LOG=1500;
  const MAX_SESSION_LOG=240;
  const MAX_CONFUSIONS=6;
  const LEVELS=[
    {name:'Découverte',min:0},
    {name:'Fondations',min:.30},
    {name:'Reconnaissance',min:.46},
    {name:'Stabilité',min:.60},
    {name:'Transfert',min:.72},
    {name:'Intégration',min:.84},
    {name:'Maîtrise',min:.93}
  ];
  const DEFAULT_SETTINGS={
    theme:'system',
    volume:.64,
    soundDuration:1.35,
    presentationTempo:72,
    practiceMinutes:8,
    spokenCorrections:true,
    firstHints:true,
    voiceKey:'',
    degreeNotation:'numeric',
    hands:{minutes:10,silence:4,rate:.9,focus:'adaptive'},
    focus:'adaptive',
    modules:{jazz:false,styles:false,expression:false,world:false,micro:false},
    experiments:{adaptiveTempo:true,contextTransfer:true}
  };
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
  const int=(v,min,max)=>Math.round(clamp(v,min,max));
  const DATA_INTEGRITY_MAX_PRACTICE_RATE=50;
  const PERFORMANCE_POLICY=Object.freeze({
    rhythmTiming:{evidenceType:'USER_MEASUREMENT',skillRefs:['rhythm'],baseReliability:.78,plannerWeight:.22,recommendable:true,minSamples:4,targetSamples:32,windowDays:14},
    polyrhythmTiming:{evidenceType:'USER_MEASUREMENT',skillRefs:['rhythm'],baseReliability:.82,plannerWeight:.24,recommendable:true,minSamples:4,targetSamples:16,windowDays:14},
    melodyMemory:{evidenceType:'USER_MEASUREMENT',skillRefs:['melody'],baseReliability:.80,plannerWeight:.24,recommendable:true,minSamples:1,targetSamples:8,aggregation:'recent_binary',windowDays:14},
    harmonyFunction:{evidenceType:'USER_MEASUREMENT',skillRefs:['progression','modulation'],baseReliability:.78,plannerWeight:.22,recommendable:true,minSamples:1,targetSamples:8,aggregation:'recent_binary',windowDays:14},
    midiPerformance:{evidenceType:'DEVICE_ASSISTED_RESPONSE',skillRefs:['melody','chord'],baseReliability:.62,plannerWeight:0,recommendable:false,windowDays:14}
  });
  const LEGACY_DIAGNOSTIC_KINDS=new Set(['melodyContinuation','intonationContextAudit']);
  const performancePolicy=kind=>PERFORMANCE_POLICY[String(kind||'')]||null;
  const HARMONY_RESPONSE_LABELS=new Set(['Tension puis résolution','Tonicisation','Substitution','Modulation']);
  const HARMONY_TRIAL_TYPES=new Set(['resolution','tonicization','substitution','modulation']);
  const validRomanProgression=roman=>Array.isArray(roman)&&roman.length>=2&&roman.every(x=>typeof x==='string'&&x.trim().length>0);
  function canonicalPerformanceScore(kind,metrics={},fallback=0){
    const key=String(kind||'');
    if(key==='melodyMemory'){const correct=Number(metrics?.correctIndex),chosen=Number(metrics?.chosen);return Number.isInteger(correct)&&correct>=0&&Number.isInteger(chosen)&&chosen>=0?(chosen===correct?1:0):0}
    if(key==='harmonyFunction'){const label=String(metrics?.label||''),chosen=String(metrics?.chosen||'');return HARMONY_RESPONSE_LABELS.has(label)&&HARMONY_RESPONSE_LABELS.has(chosen)?(chosen===label?1:0):clamp(fallback,0,1)}
    if(key==='rhythmTiming')return Number.isFinite(Number(metrics?.score))?clamp(metrics.score,0,1):0;
    if(key==='polyrhythmTiming')return Number.isFinite(Number(metrics?.result?.score))?clamp(metrics.result.score,0,1):0;
    if(key==='midiPerformance'){const noteOns=Number(metrics?.performance?.noteOns),recall=Number(metrics?.recall?.score);return noteOns>0&&Number.isFinite(recall)?clamp(recall,0,1):0}
    return clamp(fallback,0,1);
  }
  function performanceQualification(kind,metrics={},requestedReliability=null){
    const key=String(kind||''),policy=performancePolicy(key);if(!policy)return{valid:false,evidenceType:'LEGACY_DIAGNOSTIC',skillRefs:[],reliability:0,reliabilityCap:0,plannerWeight:0,plannerEligible:false,sampleCount:null,targetSamples:null,minSamples:null,reason:'unknown_performance_kind'};
    const reliabilityCap=clamp(requestedReliability??policy.baseReliability,0,policy.baseReliability);let valid=true,sampleCount=null,reason=null;
    if(key==='rhythmTiming'){sampleCount=int(metrics?.n,0,1000000);valid=metrics?.valid===true&&sampleCount>=policy.minSamples;if(!valid)reason=String(metrics?.reason||'insufficient_timing_measurement')}
    else if(key==='polyrhythmTiming'){const a=metrics?.a||{},b=metrics?.b||{},result=metrics?.result||{};sampleCount=Math.min(int(a.n,0,1000000),int(b.n,0,1000000));valid=result.valid===true&&a.valid===true&&b.valid===true&&sampleCount>=policy.minSamples;if(!valid)reason=String(result.reason||a.reason||b.reason||'insufficient_polyrhythm_measurement')}
    else if(key==='melodyMemory'){sampleCount=1;valid=Number.isInteger(Number(metrics?.correctIndex))&&Number(metrics.correctIndex)>=0&&Number.isInteger(Number(metrics?.chosen))&&Number(metrics.chosen)>=0;if(!valid)reason='invalid_melody_memory_response'}
    else if(key==='harmonyFunction'){sampleCount=1;const canonical=HARMONY_TRIAL_TYPES.has(String(metrics?.type||''))&&HARMONY_RESPONSE_LABELS.has(String(metrics?.label||''))&&HARMONY_RESPONSE_LABELS.has(String(metrics?.chosen||''))&&validRomanProgression(metrics?.roman),legacy=metrics?.chosen==null&&typeof metrics?.type==='string'&&metrics.type.length>0&&typeof metrics?.label==='string'&&metrics.label.length>0&&typeof metrics?.roman==='string'&&metrics.roman.length>0;valid=canonical||legacy;if(!valid)reason='invalid_harmony_function_response'}
    const sufficiency=policy.targetSamples&&sampleCount!=null?Math.sqrt(clamp(sampleCount/policy.targetSamples,0,1)):1,reliability=valid?clamp(reliabilityCap*sufficiency,0,policy.baseReliability):0,plannerEligible=Boolean(valid&&policy.plannerWeight>0);
    return{valid,evidenceType:valid?policy.evidenceType:'INVALID_MEASUREMENT',skillRefs:[...policy.skillRefs],reliability,reliabilityCap,plannerWeight:plannerEligible?policy.plannerWeight:0,plannerEligible,sampleCount,targetSamples:policy.targetSamples||null,minSamples:policy.minSamples||null,reason};
  }
  function sanitizePerformanceRow(x){if(!x||typeof x!=='object')return null;const kind=String(x.kind||'').slice(0,32),policy=performancePolicy(kind),diagnostic=!policy,metrics=x.metrics&&typeof x.metrics==='object'?JSON.parse(JSON.stringify(x.metrics)):{},cap=policy?clamp(x.reliabilityCap??policy.baseReliability,0,policy.baseReliability):0,q=policy?performanceQualification(kind,metrics,cap):null;return{time:Math.max(0,finite(x.time)),kind,score:canonicalPerformanceScore(kind,metrics,x.score),metrics,evidenceType:q?.evidenceType||(LEGACY_DIAGNOSTIC_KINDS.has(kind)?'DERIVED_DIAGNOSTIC':'LEGACY_DIAGNOSTIC'),skillRefs:q?[...q.skillRefs]:[],reliability:q?.reliability||0,reliabilityCap:q?.reliabilityCap||0,plannerWeight:q?.plannerWeight||0,plannerEligible:Boolean(q?.plannerEligible),measurementValid:q?.valid===true,sampleCount:q?.sampleCount??null,sampleTarget:q?.targetSamples??null,qualificationReason:q?.reason||null,legacyDiagnostic:diagnostic}}
  function hashSeed(value){let h=2166136261>>>0;const s=String(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function seeded(seed){let a=hashSeed(seed);return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296}}
  const BETA_CACHE=new Map();let BETA_CACHE_SIZE=0,betaLastA=NaN,betaLastB=NaN,betaLastValue=null;
  const INTONATION_CACHE=new WeakMap();
  const PLAN_CACHE=new WeakMap();
  const CONFUSION_CACHE=new WeakMap(),CATALOG_PARTS_CACHE=new WeakMap();
  function logGamma(z){const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);z-=1;let x=.99999999999980993;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+c.length-.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)}
  function betaCF(a,b,x){const MAX=160,EPS=3e-14,FPMIN=1e-300;let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;for(let m=1;m<=MAX;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break}return h}
  function betaCDF(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const logBt=logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x),bt=Math.exp(logBt);return x<(a+1)/(a+b+2)?bt*betaCF(a,b,x)/a:1-bt*betaCF(b,a,1-x)/b}
  function betaQuantile(p,a,b){if(p<=0)return 0;if(p>=1)return 1;let lo=0,hi=1;const mean=a/(a+b),sd=Math.sqrt(a*b/((a+b)*(a+b)*(a+b+1)));lo=Math.max(0,mean-8*sd);hi=Math.min(1,mean+8*sd);if(betaCDF(lo,a,b)>p)lo=0;if(betaCDF(hi,a,b)<p)hi=1;for(let i=0;i<52;i++){const mid=(lo+hi)/2;if(betaCDF(mid,a,b)<p)lo=mid;else hi=mid}return(lo+hi)/2}
  function betaStats(a,b){a=clamp(a,.2,1e6);b=clamp(b,.2,1e6);if(a===betaLastA&&b===betaLastB)return betaLastValue;let row=BETA_CACHE.get(a);if(row&&row.has(b)){betaLastA=a;betaLastB=b;return betaLastValue=row.get(b)}const total=a+b,mean=a/total,variance=a*b/(total*total*(total+1)),lower=betaQuantile(.10,a,b),upper=betaQuantile(.90,a,b),value={mean,variance,lower,uncertainty:clamp(upper-lower,0,1)};if(!row){row=new Map();BETA_CACHE.set(a,row)}row.set(b,value);BETA_CACHE_SIZE++;if(BETA_CACHE_SIZE>4096){BETA_CACHE.clear();BETA_CACHE_SIZE=0;BETA_CACHE.set(a,new Map([[b,value]]));BETA_CACHE_SIZE=1}betaLastA=a;betaLastB=b;betaLastValue=value;return value}
  function freshCard(){return{alpha:PRIOR_A,beta:PRIOR_B,attempts:0,correct:0,lapses:0,streak:0,difficulty:5.5,stability:.18,due:0,first:0,last:0,lastShown:0,meanLatency:0,exposures:0,spaced:0,hintShown:false,irtDifficulty:.5,irtN:0,qualification:null}}
  function legacyWorldQualificationDifficulty(unit){const d=clamp(unit?.difficulty,0,1),legacyModal=unit?.kind==='jins'||unit?.kind==='maqam'||unit?.group==='world.raga';return clamp(d+(legacyModal?.08:0),0,1)}
  function prerequisiteThresholds(unit){const world=unit?.module==='world',difficulty=unit?(world?legacyWorldQualificationDifficulty(unit):unit._readyDifficulty??clamp(unit.challenge?.perceptual??unit.difficulty,0,1)):0,needed=unit?(world?Math.max(4,Math.round(3+difficulty*5)):unit._readyAttempts??Math.max(4,Math.round(3+difficulty*5))):4;return{difficulty,needed,lower:.45+.14*difficulty}}
  function directQualificationProof(card,unit){if(!card||!unit)return false;const req=prerequisiteThresholds(unit);if(card.attempts<req.needed||card.spaced<1)return false;return betaStats(card.alpha,card.beta).lower>=req.lower}
  function qualificationSnapshot(card,unit,timestamp=Date.now()){if(!directQualificationProof(card,unit))return null;return{time:Math.max(0,finite(timestamp)),attempts:card.attempts,correct:card.correct,alpha:Math.round(card.alpha*1e12)/1e12,beta:Math.round(card.beta*1e12)/1e12,spaced:card.spaced}}
  function sanitizeQualification(raw,card,unit,timestamp=Date.now()){const rebuild=()=>qualificationSnapshot(card,unit,Math.max(0,finite(raw?.time??card.last??timestamp)));if(!raw||typeof raw!=='object')return rebuild();const q={time:Math.max(0,finite(raw.time)),attempts:int(raw.attempts,0,1e7),correct:int(raw.correct,0,1e7),alpha:clamp(raw.alpha,.2,1e6),beta:clamp(raw.beta,.2,1e6),spaced:int(raw.spaced,0,1e7)};if(q.attempts>card.attempts||q.correct>card.correct||q.correct>q.attempts||q.spaced>card.spaced||q.spaced>q.correct||q.alpha>card.alpha+1e-9||q.beta>card.beta+1e-9)return rebuild();const proof={...card,attempts:q.attempts,correct:q.correct,alpha:q.alpha,beta:q.beta,spaced:q.spaced};return directQualificationProof(proof,unit)?q:rebuild()}
  function ensureQualification(card,unit,timestamp=Date.now()){if(card?.qualification)return card.qualification;const q=qualificationSnapshot(card,unit,timestamp);if(q)card.qualification=q;return q}
  function freshFactor(){return{alpha:PRIOR_A,beta:PRIOR_B,attempts:0,last:0}}
  function freshCalibration(){return{bias:0,n:0}}
  function cloneDefaults(){return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))}
  function createState(timestamp=Date.now()){
    return{
      schema:SCHEMA,
      version:VERSION,
      created:timestamp,
      updated:timestamp,
      settings:cloneDefaults(),
      units:{},
      factors:{family:{},context:{},latent:{}},
      confusions:{},
      calibration:{global:freshCalibration(),family:{}},
      placement:{passed:{},history:[]},
      performance:[],
      durable:{transfer:{},tuningContexts:{}},
      attempts:[],
      sessions:[],
      lastPractice:null,
      lastHands:null,
      counters:{practice:0,hands:0},
      legacy:null
    };
  }
  function hasMicrotonalCents(unit){const cents=Array.isArray(unit?.params?.cents)?unit.params.cents:[];return cents.some(c=>{const n=Number(c);return Number.isFinite(n)&&Math.abs(n/100-Math.round(n/100))>.08})}
  function isRhythmUnit(unit){return unit?.kind==='rhythm'||unit?.family==='rhythm'}
  function isWorldModalUnit(unit){return unit?.module==='world'&&['jins','maqam','raga'].includes(unit?.kind)}
  function statisticalFamily(unit){if(unit?.module==='world'){if(isRhythmUnit(unit))return 'world.rhythm';if(isWorldModalUnit(unit))return 'world.modal'}return unit?.family||'unknown'}
  function primarySkillFamily(unit){return isRhythmUnit(unit)?'rhythm':(unit?.family||'unknown')}
  function catalogParts(catalog){
    if(!catalog||!Array.isArray(catalog.units)||!catalog.byId)throw new Error('Catalogue EarForge invalide');let hit=CATALOG_PARTS_CACHE.get(catalog);if(hit&&hit.units===catalog.units&&hit.count===catalog.units.length)return hit;hit={units:catalog.units,byId:catalog.byId,ids:new Set(catalog.units.map(u=>u.id)),families:new Set(catalog.units.map(u=>u.family)),statFamilies:new Set(catalog.units.map(statisticalFamily)),count:catalog.units.length};CATALOG_PARTS_CACHE.set(catalog,hit);return hit;
  }
  function sanitizeSettings(raw){
    const s=cloneDefaults(),r=raw&&typeof raw==='object'?raw:{};
    s.theme=['system','dark','light'].includes(r.theme)?r.theme:'system';
    s.volume=clamp(r.volume??r.soundVolume??s.volume,.08,.95);
    s.soundDuration=clamp(r.soundDuration??s.soundDuration,.7,2.6);
    s.presentationTempo=clamp(r.presentationTempo??(r.soundDuration?Math.round(90/clamp(r.soundDuration,.7,2.6)):s.presentationTempo),48,132);
    s.practiceMinutes=int(r.practiceMinutes??r.duration??s.practiceMinutes,5,24);
    s.spokenCorrections=r.spokenCorrections!==false;
    s.firstHints=r.firstHints!==false;
    s.voiceKey=typeof r.voiceKey==='string'?r.voiceKey.slice(0,180):'';
    s.degreeNotation=['numeric','mobile','function'].includes(r.degreeNotation)?r.degreeNotation:'numeric';
    const h=r.hands&&typeof r.hands==='object'?r.hands:{};
    s.hands.minutes=int(h.minutes??h.duration??s.hands.minutes,6,24);
    s.hands.silence=clamp(h.silence??s.hands.silence,2,9);
    s.hands.rate=clamp(h.rate??s.hands.rate,.65,1.18);
    s.hands.focus=typeof h.focus==='string'?h.focus.slice(0,32):'adaptive';
    s.focus=typeof r.focus==='string'?r.focus.slice(0,32):'adaptive';
    const m=r.modules&&typeof r.modules==='object'?r.modules:{};
    s.modules.jazz=m.jazz===true;
    s.modules.styles=m.styles===true;
    s.modules.expression=m.expression===true;
    s.modules.world=m.world===true;
    s.modules.micro=m.micro===true;
    const e=r.experiments&&typeof r.experiments==='object'?r.experiments:{};
    s.experiments.adaptiveTempo=e.adaptiveTempo!==false;
    s.experiments.contextTransfer=e.contextTransfer!==false;
    return s;
  }
  function sanitizeCard(raw,unit=null,timestamp=Date.now()){
    const c=freshCard(),r=raw&&typeof raw==='object'?raw:{};
    c.alpha=clamp(r.alpha,.2,1e6);c.beta=clamp(r.beta,.2,1e6);
    c.attempts=int(r.attempts,0,1e7);c.correct=int(r.correct,0,c.attempts);
    c.lapses=int(r.lapses,0,c.attempts);c.streak=int(r.streak,0,c.attempts);
    c.difficulty=clamp(r.difficulty,1,10);c.stability=clamp(r.stability,.02,36500);
    c.due=Math.max(0,finite(r.due));c.first=Math.max(0,finite(r.first));c.last=Math.max(0,finite(r.last));c.lastShown=Math.max(0,finite(r.lastShown));
    c.meanLatency=clamp(r.meanLatency,0,120000);c.exposures=int(r.exposures,0,1e7);c.spaced=int(r.spaced,0,c.correct);c.hintShown=r.hintShown===true;c.irtDifficulty=clamp(r.irtDifficulty??.5,.02,.98);c.irtN=int(r.irtN,0,c.attempts);
    if(c.alpha+c.beta<.5){c.alpha=PRIOR_A;c.beta=PRIOR_B}
    c.qualification=sanitizeQualification(r.qualification,c,unit,timestamp);
    return c;
  }
  function sanitizeFactor(raw){
    const f=freshFactor(),r=raw&&typeof raw==='object'?raw:{};
    f.alpha=clamp(r.alpha,.2,1e6);f.beta=clamp(r.beta,.2,1e6);f.attempts=int(r.attempts,0,1e7);f.last=Math.max(0,finite(r.last));return f;
  }
  function migrateLegacy(raw,catalog,timestamp){
    const out=createState(timestamp),parts=catalogParts(catalog);
    out.settings=sanitizeSettings(raw?.settings);
    const oldSkills=raw?.skills&&typeof raw.skills==='object'?raw.skills:{};
    out.legacy={schema:int(raw?.schema,0,99),migratedAt:timestamp,familyTotals:{}};
    for(const family of parts.families){
      const old=oldSkills[family];
      if(!old||typeof old!=='object')continue;
      let a=finite(old.alpha,NaN),b=finite(old.beta,NaN);
      if(!Number.isFinite(a)||!Number.isFinite(b)){
        const mastery=clamp(old.mastery,.02,.98);a=1+mastery*8;b=1+(1-mastery)*8;
      }
      const factor=sanitizeFactor({alpha:a,beta:b,attempts:old.attempts??old.seen,last:old.lastSeen});
      out.factors.family[family]=factor;
      out.legacy.familyTotals[family]={attempts:int(old.attempts??old.seen,0,1e7),correct:int(old.correct,0,1e7),lapses:int(old.lapses,0,1e7)};
    }
    if(out.factors.family.world){const z=out.factors.family.world,excess=Math.max(0,z.alpha+z.beta-PRIOR_A-PRIOR_B),mean=z.alpha/Math.max(.001,z.alpha+z.beta),mass=Math.min(6,excess*.25);for(const key of ['world.modal','world.rhythm'])if(!out.factors.family[key])out.factors.family[key]={alpha:PRIOR_A+mass*mean,beta:PRIOR_B+mass*(1-mean),attempts:Math.min(12,Math.round((z.attempts||0)*.25)),last:z.last||0}}

    out.sessions=Array.isArray(raw?.sessions)?raw.sessions.slice(-MAX_SESSION_LOG).map(sanitizeSession).filter(Boolean):[];
    out.created=Math.max(0,finite(raw?.created,timestamp));out.updated=timestamp;
    return out;
  }
  const CONTEXT_KEY_RE=/^(timbre|register|presentation|meter|mode|kit|articulation|tempoBand):[a-z0-9._-]{1,48}$/i;
  function sanitizeContextLog(raw){
    const values=Array.isArray(raw)?raw:contextKeys(raw);return values.filter(v=>CONTEXT_KEY_RE.test(String(v))).map(String).slice(0,8);
  }
  const TRANSFER_AXES=Object.freeze(['timbre','register','articulation','tempoBand']);
  function freshDurable(){return{transfer:{},tuningContexts:{}}}
  function transferAxisParts(key){const m=/^(timbre|register|articulation|tempoBand):(.+)$/i.exec(String(key||''));return m?[m[1],m[2]]:null}
  function updateTransferSufficient(state,unitId,context){const keys=sanitizeContextLog(context);if(!keys.length)return;const root=state.durable||(state.durable=freshDurable()),row=root.transfer[unitId]||(root.transfer[unitId]={axes:{}}),axes=row.axes||(row.axes={});for(const key of keys){const m=transferAxisParts(key);if(!m)continue;const [axis,value]=m,list=Array.isArray(axes[axis])?axes[axis]:(axes[axis]=[]);if(!list.includes(value)&&list.length<2)list.push(value)}}
  const TUNING_CONTEXT_RE=/^(?:timbre:(?:organ|strings|flute)|register:(?:low|mid|high)|articulation:(?:tenuto|normal)|tempoBand:(?:slow|moderate|moving|fast))$/;
  function tuningContextKeys(raw){return sanitizeContextLog(raw).filter(key=>TUNING_CONTEXT_RE.test(key))}
  function updateTuningContextSufficient(state,unitId,correct,context){if(!(tuningThresholdFromId(unitId)>0))return;const keys=tuningContextKeys(context);if(!keys.length)return;const root=state.durable||(state.durable=freshDurable()),units=root.tuningContexts||(root.tuningContexts={}),row=units[unitId]||(units[unitId]={});for(const key of keys){const z=row[key]||(row[key]={n:0,correct:0});z.n++;if(correct)z.correct++}}
  function sanitizeDurable(raw,state,catalog){const parts=catalogParts(catalog),out=freshDurable(),r=raw&&typeof raw==='object'?raw:{};const tr=r.transfer&&typeof r.transfer==='object'?r.transfer:{};for(const [id,row] of Object.entries(tr)){if(!parts.ids.has(id)||!row||typeof row!=='object')continue;const card=state.units[id],axes={};for(const axis of TRANSFER_AXES){const vals=Array.isArray(row.axes?.[axis])?row.axes[axis]:[],clean=[];for(const value of vals){const v=String(value||'');if(!/^[a-z0-9._-]{1,48}$/i.test(v)||clean.includes(v))continue;clean.push(v);if(clean.length>=2)break}if(card?.correct<2&&clean.length>1)clean.length=1;if(clean.length)axes[axis]=clean}if(Object.keys(axes).length)out.transfer[id]={axes}}const tc=r.tuningContexts&&typeof r.tuningContexts==='object'?r.tuningContexts:{};for(const [id,row] of Object.entries(tc)){if(!parts.ids.has(id)||!(tuningThresholdFromId(id)>0)||!row||typeof row!=='object')continue;const card=state.units[id];if(!card?.attempts)continue;const clean={};for(const [key,z] of Object.entries(row)){if(!TUNING_CONTEXT_RE.test(key)||!z||typeof z!=='object')continue;const n=int(z.n,0,card.attempts),correct=int(z.correct,0,Math.min(n,card.correct));if(n>0)clean[key]={n,correct}}if(Object.keys(clean).length)out.tuningContexts[id]=clean}return out}
  function rebuildDurableFromAttempts(state){state.durable=freshDurable();for(const a of state.attempts||[]){if(a.correct)updateTransferSufficient(state,a.unit,a.context);updateTuningContextSufficient(state,a.unit,a.correct,a.context)}return state.durable}
  function sanitizeStimulus(raw){const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const out={};const tempo=clamp(r.tempoBpm??r.bpm,0,400),duration=clamp(r.durationSeconds??r.duration,0,120),challenge=Number(r.stimulusChallenge),tempoRatio=Number(r.tempoRatio),noteDurationScale=Number(r.noteDurationScale);if(tempo>0)out.tempoBpm=Math.round(tempo*100)/100;if(duration>0)out.durationSeconds=Math.round(duration*1000)/1000;if(Number.isFinite(challenge))out.stimulusChallenge=Math.round(clamp(challenge,0,1)*10000)/10000;if(Number.isFinite(tempoRatio)&&tempoRatio>0)out.tempoRatio=Math.round(tempoRatio*10000)/10000;if(Number.isFinite(noteDurationScale)&&noteDurationScale>0)out.noteDurationScale=Math.round(noteDurationScale*10000)/10000;return out}
  function sanitizeAttempt(x,ids){
    if(!x||typeof x!=='object'||!ids.has(String(x.unit??x.u??'')))return null;
    const unit=String(x.unit??x.u),wrong=ids.has(String(x.wrong??x.w??''))?String(x.wrong??x.w):null;
    return{time:Math.max(0,finite(x.time??x.t)),unit,correct:Boolean(x.correct??x.o),wrong,latency:clamp(x.latency??x.l,0,120000),replays:int(x.replays??x.r,0,99),hints:int(x.hints??x.h,0,20),confidence:x.confidence==null?null:Math.round(clamp(x.confidence,0,1)*10000)/10000,predicted:x.predicted==null?null:Math.round(clamp(x.predicted,0,1)*1000000)/1000000,irt:x.irt==null?null:Math.round(clamp(x.irt,0,1)*1000000)/1000000,choices:int(x.choices??x.n,2,8),difficulty:Math.round(clamp(x.difficulty??x.d,.1,1)*1000)/1000,context:sanitizeContextLog(x.context??x.c),stimulus:sanitizeStimulus(x.stimulus??x.s??x.context),mode:x.mode==='hands'?'hands':'practice'};
  }
  function sanitizeSession(x){
    if(!x||typeof x!=='object')return null;
    const mode=x.mode==='hands'?'hands':'practice';
    const fatigue=clamp(x.fatigue,0,1),duration=clamp(x.duration??x.minutes,0,240),load=x.load&&typeof x.load==='object'?x.load:{};
    return{time:Math.max(0,finite(x.time??x.t)),mode,count:int(x.count??x.total,0,10000),accuracy:clamp(x.accuracy,0,1),fatigue,duration,load:{active:clamp(load.active??(mode==='practice'?fatigue:0),0,1),passive:clamp(load.passive??(mode==='hands'?Math.min(.85,.12+duration/80):0),0,1),auditory:clamp(load.auditory??(mode==='hands'?Math.min(.9,.18+duration/60):fatigue*.55),0,1),cognitive:clamp(load.cognitive??(mode==='practice'?fatigue:Math.min(.45,.08+duration/160)),0,1),attention:clamp(load.attention??(mode==='practice'?fatigue:Math.min(.5,.10+duration/150)),0,1)}};
  }
  function sanitizeState(raw,catalog,timestamp=Date.now()){
    const parts=catalogParts(catalog);
    if(!raw||typeof raw!=='object')return createState(timestamp);
    const schema=Number(raw.schema);if(schema!==SCHEMA&&schema!==8&&schema!==7)return migrateLegacy(raw,catalog,timestamp);
    const out=createState(timestamp);
    out.created=Math.max(0,finite(raw.created,timestamp));out.updated=timestamp;out.settings=sanitizeSettings(raw.settings);
    const units=raw.units&&typeof raw.units==='object'?raw.units:{};
    for(const [id,value] of Object.entries(units))if(parts.ids.has(id))out.units[id]=sanitizeCard(value,catalog.byId[id],timestamp);
    const family=raw.factors?.family&&typeof raw.factors.family==='object'?raw.factors.family:{};
    for(const [key,value] of Object.entries(family))if(parts.families.has(key)||parts.statFamilies.has(key))out.factors.family[key]=sanitizeFactor(value);if(out.factors.family.world){const z=out.factors.family.world,excess=Math.max(0,z.alpha+z.beta-PRIOR_A-PRIOR_B),mean=z.alpha/Math.max(.001,z.alpha+z.beta),mass=Math.min(6,excess*.25);for(const key of ['world.modal','world.rhythm'])if(!out.factors.family[key])out.factors.family[key]={alpha:PRIOR_A+mass*mean,beta:PRIOR_B+mass*(1-mean),attempts:Math.min(12,Math.round((z.attempts||0)*.25)),last:z.last||0}}
    const context=raw.factors?.context&&typeof raw.factors.context==='object'?raw.factors.context:{};
    for(const [key,value] of Object.entries(context))if(CONTEXT_KEY_RE.test(key))out.factors.context[key]=sanitizeFactor(value);
    const latent=raw.factors?.latent&&typeof raw.factors.latent==='object'?raw.factors.latent:{};
    for(const [key,value] of Object.entries(latent))if(/^[a-z][a-z0-9._-]{1,63}$/i.test(key))out.factors.latent[key]=sanitizeFactor(value);
    const cal=raw.calibration&&typeof raw.calibration==='object'?raw.calibration:{};const cleanCal=x=>({bias:clamp(x?.bias,-.22,.22),n:int(x?.n,0,1e7)});out.calibration.global=cleanCal(cal.global);const cf=cal.family&&typeof cal.family==='object'?cal.family:{};for(const [key,value] of Object.entries(cf))if(parts.families.has(key)||parts.statFamilies.has(key))out.calibration.family[key]=cleanCal(value);if(out.calibration.family.world){const z=out.calibration.family.world;for(const key of ['world.modal','world.rhythm'])if(!out.calibration.family[key])out.calibration.family[key]={bias:clamp(z.bias*.35,-.08,.08),n:Math.min(12,Math.round((z.n||0)*.25))}}
    const conf=raw.confusions&&typeof raw.confusions==='object'?raw.confusions:{};
    for(const [correct,row] of Object.entries(conf)){
      if(!parts.ids.has(correct)||!row||typeof row!=='object')continue;
      const clean=Object.entries(row).filter(([wrong])=>parts.ids.has(wrong)&&wrong!==correct).map(([wrong,v])=>[wrong,{weight:clamp(v?.weight??v?.w,0,1000),last:Math.max(0,finite(v?.last??v?.t))}]).filter(([,v])=>v.weight>=.05).sort((a,b)=>b[1].weight-a[1].weight).slice(0,MAX_CONFUSIONS);
      if(clean.length)out.confusions[correct]=Object.fromEntries(clean);
    }
    out.attempts=Array.isArray(raw.attempts)?raw.attempts.slice(-MAX_ATTEMPT_LOG).map(x=>sanitizeAttempt(x,parts.ids)).filter(Boolean):[];
    out.durable=schema===SCHEMA?sanitizeDurable(raw.durable,out,catalog):rebuildDurableFromAttempts(out);
    out.sessions=Array.isArray(raw.sessions)?raw.sessions.slice(-MAX_SESSION_LOG).map(sanitizeSession).filter(Boolean):[];
    const placement=raw.placement&&typeof raw.placement==='object'?raw.placement:{};const passed=placement.passed&&typeof placement.passed==='object'?placement.passed:{};for(const [id,v] of Object.entries(passed))if(parts.ids.has(id)&&v&&typeof v==='object'){const score=clamp(v.score,0,1),questions=int(v.questions,0,200),reliability=clamp(v.reliability??Math.min(1,questions/8),0,1);if(v.passed===true&&score>=.75&&questions>=3)out.placement.passed[id]={passed:true,score,reliability,questions,time:Math.max(0,finite(v.time))}}out.placement.history=Array.isArray(placement.history)?placement.history.filter(x=>x&&parts.ids.has(String(x.unitId||''))).slice(-200).map(x=>({unitId:String(x.unitId),passed:x.passed===true,score:clamp(x.score,0,1),reliability:clamp(x.reliability,0,1),questions:int(x.questions,0,200),time:Math.max(0,finite(x.time))})):[];
    out.performance=Array.isArray(raw.performance)?raw.performance.slice(-240).map(sanitizePerformanceRow).filter(Boolean):[];
    out.lastPractice=parts.ids.has(String(raw.lastPractice))?String(raw.lastPractice):null;
    out.lastHands=parts.ids.has(String(raw.lastHands))?String(raw.lastHands):null;
    out.counters={practice:int(raw.counters?.practice,0,1e9),hands:int(raw.counters?.hands,0,1e9)};
    out.legacy=raw.legacy&&typeof raw.legacy==='object'?JSON.parse(JSON.stringify(raw.legacy)):null;
    return out;
  }
  function ensureCard(state,id){return state.units[id]||(state.units[id]=freshCard())}
  function ensureFactor(state,kind,key){const bucket=state.factors[kind]||(state.factors[kind]={});return bucket[key]||(bucket[key]=freshFactor())}
  function factorStats(state,family){const f=state.factors.family[family]||freshFactor();return betaStats(f.alpha,f.beta)}
  function contextStats(state,key){const f=state.factors.context[key]||freshFactor();return{...betaStats(f.alpha,f.beta),attempts:f.attempts,last:f.last}}
  function contextPriority(state,key){const x=contextStats(state,key);return .2+1.25*(1-x.lower)+.8*x.uncertainty+1/Math.sqrt(1+x.attempts)}
  function latentKeys(unit){const out=[];const add=x=>{if(x&&!out.includes(x))out.push(x)},rhythm=isRhythmUnit(unit),worldModal=isWorldModalUnit(unit);if(!rhythm&&(['direction','interval','chord','scale','tuning','degree','progression','modulation','melody'].includes(unit.family)||worldModal))add('auditory.pitch');if(unit.family==='direction')add('pitch.direction');if(unit.family==='interval')add('pitch.interval_width');if(unit.family==='chord'){add('harmony.chord_quality');add('harmony.voicing')}if(unit.family==='scale')add('tonal.scale_color');if(unit.family==='degree')add('tonal.function');if(unit.family==='progression'){add('tonal.function');add('harmony.progression')}if(unit.family==='modulation'){add('tonal.function');add('harmony.progression');add('harmony.modulation')}if(unit.family==='melody'){add('melody.contour');add('melody.memory')}if(unit.family==='tuning')add('intonation.discrimination');if(rhythm){add('rhythm.pulse');const a=String(unit.params?.axis||unit.group||'');if(/subdiv|notation|eighth|sixteenth|triplet/i.test(a+unit.id))add('rhythm.subdivision');if(/sync|swing|clave|groove|style/i.test(a+unit.id))add('rhythm.syncopation');if(/meter|odd|five|seven|nine|twelve|polyrhythm/i.test(a+unit.id))add('rhythm.meter_layers')}if(unit.family==='expression'){if(/articulation/.test(unit.group))add('expression.articulation');else add('expression.dynamics')}if(worldModal){add('world.modal_language');if(hasMicrotonalCents(unit))add('intonation.microtonal')}return out.slice(0,5)}
  function controlLatentKeys(unit){const out=[],add=x=>{if(x&&!out.includes(x))out.push(x)};if(['direction','interval','chord','scale','tuning','degree','progression','modulation','melody','world'].includes(unit.family))add('auditory.pitch');if(unit.family==='direction')add('pitch.direction');if(unit.family==='interval')add('pitch.interval_width');if(unit.family==='chord'){add('harmony.chord_quality');add('harmony.voicing')}if(unit.family==='scale')add('tonal.scale_color');if(unit.family==='degree')add('tonal.function');if(unit.family==='progression'){add('tonal.function');add('harmony.progression')}if(unit.family==='modulation'){add('tonal.function');add('harmony.progression');add('harmony.modulation')}if(unit.family==='melody'){add('melody.contour');add('melody.memory')}if(unit.family==='tuning')add('intonation.discrimination');if(unit.family==='rhythm'){add('rhythm.pulse');const a=String(unit.params?.axis||unit.group||'');if(/subdiv|notation|eighth|sixteenth|triplet/i.test(a+unit.id))add('rhythm.subdivision');if(/sync|swing|clave|groove|style/i.test(a+unit.id))add('rhythm.syncopation');if(/meter|odd|five|seven|nine|twelve|polyrhythm/i.test(a+unit.id))add('rhythm.meter_layers')}if(unit.family==='expression'){if(/articulation/.test(unit.group))add('expression.articulation');else add('expression.dynamics')}if(unit.module==='world'){add('world.modal_language');if(unit.kind==='jins'||unit.kind==='maqam'||unit.group==='world.raga')add('intonation.microtonal')}return out.slice(0,5)}
  function typedLatentKeys(unit){if(unit?.module!=='world')return[];const out=[],add=x=>{if(x&&!out.includes(x))out.push(x)};if(isRhythmUnit(unit)){add('typed.world.rhythm.pulse');const a=String(unit.params?.axis||unit.group||'');if(/sync|swing|clave|groove|style|world-cycle/i.test(a+unit.id))add('typed.world.rhythm.syncopation');if(/meter|odd|five|seven|nine|twelve|polyrhythm|tala|cycle/i.test(a+unit.id))add('typed.world.rhythm.meter_layers')}else if(isWorldModalUnit(unit)){add('typed.world.modal_language');if(hasMicrotonalCents(unit))add('typed.intonation.microtonal')}return out.slice(0,5)}
  function typedLatentStats(state,unit){const keys=typedLatentKeys(unit);let weight=0,mean=0,lower=0,uncertainty=0,attempts=0,n=0;for(const key of keys){const f=state.factors?.latent?.[key];if(!f||!(f.attempts>0))continue;const x=betaStats(f.alpha,f.beta),w=Math.sqrt(f.attempts);weight+=w;mean+=x.mean*w;lower+=x.lower*w;uncertainty+=x.uncertainty*w;attempts+=f.attempts;n++}return n?{mean:mean/weight,lower:lower/weight,uncertainty:uncertainty/weight,attempts,keys}:{mean:.5,lower:0,uncertainty:1,attempts:0,keys}}
  function latentStats(state,unit){const keys=controlLatentKeys(unit);if(!(state.counters?.practice>0))return{mean:.5,lower:0,uncertainty:1,attempts:0,keys};let weight=0,mean=0,lower=0,uncertainty=0,attempts=0,n=0;for(let i=0;i<keys.length;i++){const f=state.factors?.latent?.[keys[i]];if(!f||!(f.attempts>0))continue;const x=betaStats(f.alpha,f.beta),w=Math.sqrt(f.attempts);weight+=w;mean+=x.mean*w;lower+=x.lower*w;uncertainty+=x.uncertainty*w;attempts+=f.attempts;n++}if(!n)return{mean:.5,lower:0,uncertainty:1,attempts:0,keys};return{mean:mean/weight,lower:lower/weight,uncertainty:uncertainty/weight,attempts,keys}}
  function logit(p){p=clamp(p,1e-6,1-1e-6);return Math.log(p/(1-p))}
  function sigmoid(x){return x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x))}
  function legacyWorldPlannerChallenge(unit){const d=clamp(unit.difficulty,.02,.98),p=unit.params||{},seq=Array.isArray(p.steps)?p.steps:Array.isArray(p.cents)?p.cents:Array.isArray(p.roman)?p.roman:Array.isArray(p.chords)?p.chords:Array.isArray(p.events)?p.events:[],len=unit.group==='world.raga'?8:(seq.length||(Number.isFinite(Number(p.steps))?Math.min(32,Math.max(0,Number(p.steps))):0)),legacyModal=unit.kind==='jins'||unit.kind==='maqam'||unit.group==='world.raga',r3=x=>+clamp(x,0,1).toFixed(3),perceptual=r3(d+(legacyModal?.08:0)+(unit.family==='interval'?.04:0)),conceptual=r3(d+((unit.family==='degree'||unit.family==='progression'||unit.family==='modulation')?.08:0)-(unit.kind==='direction'?.10:0)),memory=+clamp(d*.64+Math.min(.32,len*.035)+(unit.kind==='melody'?.12:0),.05,1).toFixed(3),speed=+clamp(d*.52+(p.tempo?Math.max(0,(p.tempo-72)/180):0)+(unit.family==='rhythm'?.12:0),.05,1).toFixed(3),transfer=+clamp(d*.58+(unit.stage||0)/120+(unit.module==='world'||unit.module==='jazz'?.10:0),.08,1).toFixed(3);return clamp(.42*perceptual+.18*memory+.16*speed+.14*conceptual+.10*transfer,.02,.98)}
  function challengeScalar(unit){if(unit?.module==='world')return legacyWorldPlannerChallenge(unit);if(Number.isFinite(unit._challengeScalar))return unit._challengeScalar;const v=unit.challenge||{},d=clamp(unit.difficulty,.02,.98);return clamp(.42*clamp(v.perceptual??d,0,1)+.18*clamp(v.memory??d,0,1)+.16*clamp(v.speed??d,0,1)+.14*clamp(v.conceptual??d,0,1)+.10*clamp(v.transfer??d,0,1),.02,.98)}
  function irtPrediction(state,unit,preparedLatent=null,preparedCard=undefined,preparedFamily=null){const card=preparedCard===undefined?state.units[unit.id]:preparedCard,latent=preparedLatent||latentStats(state,unit),skill=latent.attempts?latent.mean:(preparedFamily||factorStats(state,unit.family)).mean,d=card?.irtN?card.irtDifficulty:challengeScalar(unit);return clamp(sigmoid(1.7*(logit(skill)-logit(d))),.04,.996)}
  function updateIRTDifficulty(card,unit,p,outcome){if(!card.irtN)card.irtDifficulty=challengeScalar(unit);card.irtN++;const eta=Math.max(.008,.055/Math.sqrt(card.irtN));card.irtDifficulty=clamp(card.irtDifficulty-eta*((outcome?1:0)-p),.02,.98);return card.irtDifficulty}
  function evidenceStats(state,unit,preparedFamily=null,preparedCard=undefined){
    const family=preparedFamily||factorStats(state,unit.family),card=preparedCard===undefined?state.units[unit.id]:preparedCard;
    if(!card)return family;
    const item=betaStats(card.alpha,card.beta),w=card.attempts/(card.attempts+8);
    const mean=w*item.mean+(1-w)*family.mean;
    const variance=w*w*item.variance+(1-w)*(1-w)*family.variance+.012*w*(1-w),mixPenalty=.035*Math.sqrt(w*(1-w));
    return{mean,variance,lower:clamp(w*item.lower+(1-w)*family.lower-mixPenalty,0,1),uncertainty:clamp(w*item.uncertainty+(1-w)*family.uncertainty+.10*Math.sqrt(w*(1-w)),0,1)};
  }
  function retrievability(card,timestamp=Date.now()){
    if(!card||!card.attempts||!card.last)return .72;
    const elapsed=Math.max(0,(timestamp-card.last)/DAY),s=Math.max(.02,card.stability);
    return clamp(Math.pow(.9,elapsed/s),.02,1);
  }
  function rawPrediction(state,unit,timestamp=Date.now(),preparedEvidence=null,preparedLatent=null,preparedCard=undefined){
    const e=preparedEvidence||evidenceStats(state,unit),card=preparedCard===undefined?state.units[unit.id]:preparedCard,r=retrievability(card,timestamp),latent=preparedLatent||latentStats(state,unit),attempts=card?.attempts||0,cold=latent.attempts?Math.min(.14,.14*Math.exp(-attempts/3)):0,knowledge=(1-cold)*e.mean+cold*latent.mean,designedDifficulty=challengeScalar(unit),learnedDifficulty=card?.irtN>=6?card.irtDifficulty:designedDifficulty,difficultyScalar=.82*designedDifficulty+.18*learnedDifficulty,difficultyPenalty=(difficultyScalar-.5)*.18;
    return clamp(.10+.86*knowledge*Math.pow(r,.42)-difficultyPenalty,.08,.985);
  }
  function correlatedRisk(state,unit,timestamp=Date.now(),preparedFamily=null){
    let num=0,den=0,family=preparedFamily;for(const rel of unit.relations||[]){const v=state.units[rel.id];if(!v||v.attempts<2)continue;if(!family)family=factorStats(state,unit.family);const item=betaStats(v.alpha,v.beta),mix=v.attempts/(v.attempts+8),mean=mix*item.mean+(1-mix)*family.mean,r=retrievability(v,timestamp),p=clamp(.10+.86*mean*Math.pow(r,.42)-(clamp(rel.difficulty,.0,1)-.5)*.18,.08,.985),err=v.attempts?1-v.correct/v.attempts:0,cp=Math.min(1,confusionPressure(state,rel.id)/2.2),w=clamp(rel.weight,0,1);num+=w*(.56*(1-p)+.24*err+.20*cp);den+=w}return den?num/den:0
  }
  function prediction(state,unit,timestamp=Date.now(),preparedEvidence=null,preparedFamily=null,preparedCard=undefined){
    const card=preparedCard===undefined?state.units[unit.id]:preparedCard,latent=latentStats(state,unit),base=rawPrediction(state,unit,timestamp,preparedEvidence,latent,card),cal=state.calibration||{},g=cal.global||freshCalibration(),parent=cal.family?.[unit.family]||freshCalibration(),familyBias=parent.bias,attempts=card?.attempts||0,risk=Math.max(0,correlatedRisk(state,unit,timestamp,preparedFamily)-.48),prior=.07*risk*Math.exp(-attempts/2.4);
    const calibrated=clamp(base+.35*g.bias+.65*familyBias-prior,.08,.985),n=card?.irtN||0;if(n<8)return calibrated;const w=Math.min(.16,.04+.015*Math.sqrt(n-7));return clamp((1-w)*calibrated+w*irtPrediction(state,unit,latent,card,preparedFamily),.08,.985);
  }
  function updateCalibration(state,unit,basePrediction,outcome){const cal=state.calibration||(state.calibration={global:freshCalibration(),family:{}}),res=(outcome?1:0)-basePrediction;function upd(x,rate){x.n=(x.n||0)+1;const eta=Math.max(.012,Math.min(rate,1/(8+Math.sqrt(x.n)*2)));x.bias=clamp((x.bias||0)+eta*(res-(x.bias||0)),-.22,.22)}upd(cal.global||(cal.global=freshCalibration()),.055);const parentKey=unit.family,parent=cal.family[parentKey]||(cal.family[parentKey]=freshCalibration());upd(parent,.075);const key=statisticalFamily(unit);if(key!==parentKey){const child=cal.family[key]||(cal.family[key]=freshCalibration());upd(child,.075)}}
  function calibrationMetrics(state,{window=500,bins=8}={}){const rows=(state.attempts||[]).filter(a=>a.mode==='practice'&&Number.isFinite(a.predicted)).slice(-Math.max(1,window));if(!rows.length)return{n:0,brier:null,logLoss:null,ece:null,bins:[]};let brier=0,logLoss=0;const buckets=Array.from({length:Math.max(2,bins)},()=>({n:0,p:0,y:0}));for(const a of rows){const p=clamp(a.predicted,1e-6,1-1e-6),y=a.correct?1:0;brier+=(p-y)*(p-y);logLoss-=y*Math.log(p)+(1-y)*Math.log(1-p);const k=Math.min(buckets.length-1,Math.floor(p*buckets.length)),z=buckets[k];z.n++;z.p+=p;z.y+=y}let ece=0;const out=[];for(let i=0;i<buckets.length;i++){const z=buckets[i];if(!z.n)continue;const p=z.p/z.n,y=z.y/z.n;const gap=Math.abs(p-y);ece+=z.n/rows.length*gap;out.push({from:i/buckets.length,to:(i+1)/buckets.length,n:z.n,predicted:p,observed:y,gap})}return{n:rows.length,brier:brier/rows.length,logLoss:logLoss/rows.length,ece,bins:out}}
  function tuningThresholdFromId(id){const m=/^tuning:([0-9]+(?:\.[0-9]+)?):/.exec(String(id||''));return m?Number(m[1]):null}
  function intonationProfile(state,{contextKey=null,minAttempts=3,targetSensitivity=.65}={}){
    const key=String(contextKey||''),stamp=`${Number(state?.updated)||0}`,cached=INTONATION_CACHE.get(state);if(cached?.stamp===stamp&&cached.rows?.has(key))return cached.rows.get(key);
    const groups=new Map(),chance=1/3,add=(threshold,n,correct)=>{if(!(threshold>0)||!(n>0))return;let g=groups.get(threshold);if(!g){g={threshold,n:0,correct:0};groups.set(threshold,g)}g.n+=n;g.correct+=correct};
    if(key){for(const [id,row] of Object.entries(state?.durable?.tuningContexts||{})){const z=row?.[key];if(z?.n) add(tuningThresholdFromId(id),z.n,z.correct)}}else{for(const [id,card] of Object.entries(state?.units||{})){const threshold=tuningThresholdFromId(id);if(threshold>0&&card?.attempts) add(threshold,card.attempts,card.correct)}}
    const bins=[...groups.values()].sort((a,b)=>a.threshold-b.threshold).map(g=>{const s=betaStats(PRIOR_A+g.correct,PRIOR_B+g.n-g.correct),sensitivity=clamp((s.mean-chance)/(1-chance),0,1),lowerSensitivity=clamp((s.lower-chance)/(1-chance),0,1);return{...g,mean:s.mean,lower:s.lower,sensitivity,lowerSensitivity,uncertainty:s.uncertainty}});
    const usable=bins.filter(b=>b.n>=Math.max(1,minAttempts));let estimate=null;
    if(usable.length){const pass=usable.find(b=>b.sensitivity>=targetSensitivity);if(pass){const i=usable.indexOf(pass),lo=i>0?usable[i-1]:null;if(lo&&lo.sensitivity<targetSensitivity&&pass.sensitivity>lo.sensitivity){const t=clamp((targetSensitivity-lo.sensitivity)/(pass.sensitivity-lo.sensitivity),0,1);estimate=Math.exp(Math.log(lo.threshold)*(1-t)+Math.log(pass.threshold)*t)}else estimate=pass.threshold}else estimate=usable.at(-1).threshold*1.25;estimate=clamp(estimate,3,80)}
    const n=bins.reduce((a,b)=>a+b.n,0),confidence=n?clamp(1-Math.exp(-n/18),0,1):0,result={n,contextKey:key||null,targetSensitivity,estimateCents:estimate,confidence,bins};let holder=cached;if(!holder||holder.stamp!==stamp)holder={stamp,rows:new Map()};holder.rows.set(key,result);INTONATION_CACHE.set(state,holder);return result;
  }
  function intonationCalibrationMatrix(state,{minAttempts=3,targetSensitivity=.65,axes=['timbre','register','articulation','tempoBand']}={}){
    const seen=new Set();for(const row of Object.values(state?.durable?.tuningContexts||{}))for(const k of Object.keys(row||{})){const m=/^(timbre|register|articulation|tempoBand):/i.exec(k);if(m&&axes.includes(m[1]))seen.add(k)}
    const contexts=[...seen].sort(),rows=contexts.map(contextKey=>intonationProfile(state,{contextKey,minAttempts,targetSensitivity})).filter(r=>r.n>0),global=intonationProfile(state,{minAttempts,targetSensitivity});
    return{global,contexts:rows,coverage:rows.length,calibrated:rows.filter(r=>r.estimateCents&&r.confidence>=.35).length};
  }
  function confusionGraph(state,{limit=24}={}){
    const edges=[];for(const [from,row] of Object.entries(state?.confusions||{}))for(const [to,v] of Object.entries(row||{})){const forward=clamp(v?.weight,0,1000),reverse=clamp(state?.confusions?.[to]?.[from]?.weight,0,1000),sum=forward+reverse;if(!(forward>0))continue;edges.push({from,to,weight:forward,reverse,asymmetry:sum?(forward-reverse)/sum:0,last:Math.max(0,finite(v?.last))})}edges.sort((a,b)=>b.weight-a.weight||Math.abs(b.asymmetry)-Math.abs(a.asymmetry));return{edges:edges.slice(0,Math.max(1,int(limit,1,200))),totalEdges:edges.length,maxWeight:edges[0]?.weight||0};
  }
  function moduleEnabled(state,unit){switch(unit._moduleCode){case 0:return true;case 1:return Boolean(state.settings.modules.jazz);case 2:return Boolean(state.settings.modules.styles);case 3:return Boolean(state.settings.modules.expression);case 4:return Boolean(state.settings.modules.world);case 5:return Boolean(state.settings.modules.micro);default:return unit.module==='core'||unit.module==='jazz'&&state.settings.modules.jazz||unit.module==='styles'&&state.settings.modules.styles||unit.module==='expression'&&state.settings.modules.expression||unit.module==='world'&&state.settings.modules.world||unit.module==='micro'&&state.settings.modules.micro}}
  function transferSummary(state,unit){const row=state?.durable?.transfer?.[unit.id],diversity=Object.fromEntries(TRANSFER_AXES.map(axis=>[axis,Array.isArray(row?.axes?.[axis])?row.axes[axis].length:0])),crossed=Object.values(diversity).filter(n=>n>=2).length;return{diversity,crossed,attempts:state?.units?.[unit.id]?.correct||0}}
  function competenceStage(state,unit,timestamp=Date.now()){
    const c=state.units[unit.id],e=evidenceStats(state,unit),difficulty=clamp(unit.challenge?.perceptual??unit.difficulty,0,1),recognized=Boolean(c&&c.attempts>=Math.max(4,Math.round(3+difficulty*5))&&e.lower>=.45+.14*difficulty),stabilized=Boolean(c&&recognized&&c.spaced>=1&&prediction(state,unit,timestamp)>=.60&&e.mean>=.62),transfer=stabilized?transferSummary(state,unit):{crossed:0},transferred=Boolean(stabilized&&c.spaced>=2&&transfer.crossed>=3);
    if(transferred)return'transferred';if(stabilized)return'stabilized';if(recognized)return'recognized';if(c&&(c.attempts>0||c.exposures>=Math.max(4,Math.round(3+difficulty*5))))return'familiarized';if(c&&(c.exposures>0||c.lastShown))return'seen';return'unseen';
  }
  function placementReady(state,id){const p=state.placement?.passed?.[id];return Boolean(p?.passed&&p.score>=.75&&p.questions>=3&&p.reliability>=.35)}
  function recordPlacement(state,catalog,{unitId,passed=false,score=0,reliability=null,questions=0,timestamp=Date.now()}={}){if(!catalog.byId[unitId])throw new Error('Unité de placement inconnue');const q=int(questions,0,200),s=clamp(score,0,1),r=clamp(reliability??Math.min(1,q/8),0,1),ok=Boolean(passed&&s>=.75&&q>=3);const row={unitId,passed:ok,score:s,reliability:r,questions:q,time:timestamp};state.placement||(state.placement={passed:{},history:[]});state.placement.history.push(row);if(state.placement.history.length>200)state.placement.history.splice(0,state.placement.history.length-200);if(ok)state.placement.passed[unitId]={passed:true,score:s,reliability:r,questions:q,time:timestamp};else delete state.placement.passed[unitId];state.updated=timestamp;return row}
  function prerequisiteReady(state,prereq,timestamp=Date.now(),preparedFamily=null){if(placementReady(state,prereq.id))return true;const c=state.units[prereq.id];if(!c)return false;return Boolean(c.qualification)||directQualificationProof(c,prereq)}
  function exposurePrerequisiteReady(state,prereq,timestamp=Date.now(),preparedFamily=null){
    if(prerequisiteReady(state,prereq,timestamp,preparedFamily))return true;const c=state.units[prereq.id],needed=prereq._exposureAttempts??Math.max(10,Math.round(9+clamp(prereq.difficulty,0,1)*9));return Boolean(c&&c.exposures>=needed);
  }
  function prerequisiteRule(unit){const r=unit.prereqRule;return r&&typeof r==='object'?r:null}
  function evaluatePrerequisiteRule(state,unit,catalog,timestamp,ready){if(!moduleEnabled(state,unit))return false;let all=unit._prereqAll,any=unit._prereqAny;if(!all||!any){const r=prerequisiteRule(unit),allIds=r&&Array.isArray(r.allOf)?r.allOf:(Array.isArray(unit.prereq)?unit.prereq:[]),anyIds=r&&Array.isArray(r.anyOf)?r.anyOf:[];all=allIds.map(id=>catalog.byId[id]).filter(Boolean);any=anyIds.map(id=>catalog.byId[id]).filter(Boolean)}for(let i=0;i<all.length;i++){const p=all[i];if(!(moduleEnabled(state,p)&&ready(state,p,timestamp)))return false}if(any.length){for(let i=0;i<any.length;i++){const p=any[i];if(moduleEnabled(state,p)&&ready(state,p,timestamp))return true}return false}return true}
  function isUnlocked(state,unit,catalog,timestamp=Date.now(),readyCache=null,preparedFamilies=null){if(!readyCache&&!preparedFamilies)return evaluatePrerequisiteRule(state,unit,catalog,timestamp,prerequisiteReady);const cache=readyCache||Object.create(null),families=preparedFamilies||Object.create(null),ready=(st,p,t)=>{const id=p.id,v=cache[id];if(v!==undefined)return v===1;const family=families[p.family]||(families[p.family]=factorStats(st,p.family)),ok=prerequisiteReady(st,p,t,family);cache[id]=ok?1:0;return ok};return evaluatePrerequisiteRule(state,unit,catalog,timestamp,ready)}
  function isExposureUnlocked(state,unit,catalog,timestamp=Date.now()){const families=Object.create(null),ready=(st,p,t)=>{const family=families[p.family]||(families[p.family]=factorStats(st,p.family));return exposurePrerequisiteReady(st,p,t,family)};return evaluatePrerequisiteRule(state,unit,catalog,timestamp,ready)}
  function eligibleUnits(state,catalog,{mode='practice',focus='adaptive',timestamp=Date.now()}={}){
    catalogParts(catalog);const hands=mode==='hands',readyCache=Object.create(null),families=Object.create(null),readyBase=hands?exposurePrerequisiteReady:prerequisiteReady,ready=(s,p,t)=>{const id=p.id,v=readyCache[id];if(v!==undefined)return v===1;const family=families[p.family]||(families[p.family]=factorStats(s,p.family)),ok=readyBase(s,p,t,family);readyCache[id]=ok?1:0;return ok},list=[];for(let i=0;i<catalog.units.length;i++){const u=catalog.units[i];if(evaluatePrerequisiteRule(state,u,catalog,timestamp,ready)&&(!hands||u.kind!=='melody'||u.stage<10))list.push(u)}
    const chosen=focus&&focus!=='adaptive'?list.filter(u=>primarySkillFamily(u)===focus||u.module===focus):[];return chosen.length>=2?chosen:list;
  }
  function confusionPressure(state,id){
    let frame=CONFUSION_CACHE.get(state),practice=state.counters?.practice||0;if(!frame||frame.updated!==state.updated||frame.practice!==practice){frame={updated:state.updated,practice,values:new Map()};CONFUSION_CACHE.set(state,frame)}if(frame.values.has(id))return frame.values.get(id);let total=0,row=state.confusions[id];if(row)for(const k in row)total+=clamp(row[k]?.weight,0,100);for(const k in state.confusions){row=state.confusions[k];const v=row&&row[id];if(v)total+=clamp(v.weight,0,100)*.35}const value=Math.log1p(total);frame.values.set(id,value);return value;
  }
  function targetingPerformanceRow(raw){if(!raw||typeof raw!=='object')return null;const kind=String(raw.kind||'').slice(0,32),policy=performancePolicy(kind);if(!policy)return null;const metrics=raw.metrics&&typeof raw.metrics==='object'?raw.metrics:{},cap=clamp(raw.reliabilityCap??policy.baseReliability,0,policy.baseReliability),q=performanceQualification(kind,metrics,cap);return{time:Math.max(0,finite(raw.time)),kind,score:canonicalPerformanceScore(kind,metrics,raw.score),skillRefs:q.skillRefs,reliability:q.reliability,reliabilityCap:q.reliabilityCap,plannerWeight:q.plannerWeight,plannerEligible:q.plannerEligible}}
  function performanceAggregates(state,timestamp=Date.now()){const grouped=Object.create(null);for(const raw of state.performance||[]){const row=targetingPerformanceRow(raw),policy=performancePolicy(row?.kind);if(!row||!policy||policy.recommendable!==true||!row.plannerEligible||!(row.plannerWeight>0)||!(row.reliability>0))continue;const window=Math.max(DAY,finite(policy.windowDays,14)*DAY);if(row.time>timestamp||timestamp-row.time>window)continue;(grouped[row.kind]??=[]).push(row)}const out=Object.create(null);for(const [kind,rows0] of Object.entries(grouped)){const policy=performancePolicy(kind),rows=[...rows0].sort((a,b)=>b.time-a.time);if(policy.aggregation==='recent_binary'){const use=rows.slice(0,policy.targetSamples||8),successes=use.reduce((s,r)=>s+(r.score>=.5?1:0),0),failures=use.length-successes,n=use.length,score=betaQuantile(.20,1+successes,1+failures),reliability=policy.baseReliability*Math.sqrt(clamp(n/Math.max(1,policy.targetSamples||n),0,1));out[kind]={time:Math.max(...use.map(r=>r.time)),kind,score,skillRefs:[...policy.skillRefs],reliability,decisionSufficiency:clamp(n/Math.max(1,policy.targetSamples||n),0,1),plannerWeight:policy.plannerWeight,plannerEligible:n>=Math.max(1,policy.minSamples||1),sampleCount:n,sampleTarget:policy.targetSamples||null}}else out[kind]={...rows[0],sampleCount:rows[0].sampleCount??null,sampleTarget:policy.targetSamples||null}}return out}
  function performanceTargetingByFamily(state,timestamp=Date.now()){const aggregates=performanceAggregates(state,timestamp),out=Object.create(null);for(const row of Object.values(aggregates)){const policy=performancePolicy(row.kind),need=clamp((.75-row.score)/.75,0,1),rel=clamp(row.reliability/Math.max(.0001,policy.baseReliability),0,1),decision=clamp(row.decisionSufficiency??rel,0,1),weight=clamp(row.plannerWeight/.24,0,1),pressure=clamp(need*decision*weight,0,1);if(!(pressure>0))continue;for(const ref of row.skillRefs||[]){const prior=clamp(out[ref]||0,0,1);out[ref]=1-(1-prior)*(1-pressure)}}return out}
  function scoreUnit(state,unit,{mode='practice',timestamp=Date.now(),preparedFamily=null,preparedCard=undefined,preparedRepeatId=undefined,preparedRepeatFamily=undefined,preparedTargeting=undefined}={}){
    const c=preparedCard===undefined?state.units[unit.id]:preparedCard,family=preparedFamily||factorStats(state,unit.family),e=evidenceStats(state,unit,family,c),p=prediction(state,unit,timestamp,e,family,c);
    const attempts=c?.attempts||0,exposures=c?.exposures||0;
    const hoursOverdue=c?.due?Math.max(0,(timestamp-c.due)/HOUR):0;
    const hoursIdle=c?.lastShown?Math.max(0,(timestamp-c.lastShown)/HOUR):720;
    const novelty=attempts+exposures===0?1.30:1/Math.sqrt(1+attempts+exposures*.35);
    const weakness=1.65*(1-p),uncertainty=.82*e.uncertainty,due=Math.min(1.55,Math.log1p(hoursOverdue)/2.8);
    const confusion=.28*confusionPressure(state,unit.id),fairness=Math.min(1.15,hoursIdle/(24*5));
    const challenge=.62*Math.max(0,1-Math.abs(p-.72)/.62);
    const latency=Math.min(.16,(c?.meanLatency||0)/50000);
    const repeatId=preparedRepeatId===undefined?(mode==='hands'?state.lastHands:state.lastPractice):preparedRepeatId;
    const repeatFamily=preparedRepeatFamily===undefined?(repeatId?String(repeatId).split(':')[0]:null):preparedRepeatFamily;
    const repeat=repeatId===unit.id?-.80:repeatFamily===unit.family?-.12:0;
    const moduleWeight=unit.module==='core'?0:.12;
    let psychometric=0;if(unit.family==='tuning'){const threshold=Math.abs(Number(unit.params?.threshold??unit.params?.cents)||0),profile=intonationProfile(state,{minAttempts:2});if(threshold>0&&profile.estimateCents&&profile.n>=6)psychometric=.52*profile.confidence*Math.exp(-Math.abs(Math.log(threshold/profile.estimateCents))/.52)}
    const baseScore=Math.max(.04,.15+novelty+weakness+uncertainty+due+confusion+fairness+challenge+latency+repeat+moduleWeight+psychometric),targeting=mode==='practice'?(preparedTargeting===undefined?performanceTargetingByFamily(state,timestamp):preparedTargeting):null,targetingPressure=clamp(targeting?.[primarySkillFamily(unit)]||0,0,1);
    return Math.max(.04,baseScore*(1+.90*targetingPressure));
  }
  function weightedPick(list,weights,random){let total=weights.reduce((a,b)=>a+b,0);if(!(total>0))return list[Math.floor(random()*list.length)];let x=random()*total;for(let i=0;i<list.length;i++){x-=weights[i];if(x<=0)return list[i]}return list.at(-1)}
  function plannerPressure(state,list,timestamp=Date.now()){
    if(!Array.isArray(list)||!list.length)return{coverage:0,dueFraction:0,reviewRate:0,exploreRate:.03};let unseen=0,seen=0,due=0;for(const u of list){const c=state.units[u.id],attempts=c?.attempts||0,exposures=c?.exposures||0;if(attempts+exposures===0)unseen++;else{seen++;if(attempts>0&&c.due<=timestamp)due++}}const coverage=unseen/list.length,dueFraction=seen?due/seen:0,reviewRate=clamp(dueFraction*(1-coverage),0,1),exploreRate=clamp(.03+.60*coverage*Math.pow(1-dueFraction,2),.03,.35);return{coverage,dueFraction,reviewRate,exploreRate}
  }
  function relativeReviewDebt(card,timestamp=Date.now()){if(!card?.attempts||!card.due||card.due>timestamp)return 0;const scheduled=Math.max(HOUR,card.due-Math.max(0,card.last||0));return Math.max(0,(timestamp-card.due)/scheduled)}
  function recentPracticeCapacity(state){const xs=(state.sessions||[]).filter(x=>x?.mode==='practice'&&x.count>0).slice(-8).map(x=>Math.max(1,int(x.count,1,1e7))).sort((a,b)=>a-b);if(xs.length){const m=xs.length>>1;return xs.length%2?xs[m]:Math.max(1,Math.round((xs[m-1]+xs[m])/2))}const minutes=Math.max(1,finite(state?.settings?.practiceMinutes||5));return Math.max(1,Math.round(minutes*1.6))}
  function selectUnit(state,catalog,{mode='practice',focus='adaptive',timestamp=Date.now(),seed=`${timestamp}:${state.counters?.[mode]||0}`}={}){
    const list=eligibleUnits(state,catalog,{mode,focus,timestamp});if(!list.length)throw new Error('Aucune unité disponible');
    const random=seeded(seed),targeting=mode==='practice'&&focus==='adaptive'?performanceTargetingByFamily(state,timestamp):null,pressure=plannerPressure(state,list,timestamp),draw=random(),weights=new Array(list.length),families=Object.create(null),repeatId=mode==='hands'?state.lastHands:state.lastPractice,repeatFamily=repeatId&&catalog.byId[repeatId]?catalog.byId[repeatId].family:null;for(let i=0;i<list.length;i++){const u=list[i],f=families[u.family]||(families[u.family]=factorStats(state,u.family)),c=state.units[u.id];weights[i]=scoreUnit(state,u,{mode,timestamp,preparedFamily:f,preparedCard:c??null,preparedRepeatId:repeatId,preparedRepeatFamily:repeatFamily,preparedTargeting:targeting})}
    let selected;const dueIndices=[],severeDue=[];for(let i=0;i<list.length;i++){const c=state.units[list[i].id];if(c?.attempts>0&&c.due<=timestamp){dueIndices.push(i);if(relativeReviewDebt(c,timestamp)>=1)severeDue.push(i)}}const capacity=mode==='practice'?recentPracticeCapacity(state):Infinity,backlogSaturated=mode==='practice'&&dueIndices.length>=capacity,forceReview=severeDue.length>0||backlogSaturated;if(forceReview||draw<pressure.reviewRate){const indices=severeDue.length?severeDue:dueIndices;if(indices.length){const pool=indices.map(i=>list[i]),poolWeights=indices.map(i=>weights[i]);selected=weightedPick(pool,poolWeights,random)}}
    if(!selected&&!backlogSaturated&&draw<pressure.reviewRate+pressure.exploreRate){const floor=Math.min(...list.map(u=>(state.units[u.id]?.attempts||0)+(state.units[u.id]?.exposures||0)*.3)),exploratory=list.filter(u=>((state.units[u.id]?.attempts||0)+(state.units[u.id]?.exposures||0)*.3)<=floor+1);selected=exploratory[Math.floor(random()*exploratory.length)]}
    if(!selected){const pool=backlogSaturated?dueIndices.map(i=>list[i]):list,poolWeights=backlogSaturated?dueIndices.map(i=>weights[i]):weights;selected=weightedPick(pool,poolWeights,random)}const k=list.indexOf(selected),score=k>=0?weights[k]:scoreUnit(state,selected,{mode,timestamp,preparedTargeting:targeting});return{unit:selected,score,eligible:list.length,prediction:prediction(state,selected,timestamp)};
  }
  function markShown(state,unitId,mode='practice',timestamp=Date.now()){
    const c=ensureCard(state,unitId);c.lastShown=timestamp;
    if(mode==='hands')state.lastHands=unitId;else state.lastPractice=unitId;
  }
  function contextKeys(context){
    if(!context||typeof context!=='object')return[];
    const out=[];for(const key of ['timbre','register','presentation','meter','mode','kit','articulation','tempoBand']){const v=context[key];if(typeof v==='string'&&/^[a-z0-9._-]{1,48}$/i.test(v))out.push(`${key}:${v}`)}return out;
  }
  function updateFactor(f,correct,weight,timestamp){f.attempts++;if(correct)f.alpha+=weight;else f.beta+=weight*1.08;f.last=timestamp}
  function decayConfusions(state,correctId,timestamp){
    const row=state.confusions[correctId];if(!row)return;
    for(const [wrong,v] of Object.entries(row)){const days=Math.max(0,(timestamp-v.last)/DAY);v.weight*=Math.pow(.985,days);if(v.weight<.05)delete row[wrong]}
    if(!Object.keys(row).length)delete state.confusions[correctId];
  }
  function addConfusion(state,correctId,wrongId,timestamp){
    if(!wrongId||wrongId===correctId)return;
    const row=state.confusions[correctId]||(state.confusions[correctId]={});const v=row[wrongId]||(row[wrongId]={weight:0,last:timestamp});
    const days=Math.max(0,(timestamp-v.last)/DAY);v.weight=v.weight*Math.pow(.985,days)+1;v.last=timestamp;
    const keep=Object.entries(row).sort((a,b)=>b[1].weight-a[1].weight).slice(0,MAX_CONFUSIONS);state.confusions[correctId]=Object.fromEntries(keep);
  }
  function dueIntervalDays(stability,target=TARGET_RETENTION){return Math.max(.02,stability*Math.log(target)/Math.log(.9))}
  function updateMemory(card,correct,latency,timestamp,{choiceCount=4,challenge=.5,replays=0,hints=0,confidence=null}={}){
    const before=card.attempts,elapsed=card.last?Math.max(0,(timestamp-card.last)/DAY):0,r=before?Math.pow(.9,elapsed/Math.max(.02,card.stability)):.72;
    const rating=!correct?0:latency<=2400?3:latency<=5200?2:1,chance=1/Math.max(2,choiceCount),information=clamp((1-chance)/.75,.66,1.15),task=clamp(challenge,.1,1),replayPenalty=Math.pow(.72,int(replays,0,99)),hintPenalty=Math.pow(.68,int(hints,0,20)),latencyQuality=correct?(rating===3?1:rating===2?.87:.70):1,confidenceQuality=confidence==null?1:correct?clamp(.78+.22*confidence,.78,1):clamp(.9+.35*confidence,.9,1.25),proofQuality=clamp(replayPenalty*hintPenalty*latencyQuality*confidenceQuality,.12,1.25);
    const positiveWeight=information*(.88+.24*task)*proofQuality,negativeWeight=(1.08+.20*(1-task))*(correct?1:proofQuality);
    card.attempts++;card.correct+=correct?1:0;if(!card.first)card.first=timestamp;
    if(correct&&before>0&&elapsed>=Math.min(.25,Math.max(.08,card.stability*.35)))card.spaced++;
    card.last=timestamp;card.meanLatency=before===0?latency:Math.round(card.meanLatency+(latency-card.meanLatency)/Math.min(card.attempts,16));
    if(correct){
      card.alpha+=(rating===3?1.10:rating===2?1.04:.96)*positiveWeight;card.streak++;
      card.difficulty=clamp(card.difficulty-(rating===3?.20:rating===2?.10:-.06)-.08*(1-r)-.07*(task-.5),1,10);
      if(before===0)card.stability=.14+.10*clamp(proofQuality,0,1);
      else if(card.streak===2)card.stability=Math.max(.82,card.stability*2.7);
      else{
        const growth=1.12+(1.28+1.85*(1-r)*(11-card.difficulty)/10+.12*rating-1.12)*clamp(proofQuality,0,1);
        card.stability=clamp(card.stability*growth,.08,36500);
      }
      card.due=timestamp+dueIntervalDays(card.stability)*DAY;
    }else{
      card.beta+=1.15*negativeWeight;card.streak=0;card.lapses++;card.difficulty=clamp(card.difficulty+.55+.16*(1-r)+.08*(.5-task),1,10);
      card.stability=clamp(card.stability*(.26+.035*(11-card.difficulty)),.055,36500);
      card.due=timestamp+(card.lapses>2?1.5:3)*HOUR;
    }
    return{rating,retrievability:r,nextIntervalHours:(card.due-timestamp)/HOUR,chance,information,challenge:task,proofQuality,evidenceWeight:correct?positiveWeight:negativeWeight};
  }
  function updateAnswer(state,catalog,{unitId,correct,wrongId=null,latency=0,context=null,choiceCount=4,questionDifficulty=.5,replays=0,hints=0,confidence=null,timestamp=Date.now()}={}){
    const unit=catalog.byId[unitId];if(!unit)throw new Error('Unité inconnue');if(wrongId&&!catalog.byId[wrongId])wrongId=null;const rawChoices=Number(choiceCount);if(!Number.isFinite(rawChoices)||rawChoices<2)throw new Error('Question non évaluable : moins de deux réponses distinctes');
    const cleanChoices=int(rawChoices,2,8),cleanDifficulty=clamp(questionDifficulty,.1,1),cleanContext=contextKeys(context),basePrediction=rawPrediction(state,unit,timestamp),prePrediction=prediction(state,unit,timestamp),card=ensureCard(state,unitId),preIRT=irtPrediction(state,unit);const memory=updateMemory(card,Boolean(correct),clamp(latency,0,120000),timestamp,{choiceCount:cleanChoices,challenge:cleanDifficulty,replays,hints,confidence});updateIRTDifficulty(card,unit,preIRT,Boolean(correct));updateCalibration(state,unit,basePrediction,Boolean(correct));ensureQualification(card,unit,timestamp);
    const parentFamily=ensureFactor(state,'family',unit.family);updateFactor(parentFamily,Boolean(correct),.16*memory.evidenceWeight,timestamp);const statKey=statisticalFamily(unit);if(statKey!==unit.family)updateFactor(ensureFactor(state,'family',statKey),Boolean(correct),.16*memory.evidenceWeight,timestamp);
    for(const key of controlLatentKeys(unit))updateFactor(ensureFactor(state,'latent',key),Boolean(correct),.09*memory.evidenceWeight,timestamp);for(const key of typedLatentKeys(unit))updateFactor(ensureFactor(state,'latent',key),Boolean(correct),.09*memory.evidenceWeight,timestamp);
    if(state.settings.experiments.contextTransfer)for(const key of cleanContext)updateFactor(ensureFactor(state,'context',key),Boolean(correct),.07*memory.evidenceWeight,timestamp);
    if(correct)updateTransferSufficient(state,unitId,cleanContext);updateTuningContextSufficient(state,unitId,Boolean(correct),cleanContext);
    decayConfusions(state,unitId,timestamp);if(!correct)addConfusion(state,unitId,wrongId,timestamp);
    state.attempts.push({time:timestamp,unit:unitId,correct:Boolean(correct),wrong:wrongId,latency:clamp(latency,0,120000),replays:int(replays,0,99),hints:int(hints,0,20),confidence:confidence==null?null:clamp(confidence,0,1),predicted:prePrediction,irt:preIRT,choices:cleanChoices,difficulty:cleanDifficulty,context:cleanContext,stimulus:sanitizeStimulus(context),mode:'practice'});if(state.attempts.length>MAX_ATTEMPT_LOG)state.attempts.splice(0,state.attempts.length-MAX_ATTEMPT_LOG);
    state.lastPractice=unitId;state.counters.practice++;state.updated=timestamp;
    return{card,memory,evidence:evidenceStats(state,unit),prediction:prediction(state,unit,timestamp),chance:memory.chance};
  }
  function recordExposure(state,catalog,{unitId,context=null,timestamp=Date.now()}={}){
    const unit=catalog.byId[unitId];if(!unit)throw new Error('Unité inconnue');const c=ensureCard(state,unitId);c.exposures++;c.lastShown=timestamp;
    if(state.settings.experiments.contextTransfer)for(const key of contextKeys(context)){const f=ensureFactor(state,'context',key);f.last=timestamp}
    state.lastHands=unitId;state.counters.hands++;state.updated=timestamp;return c;
  }
  function recordSession(state,{mode='practice',count=0,accuracy=0,fatigue=0,duration=0,load=null,timestamp=Date.now()}={}){
    const normalized=sanitizeSession({time:timestamp,mode,count,accuracy,fatigue,duration,load});state.sessions.push(normalized);if(state.sessions.length>MAX_SESSION_LOG)state.sessions.splice(0,state.sessions.length-MAX_SESSION_LOG);state.updated=timestamp;return normalized;
  }
  function familySummary(state,catalog,family,timestamp=Date.now()){
    const enabled=catalog.units.filter(u=>u.family===family&&moduleEnabled(state,u));
    const unlocked=enabled.filter(u=>isUnlocked(state,u,catalog,timestamp));
    const practicedUnits=unlocked.filter(u=>(state.units[u.id]?.attempts||0)>0),values=practicedUnits.map(u=>evidenceStats(state,u).lower).sort((a,b)=>a-b);
    const practiced=practicedUnits.length,mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:0,q25=values.length?values[Math.floor((values.length-1)*.25)]:0,breadth=unlocked.length?practiced/unlocked.length:0;
    const mastery=values.length?clamp(.68*mean+.32*q25,0,1):0;
    return{family,mastery,mean,q25,breadth,practiced,unlocked:unlocked.length,total:enabled.length,due:unlocked.filter(u=>{const c=state.units[u.id];return c?.attempts&&c.due<=timestamp}).length};
  }
  function summarize(state,catalog,timestamp=Date.now()){
    const families=[...new Set(catalog.units.filter(u=>moduleEnabled(state,u)).map(u=>u.family))];
    const details=families.map(f=>familySummary(state,catalog,f,timestamp));
    const active=details.filter(x=>x.practiced>0),overall=active.length?active.reduce((s,x)=>s+x.mastery*Math.sqrt(Math.max(1,x.practiced)),0)/active.reduce((s,x)=>s+Math.sqrt(Math.max(1,x.practiced)),0):0;
    let index=0;for(let i=0;i<LEVELS.length;i++)if(overall>=LEVELS[i].min)index=i;
    const current=LEVELS[index],next=LEVELS[Math.min(index+1,LEVELS.length-1)],progress=index===LEVELS.length-1?1:clamp((overall-current.min)/Math.max(.01,next.min-current.min),0,1);
    const unlocked=details.reduce((s,x)=>s+x.unlocked,0),total=details.reduce((s,x)=>s+x.total,0),practiced=details.reduce((s,x)=>s+x.practiced,0),transferred=catalog.units.filter(u=>moduleEnabled(state,u)&&competenceStage(state,u,timestamp)==='transferred').length;
    return{overall,demonstrated:overall,territory:total?unlocked/total:0,practicedCoverage:unlocked?practiced/unlocked:0,transferCoverage:practiced?transferred/practiced:0,index,level:current.name,next:index===LEVELS.length-1?'Consolidation':next.name,progress,families:details,due:details.reduce((s,x)=>s+x.due,0),unlocked,total,transferred};
  }
  function recentAccuracy(state,mode='practice',n=5){const s=state.sessions.filter(x=>x.mode===mode).slice(-n);return s.length?s.reduce((a,x)=>a+x.accuracy,0)/s.length:null}
  function scoreRows(rows,predict){let b=0,l=0,n=0;for(const row of rows){const p=clamp(predict(row,n),1e-6,1-1e-6),y=row.correct?1:0;b+=(p-y)*(p-y);l-=y*Math.log(p)+(1-y)*Math.log(1-p);n++}return{n,brier:n?b/n:null,logLoss:n?l/n:null}}
  function modelComparison(state,catalog,{window=1000}={}){const rows=(state.attempts||[]).filter(a=>a.mode==='practice').slice(-Math.max(1,window));if(!rows.length)return{n:0,models:{}};let gA=1,gB=1;const fam={},item={};const global=[],family=[],unit=[];for(const a of rows){const y=a.correct?1:0,fp=fam[a.unit?statisticalFamily(catalog.byId[a.unit]):'']||[1,1],ip=item[a.unit]||[1,1];global.push({correct:a.correct,p:gA/(gA+gB)});family.push({correct:a.correct,p:fp[0]/(fp[0]+fp[1])});unit.push({correct:a.correct,p:ip[0]/(ip[0]+ip[1])});if(y){gA++;fp[0]++;ip[0]++}else{gB++;fp[1]++;ip[1]++}if(a.unit&&catalog.byId[a.unit])fam[statisticalFamily(catalog.byId[a.unit])]=fp;item[a.unit]=ip}const metric=xs=>scoreRows(xs,r=>r.p),stored=rows.filter(a=>Number.isFinite(a.predicted)),irt=rows.filter(a=>Number.isFinite(a.irt));return{n:rows.length,models:{earforge:scoreRows(stored,r=>r.predicted),irt:scoreRows(irt,r=>r.irt),global:metric(global),family:metric(family),unit:metric(unit)}}}
  function recordPerformance(state,{kind,score=0,metrics={},reliability=null,timestamp=Date.now()}={}){const key=String(kind||''),policy=performancePolicy(key);if(!policy)throw new Error(`Type de preuve performance interdit: ${key||'absent'}`);const cleanMetrics=metrics&&typeof metrics==='object'?JSON.parse(JSON.stringify(metrics)):{},cap=clamp(reliability??policy.baseReliability,0,policy.baseReliability),q=performanceQualification(key,cleanMetrics,cap),row={time:timestamp,kind:key,score:canonicalPerformanceScore(key,cleanMetrics,score),metrics:cleanMetrics,evidenceType:q.evidenceType,skillRefs:[...q.skillRefs],reliability:q.reliability,reliabilityCap:q.reliabilityCap,plannerWeight:q.plannerWeight,plannerEligible:q.plannerEligible,measurementValid:q.valid,sampleCount:q.sampleCount,sampleTarget:q.targetSamples,qualificationReason:q.reason,legacyDiagnostic:false};state.performance||(state.performance=[]);state.performance.push(row);if(state.performance.length>240)state.performance.splice(0,state.performance.length-240);state.updated=timestamp;return row}
  function performanceEvidenceSignals(state,timestamp=Date.now()){const aggregates=performanceAggregates(state,timestamp),rows=Object.values(aggregates);let weight=0,deficit=0;for(const row of rows){const w=row.reliability*row.plannerWeight;weight+=w;deficit+=(1-row.score)*w}const recommendable=Object.entries(PERFORMANCE_POLICY).filter(([,p])=>p.recommendable),staleness=recommendable.map(([kind,policy])=>{const row=aggregates[kind],window=Math.max(DAY,finite(policy.windowDays,14)*DAY);return row?clamp((timestamp-row.time)/window,0,1):1});return{eligibleEvidence:rows.reduce((s,r)=>s+(r.sampleCount||1),0),latestKinds:Object.keys(aggregates).sort(),weightedDeficit:weight?deficit/weight:0,measurementNeed:staleness.length?staleness.reduce((a,b)=>a+b,0)/staleness.length:0}}
  function recommendedProbe(state,catalog,timestamp=Date.now()){if(!catalog)return null;const by=Object.fromEntries(summarize(state,catalog,timestamp).families.map(x=>[x.family,x])),last=performanceAggregates(state,timestamp),defs=[{kind:'rhythmTiming',label:'Pulsation et microtiming',ready:()=>((by.rhythm?.practiced||0)>=2),weak:()=>1-(by.rhythm?.mastery||0)},{kind:'melodyMemory',label:'Mémoire mélodique',ready:()=>((by.melody?.practiced||0)>=2),weak:()=>1-(by.melody?.mastery||0)},{kind:'harmonyFunction',label:'Harmonie fonctionnelle',ready:()=>((by.progression?.practiced||0)+(by.modulation?.practiced||0)>=2),weak:()=>1-((by.progression?.mastery||0)+(by.modulation?.mastery||0))/2},{kind:'polyrhythmTiming',label:'Polyrhythmie 3:2',ready:()=>((by.rhythm?.practiced||0)>=6&&(by.rhythm?.mastery||0)>=.5),weak:()=>1-(by.rhythm?.mastery||0)}],candidates=[];for(const d of defs){if(!d.ready())continue;const row=last[d.kind],policy=performancePolicy(d.kind),window=Math.max(DAY,finite(policy?.windowDays,14)*DAY),stale=row?clamp((timestamp-row.time)/window,0,1):1,priority=clamp(.68*stale+.32*clamp(d.weak(),0,1),0,1);candidates.push({...d,priority,lastTime:row?.time||0})}candidates.sort((a,b)=>b.priority-a.priority);const best=candidates[0];if(!best||best.priority<.55)return null;return{kind:best.kind,label:best.label,priority:best.priority,reason:best.lastTime?'mesure à renouveler':'mesure de calibration',requiresKeyboard:false}}
  function stimulusPolicy(state,unit,{baseTempo=null,context=null,timestamp=Date.now()}={}){const adaptive=state?.settings?.experiments?.adaptiveTempo!==false,p=prediction(state,unit,timestamp),e=evidenceStats(state,unit),itemConfidence=clamp(1-e.uncertainty,0,1),keys=contextKeys(context),measured=keys.map(key=>contextStats(state,key)).filter(x=>x.attempts>0),contextConfidence=measured.length?measured.reduce((sum,x)=>sum+clamp(1-x.uncertainty,0,1),0)/measured.length:itemConfidence,confidence=Math.min(itemConfidence,contextConfidence),center=Number.isFinite(Number(baseTempo))&&Number(baseTempo)>0?Number(baseTempo):Number(state?.settings?.presentationTempo||72);if(!adaptive)return{adaptive:false,prediction:p,uncertainty:e.uncertainty,itemConfidence,contextConfidence,confidence,tempoBpm:center,tempoRatio:1,noteDurationScale:1,stimulusChallenge:null};const legacyRatio=.82+.38*p,tempoRatio=1+(legacyRatio-1)*confidence,noteDurationScale=Math.pow(Math.max(.01,tempoRatio),-.35),stimulusChallenge=clamp(.5+(p-.5)*confidence,0,1);return{adaptive:true,prediction:p,uncertainty:e.uncertainty,itemConfidence,contextConfidence,confidence,tempoBpm:center*tempoRatio,tempoRatio,noteDurationScale,stimulusChallenge}}
  function planningSignals(state,catalog,timestamp=Date.now()){
    const advanced=performanceEvidenceSignals(state,timestamp);if(!catalog)return{expectedGain:.5,forgettingDebt:0,explorationNeed:.5,balanceNeed:.5,goalPressure:state.settings.focus==='adaptive'?0:.4,advancedEvidenceNeed:advanced.measurementNeed,advancedEvidenceDeficit:advanced.weightedDeficit,advancedEvidenceKinds:advanced.latestKinds};const stamp=`${state.updated||0}:${Math.floor(timestamp/60000)}:${state.settings.focus}:${state.counters?.practice||0}:${state.counters?.hands||0}`,hit=PLAN_CACHE.get(state);if(hit?.stamp===stamp)return hit.value;const units=eligibleUnits(state,catalog,{mode:'practice',focus:'adaptive',timestamp}),families={};let gain=0,debt=0,novel=0;for(const u of units){const c=state.units[u.id],e=evidenceStats(state,u),p=prediction(state,u,timestamp);gain+=e.uncertainty*(.35+.65*(1-Math.abs(p-.72)/.72));if(!c?.attempts)novel++;if(c?.attempts&&c.due<timestamp)debt+=Math.min(1,Math.log1p((timestamp-c.due)/HOUR)/4);(families[u.family]??=[]).push(c?.attempts||0)}const famMeans=Object.values(families).map(xs=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length)),mean=famMeans.length?famMeans.reduce((a,b)=>a+b,0)/famMeans.length:0,spread=famMeans.length?Math.sqrt(famMeans.reduce((a,x)=>a+(x-mean)*(x-mean),0)/famMeans.length):0,value={expectedGain:units.length?clamp(gain/units.length,0,1):0,forgettingDebt:units.length?clamp(debt/units.length,0,1):0,explorationNeed:units.length?novel/units.length:0,balanceNeed:clamp(spread/Math.max(1,mean+1),0,1),goalPressure:state.settings.focus==='adaptive'?0:.4,advancedEvidenceNeed:advanced.measurementNeed,advancedEvidenceDeficit:advanced.weightedDeficit,advancedEvidenceKinds:advanced.latestKinds};PLAN_CACHE.set(state,{stamp,value});return value}
  function robustPracticeThroughput(sessions){
    const plausible=sessions.filter(x=>x&&x.count>=5&&x.duration>=.5).map(x=>x.count/x.duration).filter(x=>Number.isFinite(x)&&x>0&&x<=DATA_INTEGRITY_MAX_PRACTICE_RATE).sort((a,b)=>a-b),eligible=sessions.filter(x=>x&&x.count>=5&&x.duration>=.5).length;if(!plausible.length)return{rate:1.6,samples:0,rejected:eligible,confidence:0,source:eligible?'default_after_integrity_rejection':'default'};const logs=plausible.map(Math.log).sort((a,b)=>a-b),mid=Math.floor(logs.length/2),medianLog=logs.length%2?logs[mid]:(logs[mid-1]+logs[mid])/2,prior=Math.log(1.6),n=logs.length,weight=n>=3?1:n===2?.5:.25,rate=Math.exp(prior*(1-weight)+medianLog*weight);return{rate,samples:n,rejected:Math.max(0,eligible-n),confidence:n>=3?1:weight,source:n>=3?'recent_sessions_robust_median':'recent_sessions_prior_blend'}
  }
  function practiceSessionGate({started=0,timestamp=Date.now(),budgetMinutes=5,completed=0}={}){const budget=Math.max(.25,finite(budgetMinutes)),elapsed=Math.max(0,(finite(timestamp)-finite(started))/60000),progress=clamp(elapsed/budget,0,1),continueSession=int(completed,0,1e7)<1||elapsed<budget;return{continueSession,elapsedMinutes:elapsed,budgetMinutes:budget,progress,reason:continueSession?'within_time_budget':'time_budget_reached'}}
  function recommendedPlan(state,catalog=null,timestamp=Date.now()){
    const practiceSessions=state.sessions.filter(x=>x.mode==='practice'&&x.count>0&&x.duration>.2).slice(-8),handsSessions=state.sessions.filter(x=>x.mode==='hands'&&x.count>0&&x.duration>.2).slice(-8),practiceAcc=recentAccuracy(state,'practice'),fatigue=practiceSessions.length?practiceSessions.reduce((a,x)=>a+(x.load?.active??x.fatigue??0),0)/practiceSessions.length:0,passiveLoad=handsSessions.length?handsSessions.reduce((a,x)=>a+(x.load?.passive??0),0)/handsSessions.length:0,signals=planningSignals(state,catalog,timestamp),throughputModel=robustPracticeThroughput(practiceSessions),throughput=throughputModel.rate,base=state.settings.practiceMinutes,candidates=[],maxBudget=base;
    for(let minutes=5;minutes<=maxBudget;minutes++){const timeDistance=Math.abs(minutes-base)/Math.max(1,base-5),fatigueCost=clamp(fatigue*(minutes/base)*.78,0,1),learning=clamp((.34*signals.expectedGain+.30*signals.forgettingDebt+.18*signals.explorationNeed+.13*signals.balanceNeed+.05*signals.goalPressure)*Math.sqrt(minutes/Math.max(5,base)),0,1.4),accuracyRisk=practiceAcc==null?.18:clamp((.64-practiceAcc)*.9,0,.6),utility=learning-.48*fatigueCost-.16*accuracyRisk-.08*timeDistance;candidates.push({minutes,learning,fatigueCost,utility})}candidates.sort((a,b)=>b.utility-a.utility||Math.abs(a.minutes-base)-Math.abs(b.minutes-base));const chosen=candidates[0]||{minutes:5,learning:0,fatigueCost:0,utility:0},minutes=chosen.minutes,rawQuestions=minutes*throughput,questions=Math.max(1,Math.round(rawQuestions)),practiceEstimateMinutes=minutes;let hands=state.settings.hands.minutes;if(fatigue>.62)hands=Math.max(6,hands-2);if(passiveLoad>.75)hands=Math.max(6,hands-1);const probe=recommendedProbe(state,catalog,timestamp),reason=practiceAcc===null?'calibration':fatigue>.62?'fatigue':signals.forgettingDebt>.42?'forgetting':probe&&signals.advancedEvidenceNeed>.55?'measurement':signals.explorationNeed>.45?'exploration':'adaptive';return{practiceMinutes:minutes,practiceQuestions:questions,practiceEstimateMinutes,throughput,throughputSamples:throughputModel.samples,throughputRejected:throughputModel.rejected||0,throughputConfidence:throughputModel.confidence,throughputSource:throughputModel.source,doseLimited:false,handsMinutes:int(hands,6,24),reason,probe,load:{activeFatigue:fatigue,passiveExposure:passiveLoad},signals,optimization:{utility:chosen.utility,learning:chosen.learning,fatigueCost:chosen.fatigueCost,candidates:candidates.slice(0,4)}};
  }
  function storageAttempt(a){const o={t:a.time,u:a.unit};if(a.correct)o.o=1;if(a.wrong)o.w=a.wrong;if(a.latency)o.l=a.latency;if(a.replays)o.r=a.replays;if(a.hints)o.h=a.hints;if(a.confidence!=null)o.confidence=a.confidence;if(a.predicted!=null)o.predicted=a.predicted;if(a.irt!=null)o.irt=a.irt;if(a.choices!==2)o.n=a.choices;if(a.difficulty!==.1)o.d=a.difficulty;if(a.context?.length)o.c=a.context;if(a.stimulus&&Object.keys(a.stimulus).length)o.s=a.stimulus;if(a.mode==='hands')o.mode='hands';return o}
  function storagePerformance(a){const o={time:a.time,kind:a.kind,score:a.score,metrics:a.metrics};if(a.reliabilityCap!=null)o.reliabilityCap=a.reliabilityCap;return o}
  function storageJSON(state){const attempts=state.attempts||[],performance=state.performance||[];if(!attempts.length&&!performance.length)return JSON.stringify(state);return JSON.stringify({...state,attempts:attempts.map(storageAttempt),performance:performance.map(storagePerformance)})}
  function exportState(state,catalog){const clean=sanitizeState(state,catalog,state.updated||Date.now());return JSON.stringify(clean,null,2)}
  function stateBytes(state){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(JSON.stringify(state)).length:Buffer.byteLength(JSON.stringify(state))}
  return{SCHEMA,VERSION,DAY,HOUR,LEVELS,DEFAULT_SETTINGS,statisticalFamily,primarySkillFamily,controlLatentKeys,typedLatentKeys,typedLatentStats,hasMicrotonalCents,isRhythmUnit,isWorldModalUnit,DATA_INTEGRITY_MAX_PRACTICE_RATE,createState,sanitizeSettings,sanitizeState,migrateLegacy,ensureCard,betaStats,evidenceStats,prerequisiteThresholds,directQualificationProof,qualificationSnapshot,ensureQualification,contextStats,contextPriority,latentKeys,latentStats,challengeScalar,irtPrediction,retrievability,rawPrediction,correlatedRisk,prediction,updateCalibration,calibrationMetrics,modelComparison,tuningThresholdFromId,intonationProfile,intonationCalibrationMatrix,confusionGraph,moduleEnabled,transferSummary,competenceStage,placementReady,recordPlacement,prerequisiteReady,exposurePrerequisiteReady,isUnlocked,isExposureUnlocked,eligibleUnits,scoreUnit,selectUnit,markShown,contextKeys,updateAnswer,recordExposure,recordSession,recordPerformance,performancePolicy,performanceQualification,canonicalPerformanceScore,performanceEvidenceSignals,performanceTargetingByFamily,recommendedProbe,familySummary,summarize,planningSignals,stimulusPolicy,plannerPressure,robustPracticeThroughput,practiceSessionGate,recommendedPlan,storageJSON,exportState,stateBytes,seeded};
});
