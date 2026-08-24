(() => {
  "use strict";

  const VERSION = "5.0.0";
  const DAY = 86400000;
  const MINUTE = 60000;
  const STORAGE_KEY = "earforge.profile.v5";
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now = () => Date.now();
  const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
  const choose = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const unique = a => [...new Set(a)];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);

  const INSTRUMENTS = {
    piano: "Piano", guitar: "Guitare", strings: "Cordes", flute: "Flûte", organ: "Orgue", bass: "Basse"
  };
  const INTERVALS = [
    { id: "P8", name: "Octave", semitones: 12 },
    { id: "P5", name: "Quinte juste", semitones: 7 },
    { id: "M3", name: "Tierce majeure", semitones: 4 },
    { id: "m3", name: "Tierce mineure", semitones: 3 },
    { id: "P4", name: "Quarte juste", semitones: 5 },
    { id: "M2", name: "Seconde majeure", semitones: 2 },
    { id: "m2", name: "Seconde mineure", semitones: 1 },
    { id: "M6", name: "Sixte majeure", semitones: 9 },
    { id: "m6", name: "Sixte mineure", semitones: 8 },
    { id: "m7", name: "Septième mineure", semitones: 10 },
    { id: "M7", name: "Septième majeure", semitones: 11 },
    { id: "TT", name: "Triton", semitones: 6 },
    { id: "M9", name: "Neuvième majeure", semitones: 14 },
    { id: "m9", name: "Neuvième mineure", semitones: 13 }
  ];
  const CHORDS = {
    major: { label: "Accord majeur", steps: [0, 4, 7] },
    minor: { label: "Accord mineur", steps: [0, 3, 7] },
    diminished: { label: "Accord diminué", steps: [0, 3, 6] },
    augmented: { label: "Accord augmenté", steps: [0, 4, 8] },
    sus2: { label: "Accord suspendu 2", steps: [0, 2, 7] },
    sus4: { label: "Accord suspendu 4", steps: [0, 5, 7] },
    maj7: { label: "Majeur septième", steps: [0, 4, 7, 11] },
    dom7: { label: "Septième de dominante", steps: [0, 4, 7, 10] },
    min7: { label: "Mineur septième", steps: [0, 3, 7, 10] },
    halfdim7: { label: "Demi-diminué", steps: [0, 3, 6, 10] }
  };
  const SCALES = {
    major: { label: "Gamme majeure", cents: [0, 200, 400, 500, 700, 900, 1100, 1200] },
    naturalMinor: { label: "Mineure naturelle", cents: [0, 200, 300, 500, 700, 800, 1000, 1200] },
    majorPentatonic: { label: "Pentatonique majeure", cents: [0, 200, 400, 700, 900, 1200] },
    minorPentatonic: { label: "Pentatonique mineure", cents: [0, 300, 500, 700, 1000, 1200] },
    harmonicMinor: { label: "Mineure harmonique", cents: [0, 200, 300, 500, 700, 800, 1100, 1200] },
    melodicMinor: { label: "Mineure mélodique", cents: [0, 200, 300, 500, 700, 900, 1100, 1200] },
    dorian: { label: "Mode dorien", cents: [0, 200, 300, 500, 700, 900, 1000, 1200] },
    mixolydian: { label: "Mode mixolydien", cents: [0, 200, 400, 500, 700, 900, 1000, 1200] },
    lydian: { label: "Mode lydien", cents: [0, 200, 400, 600, 700, 900, 1100, 1200] },
    phrygian: { label: "Mode phrygien", cents: [0, 100, 300, 500, 700, 800, 1000, 1200] }
  };
  const AJNAS = {
    ajam: { label: "Jins Ajam", cents: [0, 200, 400, 500] },
    nahawand: { label: "Jins Nahawand", cents: [0, 200, 300, 500] },
    hijaz: { label: "Jins Hijaz", cents: [0, 100, 400, 500] },
    rast: { label: "Jins Rast", cents: [0, 200, 350, 500] },
    bayati: { label: "Jins Bayati", cents: [0, 150, 300, 500] },
    kurd: { label: "Jins Kurd", cents: [0, 100, 300, 500] },
    saba: { label: "Jins Saba", cents: [0, 150, 300, 400] }
  };
  const MAQAMAT = {
    rast: { label: "Maqam Rast", cents: [0, 200, 350, 500, 700, 900, 1050, 1200] },
    bayati: { label: "Maqam Bayati", cents: [0, 150, 300, 500, 700, 800, 1000, 1200] },
    hijaz: { label: "Maqam Hijaz", cents: [0, 100, 400, 500, 700, 800, 1100, 1200] },
    nahawand: { label: "Maqam Nahawand", cents: [0, 200, 300, 500, 700, 800, 1100, 1200] },
    ajam: { label: "Maqam Ajam", cents: [0, 200, 400, 500, 700, 900, 1100, 1200] },
    kurd: { label: "Maqam Kurd", cents: [0, 100, 300, 500, 700, 800, 1000, 1200] },
    saba: { label: "Maqam Saba", cents: [0, 150, 300, 400, 700, 800, 1000, 1200] }
  };

  const units = [];
  const add = (id, domain, label, level, prereq, kind, data = {}, track = "core") => {
    units.push({ id, domain, label, level, prereq: prereq || [], kind, data, track });
  };

  add("pitch.direction", "Hauteur", "Direction mélodique", 1, [], "direction");
  add("pitch.distance", "Hauteur", "Distance globale", 1, ["pitch.direction"], "distance");
  add("pitch.register", "Hauteur", "Registre", 1, [], "register");
  add("sound.timbre", "Timbre", "Familles de timbres", 1, [], "timbre");
  add("rhythm.pulse", "Rythme", "Pulsation stable", 1, [], "pulse", { pattern: "pulse" });

  INTERVALS.forEach((it, i) => {
    const previous = i === 0 ? "pitch.distance" : `interval.${INTERVALS[i - 1].id}.melodic`;
    add(`interval.${it.id}.melodic`, "Intervalles", `${it.name} mélodique`, 2 + Math.floor(i / 3), [previous], "interval", { ...it, presentation: "melodic" });
    add(`interval.${it.id}.harmonic`, "Intervalles", `${it.name} harmonique`, 3 + Math.floor(i / 3), [`interval.${it.id}.melodic`], "interval", { ...it, presentation: "harmonic" });
  });

  const chordOrder = ["major", "minor", "diminished", "augmented", "sus2", "sus4", "maj7", "dom7", "min7", "halfdim7"];
  chordOrder.forEach((name, i) => {
    const prereq = i === 0 ? ["interval.M3.harmonic", "interval.P5.harmonic"] : [`chord.${chordOrder[i - 1]}.root`];
    add(`chord.${name}.root`, "Accords", CHORDS[name].label, 3 + Math.floor(i / 2), prereq, "chord", { chord: name, task: "quality" });
    if (i < 8) add(`chord.${name}.inversion`, "Accords", `${CHORDS[name].label}, renversements`, 5 + Math.floor(i / 2), [`chord.${name}.root`, "interval.P4.harmonic"], "chord", { chord: name, task: "inversion" });
  });

  const scaleOrder = ["major", "naturalMinor", "majorPentatonic", "minorPentatonic", "harmonicMinor", "melodicMinor", "dorian", "mixolydian", "lydian", "phrygian"];
  scaleOrder.forEach((name, i) => add(`scale.${name}`, "Gammes", SCALES[name].label, 3 + Math.floor(i / 2), i === 0 ? ["interval.M2.melodic", "interval.M3.melodic"] : [`scale.${scaleOrder[i - 1]}`], "scale", { scale: name }));

  const rhythmUnits = [
    ["rhythm.binary", "Deux sons par temps", "binary", ["rhythm.pulse"]],
    ["rhythm.rest", "Silences simples", "rest", ["rhythm.binary"]],
    ["rhythm.triplet", "Triolets", "triplet", ["rhythm.binary"]],
    ["rhythm.compound", "Mesure composée", "compound", ["rhythm.triplet"]],
    ["rhythm.sixteenth", "Double-croches", "sixteenth", ["rhythm.rest"]],
    ["rhythm.syncopation", "Syncopes", "syncopation", ["rhythm.sixteenth"]],
    ["rhythm.swing", "Swing", "swing", ["rhythm.triplet", "rhythm.syncopation"]],
    ["rhythm.odd5", "Mesure à cinq temps", "odd5", ["rhythm.compound", "rhythm.syncopation"]],
    ["rhythm.odd7", "Mesure à sept temps", "odd7", ["rhythm.odd5"]]
  ];
  rhythmUnits.forEach((r, i) => add(r[0], "Rythme", r[1], 2 + i, r[3], "rhythm", { pattern: r[2] }));

  add("harmony.function", "Harmonie", "Fonctions tonale, dominante et sous-dominante", 4, ["chord.major.root", "chord.minor.root", "scale.major"], "harmony", { task: "function" });
  add("harmony.cadence.authentic", "Harmonie", "Cadence parfaite et imparfaite", 5, ["harmony.function"], "harmony", { task: "cadence" });
  add("harmony.cadence.plagal", "Harmonie", "Cadence plagale", 5, ["harmony.cadence.authentic"], "harmony", { task: "cadence" });
  add("harmony.cadence.deceptive", "Harmonie", "Cadence rompue", 6, ["harmony.cadence.authentic", "chord.minor.root"], "harmony", { task: "cadence" });
  add("harmony.progression.basic", "Harmonie", "Progressions I–IV–V–I", 6, ["harmony.cadence.plagal"], "harmony", { task: "progression" });
  add("harmony.progression.minor", "Harmonie", "Progressions en mineur", 7, ["harmony.progression.basic", "scale.harmonicMinor"], "harmony", { task: "progression" });
  add("harmony.modulation", "Harmonie", "Déplacement du centre tonal", 9, ["harmony.progression.minor", "chord.dom7.root"], "harmony", { task: "modulation" });

  add("melody.contour", "Mélodie", "Contours mélodiques", 2, ["pitch.direction"], "melody", { task: "contour" });
  add("melody.degree", "Mélodie", "Degrés de la gamme", 4, ["scale.major", "melody.contour"], "melody", { task: "degree" });
  add("melody.tonic", "Mélodie", "Retour à la tonique", 5, ["melody.degree", "harmony.function"], "melody", { task: "tonic" });
  add("melody.memory4", "Mélodie", "Mémoire de quatre notes", 6, ["melody.contour", "interval.P5.melodic"], "melody", { task: "memory", length: 4 });
  add("melody.memory6", "Mélodie", "Mémoire de six notes", 8, ["melody.memory4", "scale.naturalMinor"], "melody", { task: "memory", length: 6 });

  [200, 150, 100, 50].forEach((c, i) => add(`world.step.${c}`, "Mondes", `Écart de ${c} cents`, 4 + i, i === 0 ? ["interval.M2.melodic"] : [`world.step.${[200,150,100,50][i-1]}`], "microstep", { cents: c }, "world"));
  Object.entries(AJNAS).forEach(([name, data], i) => add(`world.jins.${name}`, "Mondes", data.label, 6 + Math.floor(i / 2), i === 0 ? ["world.step.150", "scale.major"] : [`world.jins.${Object.keys(AJNAS)[i - 1]}`], "jins", { name }, "world"));
  Object.entries(MAQAMAT).forEach(([name, data], i) => add(`world.maqam.${name}`, "Mondes", data.label, 8 + Math.floor(i / 2), [`world.jins.${name}`, "world.jins.ajam"], "maqam", { name }, "world"));
  add("world.tuning.map12", "Mondes", "Carte à douze divisions", 6, ["world.step.100"], "tuningMap", { edo: 12 }, "world");
  add("world.tuning.map24", "Mondes", "Carte à vingt-quatre divisions", 8, ["world.step.50", "world.tuning.map12"], "tuningMap", { edo: 24 }, "world");

  add("experiment.noise", "Laboratoire", "Reconnaissance dans le bruit", 6, ["interval.P5.harmonic", "sound.timbre"], "transfer", { transfer: "noise" }, "experimental");
  add("experiment.timbre", "Laboratoire", "Transfert entre timbres", 6, ["sound.timbre", "interval.M3.harmonic"], "transfer", { transfer: "timbre" }, "experimental");
  add("experiment.just", "Laboratoire", "Tempérament égal et intonation juste", 8, ["interval.M3.harmonic", "chord.major.root"], "tuningCompare", {}, "experimental");
  add("experiment.adaptive", "Laboratoire", "Accordage harmonique contextuel", 10, ["experiment.just", "chord.maj7.root"], "tuningCompare", { advanced: true }, "experimental");
  add("experiment.polyrhythm23", "Laboratoire", "Polyrythme deux contre trois", 8, ["rhythm.triplet", "rhythm.binary"], "polyrhythm", { a: 2, b: 3 }, "experimental");
  add("experiment.polyrhythm34", "Laboratoire", "Polyrythme trois contre quatre", 10, ["experiment.polyrhythm23", "rhythm.sixteenth"], "polyrhythm", { a: 3, b: 4 }, "experimental");
  add("experiment.context", "Laboratoire", "Intervalle dans une phrase harmonique", 9, ["harmony.progression.basic", "interval.M7.harmonic"], "transfer", { transfer: "context" }, "experimental");

  const byId = new Map(units.map(u => [u.id, u]));
  function validateGraph() {
    const visiting = new Set();
    const done = new Set();
    const visit = id => {
      if (done.has(id)) return;
      if (visiting.has(id)) throw new Error(`Cycle pédagogique: ${id}`);
      const unit = byId.get(id);
      if (!unit) throw new Error(`Unité absente: ${id}`);
      visiting.add(id);
      unit.prereq.forEach(p => visit(p));
      visiting.delete(id);
      done.add(id);
    };
    units.forEach(u => visit(u.id));
    return true;
  }
  validateGraph();

  function defaultProfile() {
    return {
      version: 5,
      createdAt: now(),
      updatedAt: now(),
      settings: {
        sessionLength: 12,
        instrument: "piano",
        speech: true,
        transferTimbre: true,
        worldTrack: false,
        experimentalTrack: false,
        noiseTraining: false,
        referencePitch: 440,
        highContrast: false
      },
      items: {},
      units: {},
      sessions: [],
      policy: {
        balanced: { n: 0, reward: .62 },
        retrieval: { n: 0, reward: .62 },
        interleaved: { n: 0, reward: .62 }
      },
      totalAnswers: 0,
      totalCorrect: 0,
      legacyBridge: null
    };
  }

  function loadProfile() {
    let profile;
    try { profile = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { profile = null; }
    if (!profile || profile.version !== 5) {
      profile = defaultProfile();
      const legacy = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (key !== STORAGE_KEY && /earforge|ear.?training/i.test(key)) {
          try {
            const value = JSON.parse(localStorage.getItem(key));
            if (value && typeof value === "object") legacy.push({ key, value });
          } catch (_) { /* Ignore malformed legacy values. */ }
        }
      }
      if (legacy.length) {
        profile.legacyBridge = { detectedAt: now(), sources: legacy.map(x => x.key), note: "Evidence globale conservée sans la confondre avec une maîtrise atomique." };
        const broad = legacy.reduce((sum, x) => sum + Number(x.value.totalCorrect || x.value.correct || 0), 0);
        if (broad > 0) {
          ["pitch.direction", "rhythm.pulse", "sound.timbre"].forEach(id => {
            profile.units[id] = { attempts: 2, correct: 1, exposure: Math.min(20, broad), lastAt: now() - 7 * DAY };
          });
        }
      }
    }
    profile.settings = { ...defaultProfile().settings, ...(profile.settings || {}) };
    profile.items ||= {};
    profile.units ||= {};
    profile.sessions ||= [];
    profile.policy = { ...defaultProfile().policy, ...(profile.policy || {}) };
    return profile;
  }

  let profile = loadProfile();
  let saveTimer = 0;
  function saveProfile(immediate = false) {
    profile.updatedAt = now();
    clearTimeout(saveTimer);
    const write = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
      catch (_) {
        profile.sessions = profile.sessions.slice(-30);
        const keys = Object.keys(profile.items).sort((a, b) => (profile.items[b].lastAt || 0) - (profile.items[a].lastAt || 0));
        keys.slice(1200).forEach(k => delete profile.items[k]);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (_) { /* Storage may be unavailable. */ }
      }
    };
    if (immediate) write(); else saveTimer = setTimeout(write, 120);
  }

  function itemRecord(key) {
    return profile.items[key] || {
      difficulty: 5,
      stability: .35,
      due: 0,
      lastAt: 0,
      attempts: 0,
      correct: 0,
      lapses: 0,
      alpha: 1,
      beta: 1,
      latency: 0,
      exposure: 0,
      confusions: {}
    };
  }
  function recallProbability(rec, at = now()) {
    if (!rec.lastAt || !rec.attempts) return 0;
    const elapsed = Math.max(0, at - rec.lastAt) / DAY;
    return Math.pow(.9, elapsed / Math.max(.08, rec.stability));
  }
  function unitMastery(id) {
    const prefix = `${id}|`;
    const records = Object.entries(profile.items).filter(([k]) => k.startsWith(prefix)).map(([, r]) => r);
    const broad = profile.units[id] || {};
    if (!records.length) {
      if ((broad.attempts || 0) < 2) return 0;
      return clamp(((broad.correct || 0) / broad.attempts) * .35, 0, .35);
    }
    let weighted = 0, weight = 0;
    records.forEach(r => {
      const posterior = (r.alpha || 1) / ((r.alpha || 1) + (r.beta || 1));
      const retention = recallProbability(r);
      const evidence = Math.min(1, (r.attempts || 0) / 4);
      const w = .35 + evidence;
      weighted += w * posterior * (.55 + .45 * retention) * (.55 + .45 * Math.min(1, (r.stability || 0) / 7));
      weight += w;
    });
    return clamp(weighted / Math.max(.001, weight), 0, 1);
  }
  function trackEnabled(unit) {
    if (unit.track === "world") return profile.settings.worldTrack;
    if (unit.track === "experimental") return profile.settings.experimentalTrack;
    return true;
  }
  function unlocked(unit) {
    if (!trackEnabled(unit)) return false;
    return unit.prereq.every(id => unitMastery(id) >= (byId.get(id)?.level <= 2 ? .54 : .62));
  }

  function policyForSession() {
    const entries = Object.entries(profile.policy);
    const total = entries.reduce((s, [, p]) => s + (p.n || 0), 0) + 1;
    return entries.sort((a, b) => {
      const score = p => (p.reward || .5) + Math.sqrt(2 * Math.log(total + 1) / ((p.n || 0) + 1));
      return score(b[1]) - score(a[1]);
    })[0][0];
  }

  function choiceSet(correct, pool, count = 4) {
    const candidates = shuffle(unique(pool.filter(x => x !== correct)));
    return shuffle([correct, ...candidates.slice(0, count - 1)]);
  }
  function registerBand(root) { return root < 54 ? "grave" : root > 68 ? "aigu" : "médium"; }
  function tempoBand(bpm) { return bpm < 75 ? "lent" : bpm > 115 ? "rapide" : "moyen"; }
  function selectedInstrument(unit) {
    const pool = Object.keys(INSTRUMENTS).filter(x => x !== "bass");
    if (unit.domain === "Rythme") return "drums";
    if (profile.settings.transferTimbre && unitMastery(unit.id) > .58 && Math.random() < .42) return choose(pool);
    return profile.settings.instrument;
  }
  function noteEvent(midi, at, dur, instrument, cents = 0, velocity = .78) {
    return { type: "note", midi, cents, at, dur, instrument, velocity };
  }
  function chordEvents(notes, at, dur, instrument, centsOffsets = []) {
    return notes.map((m, i) => noteEvent(m, at + i * .015, dur, instrument, centsOffsets[i] || 0, .65));
  }
  function centsSequence(root, cents, instrument, step = .32) {
    return cents.map((c, i) => noteEvent(root, i * step, step * .83, instrument, c, .73));
  }

  function rhythmExercise(pattern, bpm) {
    const beat = 60 / bpm;
    const events = [];
    const addDrum = (drum, at, velocity = .8) => events.push({ type: "drum", drum, at, velocity });
    const labels = {
      pulse: "Pulsation régulière", binary: "Deux sons par temps", rest: "Avec silence", triplet: "Triolets",
      compound: "Mesure composée", sixteenth: "Double-croches", syncopation: "Syncope", swing: "Swing",
      odd5: "Cinq temps", odd7: "Sept temps"
    };
    const totalBeats = pattern === "odd5" ? 5 : pattern === "odd7" ? 7 : 4;
    for (let b = 0; b < totalBeats; b++) {
      addDrum("kick", b * beat, b === 0 ? 1 : .72);
      if (pattern !== "pulse") addDrum("hat", b * beat, .42);
    }
    if (pattern === "binary") for (let i = 0; i < 8; i++) addDrum("hat", i * beat / 2, i % 2 ? .38 : .58);
    if (pattern === "rest") [0, .5, 1.5, 2, 3.5].forEach(x => addDrum(x % 1 ? "hat" : "snare", x * beat, .65));
    if (pattern === "triplet") for (let i = 0; i < 12; i++) addDrum("hat", i * beat / 3, i % 3 ? .38 : .68);
    if (pattern === "compound") for (let i = 0; i < 6; i++) addDrum(i % 3 === 0 ? "kick" : "hat", i * beat / 3, i % 3 === 0 ? .9 : .45);
    if (pattern === "sixteenth") for (let i = 0; i < 16; i++) addDrum(i % 4 === 0 ? "kick" : "hat", i * beat / 4, i % 4 === 0 ? .82 : .33);
    if (pattern === "syncopation") [0, .75, 1.5, 2.75, 3.5].forEach((x, i) => addDrum(i % 2 ? "snare" : "kick", x * beat, .84));
    if (pattern === "swing") for (let b = 0; b < 4; b++) { addDrum("hat", b * beat, .65); addDrum("hat", b * beat + beat * .66, .4); }
    if (pattern === "odd5" || pattern === "odd7") for (let b = 0; b < totalBeats; b++) addDrum(b === 0 || b === 3 ? "snare" : "hat", b * beat, b === 0 ? .9 : .55);
    return { events, answer: labels[pattern], options: choiceSet(labels[pattern], Object.values(labels)), duration: totalBeats * beat + .25 };
  }

  function makeExercise(unit) {
    const instrument = selectedInstrument(unit);
    const root = Math.floor(rand(70, 48));
    const bpm = Math.round(rand(126, 60));
    const baseMeta = { instrument, register: registerBand(root), tempoBand: tempoBand(bpm), presentation: unit.data.presentation || unit.kind, direction: "none", context: "isolated" };
    let prompt = "Écoutez.", spokenPrompt = "Écoutez", answer = "", options = [], events = [], duration = 1.8, meta = baseMeta;

    if (unit.kind === "direction") {
      const direction = choose(["up", "down", "same"]);
      const step = direction === "same" ? 0 : Math.floor(rand(8, 2)) * (direction === "up" ? 1 : -1);
      answer = direction === "up" ? "Monte" : direction === "down" ? "Descend" : "Répète";
      options = ["Monte", "Descend", "Répète"];
      events = [noteEvent(root, 0, .55, instrument), noteEvent(root + step, .78, .65, instrument)];
      prompt = "Dans quel sens ?"; spokenPrompt = "Direction"; meta = { ...meta, direction };
    } else if (unit.kind === "distance") {
      const far = Math.random() < .5;
      const step = far ? choose([7, 9, 12]) : choose([1, 2, 3]);
      answer = far ? "Éloigné" : "Proche"; options = ["Proche", "Éloigné"];
      events = [noteEvent(root, 0, .5, instrument), noteEvent(root + step, .72, .6, instrument)];
      prompt = "Quelle distance ?"; spokenPrompt = "Distance"; meta = { ...meta, direction: "up" };
    } else if (unit.kind === "register") {
      const high = Math.random() < .5;
      answer = high ? "Aigu" : "Grave"; options = ["Grave", "Aigu"];
      events = [noteEvent(high ? 76 : 43, 0, .9, instrument)];
      prompt = "Quel registre ?"; spokenPrompt = "Registre"; meta = { ...meta, register: high ? "aigu" : "grave" };
    } else if (unit.kind === "timbre") {
      const target = choose(Object.keys(INSTRUMENTS).filter(x => x !== "bass"));
      answer = INSTRUMENTS[target]; options = choiceSet(answer, Object.values(INSTRUMENTS), 4);
      events = [noteEvent(60, 0, 1.05, target)];
      prompt = "Quel timbre ?"; spokenPrompt = "Timbre"; meta = { ...meta, instrument: target };
    } else if (unit.kind === "pulse") {
      const regular = Math.random() < .68;
      answer = regular ? "Régulière" : "Irrégulière"; options = ["Régulière", "Irrégulière"];
      for (let i = 0; i < 5; i++) events.push({ type: "drum", drum: "rim", at: i * .55 + (!regular && i === 3 ? .16 : 0), velocity: i === 0 ? .9 : .62 });
      prompt = "La pulsation est-elle stable ?"; spokenPrompt = "Pulsation"; duration = 3;
    } else if (unit.kind === "interval") {
      const it = unit.data;
      const direction = Math.random() < .5 ? "up" : "down";
      const target = root + it.semitones * (direction === "up" ? 1 : -1);
      answer = it.name; options = choiceSet(answer, INTERVALS.filter(x => Math.abs(x.semitones - it.semitones) <= 4 || Math.random() < .2).map(x => x.name), 4);
      if (it.presentation === "harmonic") events = [...chordEvents([root, target], 0, 1.25, instrument)];
      else events = [noteEvent(root, 0, .58, instrument), noteEvent(target, .78, .72, instrument)];
      prompt = "Quel intervalle ?"; spokenPrompt = "Intervalle"; meta = { ...meta, presentation: it.presentation, direction };
    } else if (unit.kind === "chord") {
      const keys = Object.keys(CHORDS);
      const targetName = unit.data.chord;
      const chord = CHORDS[targetName];
      let notes = chord.steps.map(s => root + s);
      if (unit.data.task === "inversion") {
        const inversion = Math.floor(rand(Math.min(3, notes.length), 0));
        for (let i = 0; i < inversion; i++) notes[i] += 12;
        notes = notes.sort((a, b) => a - b);
        answer = inversion === 0 ? "État fondamental" : inversion === 1 ? "Premier renversement" : "Deuxième renversement";
        options = ["État fondamental", "Premier renversement", "Deuxième renversement"];
        prompt = "Quel renversement ?"; spokenPrompt = "Renversement"; meta = { ...meta, presentation: "inversion", context: targetName };
      } else {
        answer = chord.label; options = choiceSet(answer, keys.map(k => CHORDS[k].label), 4);
        prompt = "Quel accord ?"; spokenPrompt = "Accord"; meta = { ...meta, presentation: "block" };
      }
      events = chordEvents(notes, 0, 1.45, instrument); duration = 1.8;
    } else if (unit.kind === "scale") {
      const target = SCALES[unit.data.scale];
      answer = target.label; options = choiceSet(answer, Object.values(SCALES).map(s => s.label), 4);
      events = centsSequence(root, target.cents, instrument, .27);
      prompt = "Quelle gamme ou quel mode ?"; spokenPrompt = "Gamme"; duration = target.cents.length * .27 + .3;
      meta = { ...meta, presentation: "ascending", direction: "up" };
    } else if (unit.kind === "rhythm") {
      const r = rhythmExercise(unit.data.pattern, bpm);
      ({ answer, options, events, duration } = r);
      prompt = "Quel rythme ?"; spokenPrompt = "Rythme"; meta = { ...meta, instrument: "drums", presentation: unit.data.pattern };
    } else if (unit.kind === "harmony") {
      const progressions = {
        function: { label: "Dominante", degrees: [[0,4,7],[7,11,14]] },
        authentic: { label: "Cadence parfaite", degrees: [[5,9,12],[7,11,14],[0,4,7]] },
        plagal: { label: "Cadence plagale", degrees: [[5,9,12],[0,4,7]] },
        deceptive: { label: "Cadence rompue", degrees: [[7,11,14],[9,12,16]] },
        basic: { label: "I–IV–V–I", degrees: [[0,4,7],[5,9,12],[7,11,14],[0,4,7]] },
        minor: { label: "Progression mineure", degrees: [[0,3,7],[5,8,12],[7,11,14],[0,3,7]] },
        modulation: { label: "Changement de centre tonal", degrees: [[0,4,7],[2,6,9],[7,11,14],[9,13,16]] }
      };
      const key = unit.data.task === "cadence" ? unit.id.split(".").at(-1) : unit.data.task;
      const p = progressions[key] || progressions.function;
      answer = p.label; options = choiceSet(answer, Object.values(progressions).map(x => x.label), 4);
      p.degrees.forEach((ch, i) => events.push(...chordEvents(ch.map(x => root + x), i * .82, .66, instrument)));
      duration = p.degrees.length * .82 + .2; prompt = unit.data.task === "function" ? "Quelle fonction domine ?" : "Quelle progression ?"; spokenPrompt = unit.data.task === "function" ? "Fonction" : "Harmonie";
      meta = { ...meta, presentation: unit.data.task, context: "tonal" };
    } else if (unit.kind === "melody") {
      if (unit.data.task === "contour") {
        const shapes = { Montant: [0,2,4,7], Descendant: [7,5,2,0], "En arche": [0,4,7,3], "En creux": [5,2,0,4] };
        answer = choose(Object.keys(shapes)); options = Object.keys(shapes);
        events = shapes[answer].map((s, i) => noteEvent(root + s, i * .38, .3, instrument));
        prompt = "Quel contour ?"; spokenPrompt = "Contour"; duration = 1.8;
      } else if (unit.data.task === "degree") {
        const degree = Math.floor(rand(8, 1));
        answer = `${degree}${degree === 1 ? "er" : "e"} degré`; options = choiceSet(answer, [1,2,3,4,5,6,7].map(x => `${x}${x === 1 ? "er" : "e"} degré`), 4);
        const major = [0,2,4,5,7,9,11]; events = [noteEvent(root, 0, .5, instrument), noteEvent(root + major[degree-1], .72, .7, instrument)];
        prompt = "Quel degré ?"; spokenPrompt = "Degré";
      } else if (unit.data.task === "tonic") {
        const resolves = Math.random() < .5; answer = resolves ? "Retour à la tonique" : "Reste en suspens"; options = ["Retour à la tonique", "Reste en suspens"];
        const seq = resolves ? [0,5,7,0] : [0,5,7,2]; events = seq.map((s,i) => noteEvent(root+s, i*.42, .34, instrument));
        prompt = "La phrase se résout-elle ?"; spokenPrompt = "Résolution"; duration = 2;
      } else {
        const len = unit.data.length || 4; const contour = Array.from({length:len}, () => choose([-2,0,2,3,5]));
        const changed = Math.random() < .5; const second = [...contour]; if (changed) second[Math.floor(rand(len,1))] += choose([-1,1,2]);
        answer = changed ? "Différentes" : "Identiques"; options = ["Identiques", "Différentes"];
        contour.forEach((s,i) => events.push(noteEvent(root+s, i*.3, .24, instrument)));
        second.forEach((s,i) => events.push(noteEvent(root+s, 1.25+len*.3+i*.3, .24, instrument)));
        prompt = "Les deux phrases sont-elles identiques ?"; spokenPrompt = "Mémoire"; duration = 1.6+len*.6;
      }
      meta = { ...meta, presentation: unit.data.task, context: "melodic" };
    } else if (unit.kind === "microstep") {
      const cents = unit.data.cents; answer = `${cents} cents`; options = choiceSet(answer, ["50 cents","100 cents","150 cents","200 cents"], 4);
      events = [noteEvent(root, 0, .55, instrument), noteEvent(root, .78, .7, instrument, cents)];
      prompt = "Quel écart ?"; spokenPrompt = "Écart"; meta = { ...meta, presentation: "microtonal", direction: "up" };
    } else if (unit.kind === "jins" || unit.kind === "maqam") {
      const bank = unit.kind === "jins" ? AJNAS : MAQAMAT; const target = bank[unit.data.name];
      answer = target.label; options = choiceSet(answer, Object.values(bank).map(x => x.label), 4);
      events = centsSequence(root, target.cents, instrument, unit.kind === "jins" ? .38 : .27);
      prompt = unit.kind === "jins" ? "Quel jins ?" : "Quel maqam ?"; spokenPrompt = unit.kind === "jins" ? "Jins" : "Maqam";
      duration = target.cents.length * (unit.kind === "jins" ? .38 : .27) + .3; meta = { ...meta, presentation: unit.kind, context: "world" };
    } else if (unit.kind === "tuningMap") {
      const edo = unit.data.edo; const step = 1200 / edo; const index = Math.floor(rand(edo / 2 + 1, 1));
      answer = `${index} pas`; options = choiceSet(answer, [1,2,3,4,5,6,7].map(x => `${x} pas`), 4);
      events = [noteEvent(root,0,.55,instrument), noteEvent(root,.75,.7,instrument,index*step)];
      prompt = "Combien de pas sur la carte ?"; spokenPrompt = "Carte de tons"; meta = { ...meta, presentation: `${edo}-EDO`, direction:"up" };
    } else if (unit.kind === "tuningCompare") {
      const just = Math.random() < .5; answer = just ? "Intonation juste" : "Tempérament égal"; options = ["Tempérament égal", "Intonation juste"];
      const offsets = just ? [0, -13.69, 1.96] : [0,0,0];
      events = chordEvents([root, root+4, root+7], 0, 1.5, instrument, offsets);
      prompt = "Quel accordage ?"; spokenPrompt = "Accordage"; meta = { ...meta, presentation: "tuning", context: unit.data.advanced ? "adaptive" : "triad" };
    } else if (unit.kind === "polyrhythm") {
      const { a, b } = unit.data; answer = `${a} contre ${b}`; options = choiceSet(answer, ["2 contre 3","3 contre 4","3 contre 5","4 contre 5"], 4);
      const span = 2.4; for (let i=0;i<a;i++) events.push({type:"drum",drum:"kick",at:i*span/a,velocity:.82});
      for (let i=0;i<b;i++) events.push({type:"drum",drum:"rim",at:i*span/b,velocity:.64});
      prompt = "Quel polyrythme ?"; spokenPrompt = "Polyrythme"; duration = 2.8; meta = { ...meta, instrument:"drums", presentation:"polyrhythm" };
    } else if (unit.kind === "transfer") {
      const target = choose(INTERVALS.slice(0, 8)); answer = target.name; options = choiceSet(answer, INTERVALS.slice(0,10).map(x=>x.name),4);
      const secondInstrument = unit.data.transfer === "timbre" ? choose(Object.keys(INSTRUMENTS).filter(x => x !== instrument && x !== "bass")) : instrument;
      events = [noteEvent(root,0,.55,instrument), noteEvent(root+target.semitones,.78,.7,secondInstrument)];
      if (unit.data.transfer === "noise" || profile.settings.noiseTraining) events.unshift({type:"noise",at:0,dur:1.7,level:.035});
      if (unit.data.transfer === "context") events.unshift(...chordEvents([root-5,root-1,root+2],0,.45,instrument));
      prompt = "Quel intervalle ?"; spokenPrompt = "Intervalle"; meta = { ...meta, presentation:"transfer", context:unit.data.transfer, instrument:`${instrument}-${secondInstrument}` };
    }

    if (profile.settings.noiseTraining && unit.domain !== "Rythme" && !events.some(e => e.type === "noise") && Math.random() < .32) {
      events.unshift({ type: "noise", at: 0, dur: Math.max(1.5, duration), level: .018 });
      meta.context = `${meta.context}-noise`;
    }
    const itemKey = `${unit.id}|${meta.presentation}|${meta.direction}|${meta.register}|${meta.instrument}|${meta.tempoBand}|${meta.context}`;
    return { unit, itemKey, prompt, spokenPrompt, answer, options, events, duration, meta };
  }

  function candidateScore(exercise, policy, session) {
    const rec = itemRecord(exercise.itemKey);
    const recall = recallProbability(rec);
    const overdueDays = rec.due ? clamp((now() - rec.due) / DAY, -3, 20) : 0;
    const uncertainty = 1 - Math.abs(((rec.alpha || 1) / ((rec.alpha || 1) + (rec.beta || 1))) - .5) * 2;
    const newItem = !rec.attempts;
    const priorMastery = unitMastery(exercise.unit.id);
    const frontier = 1 - Math.abs(priorMastery - .62);
    const sameDomain = session.history.slice(-2).filter(x => x.domain === exercise.unit.domain).length;
    const sameUnit = session.history.slice(-4).filter(x => x.unitId === exercise.unit.id).length;
    const newFraction = session.newCount / Math.max(1, session.index);
    let score = (1 - recall) * 2.15 + Math.max(0, overdueDays) * .14 + uncertainty * .45 + frontier * .38 - sameDomain * .32 - sameUnit * .65;
    if (newItem) score += newFraction < .26 ? .82 : -.72;
    if (policy === "retrieval") score += rec.attempts ? (1 - recall) * .75 : -.45;
    if (policy === "interleaved") score += sameDomain ? -.55 : .38;
    if (policy === "balanced") score += frontier * .25;
    if (exercise.meta.context.includes("noise") || exercise.meta.presentation === "transfer") score += priorMastery > .65 ? .28 : -.42;
    return score + Math.random() * .08;
  }

  function selectExercise(session) {
    let eligible = units.filter(unlocked);
    if (!eligible.length) eligible = units.filter(u => !u.prereq.length && trackEnabled(u));
    const candidates = [];
    eligible.forEach(unit => {
      const count = unitMastery(unit.id) > .7 ? 2 : 1;
      for (let i = 0; i < count; i++) candidates.push(makeExercise(unit));
    });
    candidates.sort((a, b) => candidateScore(b, session.policy, session) - candidateScore(a, session.policy, session));
    return candidates[0];
  }

  function updateLearning(exercise, correct, latencyMs, wrongAnswer = null, confidence = .7) {
    const at = now();
    const old = itemRecord(exercise.itemKey);
    const rec = { ...old, confusions: { ...(old.confusions || {}) } };
    const R = recallProbability(rec, at);
    rec.attempts += 1;
    rec.lastAt = at;
    rec.exposure = (rec.exposure || 0) + 1;
    rec.latency = rec.latency ? rec.latency * .72 + latencyMs * .28 : latencyMs;
    if (correct) {
      rec.correct += 1;
      rec.alpha = (rec.alpha || 1) + clamp(confidence, .35, 1);
      const gain = 1 + (.42 + .58 * (11 - rec.difficulty) / 10) * Math.pow(Math.max(.02, 1 - R), .72) * (1 + Math.log1p(rec.attempts) * .08);
      rec.stability = clamp((rec.stability || .35) * gain + (rec.attempts === 1 ? .65 : 0), .25, 3650);
      rec.difficulty = clamp(rec.difficulty - .12 * (1 - R) + (latencyMs > 7000 ? .08 : -.03), 1, 10);
    } else {
      rec.beta = (rec.beta || 1) + clamp(confidence, .4, 1);
      rec.lapses = (rec.lapses || 0) + 1;
      rec.stability = clamp((rec.stability || .35) * (.28 + .22 * R), .12, 3650);
      rec.difficulty = clamp(rec.difficulty + .55 + .18 * R, 1, 10);
      if (wrongAnswer) rec.confusions[wrongAnswer] = (rec.confusions[wrongAnswer] || 0) + 1;
    }
    const targetRetention = .9;
    let interval = rec.stability * Math.log(targetRetention) / Math.log(.9);
    if (!correct) interval = Math.min(interval, 8 / (24 * 60));
    rec.due = at + Math.max(correct ? .18 : 2 / (24 * 60), interval) * DAY;
    profile.items[exercise.itemKey] = rec;
    const u = profile.units[exercise.unit.id] || { attempts: 0, correct: 0, exposure: 0 };
    u.attempts += 1; u.exposure += 1; if (correct) u.correct += 1; u.lastAt = at;
    profile.units[exercise.unit.id] = u;
    profile.totalAnswers += 1; if (correct) profile.totalCorrect += 1;
    saveProfile();
  }

  function recordExposure(exercise) {
    const rec = { ...itemRecord(exercise.itemKey) };
    rec.exposure = (rec.exposure || 0) + 1;
    profile.items[exercise.itemKey] = rec;
    const u = profile.units[exercise.unit.id] || { attempts: 0, correct: 0, exposure: 0 };
    u.exposure += 1; u.lastAt = now(); profile.units[exercise.unit.id] = u;
    saveProfile();
  }

  class AudioEngine {
    constructor() { this.ctx = null; this.master = null; this.dry = null; this.wet = null; this.active = new Set(); }
    async ensure() {
      if (!this.ctx) {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) throw new Error("Audio Web indisponible");
        this.ctx = new Ctx({ latencyHint: "interactive" });
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.knee.value = 18; compressor.ratio.value = 3.5; compressor.attack.value = .004; compressor.release.value = .18;
        this.master = this.ctx.createGain(); this.master.gain.value = .78;
        this.dry = this.ctx.createGain(); this.wet = this.ctx.createGain(); this.wet.gain.value = .14;
        const convolver = this.ctx.createConvolver(); convolver.buffer = this.impulse(1.25, 2.7);
        this.dry.connect(compressor); this.wet.connect(convolver).connect(compressor); compressor.connect(this.master).connect(this.ctx.destination);
      }
      if (this.ctx.state !== "running") await this.ctx.resume();
    }
    impulse(seconds, decay) {
      const n = Math.floor(this.ctx.sampleRate * seconds); const buffer = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * .34; }
      return buffer;
    }
    freq(midi, cents = 0) { return Number(profile.settings.referencePitch || 440) * Math.pow(2, (midi - 69 + cents / 100) / 12); }
    route(node, send = .12) { node.connect(this.dry); const g = this.ctx.createGain(); g.gain.value = send; node.connect(g).connect(this.wet); }
    track(source) { this.active.add(source); source.addEventListener?.("ended", () => this.active.delete(source), { once: true }); return source; }
    stopAll() { this.active.forEach(s => { try { s.stop(); } catch (_) {} }); this.active.clear(); }
    envelope(g, t, dur, peak = .55, attack = .012, release = .18) {
      const p = Math.max(.0001, peak); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(p, t + attack); g.gain.exponentialRampToValueAtTime(Math.max(.0002, p * .55), t + Math.max(attack + .02, dur * .62)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + release);
    }
    oscillator(type, freq, t, dur, peak, detune = 0, filterHz = 12000) {
      const osc = this.track(this.ctx.createOscillator()); const gain = this.ctx.createGain(); const filter = this.ctx.createBiquadFilter();
      osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.detune.value = detune; filter.type = "lowpass"; filter.frequency.value = filterHz;
      this.envelope(gain, t, dur, peak); osc.connect(filter).connect(gain); this.route(gain, .1); osc.start(t); osc.stop(t + dur + .25); return osc;
    }
    noiseBuffer(seconds = 1) { const n = Math.max(1, Math.floor(this.ctx.sampleRate * seconds)); const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = b.getChannelData(0); for (let i=0;i<n;i++) d[i] = Math.random()*2-1; return b; }
    noise(t, dur, level = .03, highpass = 250) {
      const src = this.track(this.ctx.createBufferSource()); src.buffer = this.noiseBuffer(dur + .1); const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = highpass; const g = this.ctx.createGain(); this.envelope(g,t,dur,level,.02,.12); src.connect(f).connect(g); this.route(g,.04); src.start(t); src.stop(t+dur+.15);
    }
    piano(freq,t,dur,v) {
      [1,2,3,4,5].forEach((p,i) => { const osc=this.track(this.ctx.createOscillator()); const g=this.ctx.createGain(); const f=this.ctx.createBiquadFilter(); osc.type=i<2?"sine":"triangle"; osc.frequency.setValueAtTime(freq*p*(1+i*i*.00018),t); f.type="lowpass"; f.frequency.value=clamp(9000-p*650,1800,10000); this.envelope(g,t,dur*(1-.07*i),v*(.42/(p*p)),.004,.28); osc.connect(f).connect(g); this.route(g,.16); osc.start(t); osc.stop(t+dur+.35); });
      this.noise(t, .035, v*.035, 1200);
    }
    guitar(freq,t,dur,v) {
      const rate=this.ctx.sampleRate, period=Math.max(2,Math.floor(rate/freq)), n=Math.floor(rate*(dur+.35)), b=this.ctx.createBuffer(1,n,rate), d=b.getChannelData(0);
      for(let i=0;i<period;i++) d[i]=(Math.random()*2-1)*v;
      for(let i=period;i<n;i++) d[i]=.996*.5*(d[i-period]+d[i-period+1]);
      const src=this.track(this.ctx.createBufferSource()), g=this.ctx.createGain(), f=this.ctx.createBiquadFilter(); src.buffer=b; f.type="lowpass"; f.frequency.value=5200; this.envelope(g,t,dur,v*.75,.003,.25); src.connect(f).connect(g); this.route(g,.2); src.start(t); src.stop(t+dur+.35);
    }
    strings(freq,t,dur,v) {
      [-6,5].forEach((det,i)=>{ const o=this.track(this.ctx.createOscillator()),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter(),l=this.ctx.createOscillator(),lg=this.ctx.createGain(); o.type=i?"sawtooth":"triangle"; o.frequency.value=freq; o.detune.value=det; f.type="lowpass"; f.frequency.value=2300+freq*2; l.frequency.value=5.2; lg.gain.value=4; l.connect(lg).connect(o.detune); this.envelope(g,t,dur,v*.23,.11,.35); o.connect(f).connect(g); this.route(g,.22); o.start(t);l.start(t);o.stop(t+dur+.45);l.stop(t+dur+.45);this.track(l); });
    }
    flute(freq,t,dur,v) { this.oscillator("sine",freq,t,dur,v*.5,0,8000); this.oscillator("sine",freq*2,t,dur,v*.08,2,9000); this.noise(t,dur,v*.018,1600); }
    organ(freq,t,dur,v) { [[1,.34],[2,.16],[3,.1],[4,.05]].forEach(([p,a])=>this.oscillator("sine",freq*p,t,dur,v*a,0,10000)); }
    bass(freq,t,dur,v) { this.oscillator("sine",freq,t,dur,v*.55,0,1600); this.oscillator("sawtooth",freq,t,dur,v*.12,-2,900); }
    note(e,t0) {
      const t=t0+e.at, f=this.freq(e.midi,e.cents||0), d=e.dur||.6, v=e.velocity||.7, name=e.instrument in INSTRUMENTS?e.instrument:"piano";
      if(name==="piano")this.piano(f,t,d,v); else if(name==="guitar")this.guitar(f,t,d,v); else if(name==="strings")this.strings(f,t,d,v); else if(name==="flute")this.flute(f,t,d,v); else if(name==="organ")this.organ(f,t,d,v); else this.bass(f,t,d,v);
    }
    drum(e,t0) {
      const t=t0+e.at,v=e.velocity||.7,kind=e.drum;
      if(kind==="kick"){const o=this.track(this.ctx.createOscillator()),g=this.ctx.createGain();o.type="sine";o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(43,t+.16);this.envelope(g,t,.18,v*.8,.002,.08);o.connect(g);this.route(g,.05);o.start(t);o.stop(t+.3);}
      else if(kind==="snare"){this.noise(t,.16,v*.22,900);this.oscillator("triangle",180,t,.12,v*.12,0,900);}
      else if(kind==="hat"){this.noise(t,.065,v*.12,6500);}
      else if(kind==="rim"){this.oscillator("square",780,t,.035,v*.12,0,2800);}
      else if(kind==="tom"){const o=this.track(this.ctx.createOscillator()),g=this.ctx.createGain();o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(110,t+.18);this.envelope(g,t,.2,v*.4,.002,.1);o.connect(g);this.route(g,.08);o.start(t);o.stop(t+.35);}
      else {this.noise(t,.3,v*.12,3500);}
    }
    async play(exercise) {
      await this.ensure(); this.stopAll(); const start=this.ctx.currentTime+.075;
      exercise.events.forEach(e=>{ if(e.type==="note")this.note(e,start); else if(e.type==="drum")this.drum(e,start); else if(e.type==="noise")this.noise(start+e.at,e.dur,e.level,180); });
      return exercise.duration*1000;
    }
  }

  const audio = new AudioEngine();
  const dom = {
    home: $("homeView"), session: $("sessionView"), summary: $("summaryView"), settings: $("settingsDialog"),
    settingsButton: $("settingsButton"), closeSettings: $("closeSettingsButton"), settingsForm: $("settingsForm"),
    daily: $("dailyButton"), handsFree: $("handsFreeButton"), end: $("endButton"), pause: $("pauseButton"),
    play: $("playButton"), answers: $("answerArea"), rating: $("handsFreeRating"), known: $("knownButton"), review: $("reviewButton"),
    feedback: $("feedback"), continue: $("continueButton"), homeButton: $("homeButton"),
    prompt: $("sessionTitle"), domain: $("domainLabel"), mode: $("modeLabel"), progress: $("progressLabel"),
    homeStatus: $("homeStatus"), summaryText: $("summaryText"), offline: $("offlineBanner")
  };
  const settingIds = ["sessionLength","instrument","speech","transferTimbre","worldTrack","experimentalTrack","noiseTraining","referencePitch","highContrast"];
  let session = null;
  let flowTimer = 0;

  function show(view) {
    [dom.home,dom.session,dom.summary].forEach(x=>x.hidden=true); view.hidden=false; view.querySelector("h1")?.focus?.({preventScroll:true}); window.scrollTo(0,0);
  }
  function applySettings() { document.documentElement.classList.toggle("high-contrast", !!profile.settings.highContrast); }
  function homeStatus() {
    const sessions=profile.sessions.length, accuracy=profile.totalAnswers?Math.round(profile.totalCorrect/profile.totalAnswers*100):0;
    dom.homeStatus.textContent = sessions ? `${sessions} séance${sessions>1?"s":""}. Le prochain exercice est déjà choisi par vos réponses${profile.totalAnswers?` · ${accuracy} % de réussite observée`:""}.` : "Le parcours commence par les fondations, puis ouvre chaque unité au bon moment.";
  }
  function loadSettingsForm() {
    settingIds.forEach(id=>{const el=$(id);const value=profile.settings[id];if(el.type==="checkbox")el.checked=!!value;else el.value=String(value);});
  }
  function saveSettingsForm() {
    settingIds.forEach(id=>{const el=$(id);profile.settings[id]=el.type==="checkbox"?el.checked:(id==="sessionLength"||id==="referencePitch"?Number(el.value):el.value);});
    saveProfile(true); applySettings(); homeStatus();
  }
  function speak(text) {
    if(!profile.settings.speech||!globalThis.speechSynthesis)return Promise.resolve();
    return new Promise(resolve=>{globalThis.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="fr-FR";u.rate=.93;u.pitch=1;u.volume=.9;u.onend=resolve;u.onerror=resolve;globalThis.speechSynthesis.speak(u);setTimeout(resolve,Math.max(1800,text.length*90));});
  }
  function cancelFlow(){clearTimeout(flowTimer);if(globalThis.speechSynthesis)globalThis.speechSynthesis.cancel();audio.stopAll();if(session)session.token++;}

  async function startSession(mode) {
    cancelFlow();
    try { await audio.ensure(); } catch (err) { dom.homeStatus.textContent=`Le son ne peut pas démarrer: ${err.message}`; return; }
    session={mode,index:0,length:Number(profile.settings.sessionLength)||12,correct:0,answered:0,newCount:0,history:[],policy:policyForSession(),current:null,startedAt:now(),token:1,paused:false,answerStarted:0,rated:false};
    dom.mode.textContent=mode==="handsfree"?"Mains libres":"Séance du jour";dom.pause.hidden=mode!=="handsfree";dom.pause.textContent="Pause";show(dom.session);nextExercise();
  }
  function renderOptions(exercise) {
    dom.answers.replaceChildren();
    exercise.options.forEach((option,i)=>{const b=document.createElement("button");b.type="button";b.textContent=option;b.dataset.value=option;b.setAttribute("aria-label",`${i+1}. ${option}`);b.addEventListener("click",()=>answer(option,b));dom.answers.appendChild(b);});
  }
  async function playCurrent() {
    if(!session?.current)return;dom.play.setAttribute("aria-busy","true");
    try { await audio.play(session.current); } catch(err) { dom.feedback.textContent=`Son indisponible: ${err.message}`; }
    flowTimer=setTimeout(()=>dom.play.removeAttribute("aria-busy"),session.current.duration*1000+150);
  }
  async function nextExercise() {
    if(!session||session.index>=session.length){endSession(false);return;}
    session.rated=false;session.current=selectExercise(session);const ex=session.current;session.index++;session.answerStarted=performance.now();
    if(!itemRecord(ex.itemKey).attempts)session.newCount++;
    session.history.push({unitId:ex.unit.id,domain:ex.unit.domain});
    dom.progress.textContent=`${session.index} sur ${session.length}`;dom.domain.textContent=ex.unit.domain;dom.prompt.textContent=ex.prompt;dom.feedback.textContent="";dom.feedback.className="feedback";dom.continue.hidden=true;dom.rating.hidden=true;
    if(session.mode==="daily"){renderOptions(ex);dom.answers.hidden=false;await playCurrent();}
    else {dom.answers.hidden=true;runHandsFree(session.token);}
  }
  async function runHandsFree(token) {
    const ex=session?.current;if(!ex)return;await speak(ex.spokenPrompt);if(!session||token!==session.token||session.paused)return;await playCurrent();await sleep(ex.duration*1000+650);if(!session||token!==session.token||session.paused)return;
    dom.feedback.textContent=ex.answer;await speak(ex.answer);if(!session||token!==session.token||session.paused)return;recordExposure(ex);dom.rating.hidden=false;
    flowTimer=setTimeout(()=>{if(session&&token===session.token&&!session.paused&&!session.rated)nextExercise();},4200);
  }
  function answer(value, button=null) {
    if(!session||session.mode!=="daily"||dom.continue.hidden===false)return;
    const ex=session.current,correct=value===ex.answer,latency=performance.now()-session.answerStarted;session.answered++;if(correct)session.correct++;
    updateLearning(ex,correct,latency,correct?null:value,.75);[...dom.answers.children].forEach(b=>{b.disabled=true;if(b.dataset.value===ex.answer)b.classList.add("correct");else if(b===button)b.classList.add("wrong");});
    dom.feedback.textContent=correct?ex.answer:`${ex.answer}. À revoir.`;dom.feedback.className=`feedback ${correct?"good":"bad"}`;dom.continue.hidden=false;dom.continue.focus();
  }
  function rateHandsFree(known) {
    if(!session||session.mode!=="handsfree"||session.rated)return;session.rated=true;clearTimeout(flowTimer);session.answered++;if(known)session.correct++;
    updateLearning(session.current,known,4500,known?null:"auto-évaluation",known ? .75 : .85);dom.rating.hidden=true;dom.feedback.textContent=known?"Consolidé.":"Reprogrammé plus tôt.";dom.feedback.className=`feedback ${known?"good":"bad"}`;flowTimer=setTimeout(nextExercise,650);
  }
  function endSession(aborted=true) {
    if(!session)return;cancelFlow();const s=session;const accuracy=s.answered?Math.round(s.correct/s.answered*100):0;const reward=s.answered?s.correct/s.answered:.5;const arm=profile.policy[s.policy]||{n:0,reward:.5};arm.n=(arm.n||0)+1;arm.reward=(arm.reward||.5)+(reward-(arm.reward||.5))/arm.n;profile.policy[s.policy]=arm;
    profile.sessions.push({at:now(),mode:s.mode,planned:s.length,completed:s.index-(aborted?1:0),answered:s.answered,correct:s.correct,policy:s.policy});profile.sessions=profile.sessions.slice(-180);saveProfile(true);session=null;
    dom.summaryText.textContent=s.mode==="handsfree"?(s.answered?`${s.answered} auto-évaluation${s.answered>1?"s":""}. Les éléments incertains reviendront plus tôt.`:"Exposition enregistrée sans prétendre à une maîtrise."):(s.answered?`${s.correct} réponse${s.correct>1?"s":""} juste${s.correct>1?"s":""} sur ${s.answered}, soit ${accuracy} %. La difficulté et les intervalles ont été recalculés.`:"La séance a été interrompue sans modifier artificiellement votre niveau.");
    show(dom.summary);homeStatus();
  }

  dom.daily.addEventListener("click",()=>startSession("daily"));
  dom.handsFree.addEventListener("click",()=>startSession("handsfree"));
  dom.end.addEventListener("click",()=>endSession(true));
  dom.play.addEventListener("click",playCurrent);
  dom.continue.addEventListener("click",nextExercise);
  dom.known.addEventListener("click",()=>rateHandsFree(true));dom.review.addEventListener("click",()=>rateHandsFree(false));
  dom.pause.addEventListener("click",()=>{if(!session)return;session.paused=!session.paused;session.token++;clearTimeout(flowTimer);audio.stopAll();globalThis.speechSynthesis?.cancel();dom.pause.textContent=session.paused?"Reprendre":"Pause";dom.feedback.textContent=session.paused?"En pause":"";if(!session.paused)runHandsFree(session.token);});
  dom.homeButton.addEventListener("click",()=>{show(dom.home);homeStatus();});
  dom.settingsButton.addEventListener("click",()=>{loadSettingsForm();dom.settings.showModal();});
  dom.closeSettings.addEventListener("click",()=>dom.settings.close());
  dom.settingsForm.addEventListener("submit",e=>{if(e.submitter?.value==="save")saveSettingsForm();});
  $("resetButton").addEventListener("click",()=>{if(confirm("Effacer toute la progression enregistrée sur cet appareil ?")){profile=defaultProfile();saveProfile(true);loadSettingsForm();applySettings();homeStatus();}});
  document.addEventListener("keydown",e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;if(!session)return;if(e.key.toLowerCase()==="r"){e.preventDefault();playCurrent();}if(session.mode==="daily"&&/^[1-9]$/.test(e.key)){const b=dom.answers.children[Number(e.key)-1];if(b&&!b.disabled)b.click();}if(e.key==="Escape")endSession(true);});
  const updateNetwork=()=>{dom.offline.hidden=navigator.onLine;};window.addEventListener("online",updateNetwork);window.addEventListener("offline",updateNetwork);updateNetwork();
  applySettings();homeStatus();

  if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(()=>{}));
  const requested=new URLSearchParams(location.search).get("mode");if(requested==="daily"||requested==="handsfree")setTimeout(()=>startSession(requested),250);

  Object.defineProperty(globalThis,"EarForge",{value:Object.freeze({version:VERSION,curriculumUnits:units.length,validateGraph,unitMastery,unlockedUnits:()=>units.filter(unlocked).length}),writable:false});
})();
