'use strict';
(() => {
const W = 960, H = 540, RS = 1.25, GROUND = 470, WORLD = 1800, DT = 1 / 60;
const GRAV = 2300, JUMPV = 900, PARRY_WIN = 0.28, BEAM_H = 78;
const HERO_SRC = 'assets/hero.jpg', BOSS_SRC = 'assets/boss.jpg', ART1_SRC = 'assets/art1.png', ART2_SRC = 'assets/art2.png';
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
cv.width = W * RS; cv.height = H * RS;
const stage = $('stage');
function fit() { stage.style.setProperty('--u', (stage.clientWidth / W).toFixed(4)); }
addEventListener('resize', fit); fit();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - t) * (1 - t);
const TAU = Math.PI * 2;

const imgHero = new Image(), imgBoss = new Image();
const imgArt = new Image(); imgArt.src = ART1_SRC;
imgHero.src = HERO_SRC; imgBoss.src = BOSS_SRC;
if ($('tHero')) { $('tHero').src = HERO_SRC; $('cSent').style.backgroundImage = "url('" + BOSS_SRC + "')"; $('cArt').style.backgroundImage = "url('" + ART1_SRC + "')"; }
if ($('coCSent')) { $('coCSent').style.backgroundImage = "url('" + BOSS_SRC + "')"; $('coCArt').style.backgroundImage = "url('" + ART1_SRC + "')"; }

/* ================= AUDIO ================= */
let AC = null, muted = false;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } if (AC) initAudioGraph(AC); }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type, v, slide, delay) {
  const a = AC; if (!a || muted) return;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  g.gain.setValueAtTime(v || .12, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(sfxBus || a.destination); o.start(t); o.stop(t + d + .03);
}
function noise(d, v, f, kind, slide, delay) {
  const a = AC; if (!a || muted) return;
  const t = a.currentTime + (delay || 0);
  const s = a.createBufferSource(); s.buffer = getNoise(a); s.loop = true;
  const fl = a.createBiquadFilter(); fl.type = kind || 'lowpass'; fl.frequency.setValueAtTime(f || 1000, t);
  if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
  const g = a.createGain(); g.gain.setValueAtTime(v || .2, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(fl); fl.connect(g); g.connect(sfxBus || a.destination); s.start(t); s.stop(t + d + .03);
}
function sfx(n) {
  if (!AC || muted) return;
  switch (n) {
    case 'swing': noise(.16, .16, 2600, 'bandpass', -1800); break;
    case 'bswing': noise(.28, .24, 900, 'bandpass', -500); tone(90, .25, 'sawtooth', .05, -40); break;
    case 'hit': noise(.12, .3, 1800, 'lowpass', -1200); tone(160, .12, 'square', .09, -90); break;
    case 'hurt': noise(.25, .35, 900, 'lowpass', -600); tone(110, .3, 'sawtooth', .12, -70); break;
    case 'parry': tone(1500, .5, 'triangle', .16, -300); tone(2300, .35, 'sine', .1, -600); noise(.08, .25, 4000, 'highpass'); tone(200, .2, 'square', .08, -100); break;
    case 'boom': noise(1.1, .55, 500, 'lowpass', -380); tone(70, .9, 'sine', .4, -45); break;
    case 'charge': tone(110, 1.1, 'sawtooth', .06, 520); tone(220, 1.1, 'sine', .07, 700); break;
    case 'beam': noise(.6, .4, 3000, 'bandpass', -2000); tone(180, .5, 'sawtooth', .18, -80); tone(360, .5, 'square', .06, -120); break;
    case 'heal': tone(520, .5, 'sine', .11, 260); tone(780, .5, 'sine', .08, 300, .1); tone(1040, .5, 'sine', .06, 200, .2); break;
    case 'dodge': noise(.2, .12, 1200, 'bandpass', -700); break;
    case 'jump': tone(200, .12, 'sine', .05, 120); break;
    case 'roar': noise(1.2, .4, 500, 'lowpass', -300); tone(60, 1.2, 'sawtooth', .18, 30); break;
    case 'die': tone(300, 1.6, 'sawtooth', .12, -250); noise(1.6, .3, 800, 'lowpass', -700); break;
    case 'win': tone(392, 1, 'triangle', .1); tone(523, 1.2, 'triangle', .1, 0, .25); tone(659, 1.6, 'triangle', .1, 0, .5); break;
    case 'plunge': noise(.35, .2, 1500, 'lowpass', -1000); break;
    case 'skill1': tone(700, .05, 'triangle', .05, 200); tone(1500, .3, 'triangle', .13, 900); noise(.22, .22, 4500, 'highpass', -2200); tone(2600, .18, 'sine', .07, -400, .04); break;
    case 'skill2': noise(.7, .5, 400, 'lowpass', -260); tone(55, 1.1, 'sawtooth', .4, -35); tone(140, .5, 'square', .16, -90, .03); noise(.3, .3, 3000, 'bandpass', -2000, .02); break;
    case 'block': tone(240, .2, 'square', .1, -110); noise(.1, .25, 2500, 'bandpass'); tone(900, .15, 'triangle', .05, -300); break;
  }
}
$('mute').addEventListener('click', () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; applyVolumes(); });

/* ================= MUSIC: synthesized solo piano ================= */
// Everything below is original: a small piano synth plus original compositions.
const audioCfg = { music: .8, sfx: .9 };
let sfxBus = null, MG = null;
const noiseCache = new WeakMap();
function getNoise(a) {
  let b = noiseCache.get(a);
  if (!b) { b = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(a, b); }
  return b;
}
function makeIR(a) {
  const secs = 3.6, len = Math.floor(a.sampleRate * secs), ir = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len, n = Math.random() * 2 - 1;
      y += (n - y) * (0.75 - 0.6 * t);
      d[i] = y * Math.pow(1 - t, 2.4) * (i < 400 ? i / 400 : 1);
    }
  }
  return ir;
}
function buildMusicGraph(a) {
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = .012; comp.release.value = .35;
  comp.connect(a.destination);
  const bus = a.createGain(); bus.connect(comp);
  const conv = a.createConvolver(); conv.buffer = makeIR(a);
  const send = a.createGain(); send.gain.value = .5; send.connect(conv);
  const wet = a.createGain(); wet.gain.value = .9; conv.connect(wet); wet.connect(bus);
  return { bus, send };
}
function initAudioGraph(a) {
  sfxBus = a.createGain(); sfxBus.connect(a.destination);
  MG = buildMusicGraph(a);
  applyVolumes();
}
function applyVolumes() {
  if (!AC || !MG) return;
  const t = AC.currentTime;
  MG.bus.gain.setTargetAtTime(muted ? 0 : audioCfg.music, t, .05);
  sfxBus.gain.setTargetAtTime(muted ? 0 : audioCfg.sfx, t, .05);
}

/* --- piano voice --- */
const waveCache = new WeakMap();
function pianoWave(a, midi) {
  let m = waveCache.get(a); if (!m) { m = {}; waveCache.set(a, m); }
  const reg = clamp(Math.floor((midi - 24) / 12), 0, 7);
  if (!m[reg]) {
    const n = 16, re = new Float32Array(n + 1), im = new Float32Array(n + 1);
    for (let h = 1; h <= n; h++) im[h] = (1 / Math.pow(h, 1.05)) * Math.exp(-h * (.10 + reg * .045)) * (h % 2 === 0 ? .85 : 1) * (h === 3 ? 1.1 : 1);
    m[reg] = a.createPeriodicWave(re, im);
  }
  return m[reg];
}
function pianoNote(a, dest, midi, when, durS, vel, pedal) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const nat = clamp(6.4 - (midi - 30) * .062, 1.4, 6.2);
  const total = Math.min(nat, Math.max(.35, durS + pedal));
  const peak = vel * clamp(.17 - (midi - 40) * .0009, .08, .17);
  const t = Math.max(when, a.currentTime), g = a.createGain(), lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = .5;
  lp.frequency.setValueAtTime(Math.min(15000, f * (4 + vel * 10)), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2.2), t + Math.min(1.2, total));
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + .006);
  g.gain.exponentialRampToValueAtTime(peak * .5, t + Math.min(.35, total * .4));
  g.gain.exponentialRampToValueAtTime(.0001, t + total);
  const w = pianoWave(a, midi);
  for (const dt of [-1.8, 1.8]) { const o = a.createOscillator(); o.setPeriodicWave(w); o.frequency.value = f; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + total + .05); }
  lp.connect(g); g.connect(dest);
  const ns = a.createBufferSource(); ns.buffer = getNoise(a);
  const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = Math.min(5000, f * 3); nf.Q.value = .8;
  const ng = a.createGain(); ng.gain.setValueAtTime(vel * .035, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .04);
  ns.connect(nf); nf.connect(ng); ng.connect(dest); ns.start(t); ns.stop(t + .06);
}

/* --- notes and chords --- */
const NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nn(s) { const m = /^([A-G])([#b]?)(\d)$/.exec(s); return NOTE_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12; }
// b = bass, a = left-hand arpeggio notes, t = triad, ra = right-hand arpeggio notes
const CH = {
  Dm: { b: 38, a: [45, 50, 53, 57, 62], t: [62, 65, 69], ra: [57, 62, 65, 69, 74] },
  Bb: { b: 34, a: [41, 46, 50, 53, 58], t: [58, 62, 65] },
  Gm: { b: 43, a: [50, 55, 58, 62, 67], t: [58, 62, 67] },
  A: { b: 33, a: [45, 52, 57, 61, 64], t: [57, 61, 64] },
  F: { b: 41, a: [48, 53, 57, 60, 65], t: [57, 60, 65], ra: [53, 57, 60, 65, 69] },
  C: { b: 36, a: [48, 52, 55, 60, 64], t: [60, 64, 67], ra: [55, 60, 64, 67, 72] },
  Am: { b: 33, a: [45, 52, 57, 60, 64], t: [57, 60, 64], ra: [57, 60, 64, 69, 72] },
  G: { b: 43, a: [50, 55, 59, 62, 67], t: [59, 62, 67], ra: [55, 59, 62, 67, 71] },
  E: { b: 40, a: [40, 47, 52, 56, 59], t: [56, 59, 64], ra: [56, 59, 64, 68, 71] },
  D: { b: 38, a: [50, 54, 57, 62, 66], t: [62, 66, 69] },
  Bm: { b: 35, a: [47, 54, 59, 62, 66], t: [59, 62, 66] }
};
const melBars = arr => arr.map(bar => bar.map(m => [m[0], nn(m[1]), m[2]]));

/* Title theme: slow, sparse and mournful (D minor) */
const TITLE_A = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Bb', 'A'];
const TITLE_B = ['Gm', 'Dm', 'Bb', 'F', 'Gm', 'A', 'Dm', 'Dm'];
const MEL_TA = melBars([
  [[0, 'A4', 3], [3, 'G4', 1]], [[0, 'F4', 2], [2, 'G4', 1], [3, 'A4', 1]], [[0, 'Bb4', 3], [3, 'A4', 1]], [[0, 'G4', 2], [2, 'E4', 2]],
  [[0, 'D5', 3], [3, 'C5', 1]], [[0, 'A4', 2], [2, 'C5', 2]], [[0, 'D5', 2], [2, 'C5', 1], [3, 'Bb4', 1]], [[0, 'C#5', 2], [2, 'A4', 2]]]);
const MEL_TB = melBars([
  [[0, 'Bb4', 1], [1, 'D5', 1], [2, 'G5', 2]], [[0, 'F5', 3], [3, 'E5', 1]], [[0, 'D5', 2], [2, 'F5', 2]], [[0, 'A5', 3], [3, 'G5', 1]],
  [[0, 'Bb5', 2], [2, 'A5', 1], [3, 'G5', 1]], [[0, 'E5', 2], [2, 'A5', 2]], [[0, 'F5', 2], [2, 'D5', 2]], [[0, 'D5', 4]]]);
function titleGen(b) {
  const sec = Math.floor(b / 8), i = b % 8, ch = CH[(sec === 1 ? TITLE_B : TITLE_A)[i]], ev = [];
  ev.push([0, ch.b, 4, .5]);
  if (sec === 2) ev.push([0, ch.b + 12, 4, .34]);
  const pat = [0, 2, 3, 4, 3, 2, 1, 2];
  for (let k = 0; k < 8; k++) ev.push([k * .5, ch.a[pat[k]], .5, k === 0 ? .3 : (k % 2 ? .2 : .25)]);
  for (const m of (sec === 1 ? MEL_TB : MEL_TA)[i]) { ev.push([m[0], m[1], m[2], .6]); if (sec === 2) ev.push([m[0], m[1] - 12, m[2], .32]); }
  return ev;
}

/* Battle theme 1: The Violet Sentinel (D minor, driving left hand) */
const SENT_PROG = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'F', 'Bb', 'C', 'Gm', 'A', 'Dm', 'A'];
const MEL_S = melBars([
  [[0, 'D5', 1.5], [1.5, 'F5', .5], [2, 'A5', 2]], [[0, 'G5', 1], [1, 'F5', 1], [2, 'E5', 2]],
  [[0, 'D5', 1.5], [1.5, 'F5', .5], [2, 'Bb5', 2]], [[0, 'A5', 1], [1, 'G5', 1], [2, 'E5', 2]],
  [[0, 'F5', 1], [1, 'A5', 1], [2, 'D6', 2]], [[0, 'C6', 1], [1, 'A5', 1], [2, 'F5', 2]],
  [[0, 'G5', 1.5], [1.5, 'Bb5', .5], [2, 'D6', 2]], [[0, 'C#6', 1], [1, 'E6', 1], [2, 'A5', 2]],
  [[0, 'D6', 2], [2, 'C6', 1], [3, 'A5', 1]], [[0, 'A5', 1.5], [1.5, 'C6', .5], [2, 'F6', 2]],
  [[0, 'D6', 2], [2, 'C6', 1], [3, 'Bb5', 1]], [[0, 'G5', 1], [1, 'A5', 1], [2, 'G5', 2]],
  [[0, 'Bb5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'F5', 1]], [[0, 'E5', 1], [1, 'G5', 1], [2, 'A5', 2]],
  [[0, 'F5', 2], [2, 'D5', 2]], [[0, 'E5', 2], [2, 'C#5', 2]]]);
function sentGen(b, hi) {
  const ch = CH[SENT_PROG[b]], ev = [], R = ch.b + 12;
  const pat = [R, R + 7, R + 12, R + 7, R, R + 7, R + 12, R + 7];
  for (let k = 0; k < 8; k++) ev.push([k * .5, pat[k], .5, k % 4 === 0 ? .58 : k % 2 === 0 ? .46 : .34]);
  ev.push([0, ch.b, 2, .8]); ev.push([2, ch.b, 2, .66]);
  if (hi) { ev.push([1, ch.b, 1, .55]); ev.push([3, ch.b, 1, .55]); }
  for (const beat of (hi ? [0, 1, 2, 3] : [0, 2])) for (const n of ch.t) ev.push([beat, n, 1.6, .34]);
  for (const m of MEL_S[b]) { ev.push([m[0], m[1], m[2], .78]); if (hi) ev.push([m[0], m[1] - 12, m[2], .5]); }
  return ev;
}

/* Battle theme 2: Artorias (A minor, tolling bass and rising arpeggios) */
const ART_PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'C', 'G', 'Dm', 'Am', 'E', 'E'];
const MEL_A = melBars([
  [[0, 'E5', 2], [2, 'A5', 1], [3, 'G5', 1]], [[0, 'F5', 2], [2, 'A5', 2]], [[0, 'G5', 2], [2, 'E5', 1], [3, 'C5', 1]], [[0, 'D5', 2], [2, 'B4', 2]],
  [[0, 'E5', 2], [2, 'A5', 1], [3, 'B5', 1]], [[0, 'C6', 2], [2, 'A5', 2]], [[0, 'D6', 1.5], [1.5, 'C6', .5], [2, 'A5', 2]], [[0, 'G#5', 2], [2, 'B5', 2]],
  [[0, 'A5', 2], [2, 'C6', 1], [3, 'E6', 1]], [[0, 'D6', 2], [2, 'C6', 2]], [[0, 'E6', 2], [2, 'D6', 1], [3, 'C6', 1]], [[0, 'B5', 2], [2, 'D6', 2]],
  [[0, 'F6', 2], [2, 'E6', 1], [3, 'D6', 1]], [[0, 'C6', 2], [2, 'A5', 2]], [[0, 'B5', 2], [2, 'G#5', 2]], [[0, 'E5', 4]]]);
function artGen(b, hi) {
  const ch = CH[ART_PROG[b]], ev = [];
  for (const beat of (hi ? [0, 1, 2, 3] : [0, 2])) { ev.push([beat, ch.b, hi ? 1 : 2, .78]); ev.push([beat, ch.b + 12, hi ? 1 : 2, .6]); }
  const pat = [0, 1, 2, 3, 4, 3, 2, 1], steps = hi ? 16 : 8, sp = hi ? .25 : .5;
  for (let k = 0; k < steps; k++) ev.push([k * sp, ch.ra[pat[k % 8]], sp, .3 + (k % 4 === 0 ? .06 : 0)]);
  for (const m of MEL_A[b]) { ev.push([m[0], m[1], m[2], .8]); if (hi) ev.push([m[0], m[1] - 12, m[2], .5]); }
  return ev;
}

/* Victory: a warm D major resolution */
const VICT_PROG = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D'];
const MEL_V = melBars([
  [[0, 'F#5', 2], [2, 'A5', 2]], [[0, 'E5', 2], [2, 'C#5', 2]], [[0, 'D5', 2], [2, 'F#5', 2]], [[0, 'B4', 2], [2, 'D5', 2]],
  [[0, 'A5', 2], [2, 'F#5', 2]], [[0, 'E5', 2], [2, 'A5', 2]], [[0, 'B5', 2], [2, 'G5', 1], [3, 'D5', 1]], [[0, 'D5', 4]]]);
function victGen(b) {
  const ch = CH[VICT_PROG[b]], ev = [], pat = [0, 2, 3, 4, 3, 2, 1, 2];
  ev.push([0, ch.b, 4, .5]);
  for (let k = 0; k < 8; k++) ev.push([k * .5, ch.a[pat[k]], .5, k === 0 ? .3 : .22]);
  for (const m of MEL_V[b]) { ev.push([m[0], m[1], m[2], .6]); ev.push([m[0], m[1] - 12, m[2], .3]); }
  return ev;
}

const TRACKS = {
  title: { bpm: 56, beats: 4, bars: 24, pedal: 3.6, gen: titleGen },
  battleSent: { bpm: 88, beats: 4, bars: 16, pedal: 1.1, intenseTempo: 1.1, gen: sentGen },
  battleArt: { bpm: 74, beats: 4, bars: 16, pedal: 1.3, intenseTempo: 1.12, gen: artGen },
  victory: { bpm: 58, beats: 4, bars: 8, pedal: 3.4, gen: victGen }
};

/* --- sequencer --- */
const Music = { cur: null, timer: null, intense: false };
function scheduleNote(a, dest, tr, e, when, beat) {
  const durS = e[2] * beat, vel = clamp(e[3] * (1 + (Math.random() - .5) * .14), .05, 1);
  pianoNote(a, dest, e[1], when + (Math.random() - .5) * .02, durS, vel, tr.pedal);
}
function musicTick() {
  const a = AC, c = Music.cur; if (!a || !c) return;
  while (c.next < a.currentTime + 1.4) {
    const tr = c.track, bpm = tr.bpm * (Music.intense && tr.intenseTempo ? tr.intenseTempo : 1), beat = 60 / bpm;
    for (const e of tr.gen(c.bar % tr.bars, Music.intense)) scheduleNote(a, c.gain, tr, e, c.next + e[0] * beat, beat);
    c.next += tr.beats * beat; c.bar++;
  }
}
function musicPlay(name) {
  const a = ac(); if (!a || !MG) return;
  if (Music.cur && Music.cur.name === name) return;
  musicStop(1.2);
  const tr = TRACKS[name]; if (!tr) return;
  const gain = a.createGain(); gain.gain.setValueAtTime(.0001, a.currentTime); gain.gain.linearRampToValueAtTime(1, a.currentTime + 1.2);
  gain.connect(MG.bus); gain.connect(MG.send);
  Music.cur = { name, track: tr, gain, bar: 0, next: a.currentTime + .3 }; Music.intense = false;
  if (!Music.timer) Music.timer = setInterval(musicTick, 100);
  musicTick();
}
function musicStop(fade) {
  const a = AC, c = Music.cur; Music.cur = null;
  if (!a || !c) return;
  const t = a.currentTime; c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(Math.max(.0001, c.gain.gain.value), t); c.gain.gain.linearRampToValueAtTime(.0001, t + fade);
  setTimeout(() => { try { c.gain.disconnect(); } catch (e) { } }, (fade + .4) * 1000);
}
function musicIntensify() { Music.intense = true; }
// dev/test helper: render a track offline (used only when window.__TEST__ is set)
async function renderTrackOffline(name, secs, intense) {
  const sr = 44100, oa = new OfflineAudioContext(2, Math.floor(sr * secs), sr), g = buildMusicGraph(oa), tr = TRACKS[name];
  const tg = oa.createGain(); tg.connect(g.bus); tg.connect(g.send);
  const bpm = tr.bpm * (intense && tr.intenseTempo ? tr.intenseTempo : 1), beat = 60 / bpm; let t = 0, bar = 0;
  while (t < secs) { for (const e of tr.gen(bar % tr.bars, !!intense)) { const when = t + e[0] * beat; if (when < secs) scheduleNote(oa, tg, tr, e, when, beat); } t += tr.beats * beat; bar++; }
  return oa.startRendering();
}

/* ================= SETTINGS: key bindings, volume, pause ================= */
const ACTIONS = [['left', 'Move left'], ['right', 'Move right'], ['jump', 'Jump'], ['down', 'Down (plunge)'], ['attack', 'Attack'], ['parry', 'Parry'], ['block', 'Block (hold)'], ['dodge', 'Dodge / air dodge'], ['heal', 'Healing flask'], ['skill1', 'Sunray Slash (skill)'], ['skill2', 'Cinder Bomb (skill)']];
const DEFAULT_BINDS = {
  left: ['KeyA', 'ArrowLeft', ''], right: ['KeyD', 'ArrowRight', ''], jump: ['KeyW', 'Space', 'ArrowUp'], down: ['KeyS', 'ArrowDown', ''],
  attack: ['KeyJ', 'Mouse0', 'KeyZ'], parry: ['KeyK', 'Mouse2', 'KeyX'], block: ['KeyB', 'KeyI', ''], dodge: ['KeyL', 'ShiftLeft', 'KeyC'], heal: ['KeyQ', 'KeyH', ''],
  skill1: ['KeyR', '', ''], skill2: ['KeyE', '', '']
};
const RESERVED = ['Escape', 'Enter', 'KeyF', 'KeyM', 'Digit1', 'Digit2'];
let binds = {}, codeMap = {}, capturing = null, settingsFrom = 'title', settingsOpen = false, paused = false;
function rebuildMap() { codeMap = {}; for (const a in binds) for (const c of binds[a]) if (c) codeMap[c] = a; }
function resetBinds() { binds = {}; for (const a in DEFAULT_BINDS) binds[a] = DEFAULT_BINDS[a].slice(); rebuildMap(); }
function normCode(c) { return (c || '').replace(/(Shift|Control|Alt|Meta)Right$/, '$1Left'); }
function keyLabel(c) {
  if (!c) return '-';
  if (/^Mouse\d$/.test(c)) return ['Left click', 'Middle click', 'Right click'][+c[5]] || 'Mouse ' + c[5];
  if (/^Key[A-Z]$/.test(c)) return c[3];
  if (/^Digit\d$/.test(c)) return c[5];
  if (/^Numpad/.test(c)) return 'Num ' + c.slice(6);
  const map = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', MetaLeft: 'Meta', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
  return map[c] || c;
}
function labelOf(a) { const r = ACTIONS.find(x => x[0] === a); return r ? r[1] : a; }
function keysOf(a) { return binds[a].filter(x => x).map(keyLabel); }
function primaryKey(a) { const k = keysOf(a); return k.length ? k[0] : 'unbound'; }
function twoKeys(a) { const k = keysOf(a).slice(0, 2); return k.length ? k.join(' / ') : 'unbound'; }
function loadSettings() {
  resetBinds();
  try {
    const b = JSON.parse(localStorage.getItem('gilded_binds_v1') || 'null');
    if (b) for (const a in DEFAULT_BINDS) if (Array.isArray(b[a])) binds[a] = [0, 1, 2].map(i => (typeof b[a][i] === 'string' ? b[a][i] : ''));
    const c = JSON.parse(localStorage.getItem('gilded_audio_v1') || 'null');
    if (c) { audioCfg.music = clamp(+c.music, 0, 1); audioCfg.sfx = clamp(+c.sfx, 0, 1); }
  } catch (e) { }
  if (!(audioCfg.music >= 0)) audioCfg.music = .8; if (!(audioCfg.sfx >= 0)) audioCfg.sfx = .9;
  rebuildMap();
}
function saveSettings() { try { localStorage.setItem('gilded_binds_v1', JSON.stringify(binds)); localStorage.setItem('gilded_audio_v1', JSON.stringify(audioCfg)); } catch (e) { } }
function setMsg(t) { $('bindMsg').textContent = t; }
function renderTitleKeys() {
  const T = $('titleKeys'); if (!T) return; T.innerHTML = '';
  const rows = [['Move', keysOf('left').slice(0, 1).concat(keysOf('right').slice(0, 1)).join(' / ') || 'unbound'], ['Jump', twoKeys('jump')], ['Attack', twoKeys('attack')], ['Parry', twoKeys('parry')],
    ['Block (hold)', twoKeys('block') + ', takes 25% less damage'], ['Dodge slide', twoKeys('dodge')], ['Air dodge', 'Jump, then ' + primaryKey('dodge')], ['Plunge strike', primaryKey('down') + ' + ' + primaryKey('attack') + ' in the air'], ['Healing flask', twoKeys('heal')],
    ['Sunray Slash', primaryKey('skill1') + ', 300 dmg, 30s cooldown'], ['Cinder Bomb', primaryKey('skill2') + ', 800 dmg up close, 80s cooldown']];
  for (const r of rows) { const b = document.createElement('b'); b.textContent = r[0]; const s = document.createElement('span'); s.textContent = r[1]; T.appendChild(b); T.appendChild(s); }
}
function renderKeyTable() {
  const T = $('keyTable'); T.innerHTML = '';
  for (const [a, label] of ACTIONS) {
    const row = document.createElement('div'); row.className = 'krow';
    const l = document.createElement('span'); l.className = 'kl'; l.textContent = label; row.appendChild(l);
    for (let s = 0; s < 3; s++) {
      const on = capturing && capturing.a === a && capturing.s === s;
      const b = document.createElement('button'); b.className = 'slot' + (on ? ' cap' : ''); b.textContent = on ? 'press a key...' : keyLabel(binds[a][s]);
      b.setAttribute('aria-label', label + ' key ' + (s + 1)); b.addEventListener('click', () => startCapture(a, s)); row.appendChild(b);
    }
    T.appendChild(row);
  }
}
function startCapture(a, s) {
  capturing = { a, s }; renderKeyTable(); $('capPad').classList.remove('hide');
  setMsg('Now press the new key for "' + labelOf(a) + '". Esc cancels. Backspace clears this box.');
}
function endCapture(msg) { capturing = null; $('capPad').classList.add('hide'); renderKeyTable(); renderTitleKeys(); saveSettings(); if (msg) setMsg(msg); }
function assignKey(code) {
  const { a, s } = capturing; let moved = '';
  for (const x in binds) for (let i = 0; i < 3; i++) if (binds[x][i] === code && !(x === a && i === s)) { binds[x][i] = ''; if (x !== a) moved = x; }
  binds[a][s] = code; rebuildMap();
  const empty = ACTIONS.filter(r => !binds[r[0]].some(x => x)).map(r => r[1]);
  let msg = keyLabel(code) + ' is now set for "' + labelOf(a) + '".';
  if (moved) msg = keyLabel(code) + ' moved from "' + labelOf(moved) + '" to "' + labelOf(a) + '".';
  if (empty.length) msg += ' Warning, no key set for: ' + empty.join(', ') + '.';
  endCapture(msg);
}
function openSettings(from) {
  settingsFrom = from; settingsOpen = true; capturing = null; renderKeyTable();
  $('capPad').classList.add('hide'); setMsg('Click a key box, then press the new key. Each action can have up to three keys.');
  $('volMusic').value = Math.round(audioCfg.music * 100); $('volSfx').value = Math.round(audioCfg.sfx * 100);
  if (from === 'pause') $('pause').classList.add('hide');
  $('settings').classList.remove('hide');
}
function closeSettings() {
  settingsOpen = false; capturing = null; saveSettings(); $('settings').classList.add('hide');
  if (settingsFrom === 'pause') $('pause').classList.remove('hide');
}
function clearInputState() { held.left = held.right = held.down = held.block = 0; for (const k in buf) buf[k] = 0; }
function openPause() { if (paused) return; paused = true; clearInputState(); $('pause').classList.remove('hide'); }
function closePause() { paused = false; $('pause').classList.add('hide'); }
const isPlaying = () => (mode === 'boss') && (phase === 'intro' || phase === 'fight' || phase === 'won' || phase === 'lost');

/* ================= INPUT ================= */
const held = { left: 0, right: 0, down: 0, block: 0 };
const HELD_KEYS = ['left', 'right', 'down', 'block'];
const buf = { attack: 0, parry: 0, dodge: 0, jump: 0, heal: 0, skill1: 0, skill2: 0 };
const BUF = .17;
function toggleFS() {
  const el = document.documentElement;
  if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(() => { }); }
  else if (document.exitFullscreen) document.exitFullscreen();
}
function press(a) { if (HELD_KEYS.includes(a)) held[a] = 1; else buf[a] = BUF; }
function release(a) { if (HELD_KEYS.includes(a)) held[a] = 0; }
// While a key box is waiting for a key, this runs first and swallows the event.
addEventListener('keydown', e => {
  if (!capturing) return;
  e.preventDefault(); e.stopPropagation();
  const code = normCode(e.code);
  if (code === 'Escape') { endCapture('Cancelled.'); return; }
  if (code === 'Backspace' || code === 'Delete') { binds[capturing.a][capturing.s] = ''; rebuildMap(); endCapture('Cleared.'); return; }
  if (RESERVED.includes(code)) { setMsg(keyLabel(code) + ' is reserved for menus (Esc, Enter, F, M, 1, 2). Pick another key.'); return; }
  assignKey(code);
}, true);
addEventListener('keydown', e => {
  if (capturing) return;
  const code = normCode(e.code);
  if (code === 'Escape') {
    e.preventDefault();
    if (settingsOpen) closeSettings(); else if ((mode === 'pvp' && (pv === 'countdown' || pv === 'fight')) || (mode === 'coop' && (phase === 'intro' || phase === 'fight'))) mpOpenQuitConfirm();
    else if (paused) closePause(); else if (isPlaying()) openPause();
    return;
  }
  if (code === 'KeyM') { $('mute').click(); return; }
  if (settingsOpen) return;
  if (code === 'KeyF') { e.preventDefault(); toggleFS(); return; }
  if (mode === 'pvp') { /* pvp reads held/buf directly below; menu shortcuts below are boss-mode only */ }
  const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
  if (mode === 'boss' && phase === 'title' && (code === 'Digit1' || code === 'Digit2')) { e.preventDefault(); startGame(code === 'Digit1' ? 'sentinel' : 'art'); return; }
  if (mode === 'boss' && (code === 'Enter' || code === 'KeyR') && (phase === 'title' || phase === 'lostUI' || phase === 'wonUI') && !(code === 'Enter' && onButton)) { e.preventDefault(); startGame(); return; }
  if (paused) return;
  const a = codeMap[code]; if (!a) return;
  e.preventDefault(); if (e.repeat) return; ac(); press(a);
});
addEventListener('keyup', e => { const a = codeMap[normCode(e.code)]; if (a) { e.preventDefault(); release(a); } });
addEventListener('blur', () => { held.left = held.right = held.down = held.block = 0; if (phase === 'intro' || phase === 'fight') openPause(); });
cv.addEventListener('mousedown', e => { ac(); e.preventDefault(); if (paused || settingsOpen) return; const a = codeMap['Mouse' + e.button]; if (a) press(a); });
addEventListener('mouseup', e => { const a = codeMap['Mouse' + e.button]; if (a) release(a); });
stage.addEventListener('contextmenu', e => e.preventDefault());
$('capPad').addEventListener('mousedown', e => { if (!capturing) return; e.preventDefault(); assignKey('Mouse' + e.button); });
document.addEventListener('click', e => { if (e.detail > 0 && e.target instanceof HTMLButtonElement) e.target.blur(); }, true);
document.querySelectorAll('.tb').forEach(b => {
  const a = b.dataset.a;
  b.addEventListener('pointerdown', e => { e.preventDefault(); ac(); b.setPointerCapture(e.pointerId); b.classList.add('on'); press(a); });
  const up = e => { e.preventDefault(); b.classList.remove('on'); release(a); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});
if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) $('touch').classList.remove('hide');
// settings + pause buttons
$('openSettings').addEventListener('click', () => openSettings('title'));
$('closeSettings').addEventListener('click', closeSettings);
$('resetBinds').addEventListener('click', () => { resetBinds(); capturing = null; $('capPad').classList.add('hide'); renderKeyTable(); renderTitleKeys(); saveSettings(); setMsg('Controls reset to the defaults.'); });
$('volMusic').addEventListener('input', e => { audioCfg.music = clamp(+e.target.value / 100, 0, 1); applyVolumes(); });
$('volSfx').addEventListener('input', e => { audioCfg.sfx = clamp(+e.target.value / 100, 0, 1); applyVolumes(); });
$('volMusic').addEventListener('change', saveSettings); $('volSfx').addEventListener('change', saveSettings);
$('pauseBtn').addEventListener('click', () => { if (isPlaying()) (paused ? closePause : openPause)(); });
$('resumeBtn').addEventListener('click', closePause);
$('pauseSettings').addEventListener('click', () => openSettings('pause'));
$('quitBtn').addEventListener('click', () => { closePause(); toTitle(); });
loadSettings(); renderTitleKeys();
// the browser only allows sound after a click or key press, so start the title music then
function firstGesture() { ac(); setTimeout(() => { if (phase === 'title') musicPlay('title'); }, 260); }
addEventListener('pointerdown', firstGesture, { once: true, capture: true });
addEventListener('keydown', firstGesture, { once: true, capture: true });

/* ================= COMBAT DATA ================= */
const ATK = [
  { w: .02, a: .08, r: .09, cost: 20, reach: 122, lunge: 40, a0: -2.3, a1: 1.05 },
  { w: .02, a: .08, r: .09, cost: 20, reach: 128, lunge: 40, a0: 1.35, a1: -1.6 },
  { w: .03, a: .09, r: .17, cost: 20, reach: 160, lunge: 80, a0: -.5, a1: .05, thrust: true }
];
const RECT = {
  sweep: { x0: 8, x1: 190, h0: 0, h1: 62 },
  over: { x0: 8, x1: 165, h0: 0, h1: 155 },
  thrust: { x0: 8, x1: 225, h0: 30, h1: 118 },
  rise: { x0: -10, x1: 170, h0: 0, h1: 155 }
};
const STOP = { sweep: 105, over: 100, thrust: 135, rise: 100 };
const mkA = (type, w, a, r, lunge) => ({ type, w, a, r, lunge, rect: RECT[type], stop: STOP[type] });
const COMBOS = [
  { name: 'Twin Cut', atks: [mkA('sweep', .62, .12, .28, 70), mkA('over', .55, .13, 1.0, 50)] },
  { name: 'Triple Reaver', atks: [mkA('thrust', .56, .12, .30, 90), mkA('sweep', .42, .12, .28, 60), mkA('rise', .50, .13, 1.0, 50)] },
  { name: 'Crescent Fall', atks: [mkA('rise', .66, .13, .34, 70), mkA('over', .36, .12, .30, 60), mkA('thrust', .78, .12, 1.05, 110)] },
  { name: 'Requiem', atks: [mkA('sweep', .50, .12, .26, 70), mkA('sweep', .36, .12, .30, 60), mkA('over', .60, .13, .34, 60), mkA('thrust', .70, .12, 1.1, 90)] }
];
const BK = {
  over: { aw: -2.1, a1: 1.25, wl: -.12, sl: .22, rw: 26, rs: 28 },
  sweep: { aw: 2.9, a1: .05, wl: -.2, sl: .25, rw: 26, rs: 34 },
  thrust: { aw: -.15, a1: .02, wl: -.22, sl: .3, rw: 12, rs: 40 },
  rise: { aw: 1.7, a1: -1.9, wl: .15, sl: -.1, rw: 28, rs: 26 }
};

/* ================= STATE ================= */
let phase = 'title', phaseT = 0, time = 0, hitstop = 0, shake = 0, screenFlash = 0, screenFlashCol = '255,255,255', cam = 0;
let P, B;
const parts = [], fx = [], motes = [];
const orbs = [];
const slashes = [];
const SKILL1_CD = 30, SKILL2_CD = 80;
let bossType = 'sentinel';
function bossHP() { return bossType === 'art' ? 20000 : 4000; }
const prev = { bh: 0, px: 0, py: 0, bx: 0, cam: 0, pt: 0, bpt: 0, ps: '', bs: '', bph: '', time: 0, pst: 0, bst: 0 };
function savePrev() { prev.px = P.x; prev.py = P.y; prev.bx = B.x; prev.cam = cam; prev.pt = P.t; prev.bpt = B.pt; prev.ps = P.state; prev.bs = B.state; prev.bph = B.phase; prev.pst = P.stride; prev.bst = B.stride; prev.bh = B.h; }
function reset() {
  P = { x: 560, y: GROUND, vx: 0, vy: 0, face: 1, hp: 500, maxhp: 500, ghost: 500, ghostDelay: 0, st: 140, maxst: 140, stDelay: 0, flasks: 7, maxFlasks: 7,
    state: 'free', t: 0, combo: 0, hitDone: false, fxDone: false, invuln: 0, flash: 0, parrySucc: false, endT: .62, healed: false, plungeHit: false,
    deadT: 0, dodgeDir: 1, airAtk: false, parryFlash: 0, airDodged: false, landT: 0, stride: 0, blockFlash: 0,
    skill1CD: 0, skill2CD: 0, skill1Fired: false, skill2Fired: false, skill2Hit: false };
  B = { type: bossType, hw: bossType === 'art' ? 38 : 34, hh: bossType === 'art' ? 165 : 148, h: 0, jn: 0, rn: 0, jx0: 0, jx1: 0, rdir: 1, rdist: 0, rmoved: 0, jfirst: true, rfirst: true,
    x: 1230, y: GROUND, face: -1, hp: bossHP(), maxhp: bossHP(), ghost: bossHP(), ghostDelay: 0, state: 'intro', t: 0, cool: 1, last: '', lastCombo: -1,
    flash: 0, stunT: 0, combo: null, ci: 0, atk: null, phase: '', pt: 0, hitDone: false, rage: false, moving: false, beamHit: false, dieT: 0,
    roared: false, expR: 0, introFill: 0, stride: 0 };
  parts.length = 0; fx.length = 0; orbs.length = 0; slashes.length = 0; cam = clamp(P.x * .6 + B.x * .4 - W / 2, 0, WORLD - W);
  hitstop = 0; shake = 0; screenFlash = 0; savePrev();
}
for (let i = 0; i < 46; i++) motes.push({ x: rnd(0, WORLD), y: rnd(80, 520), vx: rnd(-10, 6), vy: rnd(-4, 6), s: rnd(1, 2.6), ph: rnd(0, 7), petal: Math.random() < .35 });
const inputOn = () => phase === 'fight' || phase === 'won' || phase === 'lost';

/* ================= EFFECT HELPERS ================= */
function spark(x, y, n, col, spd, life, grav) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(.3, 1) * spd; parts.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.5, 1) * life, t: 0, col, g: grav === undefined ? 700 : grav, drag: 1.5, sz: rnd(1.2, 2.6) }); }
}
function dust(x, y, n) { for (let i = 0; i < n; i++) parts.push({ k: 'dot', x: x + rnd(-14, 14), y: y - 2, vx: rnd(-60, 60), vy: rnd(-60, -10), life: rnd(.3, .6), t: 0, col: '150,140,170', g: 0, drag: 2, sz: rnd(3, 6) }); }
function petals(x, y, n, spd) {
  for (let i = 0; i < n; i++) { const a = rnd(-Math.PI, 0), s = rnd(.2, 1) * spd; parts.push({ k: 'petal', x: x + rnd(-30, 30), y: y - rnd(0, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(1.4, 2.8), t: 0, g: 60, drag: .6, rot: rnd(0, 7), vr: rnd(-6, 6), sz: rnd(2.5, 4.5) }); }
}
function addArc(x, y, r, a0, a1, face, life, col, w) { fx.push({ k: 'arc', x, y, r, a0, a1, face, life, t: 0, col, w }); }
function addStreak(x, y, len, col, life) { fx.push({ k: 'streak', x, y, len, life: life || .13, t: 0, col }); }
function addRing(x, y, r0, r1, life, col, w) { fx.push({ k: 'ring', x, y, r0, r1, life, t: 0, col, w }); }
function addText(x, y, txt, col, size, life) { fx.push({ k: 'text', x, y, txt, col, size, life: life || 1, t: 0 }); }
function doShake(v) { shake = Math.max(shake, v); }
function doFlash(v, col) { screenFlash = Math.max(screenFlash, v); screenFlashCol = col || '255,255,255'; }

/* ================= PLAYER ================= */
function startAttack(idx) {
  const A = ATK[idx];
  P.state = 'attack'; P.t = 0; P.combo = idx; P.hitDone = false; P.fxDone = false; P.airAtk = P.y < GROUND - 2;
  P.st = Math.max(0, P.st - A.cost); P.stDelay = P.st <= 0 ? 1.1 : .7;
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0); if (dir) P.face = dir;
  buf.attack = 0;
}
function heroHit(A) {
  if (P.hitDone || B.state === 'dead' || B.state === 'intro') return;
  const lo = Math.min(P.x - P.face * 8, P.x + P.face * A.reach), hi = Math.max(P.x - P.face * 8, P.x + P.face * A.reach);
  const pb = GROUND - P.y;
  const bb = B.h; if (B.x + B.hw > lo && B.x - B.hw < hi && pb + 125 > bb && pb - 20 < bb + B.hh) { P.hitDone = true; hitBoss(120, P.combo === 2 ? .08 : .04); }
}
function hitBoss(dmg, stop) {
  if (B.state === 'dead' || B.state === 'intro') return;
  B.hp = Math.max(0, B.hp - dmg); B.flash = .09; B.ghostDelay = .6;
  hitstop = Math.max(hitstop, stop || .06); doShake(5); sfx('hit');
  const sx = B.x - B.face * 26, sy = GROUND - rnd(70, 110);
  spark(sx, sy, 14, '#ffe2a0', 420, .45); spark(sx, sy, 6, '#c68bff', 260, .5);
  addText(B.x + rnd(-20, 20), GROUND - 165, String(dmg), '#ffd98a', 22, .8);
  if (!B.rage && B.hp <= B.maxhp * .5 && B.hp > 0) {
    B.rage = true; musicIntensify(); const art = B.type === 'art';
    doFlash(.5, art ? '120,170,255' : '170,80,255'); doShake(16); sfx('roar');
    addText(B.x, GROUND - 200 - (art ? 30 : 0), art ? 'PHASE TWO  +40% DAMAGE' : 'THE SENTINEL IS ENRAGED', art ? '#a9cdff' : '#d9a8ff', 20, 2);
    addRing(B.x, GROUND - 70, 20, 300, .7, art ? 'rgba(140,190,255,.9)' : 'rgba(190,120,255,.9)', 8);
  }
  if (B.hp <= 0) bossDie();
}
function bossDie() {
  orbs.length = 0;
  B.state = 'dead'; B.dieT = 0; B.phase = ''; hitstop = .35; doShake(20); doFlash(.7, '255,255,255'); sfx('die');
  phase = 'won'; phaseT = 0;
}
function startDodge(dir) {
  P.state = 'dodge'; P.t = 0; P.dodgeDir = dir || P.face; P.face = P.dodgeDir; P.invuln = Math.max(P.invuln, .27);
  P.st = Math.max(0, P.st - 20); P.stDelay = .55; buf.dodge = 0; sfx('dodge'); dust(P.x, GROUND, 5);
}
function startAirDodge(dir) {
  P.state = 'airdash'; P.t = 0; P.airDodged = true; P.dodgeDir = dir || P.face; P.face = P.dodgeDir; P.invuln = Math.max(P.invuln, .24);
  P.st = Math.max(0, P.st - 20); P.stDelay = .55; buf.dodge = 0; P.vy = 0; sfx('dodge');
  spark(P.x, P.y - 55, 10, '#ffe2a0', 300, .3, 0);
}
function startParry() {
  P.state = 'parry'; P.t = 0; P.parrySucc = false; P.endT = .62; P.st = Math.max(0, P.st - 8); P.stDelay = .5; buf.parry = 0; P.vx *= .3;
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0); if (dir) P.face = dir;
  tone(700, .1, 'triangle', .06, 200);
}
function startPlunge() {
  P.state = 'plunge'; P.t = 0; P.vy = 1050; P.vx = 0; P.plungeHit = false; P.st = Math.max(0, P.st - 18); P.stDelay = .7; buf.attack = 0; sfx('plunge');
}
function startHeal() { P.state = 'heal'; P.t = 0; P.healed = false; buf.heal = 0; }
function startSkill1(dir) {
  P.state = 'skill1'; P.t = 0; P.skill1Fired = false; P.skill1CD = SKILL1_CD; buf.skill1 = 0;
  if (dir) P.face = dir; P.vx *= .3;
}
function fireSlash() {
  sfx('skill1');
  const pb = GROUND - P.y;
  slashes.push({ x: P.x + P.face * 30, y: P.y - 78, face: P.face, vx: P.face * 1500, life: 1.1, t: 0, hit: false, pb, rot: 0 });
  addArc(P.x, P.y - 82, 92, P.face > 0 ? -2.3 : -.85, P.face > 0 ? .85 : 2.3, P.face, .16, 'rgba(255,232,140,.95)', 10);
  spark(P.x + P.face * 26, P.y - 78, 16, '#fff3b0', 460, .4);
}
function startSkill2(dir) {
  P.state = 'skill2'; P.t = 0; P.skill2Fired = false; P.skill2Hit = false; P.skill2CD = SKILL2_CD; buf.skill2 = 0;
  if (dir) P.face = dir; P.vx = 0; sfx('charge');
}
function releaseSkill2() {
  sfx('skill2'); doShake(22); doFlash(.6, '255,170,90');
  const ox = P.x + P.face * 34, oy = P.y - 46, R = 200;
  addRing(ox, oy, 16, R, .5, 'rgba(255,200,120,.95)', 11); addRing(ox, oy, 8, R * .7, .4, 'rgba(255,90,40,.85)', 15);
  spark(ox, oy, 46, '#ffcf7a', 700, .7, 260); spark(ox, oy, 22, '#ff5a30', 520, .55, 300);
  dust(ox, GROUND, 20); petals(ox, GROUND, 30, 500);
  const reach = B.hw + 150, bb = B.h;
  const pb = GROUND - P.y;
  if (B.state !== 'dead' && B.state !== 'intro' && Math.abs(B.x - ox) < reach && pb + 140 > bb && pb - 30 < bb + B.hh) {
    P.skill2Hit = true; hitBoss(800, .16);
    if (B.state !== 'dead') { B.state = 'stunned'; B.stunT = 2.2; B.phase = ''; B.combo = null; B.hitDone = true; }
    addText(B.x, GROUND - (B.type === 'art' ? 195 : 175), 'STAGGERED', '#ffcf7a', 24, 1.1);
  }
}
function hurtPlayer(dmg, srcX, heavy) {
  if (P.state === 'dead' || P.invuln > 0) return false;
  if (P.state === 'block') {
    dmg = Math.round(dmg * .75);
    P.hp = Math.max(0, P.hp - dmg); P.ghostDelay = .6; P.invuln = heavy ? .6 : .35; P.blockFlash = .2;
    P.vx = (P.x < srcX ? -1 : 1) * (heavy ? 420 : 200);
    hitstop = Math.max(hitstop, heavy ? .09 : .05); doShake(heavy ? 10 : 5); sfx('block');
    spark(P.x + P.face * 26, P.y - 62, 14, '#cfe6ff', 430, .35); spark(P.x + P.face * 26, P.y - 62, 6, '#ffd98a', 300, .3);
    addText(P.x, P.y - 118, String(dmg), '#9fd0ff', 22, .8);
    if (P.hp <= 0) { P.state = 'dead'; P.deadT = 0; sfx('die'); phase = 'lost'; phaseT = 0; doShake(12); }
    return true;
  }
  P.hp = Math.max(0, P.hp - dmg); P.flash = .14; P.ghostDelay = .6; P.invuln = heavy ? .8 : .5;
  P.state = 'hurt'; P.t = 0; P.vx = (P.x < srcX ? -1 : 1) * (heavy ? 520 : 280); if (heavy) P.vy = -330;
  hitstop = Math.max(hitstop, heavy ? .13 : .08); doShake(heavy ? 16 : 9); sfx('hurt');
  spark(P.x, P.y - 55, 16, '#b3202a', 380, .5); spark(P.x, P.y - 55, 8, '#ffcf8a', 300, .4);
  addText(P.x, P.y - 118, String(dmg), '#ff6a5a', 24, .9);
  if (P.hp <= 0) { P.state = 'dead'; P.deadT = 0; sfx('die'); phase = 'lost'; phaseT = 0; doShake(12); }
  return true;
}
function parrySuccess(hx, hy) {
  P.parrySucc = true; P.endT = P.t + .22; P.st = Math.min(P.maxst, P.st + 30); P.parryFlash = .25;
  B.state = 'stunned'; B.stunT = 2.0; B.phase = ''; B.combo = null; B.hitDone = true;
  hitstop = .17; doShake(11); doFlash(.4, '255,235,190'); sfx('parry');
  spark(hx, hy, 30, '#fff2c8', 620, .6); spark(hx, hy, 14, '#ffb84a', 420, .5);
  addRing(hx, hy, 6, 90, .35, 'rgba(255,240,190,.95)', 5);
  addText(P.x, P.y - 130, 'PARRIED', '#ffe9a8', 26, 1.1);
}
function updatePlayer(dt) {
  const live = inputOn();
  const dir = live ? ((held.right ? 1 : 0) - (held.left ? 1 : 0)) : 0;
  if (!live) { buf.attack = buf.parry = buf.dodge = buf.jump = buf.heal = 0; }
  if (P.state === 'dead') { P.deadT += dt; P.vx *= .9; physics(dt); return; }
  P.t += dt; P.invuln = Math.max(0, P.invuln - dt); P.flash = Math.max(0, P.flash - dt); P.parryFlash = Math.max(0, P.parryFlash - dt); P.blockFlash = Math.max(0, P.blockFlash - dt); P.landT = Math.max(0, P.landT - dt);
  const grounded = P.y >= GROUND - .5;
  P.stride += (grounded ? Math.abs(P.vx) : 0) * dt * .05;
  if (P.stDelay > 0) P.stDelay -= dt;
  else if (P.state !== 'dodge' && P.state !== 'attack' && P.state !== 'airdash') P.st = Math.min(P.maxst, P.st + (P.state === 'free' ? 40 : P.state === 'block' ? 32 : 22) * dt);
  P.skill1CD = Math.max(0, P.skill1CD - dt); P.skill2CD = Math.max(0, P.skill2CD - dt);

  switch (P.state) {
    case 'free': {
      const target = dir * 250;
      P.vx += (target - P.vx) * Math.min(1, dt * (grounded ? 16 : 7));
      if (dir) P.face = dir;
      if (buf.jump > 0 && grounded) { P.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(P.x, GROUND, 4); }
      if (buf.dodge > 0 && P.st > 0 && (grounded || !P.airDodged)) { if (grounded) startDodge(dir); else startAirDodge(dir); }
      else if (buf.parry > 0 && grounded && P.st > 0) startParry();
      else if (buf.attack > 0 && P.st > 0) { if (!grounded && held.down) startPlunge(); else startAttack(0); }
      else if (buf.heal > 0 && grounded && P.flasks > 0 && P.hp < P.maxhp) startHeal();
      else if (buf.skill1 > 0 && grounded && P.skill1CD <= 0) startSkill1(dir);
      else if (buf.skill2 > 0 && grounded && P.skill2CD <= 0) startSkill2(dir);
      else if (held.block && grounded) { P.state = 'block'; P.t = 0; }
      break;
    }
    case 'attack': {
      const A = ATK[P.combo], tot = A.w + A.a + A.r;
      if (P.t < A.w + A.a) P.vx = P.airAtk ? P.vx * .98 : P.face * A.lunge / (A.w + A.a); else P.vx *= .8;
      if (!P.airAtk && B.state !== 'dead' && (B.x - P.x) * P.face > 0 && Math.abs(B.x - P.x) < 62) P.vx = 0;
      if (!P.fxDone && P.t >= A.w) {
        P.fxDone = true; sfx('swing');
        if (A.thrust) addStreak(P.x + P.face * 24, P.y - 64, P.face * (A.reach - 20), 'rgba(255,232,170,.95)');
        else addArc(P.x, P.y - 82, 84, A.a0, A.a1, P.face, .13, 'rgba(255,214,140,.9)', 9);
      }
      if (P.t >= A.w && P.t < A.w + A.a) heroHit(A);
      if (P.t >= A.w + A.a + A.r * .6 && buf.attack > 0 && P.st > 0 && P.combo < 2) { startAttack(P.combo + 1); break; }
      if (P.t >= A.w + A.a && buf.dodge > 0 && P.st > 0 && (grounded || !P.airDodged)) { if (grounded) startDodge(dir); else startAirDodge(dir); break; }
      if (P.t >= A.w + A.a && buf.parry > 0 && grounded && P.st > 0) { startParry(); break; }
      if (P.t >= tot) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'airdash': {
      const k = P.t / .26; P.vx = P.dodgeDir * 680 * (1 - k * .45); P.vy = 0;
      parts.push({ k: 'dot', x: P.x, y: P.y - rnd(30, 80), vx: 0, vy: 0, life: .28, t: 0, col: '255,224,160', g: 0, drag: 1, sz: rnd(4, 8) });
      if (P.t >= .26) { P.state = 'free'; P.t = 0; P.vx *= .45; P.vy = 80; }
      break;
    }
    case 'skill1': {
      P.vx *= .8;
      if (!P.skill1Fired && P.t >= .1) { P.skill1Fired = true; fireSlash(); }
      if (P.t >= .3) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'skill2': {
      P.vx *= .7;
      if (P.t < .55 && Math.random() < .7) parts.push({ k: 'dot', x: P.x + P.face * 14 + rnd(-6, 6), y: P.y - 62 + rnd(-8, 8), vx: rnd(-8, 8), vy: rnd(-32, -6), life: .35, t: 0, col: '255,150,60', g: 0, drag: 1, sz: rnd(2, 5) });
      if (!P.skill2Fired && P.t >= .55) { P.skill2Fired = true; releaseSkill2(); }
      if (P.t >= .82) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'block': {
      if (dir) P.face = dir;
      P.vx += (dir * 90 - P.vx) * Math.min(1, dt * 14);
      if (buf.jump > 0 && grounded) { P.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(P.x, GROUND, 4); P.state = 'free'; P.t = 0; break; }
      if (buf.dodge > 0 && P.st > 0) { startDodge(dir); break; }
      if (buf.parry > 0 && P.st > 0) { startParry(); break; }
      if (buf.attack > 0 && P.st > 0) { startAttack(0); break; }
      if (buf.heal > 0 && P.flasks > 0 && P.hp < P.maxhp) { startHeal(); break; }
      if (buf.skill1 > 0 && P.skill1CD <= 0) { startSkill1(dir); break; }
      if (buf.skill2 > 0 && P.skill2CD <= 0) { startSkill2(dir); break; }
      if (!held.block || !grounded) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'dodge': {
      const k = P.t / .34; P.vx = P.dodgeDir * 720 * (1 - k * .55);
      if (Math.random() < .5) dust(P.x - P.dodgeDir * 10, GROUND, 1);
      if (P.t >= .34) { P.state = 'free'; P.t = 0; P.vx *= .3; }
      break;
    }
    case 'parry': {
      P.vx *= .8;
      if (P.t >= P.endT) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'plunge': {
      P.vx = 0; P.vy = 1050;
      const pb = GROUND - P.y;
      if (!P.plungeHit && B.state !== 'dead' && B.state !== 'intro' && Math.abs(P.x - B.x) < B.hw + 18 && pb < B.h + B.hh + 4 && pb > B.h + 10) {
        P.plungeHit = true; hitBoss(120, .09); P.state = 'free'; P.t = 0; P.vy = -560; P.vx = -P.face * 120; spark(P.x, P.y, 10, '#ffe2a0', 400, .4);
      }
      break;
    }
    case 'hurt': {
      P.vx *= .92; if (P.t > .3) { P.state = 'free'; P.t = 0; }
      break;
    }
    case 'heal': {
      P.vx = dir * 60;
      if (!P.healed && P.t >= .5) {
        P.healed = true; P.flasks--; const before = P.hp; P.hp = Math.min(P.maxhp, P.hp + Math.round(P.maxhp * .7)); sfx('heal');
        addText(P.x, P.y - 125, '+' + Math.round(P.hp - before), '#8ef07a', 24, 1);
        for (let i = 0; i < 26; i++) parts.push({ k: 'dot', x: P.x + rnd(-16, 16), y: P.y - rnd(10, 80), vx: rnd(-20, 20), vy: rnd(-90, -30), life: rnd(.6, 1.1), t: 0, col: '140,240,120', g: 0, drag: 1, sz: rnd(2, 4) });
      }
      if (P.t >= .85) { P.state = 'free'; P.t = 0; }
      break;
    }
  }
  physics(dt);
  if (P.state === 'plunge' && P.y >= GROUND) {
    P.y = GROUND; P.vy = 0;
    sfx('boom'); doShake(9); dust(P.x, GROUND, 14); petals(P.x, GROUND, 14, 300); addRing(P.x, GROUND - 4, 8, 110, .3, 'rgba(255,225,160,.8)', 4);
    if (!P.plungeHit && B.state !== 'dead' && B.state !== 'intro' && Math.abs(P.x - B.x) < 120) { P.plungeHit = true; hitBoss(120, .09); }
    P.state = 'free'; P.t = 0;
  }
}
function physics(dt) {
  const wasAir = P.y < GROUND - 1;
  if (P.state !== 'plunge' && P.state !== 'airdash') P.vy += GRAV * dt;
  P.y += P.vy * dt; P.x = clamp(P.x + P.vx * dt, 40, WORLD - 40);
  if (P.y >= GROUND) { if (wasAir && P.vy > 300) { dust(P.x, GROUND, 6); P.landT = .14; } if (wasAir) P.airDodged = false; P.y = GROUND; P.vy = 0; }
}

/* ================= BOSS AI ================= */
function bossFace() { B.face = P.x >= B.x ? 1 : -1; }
function startBossAtk() { B.atk = B.combo.atks[B.ci]; B.phase = 'wind'; B.pt = 0; B.hitDone = false; }
function bossChoose() {
  const d = Math.abs(P.x - B.x), r = Math.random();
  let pick;
  if (d > 430) pick = r < .55 ? 'kame' : 'walk';
  else if (d > 210) pick = r < .55 ? 'combo' : r < .75 ? 'kame' : r < .87 ? 'explode' : 'walk';
  else pick = r < .65 ? 'combo' : r < .9 ? 'explode' : 'kame';
  if (pick === B.last && pick !== 'walk' && Math.random() < .75) pick = pick === 'combo' ? (d > 300 ? 'kame' : 'explode') : 'combo';
  B.last = pick;
  if (pick === 'walk') { B.cool = rnd(.3, .6); return; }
  if (pick === 'combo') {
    let i; do { i = Math.floor(Math.random() * COMBOS.length); } while (i === B.lastCombo);
    B.lastCombo = i; B.combo = COMBOS[i]; B.ci = 0; B.state = 'combo'; startBossAtk();
  } else if (pick === 'kame') {
    B.state = 'kame'; B.phase = 'charge'; B.pt = 0; B.beamHit = false; sfx('charge');
  } else {
    B.state = 'explode'; B.phase = 'charge'; B.pt = 0; B.expR = 0; sfx('charge');
  }
}
function bossStrike(a) {
  if (B.hitDone) return;
  const f = B.face, R = a.rect;
  const lo = Math.min(B.x + f * R.x0, B.x + f * R.x1), hi = Math.max(B.x + f * R.x0, B.x + f * R.x1);
  if (mode === 'coop') {
    for (const T of [CP1, CP2]) {
      if (!T || T.state === 'dead') continue;
      const pb = GROUND - T.y, pt = pb + 100, overY = pt > R.h0 && pb < R.h1;
      if (T.state === 'parry' && !T.parrySucc && T.t < PARRY_WIN && T.face === -f) {
        const pl = Math.min(T.x - 16, T.x + T.face * 34), pr = Math.max(T.x + 16, T.x + T.face * 34);
        if (pr > lo && pl < hi && overY) { coParrySuccess(T, (B.x + T.x) / 2 + T.face * 6, T.y - 66); return; }
      }
    }
    for (const T of [CP1, CP2]) {
      if (!T || T.state === 'dead' || T.invuln > 0) continue;
      const pb = GROUND - T.y, pt = pb + 100, overY = pt > R.h0 && pb < R.h1;
      if (T.x + 15 > lo && T.x - 15 < hi && overY) { if (coHurtPlayer(T, a.dmg ? bd(a.dmg) : 75, B.x, false)) B.hitDone = true; }
    }
    return;
  }
  const pb = GROUND - P.y, pt = pb + 100;
  const overY = pt > R.h0 && pb < R.h1;
  if (P.state === 'parry' && !P.parrySucc && P.t < PARRY_WIN && P.face === -f) {
    const pl = Math.min(P.x - 16, P.x + P.face * 34), pr = Math.max(P.x + 16, P.x + P.face * 34);
    if (pr > lo && pl < hi && overY) { parrySuccess((B.x + P.x) / 2 + P.face * 6, P.y - 66); return; }
  }
  if (P.x + 15 > lo && P.x - 15 < hi && overY) {
    if (P.invuln > 0) return;
    if (hurtPlayer(a.dmg ? bd(a.dmg) : 75, B.x, false)) B.hitDone = true;
  }
}
function bossSlashFx(a) {
  const f = B.face, art = B.type === 'art', sc = art ? 1.5 : 1.42, sy = GROUND - 79 * sc;
  if (a.type === 'thrust') addStreak(B.x + f * 30, GROUND - 80 * sc / 1.42 * 1.1, f * 200, 'rgba(200,140,255,.95)', .16);
  else { const K = BK[a.type]; addArc(B.x, sy, art ? 170 : 138, K.aw, K.a1, f, .2, art ? 'rgba(150,195,255,.92)' : 'rgba(184,110,255,.9)', 14); }
  sfx('bswing');
}
function updateBoss(dt) {
  B.flash = Math.max(0, B.flash - dt);
  if (B.ghostDelay > 0) B.ghostDelay -= dt; else if (B.ghost > B.hp) B.ghost = Math.max(B.hp, B.ghost - 700 * dt);
  if (P.ghostDelay > 0) P.ghostDelay -= dt; else if (P.ghost > P.hp) P.ghost = Math.max(P.hp, P.ghost - 260 * dt); else P.ghost = P.hp;
  B.moving = false;
  if (B.type === 'art') { updateArt(dt); B.x = clamp(B.x, 60, WORLD - 60); return; }
  const rage = B.rage, spd = rage ? 130 : 96;
  switch (B.state) {
    case 'intro':
      B.introFill = Math.min(1, phaseT / 1.6);
      if (!B.roared && phaseT > .5) { B.roared = true; sfx('roar'); doShake(14); addRing(B.x, GROUND - 60, 10, 280, .8, 'rgba(180,110,255,.8)', 6); petals(B.x, GROUND, 40, 420); }
      break;
    case 'idle': {
      bossFace();
      const dx = Math.abs(P.x - B.x);
      if (dx > 118 && B.cool > -5) { B.x += B.face * spd * dt; B.moving = true; B.stride += spd * dt * .06; }
      B.cool -= dt;
      if (B.cool <= 0 && phase === 'fight' && P.state !== 'dead') bossChoose();
      break;
    }
    case 'combo': {
      const a = B.atk; B.pt += dt;
      const wS = a.w * (rage ? .86 : 1);
      if (B.phase === 'wind') {
        if (B.pt < wS * .5) bossFace();
        if (B.pt > wS * .3 && Math.abs(P.x - B.x) > a.stop) B.x += B.face * (a.lunge / (wS * .7)) * dt;
        if (B.pt >= wS) { B.phase = 'act'; B.pt = 0; B.hitDone = false; bossSlashFx(a); }
      } else if (B.phase === 'act') {
        bossStrike(a);
        if (B.state !== 'combo') break;
        if (B.pt >= a.a) { B.phase = 'rec'; B.pt = 0; }
      } else {
        if (B.pt >= a.r * (rage ? .85 : 1)) {
          B.ci++;
          if (B.ci >= B.combo.atks.length) { B.state = 'idle'; B.cool = rnd(.55, 1.05) * (rage ? .65 : 1); }
          else startBossAtk();
        }
      }
      B.x = clamp(B.x, 60, WORLD - 60);
      break;
    }
    case 'kame': {
      B.pt += dt; const charge = rage ? .95 : 1.15, fireT = .36, rec = .85;
      const hx = B.x + B.face * 51, hy = GROUND - 51;
      if (B.phase === 'charge') {
        if (B.pt < charge * .65) bossFace();
        if (Math.random() < .9) { const a = rnd(0, TAU), rr = rnd(60, 110); parts.push({ k: 'gather', sx: hx + Math.cos(a) * rr, sy: hy + Math.sin(a) * rr, tx: hx, ty: hy, life: .4, t: 0, x: 0, y: 0 }); }
        if (B.pt >= charge) { B.phase = 'fire'; B.pt = 0; B.beamHit = false; sfx('beam'); doShake(10); }
      } else if (B.phase === 'fire') {
        doShake(6);
        const reach = Math.min(WORLD * 1.2, 4200 * B.pt + 40), f = B.face;
        const x0 = B.x + f * 40, x1 = x0 + f * reach;
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        if (mode === 'coop') {
          for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && T.x + 12 > lo && T.x - 12 < hi && (GROUND - T.y) < BEAM_H) coHurtPlayer(T, 200, B.x, true); }
        } else if (!B.beamHit && P.x + 12 > lo && P.x - 12 < hi && (GROUND - P.y) < BEAM_H && P.invuln <= 0 && P.state !== 'dead') {
          if (hurtPlayer(200, B.x, true)) B.beamHit = true;
        }
        if (Math.random() < .8) spark(x0 + f * rnd(0, Math.min(reach, 900)), GROUND - rnd(0, 10), 1, '#d9b8ff', 260, .35, 300);
        if (B.pt >= fireT) { B.phase = 'rec'; B.pt = 0; }
      } else if (B.pt >= rec) { B.state = 'idle'; B.cool = rnd(.7, 1.2) * (rage ? .7 : 1); }
      break;
    }
    case 'explode': {
      B.pt += dt; const charge = rage ? 1.0 : 1.2, burstT = .55, rec = .9;
      if (B.phase === 'charge') {
        B.expR = 250 * Math.min(1, B.pt / charge);
        if (Math.random() < .8) { const a = rnd(0, TAU), rr = rnd(100, 200); parts.push({ k: 'gather', sx: B.x + Math.cos(a) * rr, sy: GROUND - 70 + Math.sin(a) * rr * .8, tx: B.x, ty: GROUND - 70, life: .45, t: 0, x: 0, y: 0 }); }
        if (B.pt >= charge) {
          B.phase = 'burst'; B.pt = 0; sfx('boom'); doShake(24); doFlash(.65, '220,180,255'); hitstop = .08;
          addRing(B.x, GROUND - 70, 20, 270, .5, 'rgba(230,200,255,.95)', 10); addRing(B.x, GROUND - 70, 10, 200, .4, 'rgba(160,90,255,.8)', 14);
          spark(B.x, GROUND - 70, 60, '#e6c8ff', 800, .9, 200); petals(B.x, GROUND, 90, 700); dust(B.x, GROUND, 24);
          if (mode === 'coop') { for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && Math.hypot(T.x - B.x, (T.y - 50) - (GROUND - 70)) <= 250) coHurtPlayer(T, 200, B.x, true); } }
          else { const dist = Math.hypot(P.x - B.x, (P.y - 50) - (GROUND - 70)); if (dist <= 250 && P.invuln <= 0 && P.state !== 'dead') hurtPlayer(200, B.x, true); }
        }
      } else if (B.phase === 'burst') { if (B.pt >= burstT) { B.phase = 'rec'; B.pt = 0; } }
      else if (B.pt >= rec) { B.state = 'idle'; B.cool = rnd(.7, 1.2) * (rage ? .7 : 1); }
      break;
    }
    case 'stunned':
      B.stunT -= dt;
      if (B.stunT <= 0) { B.state = 'idle'; B.cool = .5; }
      break;
    case 'dead':
      B.dieT += dt;
      if (B.dieT > .8 && Math.random() < .9) { parts.push({ k: 'dot', x: B.x + rnd(-40, 40), y: GROUND - rnd(0, 140), vx: rnd(-20, 20), vy: rnd(-120, -40), life: rnd(.8, 1.6), t: 0, col: '190,120,255', g: -20, drag: .5, sz: rnd(2, 5) }); }
      if (B.dieT > 1 && Math.random() < .3) petals(B.x, GROUND - 60, 2, 200);
      break;
  }
  B.x = clamp(B.x, 60, WORLD - 60);
}

/* ================= FX UPDATE ================= */
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
    if (p.k === 'gather') continue;
    p.vy += (p.g || 0) * dt; if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.t >= f.life) fx.splice(i, 1); }
  for (const m of motes) { m.x += (m.vx + Math.sin(time * .6 + m.ph) * 6) * dt; m.y += (m.vy + Math.cos(time * .5 + m.ph) * 4) * dt; if (m.x < 0) m.x += WORLD; if (m.x > WORLD) m.x -= WORLD; if (m.y < 60) m.y = 520; if (m.y > 525) m.y = 70; }
}

/* ================= MAIN STEP ================= */
function step(dt) {
  if (mode === 'pvp') { pvpStep(dt); return; }
  if (mode === 'coop') { coopStep(dt); return; }
  savePrev();
  if (paused) return;
  time += dt;
  if (phase === 'title') { updateFx(dt); cam = clamp(P.x * .6 + B.x * .4 - W / 2, 0, WORLD - W); return; }
  phaseT += dt;
  if (hitstop > 0) { hitstop -= dt; updateFx(dt * .15); return; }
  for (const k in buf) buf[k] = Math.max(0, buf[k] - dt);
  if (phase === 'intro' && phaseT > 2.8) { phase = 'fight'; phaseT = 0; B.state = 'idle'; B.cool = .9; musicPlay(bossType === 'art' ? 'battleArt' : 'battleSent'); }
  updatePlayer(dt); updateBoss(dt); updateOrbs(dt); updateSlashes(dt); updateFx(dt);
  const tx = clamp(P.x * .62 + B.x * .38 - W / 2, 0, WORLD - W); cam += (tx - cam) * Math.min(1, dt * 4);
  shake *= .88; if (shake < .2) shake = 0; screenFlash = Math.max(0, screenFlash - dt * 1.6);
  if ((phase === 'lost' || phase === 'won') && !B.musicCut) { B.musicCut = true; musicStop(phase === 'won' ? 1.6 : 2.4); }
  if (phase === 'lost' && phaseT > 2.0) { phase = 'lostUI'; showEnd(false); musicPlay('title'); }
  if (phase === 'won' && phaseT > 4.2) { phase = 'wonUI'; showEnd(true); sfx('win'); musicPlay('victory'); }
}
function showEnd(win) {
  $('pauseBtn').classList.add('hide');
  const art = B.type === 'art';
  $('endTitle').textContent = win ? (art ? 'ARTORIAS HAS FALLEN' : 'THE SENTINEL HAS FALLEN') : 'THOU HAST FALLEN';
  $('endSub').textContent = win ? (art ? 'The Abysswalker rests at last.' : 'The lilies bloom once more in the moonlit nave.') : (art ? 'The abyss claims another. Rise and try again.' : 'The violet moon watches. Rise and try again.');
  $('endBtn').textContent = win ? 'Duel again' : 'Try again';
  $('end').className = 'ov ' + (win ? 'win' : 'lose');
}

/* ================= SPRITE RENDERER ================= */
const PAL_H = { dark: '#3b2410', mid: '#a8743a', light: '#f0c47f', trim: '#ffd98f', cloth: '#e3dac2', cloth2: '#b9ac8d', outline: '#150c06', leg: '#8a5a2c', legFar: '#5e3d1e', blade: '#e7dcc0', bladeD: '#a8926a', grip: '#5b3a1c', guard: '#c9903e' };
const PAL_B = { dark: '#070a18', mid: '#1b2647', light: '#42568f', trim: '#d1a94c', cloak: '#43206f', cloakDark: '#1e0d3a', outline: '#03040a', leg: '#141c38', legFar: '#0b1124', blade: '#b06aff', bladeD: '#4a1aa0', grip: '#2a1746', guard: '#c9a24a' };

function ik(sx, sy, tx, ty, l1, l2, dir) {
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy); const maxd = l1 + l2 - .01;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; tx = sx + dx; ty = sy + dy; }
  if (d < .001) d = .001;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = sx + dx * a / d, my = sy + dy * a / d;
  return { x: mx + dir * h * (-dy / d), y: my + dir * h * (dx / d), tx, ty };
}
function strokePoly(c, p) { c.beginPath(); c.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y); c.stroke(); }
function limb(c, pts, w, dark, mid, light) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = dark; c.lineWidth = w + 3; strokePoly(c, pts);
  c.strokeStyle = mid; c.lineWidth = w; strokePoly(c, pts);
  c.strokeStyle = light; c.lineWidth = w * .28; c.save(); c.translate(-w * .16, -w * .16); strokePoly(c, pts); c.restore();
}
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.4; c.stroke(); }
}
function drawSword(c, hx, hy, A, len, p, boss, glow) {
  c.save(); c.translate(hx, hy); c.rotate(A);
  c.fillStyle = p.grip; c.fillRect(-12, -2, 13, 4);
  c.fillStyle = p.guard; c.beginPath(); c.arc(-13, 0, 3.2, 0, TAU); c.fill();
  c.strokeStyle = p.outline; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(4, -6, 4, 0); c.quadraticCurveTo(4, 6, 0, 10); c.lineTo(-2, 7); c.lineTo(-2, -7); c.closePath(); c.fillStyle = p.guard; c.fill(); c.stroke();
  if (boss) { c.fillStyle = '#7d3ff0'; c.beginPath(); c.arc(1.5, 0, 2.2, 0, TAU); c.fill(); }
  const bw = boss ? 4.8 : 3.8;
  if (glow) { c.shadowColor = boss ? '#b46bff' : '#ffd28a'; c.shadowBlur = glow; }
  const g = c.createLinearGradient(0, -bw, 0, bw); g.addColorStop(0, p.bladeD); g.addColorStop(.5, p.blade); g.addColorStop(1, p.bladeD);
  c.fillStyle = g; c.beginPath(); c.moveTo(4, -bw); c.lineTo(len - 14, -bw); c.lineTo(len, 0); c.lineTo(len - 14, bw); c.lineTo(4, bw); c.closePath(); c.fill();
  c.shadowBlur = 0; c.strokeStyle = p.outline; c.lineWidth = 1; c.stroke();
  c.globalAlpha *= .65; c.strokeStyle = boss ? '#ecd2ff' : '#fff4d6'; c.lineWidth = 1; c.beginPath(); c.moveTo(9, 0); c.lineTo(len - 22, 0); c.stroke();
  if (boss) { c.globalAlpha *= .7; c.strokeStyle = '#2a0e58'; for (let i = 0; i < 6; i++) { const x = 16 + i * 10; c.beginPath(); c.moveTo(x, -2.4); c.lineTo(x + 3, 2.4); c.stroke(); } }
  c.restore();
}
function drawShield(c, x, y, r, k, glowing) {
  c.save(); c.translate(x, y); c.scale(lerp(.95, .5, k), 1);
  const g = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#f2cf98'); g.addColorStop(.6, '#b37a3c'); g.addColorStop(1, '#6a4220');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.strokeStyle = '#2a170a'; c.lineWidth = 1.8; c.stroke();
  c.strokeStyle = '#ffe0a0'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r * .82, 0, TAU); c.stroke();
  c.strokeStyle = '#5a3616'; c.lineWidth = 1.3;
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, r1 = r * .86, r2 = r * .96; c.beginPath(); c.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); c.stroke(); }
  c.fillStyle = '#93622f'; c.beginPath(); c.arc(0, 0, r * .56, 0, TAU); c.fill(); c.strokeStyle = '#ffe0a0'; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#ffe6b0'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * .22, Math.sin(a) * r * .22); c.lineTo(Math.cos(a) * r * .5, Math.sin(a) * r * .5); c.stroke(); }
  c.fillStyle = '#e9b866'; c.beginPath(); c.arc(0, 0, r * .2, 0, TAU); c.fill();
  if (glowing) { const gc = typeof glowing === 'string' ? glowing : '#ffd97a'; c.strokeStyle = gc; c.lineWidth = 3; c.shadowColor = gc; c.shadowBlur = 16; c.beginPath(); c.arc(0, 0, r * 1.1, 0, TAU); c.stroke(); }
  c.restore();
}

function drawKnight(c, o) {
  const p = o.pal, boss = o.kind === 'boss', t = o.t, run = o.run || 0, air = o.air, crouch = o.crouch || 0, lean = o.lean || 0;
  c.save();
  c.translate(o.x, o.y); c.scale(o.face * o.scale, o.scale); if (o.rot) c.rotate(o.rot);
  c.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  if (o.flash) c.filter = 'brightness(2.6) saturate(.35)';
  const hipY = -44 + crouch * .9;
  let fA, fB;
  if (air) { fA = { x: -7, y: -16 }; fB = { x: 11, y: -26 }; }
  else if (o.slide) { fA = { x: -16, y: -2 }; fB = { x: 22, y: -1 }; }
  else if (o.kneel) { fA = { x: -22, y: -2 }; fB = { x: 12, y: 0 }; }
  else {
    const ph = o.phase !== undefined ? o.phase : t * (o.runSpeed || 9), rx = 17 * run;
    fA = { x: -9 * (1 - run) + Math.sin(ph) * rx, y: -Math.max(0, Math.cos(ph)) * 10 * run };
    fB = { x: 9 * (1 - run) + Math.sin(ph + Math.PI) * rx, y: -Math.max(0, Math.cos(ph + Math.PI)) * 10 * run };
  }
  const drawLeg = (hx, f, far) => {
    const k = ik(hx, hipY, f.x, f.y, 23, 23, -1);
    limb(c, [{ x: hx, y: hipY }, { x: k.x, y: k.y }, { x: k.tx, y: k.ty }], 11, p.outline, far ? p.legFar : p.leg, p.light);
    c.fillStyle = p.dark; c.strokeStyle = p.outline; c.lineWidth = 1; c.beginPath(); c.ellipse(k.tx + 4, k.ty - 2, 9, 4.6, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = boss ? p.trim : p.light; c.beginPath(); c.arc(k.x + 2, k.y, 4.2, 0, TAU); c.fill(); c.strokeStyle = p.outline; c.stroke();
  };
  drawLeg(-4, fA, true);
  drawLeg(4, fB, false);

  // lower cloth
  const sw = Math.sin(t * 1.7) * 1.5 + run * -6 + (o.clothSway || 0);
  if (!boss) {
    poly(c, [[-9, hipY - 2], [-6, hipY - 2], [-13 + sw, hipY + 30], [-18 + sw, hipY + 34]], p.cloth2, p.outline, 1);
    poly(c, [[-7, hipY - 3], [12, hipY - 3], [15 + sw, hipY + 34], [-5 + sw, hipY + 38]], p.cloth, p.outline, 1.2);
    c.strokeStyle = p.trim; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, hipY); c.lineTo(5 + sw, hipY + 36); c.stroke();
    c.strokeStyle = 'rgba(150,120,70,.6)'; c.lineWidth = .8; c.beginPath(); c.moveTo(-3, hipY + 2); c.lineTo(-2 + sw, hipY + 34); c.moveTo(9, hipY + 2); c.lineTo(11 + sw, hipY + 34); c.stroke();
  } else {
    poly(c, [[-8, hipY - 3], [11, hipY - 3], [13 + sw, hipY + 30], [8 + sw, hipY + 27], [3 + sw, hipY + 33], [-3 + sw, hipY + 27], [-8 + sw, hipY + 32]], p.cloak, p.outline, 1.2);
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(-5 + i * 4, hipY - 1 + j * 5, .9, 0, TAU); c.fill(); }
  }

  // upper body
  c.save();
  c.translate(0, crouch); c.translate(0, -44); c.rotate(lean); c.translate(0, 44);

  if (boss) {
    const w1 = Math.sin(t * 3) * 3 + run * 9 + (o.capeBack || 0), w2 = Math.sin(t * 3 + 1) * 4 + run * 12 + (o.capeBack || 0) * 1.4;
    poly(c, [[-4, -85], [-15, -72], [-21 - w1, -46], [-27 - w2, -8], [-22 - w2, -1], [-18 - w1, -9], [-13 - w2 * .7, 0], [-8 - w1 * .5, -8], [-3, -2], [1, -44]], p.cloak, p.outline, 1.4);
    poly(c, [[-4, -80], [-12, -66], [-16 - w1 * .8, -40], [-20 - w2 * .8, -14], [-8, -10], [-2, -44]], p.cloakDark, null);
    // far arm (off hand) rests behind body
    if (!o.offTarget) {
      const S = { x: -5, y: -78 }, tgt = { x: -8 + Math.sin(t * 2) * .6, y: -52 };
      const e = ik(S.x, S.y, tgt.x, tgt.y, 17, 17, 1);
      limb(c, [S, { x: e.x, y: e.y }, { x: e.tx, y: e.ty }], 9.5, p.outline, p.mid, p.light);
      c.fillStyle = p.dark; c.beginPath(); c.arc(e.tx, e.ty, 4.6, 0, TAU); c.fill();
    }
  }
  if (!boss && o.shieldK === -1) drawShield(c, -12, -60, 19, 0, false);

  // torso
  const tg = c.createLinearGradient(-12, 0, 14, 0); tg.addColorStop(0, p.dark); tg.addColorStop(.5, p.mid); tg.addColorStop(1, p.light);
  c.beginPath(); c.moveTo(-10, -80); c.quadraticCurveTo(1, -89, 11, -80); c.quadraticCurveTo(16, -64, 10, -46); c.lineTo(-9, -46); c.quadraticCurveTo(-14, -64, -10, -80); c.closePath();
  c.fillStyle = tg; c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-9, -70); c.quadraticCurveTo(2, -66, 12, -70); c.moveTo(-9, -58); c.quadraticCurveTo(2, -55, 11, -58); c.stroke();
  if (boss) {
    c.fillStyle = p.trim; c.beginPath(); c.arc(6, -71, 4.6, 0, TAU); c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#b877ff'; c.beginPath(); c.arc(6, -71, 2.6, 0, TAU); c.fill();
    c.fillStyle = p.trim; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-5 + i * 3.8, -62, .9, 0, TAU); c.fill(); }
  } else {
    c.strokeStyle = p.trim; c.lineWidth = 1.3; c.beginPath(); c.arc(5, -66, 4.5, 0, TAU); c.moveTo(1, -66); c.lineTo(9, -66); c.moveTo(5, -70.5); c.lineTo(5, -61.5); c.stroke();
    c.strokeStyle = 'rgba(255,217,143,.55)'; c.beginPath(); c.moveTo(-7, -76); c.quadraticCurveTo(0, -72, 9, -76); c.stroke();
  }
  // belt
  c.fillStyle = boss ? '#1a1030' : p.dark; c.fillRect(-10, -50, 21, 5.5); c.strokeStyle = p.outline; c.lineWidth = 1; c.strokeRect(-10, -50, 21, 5.5);
  c.fillStyle = p.trim; c.beginPath(); c.arc(1, -47.3, 3.4, 0, TAU); c.fill(); c.stroke();

  // neck + head
  c.fillStyle = p.dark; c.fillRect(-2, -87, 7, 8);
  if (!boss) {
    c.strokeStyle = p.trim; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -105, 14, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
    for (let i = 0; i < 7; i++) { const a = Math.PI * 1.08 + i * (.82 * Math.PI / 6); c.beginPath(); c.moveTo(Math.cos(a) * 14, -105 + Math.sin(a) * 14); c.lineTo(Math.cos(a) * 19.5, -105 + Math.sin(a) * 19.5); c.stroke(); }
    const hg = c.createLinearGradient(-9, -110, 13, -84); hg.addColorStop(0, p.light); hg.addColorStop(.55, p.mid); hg.addColorStop(1, p.dark);
    c.beginPath(); c.moveTo(-9, -87); c.quadraticCurveTo(-11, -107, 2, -109); c.quadraticCurveTo(14, -107, 14, -93); c.lineTo(12, -84); c.lineTo(-6, -84); c.closePath();
    c.fillStyle = hg; c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#0a0705'; c.fillRect(3, -96, 11, 2.8);
    c.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i < 3; i++) c.fillRect(6 + i * 2.6, -91, 1.2, 4);
    c.strokeStyle = p.trim; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-8, -100); c.quadraticCurveTo(3, -102, 14, -98); c.stroke();
    c.strokeStyle = p.light; c.beginPath(); c.moveTo(-6, -105); c.quadraticCurveTo(2, -109, 10, -106); c.stroke();
  } else {
    poly(c, [[-13, -78], [-14, -104], [-2, -115], [10, -114], [15, -98], [10, -88], [-2, -82]], p.cloakDark, p.outline, 1.5);
    poly(c, [[-11, -80], [-11, -102], [-3, -111], [4, -108], [-2, -90]], '#2b1352', null);
    poly(c, [[3, -104], [12, -105], [21, -96], [23, -89], [14, -88], [5, -88]], '#080b1a', p.outline, 1.2);
    c.fillStyle = '#e0b3ff'; c.shadowColor = '#c07bff'; c.shadowBlur = 9;
    c.beginPath(); c.ellipse(9.5, -98, 2.8, 1.5, -.15, 0, TAU); c.fill(); c.beginPath(); c.ellipse(15, -96.5, 2.2, 1.2, -.15, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = p.trim; c.lineWidth = 1; c.beginPath(); c.moveTo(-12, -84); c.quadraticCurveTo(0, -80, 11, -87); c.stroke();
  }
  // pauldron
  const pr = boss ? 13 : 10.5, pg = c.createRadialGradient(-2, -83, 1, 2, -78, pr + 2);
  pg.addColorStop(0, p.light); pg.addColorStop(.7, p.mid); pg.addColorStop(1, p.dark);
  c.fillStyle = pg; c.beginPath(); c.arc(1, -78, pr, 0, TAU); c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = p.trim; c.lineWidth = 1.2; c.beginPath(); c.arc(1, -78, pr - 3, .3, 2.6); c.stroke();
  if (boss) { c.fillStyle = p.trim; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.arc(1 + Math.cos(a) * (pr - 1.6), -78 + Math.sin(a) * (pr - 1.6), .9, 0, TAU); c.fill(); } }

  // shield (hero)
  if (!boss && o.shieldK !== -1) {
    const k = o.shieldK || 0;
    drawShield(c, lerp(11, 27, k), lerp(-58, -68, k), lerp(19, 22, k), k, o.shieldGlow);
  }
  // off-hand arm (front)
  if (o.offTarget) {
    const S = { x: 2, y: -78 }, e = ik(S.x, S.y, o.offTarget.x, o.offTarget.y, 17, 17, 1);
    limb(c, [S, { x: e.x, y: e.y }, { x: e.tx, y: e.ty }], 9.5, p.outline, p.mid, p.light);
    c.fillStyle = p.dark; c.beginPath(); c.arc(e.tx, e.ty, 5, 0, TAU); c.fill(); c.strokeStyle = p.trim; c.lineWidth = 1; c.stroke();
  }
  if (o.drink > 0) {
    const fx0 = 16, fy0 = -92;
    c.save(); c.translate(fx0, fy0); c.rotate(-.9 * Math.min(1, o.drink)); 
    c.fillStyle = '#8bf07a'; c.strokeStyle = p.outline; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 4, 5, 6, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d9d0b8'; c.fillRect(-2, -5, 4, 5); c.strokeRect(-2, -5, 4, 5);
    c.fillStyle = '#7a4a22'; c.fillRect(-2.6, -8, 5.2, 3.4);
    c.restore();
  }
  // sword arm + sword
  const S = { x: 3, y: -79 }, R = o.handR === undefined ? 28 : o.handR, A = o.swordA;
  const hand = { x: S.x + Math.cos(A) * R, y: S.y + Math.sin(A) * R };
  const el = ik(S.x, S.y, hand.x, hand.y, 17, 17, 1);
  limb(c, [S, { x: el.x, y: el.y }, { x: el.tx, y: el.ty }], 9.5, p.outline, p.mid, p.light);
  drawSword(c, el.tx, el.ty, A, boss ? 86 : 64, p, boss, o.glow || 0);
  c.fillStyle = p.dark; c.strokeStyle = p.trim; c.lineWidth = 1; c.beginPath(); c.arc(el.tx, el.ty, 5, 0, TAU); c.fill(); c.stroke();
  c.restore();
  c.restore();
}

function heroObj() {
  const air = P.y < GROUND - 3;
  const o = { kind: 'hero', pal: PAL_H, scale: 1.05, x: P.x, y: P.y, face: P.face, t: time, run: 0, air, swordA: 1.3, handR: 28, crouch: 0, lean: 0, shieldK: 0, flash: P.flash > 0, alpha: 1, glow: 0, runSpeed: 10, clothSway: 0, phase: P.stride };
  o.run = (P.state === 'free' && !air) ? Math.min(1, Math.abs(P.vx) / 240) : 0;
  o.swordA = 1.3 + Math.sin(time * 2) * .03 - o.run * .35;
  o.lean = o.run * .09; o.crouch = (P.state === 'free' && !air) ? 9 * (P.landT / .14) : 0;
  if (P.invuln > 0 && P.state !== 'dodge' && Math.floor(time * 30) % 2) o.alpha = .5;
  switch (P.state) {
    case 'attack': {
      const A = ATK[P.combo], t = P.t; let a;
      if (t < A.w) a = lerp(1.3, A.a0, easeOut(t / A.w));
      else if (t < A.w + A.a) { const k = (t - A.w) / A.a; a = lerp(A.a0, A.a1, ease(k)); o.lean = .16 * ease(k); if (A.thrust) o.handR = lerp(12, 38, k); o.glow = 14; }
      else { const k = Math.min(1, (t - A.w - A.a) / A.r); a = lerp(A.a1, 1.3, k * k); o.lean = .16 * (1 - k); if (A.thrust) o.handR = lerp(38, 28, k); }
      o.swordA = a; o.run = 0; break;
    }
    case 'dodge': o.slide = true; o.crouch = 22; o.lean = .6; o.swordA = 2.7; o.run = 0; o.air = false; break;
    case 'parry': o.shieldK = Math.min(1, P.t / .07); o.swordA = 2.3; o.lean = .06; o.shieldGlow = P.t < PARRY_WIN && !P.parrySucc || P.parryFlash > 0; o.run = 0; break;
    case 'hurt': o.lean = -.28; o.swordA = 1.9; o.run = 0; break;
    case 'airdash': o.air = true; o.lean = .55; o.swordA = 2.6; o.run = 0; o.clothSway = -8; break;
    case 'block': o.shieldK = .8; o.swordA = 2.2; o.lean = .04; o.crouch = 4; o.run = Math.min(1, Math.abs(P.vx) / 120) * .5; o.shieldGlow = P.blockFlash > 0 ? '#bfe0ff' : false; break;
    case 'heal': o.drink = Math.min(1, P.t / .5); o.crouch = 5; o.lean = .1; o.shieldK = -1; o.offTarget = { x: 14, y: -88 }; o.swordA = 1.55; o.run = 0; break;
    case 'skill1': { const k = clamp(P.t / .3, 0, 1); o.swordA = k < .33 ? lerp(1.3, -2.1, easeOut(k / .33)) : k < .5 ? lerp(-2.1, .9, (k - .33) / .17) : lerp(.9, 1.3, (k - .5) / .5); o.lean = .1 * Math.sin(k * Math.PI); o.glow = k < .5 ? 16 : 0; o.run = 0; break; }
    case 'skill2': {
      const chargeT = .55, k = Math.min(1, P.t / chargeT);
      if (P.t < chargeT) { o.crouch = 6 * k; o.lean = -.08 * k; o.swordA = lerp(1.3, 1.05, k); o.shieldK = -1; o.offTarget = { x: lerp(6, -8, k), y: lerp(-70, -56, k) }; o.glow = 4 + 14 * k; }
      else { const k2 = Math.min(1, (P.t - chargeT) / .27); o.lean = .28 * (1 - k2); o.swordA = lerp(-.3, 1.3, k2); o.offTarget = { x: 10, y: -60 }; o.glow = 18 * (1 - k2); }
      o.run = 0; break;
    }
    case 'plunge': o.swordA = 1.5; o.lean = .12; o.handR = 30; o.air = true; break;
    case 'dead': o.rot = -Math.min(1.5, P.deadT * 3.5); o.run = 0; o.alpha = clamp(1 - (P.deadT - 1) * .8, .25, 1); break;
    case 'free': if (air) { o.swordA = 1.1; o.lean = .05; } break;
  }
  return o;
}
function bossObj() {
  const o = { kind: 'boss', pal: PAL_B, scale: 1.42, x: B.x, y: B.y, face: B.face, t: time, run: B.moving ? .5 : 0, air: false, swordA: 1.35 + Math.sin(time * 1.6) * .03, handR: 28, crouch: 0, lean: 0, flash: B.flash > 0, alpha: 1, glow: B.rage ? 10 : 3, runSpeed: 7, phase: B.stride };
  if (B.moving) o.runSpeed = B.rage ? 9 : 7;
  switch (B.state) {
    case 'intro': {
      const k = clamp((phaseT - .4) / .5, 0, 1) * (1 - clamp((phaseT - 1.9) / .6, 0, 1));
      o.swordA = lerp(1.5, -1.9, k); o.lean = -.2 * k; o.offTarget = k > .05 ? { x: lerp(-8, 20, k), y: lerp(-52, -118, k) } : null; o.capeBack = 8 * k; o.glow = 8 + 14 * k; break;
    }
    case 'combo': {
      const a = B.atk, K = BK[a.type], wS = a.w * (B.rage ? .86 : 1); let ang;
      if (B.phase === 'wind') { const k = Math.min(1, B.pt / wS); ang = lerp(1.35, K.aw, easeOut(k)); o.lean = K.wl * k; o.handR = lerp(28, K.rw, k); o.glow = 6 + k * 10; o.capeBack = 5 * k; }
      else if (B.phase === 'act') { const k = Math.min(1, B.pt / a.a); ang = lerp(K.aw, K.a1, ease(k)); o.lean = lerp(K.wl, K.sl, k); o.handR = lerp(K.rw, K.rs, k); o.glow = 22; o.capeBack = 10; }
      else { const k = Math.min(1, B.pt / a.r); ang = lerp(K.a1, 1.35, k * k); o.lean = K.sl * (1 - k); o.handR = lerp(K.rs, 28, k); }
      o.swordA = ang; o.run = 0; break;
    }
    case 'kame': {
      const charge = B.rage ? .95 : 1.15, k = B.phase === 'charge' ? B.pt / charge : 1;
      o.crouch = 26 * Math.min(1, k * 1.6); o.lean = B.phase === 'fire' ? .28 : lerp(-.1, .12, k); o.swordA = 1.55; o.handR = 28;
      o.offTarget = { x: 36, y: -62 + o.crouch * 0 }; o.glow = 8 + 10 * k; o.capeBack = 8 + 8 * k; o.run = 0; break;
    }
    case 'explode': {
      const charge = B.rage ? 1.0 : 1.2;
      if (B.phase === 'charge') { const k = B.pt / charge; o.swordA = lerp(1.35, -1.75, easeOut(Math.min(1, k * 2))); o.offTarget = { x: lerp(-8, 8, k), y: lerp(-52, -126, easeOut(Math.min(1, k * 2))) }; o.crouch = 8 * k; o.lean = -.12; o.glow = 8 + 16 * k; o.capeBack = 10 * k; o.shakeX = Math.sin(time * 70) * 1.2 * k; }
      else { const k = Math.min(1, B.pt / .5); o.swordA = lerp(-1.75, .5, easeOut(Math.min(1, k * 4))); o.offTarget = { x: -14, y: -80 }; o.lean = .25 * (1 - k); o.glow = 20; o.capeBack = 14; }
      o.run = 0; break;
    }
    case 'stunned': o.kneel = true; o.crouch = 26; o.lean = .32; o.swordA = 1.75; o.handR = 26; o.glow = 0; o.run = 0; o.shakeX = Math.sin(time * 40) * .8; break;
    case 'dead': {
      const k = Math.min(1, B.dieT / 1.2); o.kneel = k < 1; o.crouch = 26 * Math.min(1, k * 3); o.lean = .32 + k * .3; o.swordA = 1.75; o.glow = 0; o.run = 0;
      o.alpha = clamp(1 - (B.dieT - 1.2) / 2.4, 0, 1); if (B.dieT > 1.2) o.flash = Math.floor(time * 20) % 2 === 0; break;
    }
  }
  if (o.shakeX) o.x += o.shakeX;
  return o;
}

/* ================= ARTORIAS (boss 2) ================= */
const PAL_A = { dark: '#2a2d3a', mid: '#7d8395', light: '#cfd3e0', trim: '#a9b0c6', outline: '#090a11', leg: '#6a7081', legFar: '#43485a', cloak: '#2b58cf', cloakDark: '#173080', hair: '#121716', belt: '#7a4a2a', gold: '#c9a45a' };
const RECT_A = {
  sweep: { x0: 8, x1: 215, h0: 0, h1: 65 },
  over: { x0: 8, x1: 190, h0: 0, h1: 170 },
  rise: { x0: -10, x1: 195, h0: 0, h1: 170 }
};
const STOP_A = { sweep: 120, over: 112, rise: 112 };
const mkAA = (type, w, a, r, lunge) => ({ type, w, a, r, lunge, rect: RECT_A[type], stop: STOP_A[type], dmg: 100 });
const COMBOS_A = [
  { name: 'Twin Swing', atks: [mkAA('over', .60, .13, .30, 80), mkAA('sweep', .46, .13, .95, 70)] },
  { name: 'Cross Swing', atks: [mkAA('sweep', .55, .13, .28, 80), mkAA('rise', .48, .13, .95, 60)] },
  { name: 'Triple Swing', atks: [mkAA('sweep', .52, .13, .26, 70), mkAA('over', .40, .13, .28, 70), mkAA('rise', .56, .13, 1.0, 60)] },
  { name: 'Abyss Triple', atks: [mkAA('over', .58, .13, .30, 80), mkAA('rise', .36, .13, .26, 60), mkAA('sweep', .66, .13, 1.05, 80)] }
];
// Phase 2 (below half health) raises every Artorias damage number by 40%.
function bd(base) { return Math.round(base * (B.type === 'art' && B.rage ? 1.4 : 1)); }
function cropFrac(img, fx, fy, fw, fh, x, y, s) {
  if (img.complete && img.naturalWidth) {
    const w = img.naturalWidth, h = img.naturalHeight;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(img, fx * w, fy * h, fw * w, fh * h, x, y, s, s); ctx.imageSmoothingEnabled = true;
  } else { ctx.fillStyle = '#221a2a'; ctx.fillRect(x, y, s, s); }
}
function artChoose() {
  const d = Math.abs(P.x - B.x), r = Math.random();
  let pick;
  if (d > 420) pick = r < .35 ? 'rush' : r < .65 ? 'jump' : r < .8 ? 'explode' : 'walk';
  else if (d > 190) pick = r < .30 ? 'combo' : r < .55 ? 'jump' : r < .78 ? 'rush' : 'explode';
  else pick = r < .48 ? 'combo' : r < .68 ? 'explode' : r < .84 ? 'jump' : 'rush';
  if (pick === B.last && pick !== 'walk' && Math.random() < .7) pick = pick === 'combo' ? (d > 300 ? 'jump' : 'explode') : 'combo';
  B.last = pick;
  if (pick === 'walk') { B.cool = rnd(.3, .6); return; }
  if (pick === 'combo') {
    const three = Math.random() < .5; let i;
    do { i = (three ? 2 : 0) + Math.floor(Math.random() * 2); } while (i === B.lastCombo);
    B.lastCombo = i; B.combo = COMBOS_A[i]; B.ci = 0; B.state = 'combo'; startBossAtk();
  } else if (pick === 'jump') {
    B.state = 'jump'; B.phase = 'crouch'; B.pt = 0; B.jn = Math.random() < .45 ? 2 : 1; B.jfirst = true; B.h = 0;
  } else if (pick === 'rush') {
    B.state = 'rush'; B.phase = 'wind'; B.pt = 0; B.rn = Math.random() < .5 ? 2 : 1; B.rfirst = true;
  } else {
    B.state = 'explode'; B.phase = 'charge'; B.pt = 0; B.expR = 0; sfx('charge');
  }
}
function artSlam() {
  sfx('boom'); doShake(15); dust(B.x, GROUND, 14); petals(B.x, GROUND, 24, 420);
  addRing(B.x, GROUND - 4, 10, 190, .4, 'rgba(160,200,255,.9)', 7);
  spark(B.x + B.face * 100, GROUND - 10, 20, '#bcd8ff', 500, .5);
  const f = B.face, lo = Math.min(B.x - f * 40, B.x + f * 205), hi = Math.max(B.x - f * 40, B.x + f * 205);
  if (mode === 'coop') { for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && T.x + 15 > lo && T.x - 15 < hi && (GROUND - T.y) < 170) coHurtPlayer(T, bd(200), B.x, true); } return; }
  if (P.x + 15 > lo && P.x - 15 < hi && (GROUND - P.y) < 170 && P.invuln <= 0 && P.state !== 'dead') hurtPlayer(bd(200), B.x, true);
}
function artBlast() {
  sfx('boom'); doShake(24); doFlash(.65, '190,215,255'); hitstop = .08;
  addRing(B.x, GROUND - 70, 20, 270, .5, 'rgba(210,230,255,.95)', 10); addRing(B.x, GROUND - 70, 10, 200, .4, 'rgba(90,140,255,.8)', 14);
  spark(B.x, GROUND - 70, 60, '#cfe2ff', 800, .9, 200); petals(B.x, GROUND, 90, 700); dust(B.x, GROUND, 24);
  if (mode === 'coop') { for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && Math.hypot(T.x - B.x, (T.y - 50) - (GROUND - 70)) <= 250) coHurtPlayer(T, bd(300), B.x, true); } }
  else { const dist = Math.hypot(P.x - B.x, (P.y - 50) - (GROUND - 70)); if (dist <= 250 && P.invuln <= 0 && P.state !== 'dead') hurtPlayer(bd(300), B.x, true); }
  // small energy balls flying off in different directions (50 damage each)
  const n = B.rage ? 18 : 14;
  for (let i = 0; i < n; i++) {
    let o;
    if (i < 4) { const dir = i % 2 ? 1 : -1; o = { x: B.x, y: GROUND - 26 - (i > 1 ? 24 : 0), vx: dir * rnd(430, 540), vy: 0, g: 0 }; }
    else { const a = -rnd(.12, Math.PI - .12), s = rnd(300, 620); o = { x: B.x, y: GROUND - 70, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 800 }; }
    o.r = 12; o.life = 4; o.t = 0; o.dmg = bd(50); orbs.push(o);
  }
}
function updateArtCombo(dt) {
  const a = B.atk, rage = B.rage; B.pt += dt;
  const wS = a.w * (rage ? .86 : 1);
  if (B.phase === 'wind') {
    if (B.pt < wS * .5) bossFace();
    if (B.pt > wS * .3 && Math.abs(P.x - B.x) > a.stop) B.x += B.face * (a.lunge / (wS * .7)) * dt;
    if (B.pt >= wS) { B.phase = 'act'; B.pt = 0; B.hitDone = false; bossSlashFx(a); }
  } else if (B.phase === 'act') {
    bossStrike(a);
    if (B.state !== 'combo') return;
    if (B.pt >= a.a) { B.phase = 'rec'; B.pt = 0; }
  } else if (B.pt >= a.r * (rage ? .85 : 1)) {
    B.ci++;
    if (B.ci >= B.combo.atks.length) { B.state = 'idle'; B.cool = rnd(.5, .95) * (rage ? .65 : 1); }
    else startBossAtk();
  }
}
function updateArt(dt) {
  const rage = B.rage, spd = rage ? 150 : 112;
  if (rage && B.state !== 'dead' && Math.random() < .5) parts.push({ k: 'dot', x: B.x + rnd(-30, 30), y: GROUND - B.h - rnd(0, 150), vx: rnd(-15, 15), vy: rnd(-90, -30), life: rnd(.5, 1), t: 0, col: '130,180,255', g: 0, drag: 1, sz: rnd(2, 4) });
  switch (B.state) {
    case 'intro':
      B.introFill = Math.min(1, phaseT / 1.6);
      if (!B.roared && phaseT > .5) { B.roared = true; sfx('roar'); doShake(14); addRing(B.x, GROUND - 60, 10, 280, .8, 'rgba(140,190,255,.8)', 6); petals(B.x, GROUND, 40, 420); }
      break;
    case 'idle':
      bossFace();
      if (Math.abs(P.x - B.x) > 130) { B.x += B.face * spd * dt; B.moving = true; B.stride += spd * dt * .06; }
      B.cool -= dt;
      if (B.cool <= 0 && phase === 'fight' && P.state !== 'dead') artChoose();
      break;
    case 'combo': updateArtCombo(dt); break;
    case 'jump': {   // Lion's Claw style leap-and-slam, once or twice in a row
      B.pt += dt;
      const durC = B.jfirst ? (rage ? .45 : .55) : .26;
      if (B.phase === 'crouch') {
        if (B.pt < durC * .75) bossFace();
        if (B.pt >= durC) { B.phase = 'air'; B.pt = 0; B.jx0 = B.x; B.jx1 = clamp(P.x - B.face * 75, 80, WORLD - 80); sfx('roar'); dust(B.x, GROUND, 10); }
      } else if (B.phase === 'air') {
        const T = rage ? .52 : .62, k = Math.min(1, B.pt / T);
        B.x = lerp(B.jx0, B.jx1, k); B.h = 4 * 240 * k * (1 - k);
        if (k >= 1) { B.phase = 'slam'; B.pt = 0; B.h = 0; artSlam(); }
      } else if (B.phase === 'slam') {
        if (B.pt >= .22) { B.jn--; B.jfirst = false; if (B.jn > 0) { B.phase = 'crouch'; B.pt = 0; } else { B.phase = 'rec'; B.pt = 0; } }
      } else if (B.pt >= (rage ? .65 : .85)) { B.state = 'idle'; B.cool = rnd(.6, 1.1) * (rage ? .65 : 1); B.h = 0; }
      break;
    }
    case 'rush': {   // sword-first charge, once or twice in a row
      B.pt += dt;
      const windT = B.rfirst ? (rage ? .42 : .55) : .24;
      if (B.phase === 'wind') {
        if (B.pt < windT * .8) bossFace();
        if (B.pt >= windT) { B.phase = 'dash'; B.pt = 0; B.hitDone = false; B.rdir = B.face; B.rdist = Math.max(420, Math.abs(P.x - B.x) + 160); B.rmoved = 0; sfx('bswing'); doShake(6); }
      } else if (B.phase === 'dash') {
        const stepD = 1250 * dt; B.x += B.rdir * stepD; B.rmoved += stepD;
        parts.push({ k: 'dot', x: B.x, y: GROUND - rnd(20, 140), vx: 0, vy: 0, life: .3, t: 0, col: '150,195,255', g: 0, drag: 1, sz: rnd(6, 12) });
        if (!B.hitDone) {
          const lo = Math.min(B.x - B.rdir * 20, B.x + B.rdir * 165), hi = Math.max(B.x - B.rdir * 20, B.x + B.rdir * 165);
          if (mode === 'coop') {
            for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && T.x + 15 > lo && T.x - 15 < hi && (GROUND - T.y) < 112) { if (coHurtPlayer(T, bd(150), B.x, true)) B.hitDone = true; } }
          } else if (P.state !== 'dead') {
            const pb = GROUND - P.y;
            if (P.x + 15 > lo && P.x - 15 < hi && pb < 112 && P.invuln <= 0) { if (hurtPlayer(bd(150), B.x, true)) B.hitDone = true; }
          }
        }
        if (B.rmoved >= B.rdist || B.pt > .5 || B.x <= 70 || B.x >= WORLD - 70) { B.phase = 'rec'; B.pt = 0; }
      } else {
        const recT = B.rn > 1 ? .12 : .8;
        if (B.pt >= recT) { B.rn--; B.rfirst = false; if (B.rn > 0) { B.phase = 'wind'; B.pt = 0; } else { B.state = 'idle'; B.cool = rnd(.6, 1.1) * (rage ? .65 : 1); } }
      }
      break;
    }
    case 'explode': {   // blast (300) followed by energy balls (50 each)
      B.pt += dt; const charge = rage ? .95 : 1.15, burstT = .5, rec = .9;
      if (B.phase === 'charge') {
        B.expR = 250 * Math.min(1, B.pt / charge);
        if (Math.random() < .8) { const a = rnd(0, TAU), rr = rnd(100, 200); parts.push({ k: 'gather', sx: B.x + Math.cos(a) * rr, sy: GROUND - 70 + Math.sin(a) * rr * .8, tx: B.x, ty: GROUND - 70, life: .45, t: 0, x: 0, y: 0, gc: '170,205,255' }); }
        if (B.pt >= charge) { B.phase = 'burst'; B.pt = 0; artBlast(); }
      } else if (B.phase === 'burst') { if (B.pt >= burstT) { B.phase = 'rec'; B.pt = 0; } }
      else if (B.pt >= rec) { B.state = 'idle'; B.cool = rnd(.7, 1.2) * (rage ? .65 : 1); }
      break;
    }
    case 'stunned':
      B.stunT -= dt;
      if (B.stunT <= 0) { B.state = 'idle'; B.cool = .5; }
      break;
    case 'dead':
      B.dieT += dt;
      if (B.dieT > .8 && Math.random() < .9) parts.push({ k: 'dot', x: B.x + rnd(-40, 40), y: GROUND - rnd(0, 150), vx: rnd(-20, 20), vy: rnd(-120, -40), life: rnd(.8, 1.6), t: 0, col: '150,195,255', g: -20, drag: .5, sz: rnd(2, 5) });
      if (B.dieT > 1 && Math.random() < .3) petals(B.x, GROUND - 60, 2, 200);
      break;
  }
}
function updateSlashes(dt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    const p = slashes[i]; p.t += dt; p.x += p.vx * dt; p.rot += dt * 26;
    if (Math.random() < .8) parts.push({ k: 'dot', x: p.x - p.face * 14, y: p.y + rnd(-6, 6), vx: -p.face * 40, vy: rnd(-8, 8), life: .22, t: 0, col: '255,224,140', g: 0, drag: 2, sz: rnd(3, 6) });
    let dead = p.t > p.life || p.x < -60 || p.x > WORLD + 60;
    if (!p.hit && B.state !== 'dead' && B.state !== 'intro') {
      const lo = Math.min(p.x - 18, p.x + 18), hi = Math.max(p.x - 18, p.x + 18);
      if (B.x + B.hw > lo && B.x - B.hw < hi && p.pb + 125 > B.h && p.pb - 20 < B.h + B.hh) {
        p.hit = true; dead = true; hitBoss(300, .1);
        spark(p.x, p.y, 26, '#fff3b0', 560, .5); addRing(p.x, p.y, 6, 70, .3, 'rgba(255,232,140,.9)', 5);
      }
    }
    if (dead) slashes.splice(i, 1);
  }
}
function updateOrbs(dt) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.t += dt; o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt;
    if (Math.random() < .6) parts.push({ k: 'dot', x: o.x, y: o.y, vx: 0, vy: 0, life: .25, t: 0, col: '150,195,255', g: 0, drag: 1, sz: 5 });
    let dead = o.t > o.life || o.x < 0 || o.x > WORLD || (o.g > 0 && o.y >= GROUND - 4 && o.vy > 0);
    if (!dead && mode === 'coop') {
      for (const T of [CP1, CP2]) { if (T && T.state !== 'dead' && T.invuln <= 0 && Math.abs(o.x - T.x) < 14 + o.r && o.y > T.y - 104 && o.y < T.y + 10) { if (coHurtPlayer(T, o.dmg, o.x, false)) dead = true; } }
    } else if (!dead && P.state !== 'dead' && P.invuln <= 0 && Math.abs(o.x - P.x) < 14 + o.r && o.y > P.y - 104 && o.y < P.y + 10) {
      if (hurtPlayer(o.dmg, o.x, false)) dead = true;
    }
    if (dead) { spark(o.x, Math.min(o.y, GROUND - 4), 6, '#bcd8ff', 260, .3); orbs.splice(i, 1); }
  }
}
function drawSlashes() {
  for (const p of slashes) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * .3);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 30); g.addColorStop(0, 'rgba(255,252,224,1)'); g.addColorStop(.4, 'rgba(255,224,130,.9)'); g.addColorStop(1, 'rgba(255,180,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 30, 15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,200,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, 0, .3, TAU - .3); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,110,.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(2, 0, 12, 5, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}
function drawOrbs() {
  for (const o of orbs) {
    const r = 16 + Math.sin(time * 30 + o.x) * 1.5;
    const g = ctx.createRadialGradient(o.x, o.y, 1, o.x, o.y, r * 1.8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(160,200,255,.95)'); g.addColorStop(1, 'rgba(60,110,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, r * 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .6, 0, TAU); ctx.fill();
  }
}
function drawGreatsword(c, hx, hy, A, len, glow) {
  c.save(); c.translate(hx, hy); c.rotate(A);
  c.fillStyle = '#23262f'; c.fillRect(-27, -2.8, 29, 5.6);
  c.strokeStyle = '#4b5166'; c.lineWidth = 1;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-25 + i * 4.6, -2.8); c.lineTo(-23 + i * 4.6, 2.8); c.stroke(); }
  poly(c, [[-27, -4.5], [-27, 4.5], [-42, 0]], '#8e94a8', '#090a11', 1);
  c.fillStyle = '#a9b0c6'; c.strokeStyle = '#090a11'; c.beginPath(); c.arc(-28, 0, 3.6, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#7d8395'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(1, -14); c.quadraticCurveTo(6, -12, 7, -6); c.lineTo(7, 6); c.quadraticCurveTo(6, 12, 1, 14); c.lineTo(-2, 9); c.lineTo(-2, -9); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#2b58cf'; c.beginPath(); c.arc(2.5, 0, 2.3, 0, TAU); c.fill();
  if (glow) { c.shadowColor = '#7fb0ff'; c.shadowBlur = glow; }
  const g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#5b7099'); g.addColorStop(.5, '#cfe2fb'); g.addColorStop(1, '#5b7099');
  c.fillStyle = g; c.beginPath(); c.moveTo(7, -5); c.lineTo(len - 18, -4.4); c.lineTo(len, 0); c.lineTo(len - 18, 4.4); c.lineTo(7, 5); c.closePath(); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#090a11'; c.lineWidth = 1.2; c.stroke();
  c.strokeStyle = 'rgba(235,245,255,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(12, 0); c.lineTo(len - 26, 0); c.stroke();
  c.fillStyle = 'rgba(70,110,200,.7)'; for (let i = 0; i < 6; i++) c.fillRect(22 + i * 12, -1.4, 4, 2.8);
  c.restore();
}
function drawArtorias(c, o) {
  const p = PAL_A, t = o.t, run = o.run || 0, air = o.air, crouch = o.crouch || 0, lean = o.lean || 0;
  c.save();
  c.translate(o.x, o.y); c.scale(o.face * o.scale, o.scale); if (o.rot) c.rotate(o.rot);
  c.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  if (o.flash) c.filter = 'brightness(2.6) saturate(.35)';
  const hipY = -44 + crouch * .9;
  let fA, fB;
  if (air) { fA = { x: -8, y: -16 }; fB = { x: 12, y: -28 }; }
  else if (o.slide) { fA = { x: -18, y: -2 }; fB = { x: 24, y: -1 }; }
  else if (o.kneel) { fA = { x: -22, y: -2 }; fB = { x: 12, y: 0 }; }
  else {
    const ph = o.phase !== undefined ? o.phase : t * 7, rx = 17 * run;
    fA = { x: -10 * (1 - run) + Math.sin(ph) * rx, y: -Math.max(0, Math.cos(ph)) * 10 * run };
    fB = { x: 10 * (1 - run) + Math.sin(ph + Math.PI) * rx, y: -Math.max(0, Math.cos(ph + Math.PI)) * 10 * run };
  }
  const drawLeg = (hx, f, far) => {
    const k = ik(hx, hipY, f.x, f.y, 23, 23, -1);
    limb(c, [{ x: hx, y: hipY }, { x: k.x, y: k.y }, { x: k.tx, y: k.ty }], 12, p.outline, far ? p.legFar : p.leg, p.light);
    c.fillStyle = p.dark; c.strokeStyle = p.outline; c.lineWidth = 1; c.beginPath(); c.ellipse(k.tx + 4, k.ty - 2, 10, 5, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = p.trim; c.beginPath(); c.arc(k.x + 2, k.y, 5, 0, TAU); c.fill(); c.stroke();
  };
  drawLeg(-4, fA, true); drawLeg(4, fB, false);
  // tattered blue cloth
  const sw = Math.sin(t * 1.7) * 1.8 + run * -7 + (o.clothSway || 0);
  poly(c, [[-9, hipY - 3], [-4, hipY - 3], [-14 + sw, hipY + 34], [-21 + sw, hipY + 30], [-24 + sw, hipY + 38]], p.cloakDark, p.outline, 1);
  poly(c, [[-8, hipY - 3], [12, hipY - 3], [16 + sw, hipY + 30], [11 + sw, hipY + 26], [6 + sw, hipY + 37], [sw, hipY + 27], [-6 + sw, hipY + 35]], p.cloak, p.outline, 1.2);

  c.save();
  c.translate(0, crouch); c.translate(0, -44); c.rotate(lean); c.translate(0, 44);
  const w1 = Math.sin(t * 3) * 3 + run * 9 + (o.capeBack || 0), w2 = Math.sin(t * 3 + 1) * 4 + run * 12 + (o.capeBack || 0) * 1.4;
  poly(c, [[-4, -85], [-16, -72], [-24 - w1, -44], [-32 - w2, -8], [-26 - w2, -1], [-21 - w1, -10], [-15 - w2 * .7, 0], [-9 - w1 * .5, -9], [-3, -2], [1, -44]], p.cloak, p.outline, 1.4);
  poly(c, [[-4, -80], [-13, -66], [-19 - w1 * .8, -40], [-24 - w2 * .8, -14], [-9, -10], [-2, -44]], p.cloakDark, null);
  // long dark hair streaming from the helm
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ph = t * 3.2 + i * 1.2, len = 36 + i * 8 + (o.capeBack || 0) * 1.6 + run * 14;
    c.strokeStyle = p.hair; c.lineWidth = 3.4 - i * .55;
    c.beginPath(); c.moveTo(-3, -108 + i * 2.2);
    c.bezierCurveTo(-13 - len * .3, -113 + Math.sin(ph) * 5, -21 - len * .6, -101 + Math.sin(ph + 1) * 9 + i * 4, -27 - len, -93 + i * 8 + Math.sin(ph + 2) * 7);
    c.stroke();
  }
  // broken off-arm, hanging limp
  {
    const S = { x: -5, y: -78 }, tgt = { x: -9 + Math.sin(t * 1.4) * 1.4 - run * 3, y: -47 + Math.sin(t * 2.1) * .8 };
    const e = ik(S.x, S.y, tgt.x, tgt.y, 16, 16, 1);
    limb(c, [S, { x: e.x, y: e.y }, { x: e.tx, y: e.ty }], 9.5, p.outline, p.legFar, p.trim);
    c.fillStyle = p.dark; c.beginPath(); c.arc(e.tx, e.ty, 4.6, 0, TAU); c.fill();
    c.strokeStyle = p.cloakDark; c.lineWidth = 2.4; c.beginPath(); c.moveTo(e.x - 4, e.y - 3); c.lineTo(e.x + 4, e.y + 3); c.stroke();
  }
  // torso
  const tg = c.createLinearGradient(-12, 0, 14, 0); tg.addColorStop(0, p.dark); tg.addColorStop(.5, p.mid); tg.addColorStop(1, p.light);
  c.beginPath(); c.moveTo(-11, -80); c.quadraticCurveTo(1, -90, 12, -80); c.quadraticCurveTo(17, -64, 11, -46); c.lineTo(-10, -46); c.quadraticCurveTo(-15, -64, -11, -80); c.closePath();
  c.fillStyle = tg; c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-10, -70); c.quadraticCurveTo(2, -66, 13, -70); c.moveTo(-10, -60); c.quadraticCurveTo(2, -56, 12, -60); c.moveTo(-9, -52); c.quadraticCurveTo(2, -49, 11, -52); c.stroke();
  c.fillStyle = p.belt; c.fillRect(-11, -50, 23, 5.5); c.strokeStyle = p.outline; c.lineWidth = 1; c.strokeRect(-11, -50, 23, 5.5);
  c.fillStyle = p.gold; c.beginPath(); c.arc(1, -47.3, 3.2, 0, TAU); c.fill(); c.stroke();
  poly(c, [[-11, -85], [12, -84], [16, -72], [4, -63], [-10, -72]], p.cloak, p.outline, 1.2);
  poly(c, [[9, -72], [16, -66], [18 + Math.sin(t * 2) * 1.5, -49], [10, -55]], p.cloakDark, p.outline, 1);
  // head: tall crested helm
  c.fillStyle = p.dark; c.fillRect(-3, -88, 8, 8);
  const hg = c.createLinearGradient(-9, -114, 14, -84); hg.addColorStop(0, p.light); hg.addColorStop(.55, p.mid); hg.addColorStop(1, p.dark);
  c.beginPath(); c.moveTo(-9, -86); c.quadraticCurveTo(-12, -103, -3, -111); c.quadraticCurveTo(8, -115, 14, -101); c.lineTo(13, -88); c.quadraticCurveTo(5, -83, -6, -84); c.closePath();
  c.fillStyle = hg; c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.6; c.stroke();
  poly(c, [[-6, -108], [-1, -115], [6, -114], [10, -107], [3, -110]], p.dark, p.outline, 1.2);
  poly(c, [[-1, -114], [-4, -128], [3, -114]], p.trim, p.outline, 1);
  c.fillStyle = '#06070c'; c.fillRect(4, -100, 10, 2.6); c.fillRect(8.5, -104, 2.4, 12);
  c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -96); c.quadraticCurveTo(1, -92, 8, -90); c.stroke();
  // pauldron
  const pg = c.createRadialGradient(-2, -84, 1, 2, -78, 16); pg.addColorStop(0, p.light); pg.addColorStop(.7, p.mid); pg.addColorStop(1, p.dark);
  c.fillStyle = pg; c.beginPath(); c.arc(1, -78, 13.5, 0, TAU); c.fill(); c.strokeStyle = p.outline; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = p.cloak; c.lineWidth = 2.2; c.beginPath(); c.arc(1, -78, 9.5, .3, 2.7); c.stroke();
  c.fillStyle = p.trim; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.arc(1 + Math.cos(a) * 12, -78 + Math.sin(a) * 12, .9, 0, TAU); c.fill(); }
  // sword arm + greatsword
  const S = { x: 3, y: -79 }, R = o.handR === undefined ? 26 : o.handR, A = o.swordA;
  const hand = { x: S.x + Math.cos(A) * R, y: S.y + Math.sin(A) * R };
  const el = ik(S.x, S.y, hand.x, hand.y, 17, 17, 1);
  limb(c, [S, { x: el.x, y: el.y }, { x: el.tx, y: el.ty }], 10.5, p.outline, p.mid, p.light);
  drawGreatsword(c, el.tx, el.ty, A, 104, o.glow || 0);
  c.fillStyle = p.mid; c.strokeStyle = p.outline; c.lineWidth = 1.2; c.beginPath(); c.arc(el.tx, el.ty, 5.4, 0, TAU); c.fill(); c.stroke();
  c.restore(); c.restore();
}
const ART_IDLE = .68;
function artObj() {
  const rage = B.rage;
  const o = { kind: 'art', scale: 1.5, x: B.x, y: B.y - B.h, face: B.face, t: time, run: B.moving ? .55 : 0, air: false, swordA: ART_IDLE + Math.sin(time * 1.6) * .03, handR: 26, crouch: 8, lean: .07, flash: B.flash > 0, alpha: 1, glow: rage ? 14 : 4, phase: B.stride, capeBack: rage ? 6 : 0 };
  switch (B.state) {
    case 'intro': {
      const k = clamp((phaseT - .4) / .5, 0, 1) * (1 - clamp((phaseT - 1.9) / .6, 0, 1));
      o.swordA = lerp(ART_IDLE, -1.8, k); o.lean = -.15 * k; o.crouch = 8 * (1 - k); o.glow = 6 + 16 * k; o.capeBack = 8 * k; break;
    }
    case 'combo': {
      const a = B.atk, K = BK[a.type], wS = a.w * (rage ? .86 : 1); let ang;
      o.crouch = 4;
      if (B.phase === 'wind') { const k = Math.min(1, B.pt / wS); ang = lerp(ART_IDLE, K.aw, easeOut(k)); o.lean = K.wl * k; o.handR = lerp(26, K.rw, k); o.glow = 8 + k * 12; o.capeBack = 5 * k; }
      else if (B.phase === 'act') { const k = Math.min(1, B.pt / a.a); ang = lerp(K.aw, K.a1, ease(k)); o.lean = lerp(K.wl, K.sl, k); o.handR = lerp(K.rw, K.rs, k); o.glow = 24; o.capeBack = 12; }
      else { const k = Math.min(1, B.pt / a.r); ang = lerp(K.a1, ART_IDLE, k * k); o.lean = K.sl * (1 - k); o.handR = lerp(K.rs, 26, k); }
      o.swordA = ang; o.run = 0; break;
    }
    case 'jump': {
      if (B.phase === 'crouch') { const durC = B.jfirst ? (rage ? .45 : .55) : .26, k = Math.min(1, B.pt / durC); o.crouch = lerp(8, 34, k); o.lean = -.25 * k; o.swordA = lerp(ART_IDLE, -2.0, easeOut(k)); o.glow = 8 + 12 * k; }
      else if (B.phase === 'air') { const T = rage ? .52 : .62, k = Math.min(1, B.pt / T); o.air = true; o.crouch = 0; o.lean = lerp(-.1, .3, k); o.swordA = k < .6 ? lerp(-2.0, -1.5, k / .6) : lerp(-1.5, 1.1, (k - .6) / .4); o.glow = 18; o.capeBack = 14; }
      else if (B.phase === 'slam') { const k = Math.min(1, B.pt / .22); o.crouch = lerp(16, 8, k); o.lean = .32 * (1 - k * .5); o.swordA = 1.05; o.glow = 26; }
      else { const k = Math.min(1, B.pt / .85); o.crouch = lerp(12, 8, k); o.lean = .2 * (1 - k); o.swordA = lerp(1.05, ART_IDLE, k); }
      o.run = 0; break;
    }
    case 'rush': {
      if (B.phase === 'wind') { const windT = B.rfirst ? (rage ? .42 : .55) : .24, k = Math.min(1, B.pt / windT); o.crouch = lerp(8, 26, k); o.lean = -.3 * k; o.swordA = lerp(ART_IDLE, -.05, easeOut(k)); o.handR = lerp(26, 8, k); o.glow = 10 + 14 * k; o.capeBack = 6 * k; }
      else if (B.phase === 'dash') { o.slide = true; o.crouch = 20; o.lean = .58; o.swordA = .02; o.handR = 44; o.glow = 26; o.capeBack = 28; }
      else { const k = Math.min(1, B.pt / .6); o.crouch = lerp(18, 8, k); o.lean = .3 * (1 - k); o.swordA = lerp(.2, ART_IDLE, k); o.handR = lerp(36, 26, k); }
      o.run = 0; break;
    }
    case 'explode': {
      const charge = rage ? .95 : 1.15;
      if (B.phase === 'charge') { const k = Math.min(1, B.pt / charge); o.swordA = lerp(ART_IDLE, -1.75, easeOut(Math.min(1, k * 2))); o.crouch = 8 + 6 * k; o.lean = -.12; o.glow = 8 + 18 * k; o.capeBack = 12 * k; o.shakeX = Math.sin(time * 70) * 1.2 * k; }
      else { const k = Math.min(1, B.pt / .5); o.swordA = lerp(-1.75, .5, easeOut(Math.min(1, k * 4))); o.lean = .25 * (1 - k); o.crouch = 4; o.glow = 24; o.capeBack = 16; }
      o.run = 0; break;
    }
    case 'stunned': o.kneel = true; o.crouch = 26; o.lean = .32; o.swordA = 1.75; o.handR = 26; o.glow = 0; o.run = 0; o.shakeX = Math.sin(time * 40) * .8; break;
    case 'dead': {
      const k = Math.min(1, B.dieT / 1.2); o.kneel = k < 1; o.crouch = 26 * Math.min(1, k * 3); o.lean = .32 + k * .3; o.swordA = 1.75; o.glow = 0; o.run = 0;
      o.alpha = clamp(1 - (B.dieT - 1.2) / 2.4, 0, 1); if (B.dieT > 1.2) o.flash = Math.floor(time * 20) % 2 === 0; break;
    }
  }
  if (o.shakeX) o.x += o.shakeX;
  return o;
}
function startGame(type) {
  mode = 'boss'; mpTeardown();
  if (typeof type === 'string') bossType = type;
  ac(); reset(); phase = 'intro'; phaseT = 0; paused = false; clearInputState();
  $('title').classList.add('hide'); $('end').className = 'ov hide'; $('pause').classList.add('hide'); $('pauseBtn').classList.remove('hide');
  musicStop(1.4);
}
function toTitle() {
  mode = 'boss'; mpTeardown();
  reset(); phase = 'title'; phaseT = 0; paused = false; clearInputState();
  $('end').className = 'ov hide'; $('pause').classList.add('hide'); $('pauseBtn').classList.add('hide'); $('title').classList.remove('hide');
  $('pvpEnd').classList.add('hide'); $('mp').classList.add('hide'); $('mpQuit').classList.add('hide'); $('pvpLeaveBtn').classList.add('hide');
  $('co').classList.add('hide'); $('coEnd').classList.add('hide');
  musicPlay('title');
}

/* ================= BACKGROUND LAYERS ================= */
const LAY = {};
function makeLayer(w, h, fn) { const c = document.createElement('canvas'); c.width = Math.ceil(w * RS); c.height = Math.ceil(h * RS); const g = c.getContext('2d'); g.scale(RS, RS); fn(g, w, h); return c; }
function drawFar(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05040a'); gr.addColorStop(.5, '#0e0a1c'); gr.addColorStop(1, '#1b1228'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const mx = w * .56, my = 150;
  let rg = g.createRadialGradient(mx, my, 20, mx, my, 260); rg.addColorStop(0, 'rgba(160,110,230,.5)'); rg.addColorStop(1, 'rgba(160,110,230,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b48be6'; g.beginPath(); g.arc(mx, my, 62, 0, TAU); g.fill();
  g.fillStyle = 'rgba(90,50,150,.28)'; [[-18, -14, 14], [16, 8, 20], [-10, 26, 9], [22, -22, 8]].forEach(c => { g.beginPath(); g.arc(mx + c[0], my + c[1], c[2], 0, TAU); g.fill(); });
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(220,210,255,' + rnd(.15, .55) + ')'; g.fillRect(rnd(0, w), rnd(0, 250), 1.2, 1.2); }
  g.strokeStyle = 'rgba(120,110,175,.13)'; g.lineWidth = 3;
  for (let x = -60; x < w + 260; x += 230) { g.beginPath(); g.moveTo(x, 440); g.lineTo(x, 300); g.quadraticCurveTo(x, 210, x + 115, 170); g.quadraticCurveTo(x + 230, 210, x + 230, 300); g.lineTo(x + 230, 440); g.stroke(); }
}
function drawMid(g, w, h) {
  g.fillStyle = '#090b18'; g.fillRect(0, 0, w, h);
  const step = 290;
  const words = ['AHURA', 'KYRIE', 'MISERE', 'PENITENS'];
  let wi = 0;
  for (let x = -40; x < w + step; x += step) {
    const a = x + 58, b = x + step - 20, m = (a + b) / 2;
    const gr = g.createLinearGradient(0, 64, 0, 440); gr.addColorStop(0, '#2c4a80'); gr.addColorStop(.5, '#172a50'); gr.addColorStop(1, '#0a1224');
    g.beginPath(); g.moveTo(a, 440); g.lineTo(a, 240); g.quadraticCurveTo(a, 130, m, 64); g.quadraticCurveTo(b, 130, b, 240); g.lineTo(b, 440); g.closePath();
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(150,80,200,.12)'; g.fillRect(a, 150, (b - a) / 2, 150); g.fillStyle = 'rgba(230,150,70,.08)'; g.fillRect(m, 200, (b - a) / 2, 150);
    let lg = g.createLinearGradient(0, 300, 0, 440); lg.addColorStop(0, 'rgba(120,170,200,0)'); lg.addColorStop(1, 'rgba(120,170,200,.16)'); g.fillStyle = lg; g.fillRect(a, 300, b - a, 140);
    g.strokeStyle = 'rgba(170,190,230,.22)'; g.lineWidth = 2; g.beginPath();
    g.moveTo(m, 70); g.lineTo(m, 440); g.moveTo(a, 300); g.lineTo(b, 300); g.moveTo(a + (m - a) / 2, 140); g.lineTo(a + (m - a) / 2, 440); g.moveTo(m + (b - m) / 2, 140); g.lineTo(m + (b - m) / 2, 440);
    g.moveTo(m + 24, 190); g.arc(m, 190, 24, 0, TAU); g.stroke();
    g.restore();
    g.strokeStyle = '#04050d'; g.lineWidth = 7; g.beginPath(); g.moveTo(a, 440); g.lineTo(a, 240); g.quadraticCurveTo(a, 130, m, 64); g.quadraticCurveTo(b, 130, b, 240); g.lineTo(b, 440); g.stroke();
    // pillar
    const pg = g.createLinearGradient(x - 40, 0, x + 58, 0); pg.addColorStop(0, '#0b0e1f'); pg.addColorStop(.45, '#171d38'); pg.addColorStop(1, '#0a0d1b');
    g.fillStyle = pg; g.fillRect(x - 40, 0, 98, 440);
    g.fillStyle = '#1d2444'; g.fillRect(x - 46, 232, 110, 8); g.fillRect(x - 46, 424, 110, 16);
    g.strokeStyle = 'rgba(130,150,200,.14)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x - 10, 440); g.moveTo(x + 28, 0); g.lineTo(x + 28, 440); g.stroke();
    // banner
    if (Math.floor((x + 40) / step) % 2 === 0) {
      const bx = x - 12;
      g.fillStyle = 'rgba(184,172,140,.55)'; g.beginPath(); g.moveTo(bx, 40); g.lineTo(bx + 42, 40); g.lineTo(bx + 42, 236); g.lineTo(bx + 21, 250); g.lineTo(bx, 236); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,50,30,.6)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(28,22,12,.85)'; g.font = '700 17px Cinzel, Georgia, serif'; g.textAlign = 'center';
      const word = words[wi++ % words.length]; for (let i = 0; i < word.length; i++) g.fillText(word[i], bx + 21, 66 + i * 24);
    }
  }
}
function drawNear(g, w, h) {
  for (let x = 120; x < w + 500; x += 640) {
    const pg = g.createLinearGradient(x - 55, 0, x + 55, 0); pg.addColorStop(0, '#04050b'); pg.addColorStop(.5, '#0d1122'); pg.addColorStop(1, '#03040a');
    g.fillStyle = pg; g.fillRect(x - 55, 0, 110, 452);
    g.fillStyle = '#131933'; g.fillRect(x - 64, 60, 128, 10); g.fillRect(x - 64, 430, 128, 22);
    g.strokeStyle = 'rgba(140,160,210,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 20, 70); g.lineTo(x - 20, 430); g.moveTo(x + 22, 70); g.lineTo(x + 22, 430); g.stroke();
    g.strokeStyle = 'rgba(120,120,150,.25)'; g.lineWidth = 1.6; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x + 90, 0); g.lineTo(x + 90 + 4, 210); g.stroke(); g.setLineDash([]);
  }
  const fg = g.createLinearGradient(0, 300, 0, 450); fg.addColorStop(0, 'rgba(60,50,90,0)'); fg.addColorStop(1, 'rgba(60,50,90,.28)'); g.fillStyle = fg; g.fillRect(0, 300, w, 150);
}
function drawGround(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#262034'); gr.addColorStop(.25, '#171221'); gr.addColorStop(1, '#08060d'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.5;
  [10, 26, 48, 78].forEach(y => { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); });
  for (let x = 0; x < w; x += 150) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (x - w / 2) * .18, h); g.stroke(); }
  g.strokeStyle = 'rgba(230,190,110,.22)'; g.lineWidth = 2;
  [[430, 40], [320, 30], [190, 18]].forEach(r => { g.beginPath(); g.ellipse(w / 2, 46, r[0], r[1], 0, 0, TAU); g.stroke(); });
  for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 320, 46 + Math.sin(a) * 30); g.lineTo(w / 2 + Math.cos(a) * 430, 46 + Math.sin(a) * 40); g.stroke(); }
  g.fillStyle = 'rgba(230,190,110,.3)'; g.font = '600 11px Cinzel, Georgia, serif'; g.textAlign = 'center';
  'MISERERE  NOBIS  DOMINE'.split('').forEach((ch, i, arr) => { const a = -Math.PI / 2 + i / arr.length * TAU + .1; g.save(); g.translate(w / 2 + Math.cos(a) * 375, 46 + Math.sin(a) * 35); g.rotate(a + Math.PI / 2); g.scale(1, .18); g.fillText(ch, 0, 0); g.restore(); });
  const rg = g.createRadialGradient(w / 2, 40, 10, w / 2, 40, 520); rg.addColorStop(0, 'rgba(170,120,230,.16)'); rg.addColorStop(1, 'rgba(170,120,230,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a3050'; g.fillRect(0, 0, w, 1.5);
}
function drawVig(g, w, h) {
  const rg = g.createRadialGradient(w / 2, h / 2, h * .32, w / 2, h / 2, h * .95); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(2,1,6,.78)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
}
function drawFog(g, w, h) {
  for (let i = 0; i < 16; i++) {
    const x = rnd(0, w), y = rnd(40, h - 30), r = rnd(110, 200), rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(150,140,190,.10)'); rg.addColorStop(1, 'rgba(150,140,190,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function buildBG() {
  LAY.far = makeLayer(W + (WORLD - W) * .12, H, drawFar);
  LAY.mid = makeLayer(W + (WORLD - W) * .35, H, drawMid);
  LAY.near = makeLayer(W + (WORLD - W) * .8, H, drawNear);
  LAY.ground = makeLayer(WORLD, H - 430, drawGround);
  LAY.vig = makeLayer(W, H, drawVig);
  LAY.fog = makeLayer(1400, 220, drawFog);
}
const flowers = [], blades = [];
(function () {
  for (let i = 0; i < 190; i++) { const y = 438 + Math.pow(Math.random(), .8) * 98; flowers.push({ x: rnd(0, WORLD), y, s: .6 + (y - 438) / 100 * .95, h: rnd(10, 30), ph: rnd(0, 7), n: Math.random() < .5 ? 5 : 6 }); }
  flowers.sort((a, b) => a.y - b.y);
  for (let i = 0; i < 420; i++) blades.push({ x: rnd(0, WORLD), y: 436 + Math.random() * 100, h: rnd(6, 20), ph: rnd(0, 7) });
})();
function drawBlades(y0, y1) {
  ctx.strokeStyle = 'rgba(30,58,42,.9)'; ctx.lineWidth = 1.3; ctx.beginPath();
  for (const b of blades) { if (b.y < y0 || b.y >= y1 || b.x < cam - 20 || b.x > cam + W + 20) continue; const sw = Math.sin(time * 1.5 + b.ph) * 2.2; ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + sw * .4, b.y - b.h * .5, b.x + sw, b.y - b.h); }
  ctx.stroke();
}
function drawFlowers(y0, y1) {
  for (const f of flowers) {
    if (f.y < y0 || f.y >= y1 || f.x < cam - 30 || f.x > cam + W + 30) continue;
    const sw = Math.sin(time * 1.4 + f.ph) * 3 * f.s, h = f.h * f.s + 8 * f.s, cx = f.x + sw, cy = f.y - h;
    ctx.strokeStyle = '#1f3d2c'; ctx.lineWidth = 1.5 * f.s; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(f.x + sw * .4, f.y - h * .5, cx, cy); ctx.stroke();
    ctx.fillStyle = 'rgba(240,235,255,.11)'; ctx.beginPath(); ctx.arc(cx, cy, 10 * f.s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2eee2'; ctx.strokeStyle = 'rgba(80,70,90,.55)'; ctx.lineWidth = .6; ctx.beginPath();
    for (let i = 0; i < f.n; i++) { const a = i / f.n * TAU + f.ph; ctx.moveTo(cx + Math.cos(a) * 3.6 * f.s + 2.6 * f.s, cy + Math.sin(a) * 3.2 * f.s); ctx.arc(cx + Math.cos(a) * 3.6 * f.s, cy + Math.sin(a) * 3.2 * f.s, 2.6 * f.s, 0, TAU); }
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c15e'; ctx.beginPath(); ctx.arc(cx, cy, 1.7 * f.s, 0, TAU); ctx.fill();
  }
}

/* ================= RENDER ================= */
function drawShadow(x, y, w, air) { ctx.fillStyle = 'rgba(0,0,0,' + (.38 - air * .2) + ')'; ctx.beginPath(); ctx.ellipse(x, GROUND + 4, w * (1 - air * .4), 6, 0, 0, TAU); ctx.fill(); }
function drawBeam() {
  if (B.state !== 'kame') return;
  const f = B.face;
  if (B.phase === 'charge') {
    const charge = B.rage ? .95 : 1.15, k = B.pt / charge, hx = B.x + f * 51, hy = GROUND - 51;
    const r = 8 + 34 * k;
    let g = ctx.createRadialGradient(hx, hy, 1, hx, hy, r * 1.8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(210,170,255,.95)'); g.addColorStop(1, 'rgba(110,50,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, r * 1.8, 0, TAU); ctx.fill();
    // warning lane
    const a = .08 + .22 * k * (.6 + .4 * Math.sin(time * 26)), x0 = B.x + f * 40;
    ctx.fillStyle = 'rgba(190,120,255,' + a + ')'; ctx.fillRect(f > 0 ? x0 : x0 - WORLD, GROUND - BEAM_H, WORLD, BEAM_H);
    ctx.strokeStyle = 'rgba(230,200,255,' + (a * 2) + ')'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]); ctx.beginPath(); const yy = GROUND - BEAM_H; ctx.moveTo(x0, yy); ctx.lineTo(x0 + f * WORLD, yy); ctx.stroke(); ctx.setLineDash([]);
  } else if (B.phase === 'fire') {
    const reach = Math.min(WORLD * 1.2, 4200 * B.pt + 40), x0 = B.x + f * 40, x1 = x0 + f * reach;
    const lo = Math.min(x0, x1), wd = Math.abs(reach), pulse = 1 + Math.sin(time * 90) * .06, fade = B.pt > .26 ? 1 - (B.pt - .26) / .1 : 1;
    ctx.save(); ctx.globalAlpha = clamp(fade, 0, 1);
    const cy = GROUND - BEAM_H / 2;
    const layers = [[BEAM_H + 22, 'rgba(110,50,255,.35)'], [BEAM_H, 'rgba(160,100,255,.75)'], [BEAM_H * .62, 'rgba(225,200,255,.95)'], [BEAM_H * .3, 'rgba(255,255,255,1)']];
    for (const L of layers) { const hh = L[0] * pulse; ctx.fillStyle = L[1]; ctx.beginPath(); ctx.roundRect(lo, cy - hh / 2, wd, hh, hh / 2); ctx.fill(); }
    let g = ctx.createRadialGradient(x0, cy, 2, x0, cy, 90); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(150,80,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x0, cy, 90, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawExplosion() {
  if (B.state !== 'explode') return;
  const art = B.type === 'art', cx = B.x, cy = GROUND - 70;
  const C1 = art ? '190,215,255' : '230,200,255', C2 = art ? '70,120,255' : '140,70,255', C3 = art ? '40,80,230' : '120,50,255', C4 = art ? '150,190,255' : '210,150,255', C5 = art ? '170,210,255' : '210,160,255';
  if (B.phase === 'charge') {
    const chargeT = art ? (B.rage ? .95 : 1.15) : (B.rage ? 1.0 : 1.2), k = Math.min(1, B.pt / chargeT), R = 250;
    ctx.save(); ctx.beginPath(); ctx.rect(cx - R - 20, 0, R * 2 + 40, GROUND + 6); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, R); g.addColorStop(0, 'rgba(' + C1 + ',' + (.25 + .45 * k) + ')'); g.addColorStop(.6, 'rgba(' + C2 + ',' + (.10 + .15 * k) + ')'); g.addColorStop(1, 'rgba(' + C3 + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * (.35 + .65 * k), 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(' + C4 + ',' + (.35 + .4 * Math.sin(time * 18) * .5 + .2) + ')'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.lineDashOffset = -time * 60;
    ctx.beginPath(); ctx.ellipse(cx, GROUND + 2, R, 22, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,' + (.2 + .5 * k) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, GROUND + 2, R * k, 22 * k, 0, 0, TAU); ctx.stroke();
  } else if (B.phase === 'burst') {
    const k = Math.min(1, B.pt / (art ? .5 : .55)), R = 270 * easeOut(Math.min(1, k * 1.6));
    ctx.save(); ctx.globalAlpha = 1 - k * k;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, R); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(' + C5 + ',.85)'); g.addColorStop(1, 'rgba(' + C3 + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.restore();
  }
}
function drawParts() {
  for (const p of parts) {
    const k = p.t / p.life;
    if (p.k === 'spark') { ctx.strokeStyle = p.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = p.sz * (1 - k * .5); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (p.k === 'dot') { ctx.fillStyle = 'rgba(' + p.col + ',' + (.8 * (1 - k)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1 - k * .4), 0, TAU); ctx.fill(); }
    else if (p.k === 'petal') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * .5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.k === 'gather') { const e = k * k, x = lerp(p.sx, p.tx, e), y = lerp(p.sy, p.ty, e); ctx.fillStyle = 'rgba(' + (p.gc || '220,180,255') + ',' + (.3 + .7 * k) + ')'; ctx.beginPath(); ctx.arc(x, y, 2.2 * (1 - k * .5), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawFx() {
  for (const f of fx) {
    const k = f.t / f.life;
    if (f.k === 'arc') {
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.face, 1); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
      ctx.strokeStyle = f.col; ctx.lineWidth = f.w * (1 - k * .5); ctx.beginPath(); ctx.arc(0, 0, f.r, f.a0, f.a1, f.a1 < f.a0); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = f.w * .3 * (1 - k); ctx.beginPath(); ctx.arc(0, 0, f.r, f.a0, f.a1, f.a1 < f.a0); ctx.stroke(); ctx.restore();
    } else if (f.k === 'streak') {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round'; ctx.strokeStyle = f.col; ctx.lineWidth = 10 * (1 - k); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.len, f.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - k); ctx.stroke(); ctx.restore();
    } else if (f.k === 'ring') {
      const r = lerp(f.r0, f.r1, easeOut(k)); ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.col; ctx.lineWidth = f.w * (1 - k); ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * (f.r1 > 150 ? .55 : 1), 0, 0, TAU); ctx.stroke(); ctx.restore();
    } else if (f.k === 'text') {
      ctx.save(); ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3; ctx.font = '900 ' + f.size + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(f.txt, f.x, f.y - k * 34); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y - k * 34); ctx.restore();
    }
  }
}
function render(alpha) {
  if (mode === 'pvp') { pvpRenderFrame(); return; }
  if (mode === 'coop') { coopRenderFrame(); return; }
  if (alpha === undefined) alpha = 1; alpha = clamp(alpha, 0, 1);
  const sv = [P.x, P.y, B.x, cam, P.t, B.pt, time, P.stride, B.stride, B.h];
  P.x = lerp(prev.px, P.x, alpha); P.y = lerp(prev.py, P.y, alpha); B.x = lerp(prev.bx, B.x, alpha); cam = lerp(prev.cam, cam, alpha);
  P.stride = lerp(prev.pst, P.stride, alpha); B.stride = lerp(prev.bst, B.stride, alpha); B.h = lerp(prev.bh, B.h, alpha);
  if (P.state === prev.ps) P.t = lerp(prev.pt, P.t, alpha);
  if (B.state === prev.bs && B.phase === prev.bph) B.pt = lerp(prev.bpt, B.pt, alpha);
  time = time - DT * (1 - alpha);
  try { renderFrame(); } finally { P.x = sv[0]; P.y = sv[1]; B.x = sv[2]; cam = sv[3]; P.t = sv[4]; B.pt = sv[5]; time = sv[6]; P.stride = sv[7]; B.stride = sv[8]; B.h = sv[9]; }
}
function renderFrame() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
  if (!LAY.far) return;
  const snap = v => Math.round(v * RS) / RS;
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake * .7 : 0;
  ctx.drawImage(LAY.far, snap(-cam * .12 + sx * .2), snap(sy * .2), W + (WORLD - W) * .12, H);
  ctx.drawImage(LAY.mid, snap(-cam * .35 + sx * .5), snap(sy * .5), W + (WORLD - W) * .35, H);
  ctx.drawImage(LAY.near, snap(-cam * .8 + sx * .8), snap(sy * .8), W + (WORLD - W) * .8, H);
  ctx.save(); ctx.translate(snap(-cam + sx), snap(sy));
  ctx.drawImage(LAY.ground, 0, 430, WORLD, H - 430);
  // fog behind
  const fo = Math.round((time * 9) % 1400); ctx.globalAlpha = .9; ctx.drawImage(LAY.fog, Math.round(cam) - fo, 330, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - fo + 1400, 330, 1400, 220); ctx.globalAlpha = 1;
  drawBlades(430, GROUND + 6);
  drawFlowers(0, GROUND);
  drawExplosion();
  // boss then hero
  const isArt = B.type === 'art', bo = isArt ? artObj() : bossObj(), ho = heroObj();
  drawShadow(B.x, 0, isArt ? 54 : 46, clamp(B.h / 170, 0, 1)); drawShadow(P.x, 0, 22, clamp((GROUND - P.y) / 170, 0, 1));
  if (B.state === 'dead' && bo.alpha <= 0) { /* gone */ } else if (isArt) drawArtorias(ctx, bo); else drawKnight(ctx, bo);
  drawKnight(ctx, ho);
  if (B.state === 'stunned') { for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.1; ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(B.x + Math.cos(a) * 30, GROUND - (B.type === 'art' ? 195 : 175) + Math.sin(a) * 7, 3.5, 0, TAU); ctx.fill(); } }
  drawBeam(); drawOrbs(); drawSlashes();
  drawParts(); drawFx();
  drawBlades(GROUND + 6, 600); drawFlowers(GROUND, 600);
  // motes
  for (const m of motes) { if (m.x < cam - 10 || m.x > cam + W + 10) continue; const a = .25 + .3 * Math.sin(time * 2 + m.ph); ctx.fillStyle = 'rgba(240,235,255,' + a + ')'; if (m.petal) { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(time + m.ph); ctx.beginPath(); ctx.ellipse(0, 0, m.s * 1.6, m.s * .8, 0, 0, TAU); ctx.fill(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(m.x, m.y, m.s * .6, 0, TAU); ctx.fill(); } }
  { const f2 = Math.round(fo * 1.4) % 1400; ctx.globalAlpha = .55; ctx.drawImage(LAY.fog, Math.round(cam) - f2, 400, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - f2 + 1400, 400, 1400, 220); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.drawImage(LAY.vig, 0, 0, W, H);
  if (screenFlash > 0) { ctx.fillStyle = 'rgba(' + screenFlashCol + ',' + Math.min(.7, screenFlash) + ')'; ctx.fillRect(0, 0, W, H); }
  if (P && P.hp < 120 && P.state !== 'dead') { const a = .12 + .08 * Math.sin(time * 6); const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .8); g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(1, 'rgba(160,0,20,' + a * 2.5 + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (phase !== 'title') drawHUD();
  if (phase === 'intro') drawIntro();
  if (phase === 'won' || phase === 'wonUI') { const k = clamp(phaseT / 1.5, 0, 1); ctx.fillStyle = 'rgba(0,0,0,' + (.35 * k) + ')'; ctx.fillRect(0, 0, W, H); if (phase === 'won' && phaseT > 1) { ctx.save(); ctx.globalAlpha = clamp((phaseT - 1) / 1, 0, 1); ctx.textAlign = 'center'; ctx.font = '900 44px Cinzel, Georgia, serif'; ctx.fillStyle = '#f2dc9c'; ctx.shadowColor = '#000'; ctx.shadowBlur = 12; ctx.fillText('BOSS DEFEATED', W / 2, 270); ctx.restore(); } }
  if (phase === 'lost' || phase === 'lostUI') { const k = clamp(phaseT / 1.6, 0, 1); ctx.fillStyle = 'rgba(30,0,4,' + (.55 * k) + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ================= HUD ================= */
function cropPortrait(img, sx, sy, sw, sh, x, y, s) {
  if (img.complete && img.naturalWidth) { const r = img.naturalWidth / 736; ctx.drawImage(img, sx * r, sy * r, sw * r, sh * r, x, y, s, s); }
  else { ctx.fillStyle = '#221a2a'; ctx.fillRect(x, y, s, s); }
}
function drawBar(x, y, w, h, frac, ghost, c1, c2) {
  ctx.fillStyle = '#07050a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  if (ghost > frac) { ctx.fillStyle = '#d9cfae'; ctx.fillRect(x, y, w * ghost, h); }
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x, y, w * frac, h * .38);
  ctx.strokeStyle = '#b9975a'; ctx.lineWidth = 1.6; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  ctx.fillStyle = '#d8b56a'; [[x - 3, y - 3], [x + w + 3, y - 3], [x - 3, y + h + 3], [x + w + 3, y + h + 3]].forEach(c => { ctx.beginPath(); ctx.moveTo(c[0], c[1] - 3.4); ctx.lineTo(c[0] + 3.4, c[1]); ctx.lineTo(c[0], c[1] + 3.4); ctx.lineTo(c[0] - 3.4, c[1]); ctx.fill(); });
}
function drawFlask(x, y, full) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#b9975a'; ctx.lineWidth = 1.6; ctx.fillStyle = full ? '#7fe36c' : 'rgba(20,16,24,.85)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = full ? '#e5dcc2' : '#3a3244'; ctx.fillRect(-3, -8, 6, 7); ctx.strokeRect(-3, -8, 6, 7);
  ctx.fillStyle = full ? '#8a5a2c' : '#2a2430'; ctx.fillRect(-3.6, -12, 7.2, 4.6);
  if (full) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-3, 3, 1.6, 3.4, .3, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawSkillIcon(x, y, r, cd, maxCd, key, kind) {
  const ready = cd <= 0, frac = clamp(cd / maxCd, 0, 1);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#0c0910'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  if (kind === 'slash') {
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r); g.addColorStop(0, 'rgba(255,244,190,.95)'); g.addColorStop(1, 'rgba(230,170,60,.15)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r * .68, r * .3, -.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,190,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(0, 0, r * .68, r * .3, -.5, 0, TAU); ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(0, 1, 1, 0, 1, r); g.addColorStop(0, 'rgba(255,224,150,1)'); g.addColorStop(.5, 'rgba(255,110,40,.9)'); g.addColorStop(1, 'rgba(160,30,10,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 1, r * .62, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = ready ? '#f2d48f' : '#5a4a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  if (!ready) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.closePath(); ctx.fillStyle = 'rgba(4,3,6,.74)'; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#f2e6c8'; ctx.font = '700 11px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.ceil(cd), 0, 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = 'rgba(240,230,200,.85)'; ctx.font = '700 10px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(key, 0, r + 12);
  ctx.restore();
}
function drawHUD() {
  ctx.save();
  const px = 16, py = 14, pr = 36;
  ctx.fillStyle = '#07050a'; ctx.beginPath(); ctx.arc(px + pr, py + pr, pr + 4, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(px + pr, py + pr, pr, 0, TAU); ctx.clip(); cropPortrait(imgHero, 226, 0, 268, 268, px, py, pr * 2); ctx.restore();
  if (P.flash > 0) { ctx.fillStyle = 'rgba(200,20,30,.45)'; ctx.beginPath(); ctx.arc(px + pr, py + pr, pr, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + pr, py + pr, pr + 2, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#4b3714'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px + pr, py + pr, pr + 5, 0, TAU); ctx.stroke();
  const bx = 106;
  drawBar(bx, 24, 270, 17, P.hp / P.maxhp, P.ghost / P.maxhp, '#e0403c', '#8a1414');
  ctx.font = '700 12px Cinzel, Georgia, serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#f2e6c8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(Math.ceil(P.hp) + ' / ' + P.maxhp, bx + 6, 37); ctx.shadowBlur = 0;
  drawBar(bx, 50, 200, 9, P.st / P.maxst, 0, P.st < 15 ? '#e0a040' : '#5fd6a0', P.st < 15 ? '#8a5a14' : '#1f8a68');
  for (let i = 0; i < P.maxFlasks; i++) drawFlask(bx + 8 + i * 15, 80, i < P.flasks);
  drawSkillIcon(bx + 168, 82, 15, P.skill1CD, SKILL1_CD, primaryKey('skill1'), 'slash');
  drawSkillIcon(bx + 210, 82, 15, P.skill2CD, SKILL2_CD, primaryKey('skill2'), 'bomb');
  // boss bar
  if (phase !== 'title' && (B.state !== 'dead' || B.dieT < 2)) {
    const fill = phase === 'intro' ? B.introFill : 1, bw = 640, bxx = (W - bw) / 2, byy = 498;
    ctx.textAlign = 'center'; ctx.font = '700 17px Cinzel, Georgia, serif'; ctx.fillStyle = '#efdcae'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText(B.type === 'art' ? 'ARTORIAS THE ABYSSWALKER' : 'THE VIOLET SENTINEL', W / 2, byy - 10); ctx.shadowBlur = 0;
    const sw = 30; ctx.save(); ctx.beginPath(); ctx.arc(bxx - 30, byy + 6, sw / 2, 0, TAU); ctx.clip(); if (B.type === 'art') cropFrac(imgArt, .367, .164, .309, .309, bxx - 45, byy - 9, sw); else cropPortrait(imgBoss, 232, 92, 250, 250, bxx - 45, byy - 9, sw); ctx.restore();
    ctx.strokeStyle = '#c9a45a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bxx - 30, byy + 6, sw / 2 + 1, 0, TAU); ctx.stroke();
    drawBar(bxx, byy, bw, 13, (B.hp / B.maxhp) * fill, B.ghost / B.maxhp * fill, B.rage ? (B.type === 'art' ? '#5a9bff' : '#b04cff') : '#c93a3a', B.rage ? (B.type === 'art' ? '#1f3f9a' : '#4a1a90') : '#7a1212');
    if (B.rage) { ctx.font = '600 10px Cinzel, Georgia, serif'; ctx.fillStyle = B.type === 'art' ? '#bcd8ff' : '#d9b3ff'; ctx.fillText(B.type === 'art' ? 'PHASE TWO  -  +40% DAMAGE' : 'ENRAGED', W / 2, byy + 30); }
  }
  ctx.restore();
  if (phase === 'fight' && phaseT < 12) {
    ctx.save(); ctx.globalAlpha = clamp(1 - (phaseT - 8) / 4, 0, .8); ctx.font = '600 12px Cinzel, Georgia, serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#f0e2c0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    [primaryKey('left') + ' / ' + primaryKey('right') + ' move   ' + primaryKey('jump') + ' jump   ' + primaryKey('attack') + ' attack', primaryKey('dodge') + ' dodge (also in the air)   ' + primaryKey('parry') + ' parry', 'Hold ' + primaryKey('block') + ' to block (-25% damage)   ' + primaryKey('heal') + ' flask   Esc pause', primaryKey('skill1') + ' Sunray Slash   ' + primaryKey('skill2') + ' Cinder Bomb'].forEach((s, i) => ctx.fillText(s, W - 16, 26 + i * 17));
    ctx.restore();
  }
}
function drawIntro() {
  const t = phaseT, a = t < .5 ? t / .5 : t > 2.2 ? clamp(1 - (t - 2.2) / .6, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.72)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 205, W, 130);
  ctx.font = '900 40px Cinzel, Georgia, serif'; ctx.fillStyle = '#e9d6a4'; ctx.shadowColor = B.type === 'art' ? '#4a7dff' : '#7a3cff'; ctx.shadowBlur = 20; ctx.fillText(B.type === 'art' ? 'ARTORIAS' : 'THE VIOLET SENTINEL', W / 2, 262); ctx.shadowBlur = 0;
  ctx.font = '600 15px Cinzel, Georgia, serif'; ctx.fillStyle = '#b9a4d8'; ctx.fillText(B.type === 'art' ? 'The Abysswalker' : 'Warden of the Moonlit Nave', W / 2, 292);
  ctx.strokeStyle = 'rgba(201,164,90,.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(W / 2 - 170, 306); ctx.lineTo(W / 2 + 170, 306); ctx.stroke();
  ctx.restore();
}

/* ================= PVP DUEL (co-op mod: two Gilded Knights, online) =================
   One extra player palette (violet), a second self-contained physics/combat path that
   mirrors the single-player one but targets the other knight instead of a boss, and a
   small WebRTC (PeerJS) networking layer: the host runs the only authoritative
   simulation; the guest just forwards its key/button presses and displays whatever
   the host sends back. Because of that, the guest player will feel network latency
   (usually small on a good connection) and its hit-effects are a lightweight replay,
   not the exact same particles the host generated. */
const PAL_P2 = { dark: '#160a2e', mid: '#5a3aa0', light: '#c9a8ff', trim: '#e6d8ff', cloth: '#cfc0ea', cloth2: '#9d86c4', outline: '#0c0618', leg: '#4a2f82', legFar: '#301d58', blade: '#e2d4ff', bladeD: '#8a6ad0', grip: '#3a2566', guard: '#a488e0' };
const PVP_HW = 22, PVP_MAXHP = 500, PVP_MAXST = 140, PVP_FLASKS = 3;
let mode = 'boss'; // 'boss' = the single-player boss fights above; 'pvp' = the PVP module; 'coop' = the co-op module below
let PV1 = null, PV2 = null; // PV1 = host (gold), PV2 = guest (violet)
let CP1 = null, CP2 = null; // co-op fighters vs a shared boss: CP1 = host (gold), CP2 = guest (violet)
let pv = 'lobby', pvT = 0, pvWinner = 0; // pv: lobby|countdown|fight|over
const mp = { role: null, peer: null, conn: null, code: '', status: '', connected: false };
const remoteHeld = { left: 0, right: 0, down: 0, block: 0 };
const remoteBuf = { attack: 0, parry: 0, dodge: 0, jump: 0, heal: 0, skill1: 0, skill2: 0 };

function mkPV(x, face) {
  return {
    x, y: GROUND, vx: 0, vy: 0, face, hp: PVP_MAXHP, maxhp: PVP_MAXHP, st: PVP_MAXST, maxst: PVP_MAXST, stDelay: 0, flasks: PVP_FLASKS, maxFlasks: PVP_FLASKS,
    state: 'free', t: 0, combo: 0, hitDone: false, fxDone: false, invuln: 0, flash: 0, parrySucc: false, endT: .62, healed: false, plungeHit: false,
    deadT: 0, dodgeDir: 1, airAtk: false, parryFlash: 0, airDodged: false, landT: 0, stride: 0, blockFlash: 0, stunT: 0,
    skill1CD: 0, skill2CD: 0, skill1Fired: false, skill2Fired: false, skill2Hit: false
  };
}
function mpSnapField(o) { return { x: o.x, y: o.y, vy: o.vy, face: o.face, hp: o.hp, state: o.state, parrySucc: o.parrySucc }; }

/* ---- combat: mirrors startAttack/heroHit/hurtPlayer/parrySuccess above, generalized ---- */
function pvpStartAttack(ps, idx, dir) {
  const A = ATK[idx];
  ps.state = 'attack'; ps.t = 0; ps.combo = idx; ps.hitDone = false; ps.fxDone = false; ps.airAtk = ps.y < GROUND - 2;
  ps.st = Math.max(0, ps.st - A.cost); ps.stDelay = ps.st <= 0 ? 1.1 : .7;
  if (dir) ps.face = dir;
}
function pvpStartDodge(ps, dir) {
  ps.state = 'dodge'; ps.t = 0; ps.dodgeDir = dir || ps.face; ps.face = ps.dodgeDir; ps.invuln = Math.max(ps.invuln, .27);
  ps.st = Math.max(0, ps.st - 20); ps.stDelay = .55; sfx('dodge'); dust(ps.x, GROUND, 5);
}
function pvpStartAirDodge(ps, dir) {
  ps.state = 'airdash'; ps.t = 0; ps.airDodged = true; ps.dodgeDir = dir || ps.face; ps.face = ps.dodgeDir; ps.invuln = Math.max(ps.invuln, .24);
  ps.st = Math.max(0, ps.st - 20); ps.stDelay = .55; ps.vy = 0; sfx('dodge'); spark(ps.x, ps.y - 55, 8, '#ffe2a0', 280, .28, 0);
}
function pvpStartParry(ps, dir) {
  ps.state = 'parry'; ps.t = 0; ps.parrySucc = false; ps.endT = .62; ps.st = Math.max(0, ps.st - 8); ps.stDelay = .5; ps.vx *= .3;
  if (dir) ps.face = dir; tone(700, .1, 'triangle', .06, 200);
}
function pvpStartPlunge(ps) { ps.state = 'plunge'; ps.t = 0; ps.vy = 1050; ps.vx = 0; ps.plungeHit = false; ps.st = Math.max(0, ps.st - 18); ps.stDelay = .7; sfx('plunge'); }
function pvpStartHeal(ps) { ps.state = 'heal'; ps.t = 0; ps.healed = false; }
function pvpStartSkill1(ps, dir) { ps.state = 'skill1'; ps.t = 0; ps.skill1Fired = false; ps.skill1CD = SKILL1_CD; if (dir) ps.face = dir; ps.vx *= .3; }
function pvpStartSkill2(ps, dir) { ps.state = 'skill2'; ps.t = 0; ps.skill2Fired = false; ps.skill2Hit = false; ps.skill2CD = SKILL2_CD; if (dir) ps.face = dir; ps.vx = 0; sfx('charge'); }
function pvpFireSlash(ps) {
  sfx('skill1');
  slashes.push({ x: ps.x + ps.face * 30, y: ps.y - 78, face: ps.face, vx: ps.face * 1450, life: 1.0, t: 0, hit: false, rot: 0, owner: ps });
  addArc(ps.x, ps.y - 82, 90, ps.face > 0 ? -2.3 : -.85, ps.face > 0 ? .85 : 2.3, ps.face, .15, 'rgba(255,232,140,.95)', 9);
  spark(ps.x + ps.face * 26, ps.y - 78, 14, '#fff3b0', 440, .38);
}
function pvpReleaseSkill2(ps, opp) {
  sfx('skill2'); doShake(20); doFlash(.5, '255,170,90');
  const ox = ps.x + ps.face * 34, oy = ps.y - 46, R = 190;
  addRing(ox, oy, 14, R, .45, 'rgba(255,200,120,.95)', 10); addRing(ox, oy, 8, R * .7, .35, 'rgba(255,90,40,.85)', 14);
  spark(ox, oy, 40, '#ffcf7a', 650, .6, 240); spark(ox, oy, 18, '#ff5a30', 460, .5, 260); dust(ox, GROUND, 16);
  if (opp.state !== 'dead' && opp.invuln <= 0 && Math.abs(opp.x - ox) < R) { ps.skill2Hit = true; pvpHurt(opp, ps, 150, true); }
}
function pvpHurt(def, atk, dmg, heavy) {
  if (def.state === 'dead' || def.invuln > 0) return false;
  if (def.state === 'block') {
    dmg = Math.round(dmg * .75);
    def.hp = Math.max(0, def.hp - dmg); def.invuln = heavy ? .5 : .3; def.blockFlash = .2;
    def.vx = (def.x < atk.x ? -1 : 1) * (heavy ? 380 : 180);
    hitstop = Math.max(hitstop, heavy ? .08 : .05); doShake(heavy ? 9 : 5); sfx('block');
    spark(def.x + def.face * 26, def.y - 62, 12, '#cfe6ff', 400, .32); spark(def.x + def.face * 26, def.y - 62, 5, '#ffd98a', 280, .28);
    addText(def.x, def.y - 118, String(dmg), '#9fd0ff', 20, .8);
    if (def.hp <= 0) pvpKill(def); return true;
  }
  def.hp = Math.max(0, def.hp - dmg); def.flash = .14; def.invuln = heavy ? .6 : .4;
  def.state = 'hurt'; def.t = 0; def.vx = (def.x < atk.x ? -1 : 1) * (heavy ? 440 : 240); if (heavy) def.vy = -300;
  hitstop = Math.max(hitstop, heavy ? .11 : .07); doShake(heavy ? 13 : 8); sfx('hurt');
  spark(def.x, def.y - 55, 14, '#b3202a', 340, .42); spark(def.x, def.y - 55, 6, '#ffcf8a', 260, .35);
  addText(def.x, def.y - 118, String(dmg), '#ff6a5a', 22, .85);
  if (def.hp <= 0) pvpKill(def); return true;
}
function pvpKill(def) { def.state = 'dead'; def.deadT = 0; sfx('die'); doShake(14); doFlash(.5, '255,255,255'); pv = 'over'; pvT = 0; pvWinner = (def === PV1) ? 2 : 1; }
function pvpParrySuccess(def, atk) {
  def.parrySucc = true; def.endT = def.t + .22; def.st = Math.min(def.maxst, def.st + 30); def.parryFlash = .25;
  atk.state = 'stunned'; atk.t = 0; atk.stunT = 1.3; atk.hitDone = true;
  hitstop = Math.max(hitstop, .15); doShake(10); doFlash(.35, '255,235,190'); sfx('parry');
  const hx = (def.x + atk.x) / 2, hy = def.y - 66;
  spark(hx, hy, 26, '#fff2c8', 560, .5); spark(hx, hy, 12, '#ffb84a', 380, .4); addRing(hx, hy, 6, 80, .32, 'rgba(255,240,190,.95)', 5);
  addText(def.x, def.y - 130, 'PARRIED', '#ffe9a8', 24, 1);
}
function pvpTryHit(atk, A, def) {
  if (atk.hitDone || def.state === 'dead') return;
  const f = atk.face, lo = Math.min(atk.x - f * 8, atk.x + f * A.reach), hi = Math.max(atk.x - f * 8, atk.x + f * A.reach);
  if (!(def.x + PVP_HW > lo && def.x - PVP_HW < hi)) return;
  if (def.state === 'parry' && !def.parrySucc && def.t < PARRY_WIN && def.face === -f) { atk.hitDone = true; pvpParrySuccess(def, atk); return; }
  if (def.invuln > 0) { atk.hitDone = true; return; }
  atk.hitDone = true; pvpHurt(def, atk, A.thrust ? 68 : 55, atk.combo === 2);
}
function pvPhysics(ps, dt) {
  const wasAir = ps.y < GROUND - 1;
  if (ps.state !== 'plunge' && ps.state !== 'airdash') ps.vy += GRAV * dt;
  ps.y += ps.vy * dt; ps.x = clamp(ps.x + ps.vx * dt, 40, WORLD - 40);
  if (ps.y >= GROUND) { if (wasAir && ps.vy > 300) { dust(ps.x, GROUND, 6); ps.landT = .14; } if (wasAir) ps.airDodged = false; ps.y = GROUND; ps.vy = 0; }
}
function pvpUpdateOne(ps, inp, opp, dt) {
  const held = inp.held, buf = inp.buf;
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (ps.state === 'dead') { ps.deadT += dt; ps.vx *= .9; pvPhysics(ps, dt); return; }
  ps.t += dt; ps.invuln = Math.max(0, ps.invuln - dt); ps.flash = Math.max(0, ps.flash - dt); ps.parryFlash = Math.max(0, ps.parryFlash - dt); ps.blockFlash = Math.max(0, ps.blockFlash - dt); ps.landT = Math.max(0, ps.landT - dt);
  const grounded = ps.y >= GROUND - .5;
  ps.stride += (grounded ? Math.abs(ps.vx) : 0) * dt * .05;
  if (ps.stDelay > 0) ps.stDelay -= dt;
  else if (ps.state !== 'dodge' && ps.state !== 'attack' && ps.state !== 'airdash') ps.st = Math.min(ps.maxst, ps.st + (ps.state === 'free' ? 40 : ps.state === 'block' ? 32 : 22) * dt);
  ps.skill1CD = Math.max(0, ps.skill1CD - dt); ps.skill2CD = Math.max(0, ps.skill2CD - dt);
  switch (ps.state) {
    case 'free': {
      const target = dir * 250; ps.vx += (target - ps.vx) * Math.min(1, dt * (grounded ? 16 : 7)); if (dir) ps.face = dir;
      if (buf.jump > 0 && grounded) { ps.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(ps.x, GROUND, 4); }
      if (buf.dodge > 0 && ps.st > 0 && (grounded || !ps.airDodged)) { if (grounded) pvpStartDodge(ps, dir); else pvpStartAirDodge(ps, dir); buf.dodge = 0; }
      else if (buf.parry > 0 && grounded && ps.st > 0) { pvpStartParry(ps, dir); buf.parry = 0; }
      else if (buf.attack > 0 && ps.st > 0) { if (!grounded && held.down) pvpStartPlunge(ps); else pvpStartAttack(ps, 0, dir); buf.attack = 0; }
      else if (buf.heal > 0 && grounded && ps.flasks > 0 && ps.hp < ps.maxhp) { pvpStartHeal(ps); buf.heal = 0; }
      else if (buf.skill1 > 0 && grounded && ps.skill1CD <= 0) { pvpStartSkill1(ps, dir); buf.skill1 = 0; }
      else if (buf.skill2 > 0 && grounded && ps.skill2CD <= 0) { pvpStartSkill2(ps, dir); buf.skill2 = 0; }
      else if (held.block && grounded) { ps.state = 'block'; ps.t = 0; }
      break;
    }
    case 'attack': {
      const A = ATK[ps.combo], tot = A.w + A.a + A.r;
      if (ps.t < A.w + A.a) ps.vx = ps.airAtk ? ps.vx * .98 : ps.face * A.lunge / (A.w + A.a); else ps.vx *= .8;
      if (!ps.airAtk && opp.state !== 'dead' && (opp.x - ps.x) * ps.face > 0 && Math.abs(opp.x - ps.x) < 50) ps.vx = 0;
      if (!ps.fxDone && ps.t >= A.w) {
        ps.fxDone = true; sfx('swing');
        if (A.thrust) addStreak(ps.x + ps.face * 24, ps.y - 64, ps.face * (A.reach - 20), 'rgba(255,232,170,.95)');
        else addArc(ps.x, ps.y - 82, 84, A.a0, A.a1, ps.face, .13, 'rgba(255,214,140,.9)', 9);
      }
      if (ps.t >= A.w && ps.t < A.w + A.a) pvpTryHit(ps, A, opp);
      if (ps.t >= A.w + A.a + A.r * .6 && buf.attack > 0 && ps.st > 0 && ps.combo < 2) { pvpStartAttack(ps, ps.combo + 1, dir); buf.attack = 0; break; }
      if (ps.t >= A.w + A.a && buf.dodge > 0 && ps.st > 0 && (grounded || !ps.airDodged)) { if (grounded) pvpStartDodge(ps, dir); else pvpStartAirDodge(ps, dir); buf.dodge = 0; break; }
      if (ps.t >= A.w + A.a && buf.parry > 0 && grounded && ps.st > 0) { pvpStartParry(ps, dir); buf.parry = 0; break; }
      if (ps.t >= tot) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'airdash': {
      const k = ps.t / .26; ps.vx = ps.dodgeDir * 680 * (1 - k * .45); ps.vy = 0;
      parts.push({ k: 'dot', x: ps.x, y: ps.y - rnd(30, 80), vx: 0, vy: 0, life: .26, t: 0, col: '255,224,160', g: 0, drag: 1, sz: rnd(4, 7) });
      if (ps.t >= .26) { ps.state = 'free'; ps.t = 0; ps.vx *= .45; ps.vy = 80; }
      break;
    }
    case 'skill1': { ps.vx *= .8; if (!ps.skill1Fired && ps.t >= .1) { ps.skill1Fired = true; pvpFireSlash(ps); } if (ps.t >= .3) { ps.state = 'free'; ps.t = 0; } break; }
    case 'skill2': {
      ps.vx *= .7;
      if (ps.t < .55 && Math.random() < .7) parts.push({ k: 'dot', x: ps.x + ps.face * 14 + rnd(-6, 6), y: ps.y - 62 + rnd(-8, 8), vx: rnd(-8, 8), vy: rnd(-30, -6), life: .32, t: 0, col: '255,150,60', g: 0, drag: 1, sz: rnd(2, 5) });
      if (!ps.skill2Fired && ps.t >= .55) { ps.skill2Fired = true; pvpReleaseSkill2(ps, opp); }
      if (ps.t >= .82) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'block': {
      if (dir) ps.face = dir; ps.vx += (dir * 90 - ps.vx) * Math.min(1, dt * 14);
      if (buf.jump > 0 && grounded) { ps.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(ps.x, GROUND, 4); ps.state = 'free'; ps.t = 0; break; }
      if (buf.dodge > 0 && ps.st > 0) { pvpStartDodge(ps, dir); buf.dodge = 0; break; }
      if (buf.parry > 0 && ps.st > 0) { pvpStartParry(ps, dir); buf.parry = 0; break; }
      if (buf.attack > 0 && ps.st > 0) { pvpStartAttack(ps, 0, dir); buf.attack = 0; break; }
      if (buf.heal > 0 && ps.flasks > 0 && ps.hp < ps.maxhp) { pvpStartHeal(ps); buf.heal = 0; break; }
      if (buf.skill1 > 0 && ps.skill1CD <= 0) { pvpStartSkill1(ps, dir); buf.skill1 = 0; break; }
      if (buf.skill2 > 0 && ps.skill2CD <= 0) { pvpStartSkill2(ps, dir); buf.skill2 = 0; break; }
      if (!held.block || !grounded) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'dodge': {
      const k = ps.t / .34; ps.vx = ps.dodgeDir * 720 * (1 - k * .55);
      if (Math.random() < .5) dust(ps.x - ps.dodgeDir * 10, GROUND, 1);
      if (ps.t >= .34) { ps.state = 'free'; ps.t = 0; ps.vx *= .3; }
      break;
    }
    case 'parry': { ps.vx *= .8; if (ps.t >= ps.endT) { ps.state = 'free'; ps.t = 0; } break; }
    case 'plunge': {
      ps.vx = 0; ps.vy = 1050;
      if (!ps.plungeHit && opp.state !== 'dead' && opp.invuln <= 0 && Math.abs(ps.x - opp.x) < PVP_HW + 24 && (GROUND - ps.y) < 140 && (GROUND - ps.y) > 4) {
        ps.plungeHit = true; pvpHurt(opp, ps, 75, false); ps.state = 'free'; ps.t = 0; ps.vy = -540; ps.vx = -ps.face * 110; spark(ps.x, ps.y, 10, '#ffe2a0', 380, .38);
      }
      break;
    }
    case 'hurt': { ps.vx *= .92; if (ps.t > .3) { ps.state = 'free'; ps.t = 0; } break; }
    case 'heal': {
      ps.vx = dir * 60;
      if (!ps.healed && ps.t >= .5) {
        ps.healed = true; ps.flasks--; const before = ps.hp; ps.hp = Math.min(ps.maxhp, ps.hp + Math.round(ps.maxhp * .4)); sfx('heal');
        addText(ps.x, ps.y - 125, '+' + Math.round(ps.hp - before), '#8ef07a', 22, 1);
        for (let i = 0; i < 20; i++) parts.push({ k: 'dot', x: ps.x + rnd(-16, 16), y: ps.y - rnd(10, 80), vx: rnd(-20, 20), vy: rnd(-80, -30), life: rnd(.5, 1), t: 0, col: '140,240,120', g: 0, drag: 1, sz: rnd(2, 4) });
      }
      if (ps.t >= .85) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'stunned': { ps.vx *= .85; ps.stunT -= dt; if (ps.stunT <= 0) { ps.state = 'free'; ps.t = 0; } break; }
  }
  pvPhysics(ps, dt);
  if (ps.state === 'plunge' && ps.y >= GROUND) {
    ps.y = GROUND; ps.vy = 0; sfx('boom'); doShake(8); dust(ps.x, GROUND, 12); addRing(ps.x, GROUND - 4, 8, 100, .28, 'rgba(255,225,160,.8)', 4);
    if (!ps.plungeHit && opp.state !== 'dead' && opp.invuln <= 0 && Math.abs(ps.x - opp.x) < 100) { ps.plungeHit = true; pvpHurt(opp, ps, 75, false); }
    ps.state = 'free'; ps.t = 0;
  }
}
function pvpUpdateSlashes(dt) {
  for (let i = slashes.length - 1; i >= 0; i--) {
    const p = slashes[i]; p.t += dt; p.x += p.vx * dt; p.rot += dt * 26;
    if (Math.random() < .8) parts.push({ k: 'dot', x: p.x - p.face * 14, y: p.y + rnd(-6, 6), vx: -p.face * 40, vy: rnd(-8, 8), life: .2, t: 0, col: '255,224,140', g: 0, drag: 2, sz: rnd(3, 6) });
    let dead = p.t > p.life || p.x < -60 || p.x > WORLD + 60;
    const opp = p.owner === PV1 ? PV2 : PV1;
    if (!p.hit && opp.state !== 'dead' && opp.invuln <= 0) {
      const lo = Math.min(p.x - 16, p.x + 16), hi = Math.max(p.x - 16, p.x + 16);
      if (opp.x + PVP_HW > lo && opp.x - PVP_HW < hi) { p.hit = true; dead = true; pvpHurt(opp, p.owner, 95, false); spark(p.x, p.y, 22, '#fff3b0', 500, .45); addRing(p.x, p.y, 6, 60, .28, 'rgba(255,232,140,.9)', 5); }
    }
    if (dead) slashes.splice(i, 1);
  }
}

/* ---- host-authoritative tick / guest display tick ---- */
function pvpStep(dt) {
  if (mp.role === 'guest') { pvpGuestTick(dt); return; }
  if (pv === 'lobby') { time += dt; updateFx(dt); return; }
  if (pv === 'countdown') {
    pvT += dt; time += dt;
    if (pvT >= 3) { pv = 'fight'; pvT = 0; musicPlay('battleSent'); }
    netMaybeSend(); return;
  }
  if (pv === 'fight') {
    if (hitstop > 0) { hitstop -= dt; updateFx(dt * .15); netMaybeSend(); return; }
    pvT += dt; time += dt;
    pvpUpdateOne(PV1, { held, buf }, PV2, dt);
    pvpUpdateOne(PV2, { held: remoteHeld, buf: remoteBuf }, PV1, dt);
    pvpUpdateSlashes(dt); updateFx(dt);
    const tx = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W); cam += (tx - cam) * Math.min(1, dt * 4);
    shake *= .88; if (shake < .2) shake = 0; screenFlash = Math.max(0, screenFlash - dt * 1.6);
    for (const k in buf) buf[k] = Math.max(0, buf[k] - dt);
    for (const k in remoteBuf) remoteBuf[k] = Math.max(0, remoteBuf[k] - dt);
    netMaybeSend();
    if (pv === 'over') { musicStop(1.6); showPvpEnd(); netMaybeSend(); }
    return;
  }
  if (pv === 'over') { pvT += dt; time += dt; updateFx(dt); return; }
}
let netAccum = 0;
function netMaybeSend() {
  if (!mp.conn || !mp.conn.open) return;
  netSend({ t: 'state', p1: pvpSnapOut(PV1), p2: pvpSnapOut(PV2), pv, pvT, pvWinner, cam, time, shake, screenFlash, screenFlashCol });
}
function pvpSnapOut(ps) {
  return {
    x: ps.x, y: ps.y, vx: ps.vx, vy: ps.vy, face: ps.face, hp: ps.hp, maxhp: ps.maxhp, st: ps.st, maxst: ps.maxst, flasks: ps.flasks,
    state: ps.state, t: ps.t, combo: ps.combo, invuln: ps.invuln, flash: ps.flash, parrySucc: ps.parrySucc, endT: ps.endT,
    dodgeDir: ps.dodgeDir, airAtk: ps.airAtk, parryFlash: ps.parryFlash, blockFlash: ps.blockFlash, stride: ps.stride,
    skill1CD: ps.skill1CD, skill2CD: ps.skill2CD, deadT: ps.deadT, landT: ps.landT, healed: ps.healed
  };
}
function pvpGuestTick(dt) {
  time += dt; updateFx(dt);
  if (PV1 && PV2) { const tx = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W); cam += (tx - cam) * Math.min(1, dt * 4); }
  shake *= .88; if (shake < .2) shake = 0; screenFlash = Math.max(0, screenFlash - dt * 1.6);
  netGuestSendInput();
}
function netGuestSendInput() {
  if (!mp.conn || !mp.conn.open) return;
  const edges = []; for (const k in buf) if (buf[k] > 0) { edges.push(k); buf[k] = 0; }
  netSend({ t: 'input', held: { left: held.left, right: held.right, down: held.down, block: held.block }, edges });
}
function pvpGuestReact(prevP, curP) {
  if (!prevP || !curP) return;
  if (curP.hp < prevP.hp) {
    const dmg = prevP.hp - curP.hp;
    if (curP.state === 'block') { spark(curP.x + curP.face * 26, curP.y - 62, 10, '#cfe6ff', 380, .3); sfx('block'); addText(curP.x, curP.y - 118, String(dmg), '#9fd0ff', 18, .7); }
    else { spark(curP.x, curP.y - 55, 12, '#b3202a', 320, .4); sfx('hurt'); addText(curP.x, curP.y - 118, String(dmg), '#ff6a5a', 20, .75); }
    doShake(6);
  }
  if (curP.state === 'parry' && curP.parrySucc && !prevP.parrySucc) { sfx('parry'); doFlash(.3, '255,235,190'); spark(curP.x, curP.y - 66, 18, '#fff2c8', 460, .4); addText(curP.x, curP.y - 130, 'PARRIED', '#ffe9a8', 22, .9); }
  if (curP.state === 'dodge' && prevP.state !== 'dodge') { sfx('dodge'); dust(curP.x, GROUND, 4); }
  if (curP.state === 'heal' && prevP.state !== 'heal') sfx('heal');
  if (curP.state === 'dead' && prevP.state !== 'dead') { sfx('die'); doShake(12); }
}

/* ---- networking (PeerJS, free public broker; no server of ours needed) ---- */
function mpHasPeer() { return typeof Peer !== 'undefined'; }
function mpSetStatus(s) { mp.status = s; const el = $('mpStatus'); if (el) el.textContent = s; }
function mpMakeCode() { const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += CH[Math.floor(Math.random() * CH.length)]; return s; }
function mpTeardown() {
  try { if (mp.conn) mp.conn.close(); } catch (e) { }
  try { if (mp.peer) mp.peer.destroy(); } catch (e) { }
  mp.role = null; mp.peer = null; mp.conn = null; mp.code = ''; mp.connected = false;
  PV1 = null; PV2 = null; pv = 'lobby'; pvT = 0; pvWinner = 0;
  CP1 = null; CP2 = null;
  slashes.length = 0; orbs.length = 0; parts.length = 0; fx.length = 0;
  $('pvpLeaveBtn').classList.add('hide');
}
function mpHost() {
  if (!mpHasPeer()) { mpSetStatus('No internet connection available for online play.'); return; }
  mpTeardown(); mode = 'pvp'; mp.role = 'host'; mp.code = mpMakeCode();
  mpSetStatus('Opening lobby\u2026');
  try { mp.peer = new Peer('gkd-' + mp.code); } catch (e) { mpSetStatus('Could not start hosting.'); return; }
  mp.peer.on('open', () => { $('mpCodeBig').textContent = mp.code; mpSetStatus('Waiting for an opponent to join\u2026'); });
  mp.peer.on('connection', c => { if (mp.conn) { c.close(); return; } mp.conn = c; mpWireConn(c); });
  mp.peer.on('error', e => { mpSetStatus('Connection error \u2014 try a new lobby.'); });
}
function mpJoin(code) {
  if (!mpHasPeer()) { mpSetStatus('No internet connection available for online play.'); return; }
  mpTeardown(); mode = 'pvp'; mp.role = 'guest'; mp.code = (code || '').trim().toUpperCase();
  if (mp.code.length < 3) { mpSetStatus('Enter the 5-letter code your opponent shared.'); return; }
  mpSetStatus('Connecting\u2026');
  try { mp.peer = new Peer(); } catch (e) { mpSetStatus('Could not connect.'); return; }
  mp.peer.on('open', () => { const c = mp.peer.connect('gkd-' + mp.code, { reliable: true }); mp.conn = c; mpWireConn(c); });
  mp.peer.on('error', e => { mpSetStatus(e && e.type === 'peer-unavailable' ? 'No lobby found with that code.' : 'Connection error.'); });
}
function mpWireConn(c) {
  c.on('open', () => {
    mp.connected = true; mpSetStatus('Connected! Starting duel\u2026');
    if (mp.role === 'host') { PV1 = mkPV(760, 1); PV2 = mkPV(1040, -1); pv = 'countdown'; pvT = 0; pvWinner = 0; cam = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W); netSend({ t: 'start', x1: 760, x2: 1040 }); pvpEnterDuelUI(); }
  });
  c.on('data', d => netOnData(d));
  c.on('close', () => mpOnDisconnect());
  c.on('error', () => mpOnDisconnect());
}
function mpOnDisconnect() {
  if (mode === 'pvp' && (pv === 'countdown' || pv === 'fight')) { pv = 'over'; pvT = 0; pvWinner = 0; showPvpEnd(true); }
  mp.connected = false;
}
function netSend(obj) { if (mp.conn && mp.conn.open) { try { mp.conn.send(obj); } catch (e) { } } }
function netOnData(d) {
  if (!d || !d.t) return;
  if (d.t === 'start') { PV1 = mkPV(d.x1, 1); PV2 = mkPV(d.x2, -1); pv = 'countdown'; pvT = 0; pvWinner = 0; cam = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W); pvpEnterDuelUI(); }
  else if (d.t === 'state') {
    if (!PV1 || !PV2) { PV1 = mkPV(760, 1); PV2 = mkPV(1040, -1); pvpEnterDuelUI(); }
    const prev1 = mpSnapField(PV1), prev2 = mpSnapField(PV2);
    Object.assign(PV1, d.p1); Object.assign(PV2, d.p2);
    pv = d.pv; pvT = d.pvT; pvWinner = d.pvWinner; cam = d.cam; time = d.time; shake = d.shake; screenFlash = d.screenFlash; screenFlashCol = d.screenFlashCol;
    pvpGuestReact(prev1, PV1); pvpGuestReact(prev2, PV2);
    if (pv === 'over') showPvpEnd();
  } else if (d.t === 'input') { Object.assign(remoteHeld, d.held); for (const k of d.edges || []) remoteBuf[k] = BUF; }
  else if (d.t === 'rematch') { PV1 = mkPV(d.x1, 1); PV2 = mkPV(d.x2, -1); pv = 'countdown'; pvT = 0; pvWinner = 0; cam = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W); pvpEnterDuelUI(); }
  else if (d.t === 'quit') { if (pv === 'countdown' || pv === 'fight') { pv = 'over'; pvT = 0; pvWinner = 0; showPvpEnd(true); } }
}

/* ---- UI plumbing ---- */
function pvpEnterDuelUI() {
  $('title').classList.add('hide'); $('mp').classList.add('hide'); $('pvpEnd').classList.add('hide'); $('mpQuit').classList.add('hide');
  $('pvpLeaveBtn').classList.remove('hide'); clearInputState();
}
function showPvpEnd(disconnected) {
  $('pvpLeaveBtn').classList.add('hide');
  const iAmWinner = (mp.role === 'host' && pvWinner === 1) || (mp.role === 'guest' && pvWinner === 2);
  $('pvpEndTitle').textContent = disconnected ? 'OPPONENT LEFT' : (iAmWinner ? 'VICTORY' : 'DEFEAT');
  $('pvpEndSub').textContent = disconnected ? 'The duel ended early.' : (iAmWinner ? 'Your opponent has fallen.' : 'You have fallen.');
  $('pvpRematchBtn').classList.toggle('hide', !!disconnected || mp.role !== 'host');
  $('pvpEnd').classList.remove('hide');
}
function pvpLeaveToMenu() { mode = 'boss'; mpTeardown(); toTitle(); }
function mpOpenQuitConfirm() { $('mpQuit').classList.remove('hide'); }
function pvpDrawCountdown() {
  const n = Math.max(0, 3 - Math.floor(pvT));
  ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 84px Cinzel, Georgia, serif'; ctx.fillStyle = '#f0dca0'; ctx.shadowColor = '#000'; ctx.shadowBlur = 18;
  ctx.fillText(n > 0 ? String(n) : 'FIGHT!', W / 2, H / 2); ctx.restore();
}
function pvpDrawHUD() {
  if (!PV1 || !PV2) return;
  ctx.save();
  const side = (ps, x0, label, flip, col1, col2) => {
    const bx = flip ? W - x0 - 270 : x0;
    drawBar(bx, 24, 270, 17, ps.hp / ps.maxhp, 0, col1, col2);
    ctx.font = '700 12px Cinzel, Georgia, serif'; ctx.textAlign = flip ? 'right' : 'left'; ctx.fillStyle = '#f2e6c8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.fillText(Math.ceil(ps.hp) + ' / ' + ps.maxhp, flip ? bx + 264 : bx + 6, 37); ctx.shadowBlur = 0;
    drawBar(bx, 50, 200, 9, ps.st / ps.maxst, 0, ps.st < 15 ? '#e0a040' : '#5fd6a0', ps.st < 15 ? '#8a5a14' : '#1f8a68');
    ctx.font = '700 11px Cinzel, Georgia, serif'; ctx.fillStyle = flip ? '#e2c8ff' : '#f0d68e'; ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(label, flip ? bx + 200 : bx, 68);
    for (let i = 0; i < PVP_FLASKS; i++) drawFlask(flip ? bx + 200 - i * 15 : bx + 8 + i * 15, 80, i < ps.flasks);
  };
  side(PV1, 16, mp.role === 'host' ? 'YOU (HOST)' : 'HOST', false, '#e0403c', '#8a1414');
  side(PV2, 16, mp.role === 'guest' ? 'YOU (GUEST)' : 'OPPONENT', true, '#c98aff', '#5a2090');
  ctx.restore();
}
function heroObjFrom(ps, pal) {
  const air = ps.y < GROUND - 3;
  const o = { kind: 'hero', pal, scale: 1.05, x: ps.x, y: ps.y, face: ps.face, t: time, run: 0, air, swordA: 1.3, handR: 28, crouch: 0, lean: 0, shieldK: 0, flash: ps.flash > 0, alpha: 1, glow: 0, runSpeed: 10, clothSway: 0, phase: ps.stride };
  o.run = (ps.state === 'free' && !air) ? Math.min(1, Math.abs(ps.vx) / 240) : 0;
  o.swordA = 1.3 + Math.sin(time * 2) * .03 - o.run * .35;
  o.lean = o.run * .09; o.crouch = (ps.state === 'free' && !air) ? 9 * (ps.landT / .14) : 0;
  if (ps.invuln > 0 && ps.state !== 'dodge' && Math.floor(time * 30) % 2) o.alpha = .5;
  switch (ps.state) {
    case 'attack': {
      const A = ATK[ps.combo], t = ps.t; let a;
      if (t < A.w) a = lerp(1.3, A.a0, easeOut(t / A.w));
      else if (t < A.w + A.a) { const k = (t - A.w) / A.a; a = lerp(A.a0, A.a1, ease(k)); o.lean = .16 * ease(k); if (A.thrust) o.handR = lerp(12, 38, k); o.glow = 14; }
      else { const k = Math.min(1, (t - A.w - A.a) / A.r); a = lerp(A.a1, 1.3, k * k); o.lean = .16 * (1 - k); if (A.thrust) o.handR = lerp(38, 28, k); }
      o.swordA = a; o.run = 0; break;
    }
    case 'dodge': o.slide = true; o.crouch = 22; o.lean = .6; o.swordA = 2.7; o.run = 0; o.air = false; break;
    case 'parry': o.shieldK = Math.min(1, ps.t / .07); o.swordA = 2.3; o.lean = .06; o.shieldGlow = ps.t < PARRY_WIN && !ps.parrySucc || ps.parryFlash > 0; o.run = 0; break;
    case 'hurt': o.lean = -.28; o.swordA = 1.9; o.run = 0; break;
    case 'airdash': o.air = true; o.lean = .55; o.swordA = 2.6; o.run = 0; o.clothSway = -8; break;
    case 'block': o.shieldK = .8; o.swordA = 2.2; o.lean = .04; o.crouch = 4; o.run = Math.min(1, Math.abs(ps.vx) / 120) * .5; o.shieldGlow = ps.blockFlash > 0 ? '#bfe0ff' : false; break;
    case 'heal': o.drink = Math.min(1, ps.t / .5); o.crouch = 5; o.lean = .1; o.shieldK = -1; o.offTarget = { x: 14, y: -88 }; o.swordA = 1.55; o.run = 0; break;
    case 'skill1': { const k = clamp(ps.t / .3, 0, 1); o.swordA = k < .33 ? lerp(1.3, -2.1, easeOut(k / .33)) : k < .5 ? lerp(-2.1, .9, (k - .33) / .17) : lerp(.9, 1.3, (k - .5) / .5); o.lean = .1 * Math.sin(k * Math.PI); o.glow = k < .5 ? 16 : 0; o.run = 0; break; }
    case 'skill2': {
      const chargeT = .55, k = Math.min(1, ps.t / chargeT);
      if (ps.t < chargeT) { o.crouch = 6 * k; o.lean = -.08 * k; o.swordA = lerp(1.3, 1.05, k); o.shieldK = -1; o.offTarget = { x: lerp(6, -8, k), y: lerp(-70, -56, k) }; o.glow = 4 + 14 * k; }
      else { const k2 = Math.min(1, (ps.t - chargeT) / .27); o.lean = .28 * (1 - k2); o.swordA = lerp(-.3, 1.3, k2); o.offTarget = { x: 10, y: -60 }; o.glow = 18 * (1 - k2); }
      o.run = 0; break;
    }
    case 'plunge': o.swordA = 1.5; o.lean = .12; o.handR = 30; o.air = true; break;
    case 'dead': o.rot = -Math.min(1.5, ps.deadT * 3.5); o.run = 0; o.alpha = clamp(1 - (ps.deadT - 1) * .8, .25, 1); break;
    case 'stunned': o.lean = -.15 + Math.sin(time * 14) * .05; o.swordA = 1.6; o.run = 0; break;
    case 'free': if (air) { o.swordA = 1.1; o.lean = .05; } break;
  }
  return o;
}
function pvpRenderFrame() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
  if (!LAY.far) return;
  const snap = v => Math.round(v * RS) / RS;
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake * .7 : 0;
  ctx.drawImage(LAY.far, snap(-cam * .12 + sx * .2), snap(sy * .2), W + (WORLD - W) * .12, H);
  ctx.drawImage(LAY.mid, snap(-cam * .35 + sx * .5), snap(sy * .5), W + (WORLD - W) * .35, H);
  ctx.drawImage(LAY.near, snap(-cam * .8 + sx * .8), snap(sy * .8), W + (WORLD - W) * .8, H);
  ctx.save(); ctx.translate(snap(-cam + sx), snap(sy));
  ctx.drawImage(LAY.ground, 0, 430, WORLD, H - 430);
  const fo = Math.round((time * 9) % 1400); ctx.globalAlpha = .9; ctx.drawImage(LAY.fog, Math.round(cam) - fo, 330, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - fo + 1400, 330, 1400, 220); ctx.globalAlpha = 1;
  drawBlades(430, GROUND + 6); drawFlowers(0, GROUND);
  if (PV1 && PV2) {
    const o1 = heroObjFrom(PV1, PAL_H), o2 = heroObjFrom(PV2, PAL_P2);
    drawShadow(PV1.x, 0, 22, clamp((GROUND - PV1.y) / 170, 0, 1)); drawShadow(PV2.x, 0, 22, clamp((GROUND - PV2.y) / 170, 0, 1));
    if (PV1.x <= PV2.x) { drawKnight(ctx, o1); drawKnight(ctx, o2); } else { drawKnight(ctx, o2); drawKnight(ctx, o1); }
  }
  drawSlashes(); drawParts(); drawFx();
  drawBlades(GROUND + 6, 600); drawFlowers(GROUND, 600);
  for (const m of motes) { if (m.x < cam - 10 || m.x > cam + W + 10) continue; const a = .25 + .3 * Math.sin(time * 2 + m.ph); ctx.fillStyle = 'rgba(240,235,255,' + a + ')'; if (m.petal) { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(time + m.ph); ctx.beginPath(); ctx.ellipse(0, 0, m.s * 1.6, m.s * .8, 0, 0, TAU); ctx.fill(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(m.x, m.y, m.s * .6, 0, TAU); ctx.fill(); } }
  { const f2 = Math.round(fo * 1.4) % 1400; ctx.globalAlpha = .55; ctx.drawImage(LAY.fog, Math.round(cam) - f2, 400, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - f2 + 1400, 400, 1400, 220); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.drawImage(LAY.vig, 0, 0, W, H);
  if (screenFlash > 0) { ctx.fillStyle = 'rgba(' + screenFlashCol + ',' + Math.min(.7, screenFlash) + ')'; ctx.fillRect(0, 0, W, H); }
  pvpDrawHUD();
  if (pv === 'countdown') pvpDrawCountdown();
  if (pv === 'over') { const k = clamp(pvT / 1.5, 0, 1); ctx.fillStyle = 'rgba(0,0,0,' + (.35 * k) + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ---- wire up the menu ---- */
$('openMp').addEventListener('click', () => {
  mode = 'pvp'; mpTeardown(); $('title').classList.add('hide'); $('mp').classList.remove('hide');
  $('mpChoice').classList.remove('hide'); $('mpHostPane').classList.add('hide'); $('mpJoinPane').classList.add('hide'); mpSetStatus('');
});
$('mpBack').addEventListener('click', () => { mode = 'boss'; mpTeardown(); $('mp').classList.add('hide'); $('title').classList.remove('hide'); });
$('mpHostBtn').addEventListener('click', () => { ac(); $('mpChoice').classList.add('hide'); $('mpHostPane').classList.remove('hide'); mpHost(); });
$('mpJoinBtn').addEventListener('click', () => { ac(); $('mpChoice').classList.add('hide'); $('mpJoinPane').classList.remove('hide'); $('mpCodeInput').value = ''; mpSetStatus(''); setTimeout(() => $('mpCodeInput').focus(), 30); });
$('mpCancelHost').addEventListener('click', () => { mpTeardown(); mode = 'pvp'; $('mpHostPane').classList.add('hide'); $('mpChoice').classList.remove('hide'); mpSetStatus(''); });
$('mpCancelJoin').addEventListener('click', () => { mpTeardown(); mode = 'pvp'; $('mpJoinPane').classList.add('hide'); $('mpChoice').classList.remove('hide'); mpSetStatus(''); });
$('mpConnectBtn').addEventListener('click', () => mpJoin($('mpCodeInput').value));
$('mpCodeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('mpCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoin($('mpCodeInput').value); });
$('pvpRematchBtn').addEventListener('click', () => {
  if (mp.role !== 'host') return;
  PV1 = mkPV(760, 1); PV2 = mkPV(1040, -1); pv = 'countdown'; pvT = 0; pvWinner = 0; cam = clamp((PV1.x + PV2.x) / 2 - W / 2, 0, WORLD - W);
  netSend({ t: 'rematch', x1: 760, x2: 1040 }); pvpEnterDuelUI();
});
$('pvpMenuBtn').addEventListener('click', () => { netSend({ t: 'quit' }); pvpLeaveToMenu(); });
$('pvpLeaveBtn').addEventListener('click', mpOpenQuitConfirm);
$('mpQuitStay').addEventListener('click', () => $('mpQuit').classList.add('hide'));
$('mpQuitLeave').addEventListener('click', () => { $('mpQuit').classList.add('hide'); if (mode === 'coop') { netSend({ t: 'quit' }); coopLeaveToMenu(); } else { netSend({ t: 'quit' }); pvpLeaveToMenu(); } });

/* ================= CO-OP DUEL (fight a boss together) =================
   Reuses the boss AI wholesale (bossChoose/updateBoss/updateArt/bossStrike/
   artSlam/artBlast/the beam & explosion & orb code above): the single-player
   `P` object is temporarily pointed at whichever of the two co-op fighters
   the boss is closest to, purely so the existing chase/face/choose-attack
   code keeps working unmodified. The boss's actual damage-dealing checks
   (patched above wherever `mode === 'coop'`) test both real fighters. Each
   fighter's own movement/attack/parry/block/dodge/heal/skills mirror the
   single-player hero exactly, just parameterized so two can exist at once.
   Same host-authoritative model as the PVP module above. */
function mkCoPlayer(x, face) {
  return {
    x, y: GROUND, vx: 0, vy: 0, face, hp: 500, maxhp: 500, ghost: 500, ghostDelay: 0, st: 140, maxst: 140, stDelay: 0, flasks: 7, maxFlasks: 7,
    state: 'free', t: 0, combo: 0, hitDone: false, fxDone: false, invuln: 0, flash: 0, parrySucc: false, endT: .62, healed: false, plungeHit: false,
    deadT: 0, dodgeDir: 1, airAtk: false, parryFlash: 0, airDodged: false, landT: 0, stride: 0, blockFlash: 0,
    skill1CD: 0, skill2CD: 0, skill1Fired: false, skill2Fired: false, skill2Hit: false
  };
}
let coBossType = 'sentinel';
function coStartAttack(ps, idx, dir) {
  const A = ATK[idx];
  ps.state = 'attack'; ps.t = 0; ps.combo = idx; ps.hitDone = false; ps.fxDone = false; ps.airAtk = ps.y < GROUND - 2;
  ps.st = Math.max(0, ps.st - A.cost); ps.stDelay = ps.st <= 0 ? 1.1 : .7;
  if (dir) ps.face = dir;
}
function coHeroHit(ps, A) {
  if (ps.hitDone || B.state === 'dead' || B.state === 'intro') return;
  const lo = Math.min(ps.x - ps.face * 8, ps.x + ps.face * A.reach), hi = Math.max(ps.x - ps.face * 8, ps.x + ps.face * A.reach);
  const pb = GROUND - ps.y, bb = B.h;
  if (B.x + B.hw > lo && B.x - B.hw < hi && pb + 125 > bb && pb - 20 < bb + B.hh) { ps.hitDone = true; hitBoss(120, ps.combo === 2 ? .08 : .04); }
}
function coStartDodge(ps, dir) {
  ps.state = 'dodge'; ps.t = 0; ps.dodgeDir = dir || ps.face; ps.face = ps.dodgeDir; ps.invuln = Math.max(ps.invuln, .27);
  ps.st = Math.max(0, ps.st - 20); ps.stDelay = .55; sfx('dodge'); dust(ps.x, GROUND, 5);
}
function coStartAirDodge(ps, dir) {
  ps.state = 'airdash'; ps.t = 0; ps.airDodged = true; ps.dodgeDir = dir || ps.face; ps.face = ps.dodgeDir; ps.invuln = Math.max(ps.invuln, .24);
  ps.st = Math.max(0, ps.st - 20); ps.stDelay = .55; ps.vy = 0; sfx('dodge'); spark(ps.x, ps.y - 55, 10, '#ffe2a0', 300, .3, 0);
}
function coStartParry(ps, dir) {
  ps.state = 'parry'; ps.t = 0; ps.parrySucc = false; ps.endT = .62; ps.st = Math.max(0, ps.st - 8); ps.stDelay = .5; ps.vx *= .3;
  if (dir) ps.face = dir; tone(700, .1, 'triangle', .06, 200);
}
function coStartPlunge(ps) { ps.state = 'plunge'; ps.t = 0; ps.vy = 1050; ps.vx = 0; ps.plungeHit = false; ps.st = Math.max(0, ps.st - 18); ps.stDelay = .7; sfx('plunge'); }
function coStartHeal(ps) { ps.state = 'heal'; ps.t = 0; ps.healed = false; }
function coStartSkill1(ps, dir) { ps.state = 'skill1'; ps.t = 0; ps.skill1Fired = false; ps.skill1CD = SKILL1_CD; if (dir) ps.face = dir; ps.vx *= .3; }
function coStartSkill2(ps, dir) { ps.state = 'skill2'; ps.t = 0; ps.skill2Fired = false; ps.skill2Hit = false; ps.skill2CD = SKILL2_CD; if (dir) ps.face = dir; ps.vx = 0; sfx('charge'); }
function coFireSlash(ps) {
  sfx('skill1');
  const pb = GROUND - ps.y;
  slashes.push({ x: ps.x + ps.face * 30, y: ps.y - 78, face: ps.face, vx: ps.face * 1500, life: 1.1, t: 0, hit: false, pb, rot: 0 });
  addArc(ps.x, ps.y - 82, 92, ps.face > 0 ? -2.3 : -.85, ps.face > 0 ? .85 : 2.3, ps.face, .16, 'rgba(255,232,140,.95)', 10);
  spark(ps.x + ps.face * 26, ps.y - 78, 16, '#fff3b0', 460, .4);
}
function coReleaseSkill2(ps) {
  sfx('skill2'); doShake(22); doFlash(.6, '255,170,90');
  const ox = ps.x + ps.face * 34, oy = ps.y - 46, R = 200;
  addRing(ox, oy, 16, R, .5, 'rgba(255,200,120,.95)', 11); addRing(ox, oy, 8, R * .7, .4, 'rgba(255,90,40,.85)', 15);
  spark(ox, oy, 46, '#ffcf7a', 700, .7, 260); spark(ox, oy, 22, '#ff5a30', 520, .55, 300); dust(ox, GROUND, 20); petals(ox, GROUND, 30, 500);
  const reach = B.hw + 150, bb = B.h, pb = GROUND - ps.y;
  if (B.state !== 'dead' && B.state !== 'intro' && Math.abs(B.x - ox) < reach && pb + 140 > bb && pb - 30 < bb + B.hh) {
    ps.skill2Hit = true; hitBoss(800, .16);
    if (B.state !== 'dead') { B.state = 'stunned'; B.stunT = 2.2; B.phase = ''; B.combo = null; B.hitDone = true; }
    addText(B.x, GROUND - (B.type === 'art' ? 195 : 175), 'STAGGERED', '#ffcf7a', 24, 1.1);
  }
}
function coHurtPlayer(ps, dmg, srcX, heavy) {
  if (ps.state === 'dead' || ps.invuln > 0) return false;
  if (ps.state === 'block') {
    dmg = Math.round(dmg * .75);
    ps.hp = Math.max(0, ps.hp - dmg); ps.ghostDelay = .6; ps.invuln = heavy ? .6 : .35; ps.blockFlash = .2;
    ps.vx = (ps.x < srcX ? -1 : 1) * (heavy ? 420 : 200);
    hitstop = Math.max(hitstop, heavy ? .09 : .05); doShake(heavy ? 10 : 5); sfx('block');
    spark(ps.x + ps.face * 26, ps.y - 62, 14, '#cfe6ff', 430, .35); spark(ps.x + ps.face * 26, ps.y - 62, 6, '#ffd98a', 300, .3);
    addText(ps.x, ps.y - 118, String(dmg), '#9fd0ff', 22, .8);
    if (ps.hp <= 0) coPlayerDown(ps);
    return true;
  }
  ps.hp = Math.max(0, ps.hp - dmg); ps.flash = .14; ps.ghostDelay = .6; ps.invuln = heavy ? .8 : .5;
  ps.state = 'hurt'; ps.t = 0; ps.vx = (ps.x < srcX ? -1 : 1) * (heavy ? 520 : 280); if (heavy) ps.vy = -330;
  hitstop = Math.max(hitstop, heavy ? .13 : .08); doShake(heavy ? 16 : 9); sfx('hurt');
  spark(ps.x, ps.y - 55, 16, '#b3202a', 380, .5); spark(ps.x, ps.y - 55, 8, '#ffcf8a', 300, .4);
  addText(ps.x, ps.y - 118, String(dmg), '#ff6a5a', 24, .9);
  if (ps.hp <= 0) coPlayerDown(ps);
  return true;
}
function coPlayerDown(ps) {
  ps.state = 'dead'; ps.deadT = 0; sfx('die'); doShake(12);
  const other = ps === CP1 ? CP2 : CP1;
  if (!other || other.state === 'dead') { phase = 'lost'; phaseT = 0; }
}
function coParrySuccess(ps, hx, hy) {
  ps.parrySucc = true; ps.endT = ps.t + .22; ps.st = Math.min(ps.maxst, ps.st + 30); ps.parryFlash = .25;
  B.state = 'stunned'; B.stunT = 2.0; B.phase = ''; B.combo = null; B.hitDone = true;
  hitstop = .17; doShake(11); doFlash(.4, '255,235,190'); sfx('parry');
  spark(hx, hy, 30, '#fff2c8', 620, .6); spark(hx, hy, 14, '#ffb84a', 420, .5);
  addRing(hx, hy, 6, 90, .35, 'rgba(255,240,190,.95)', 5);
  addText(ps.x, ps.y - 130, 'PARRIED', '#ffe9a8', 26, 1.1);
}
function coPhysics(ps, dt) {
  const wasAir = ps.y < GROUND - 1;
  if (ps.state !== 'plunge' && ps.state !== 'airdash') ps.vy += GRAV * dt;
  ps.y += ps.vy * dt; ps.x = clamp(ps.x + ps.vx * dt, 40, WORLD - 40);
  if (ps.y >= GROUND) { if (wasAir && ps.vy > 300) { dust(ps.x, GROUND, 6); ps.landT = .14; } if (wasAir) ps.airDodged = false; ps.y = GROUND; ps.vy = 0; }
}
function coUpdateOne(ps, inp, dt) {
  const held = inp.held, buf = inp.buf;
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (ps.state === 'dead') { ps.deadT += dt; ps.vx *= .9; coPhysics(ps, dt); return; }
  ps.t += dt; ps.invuln = Math.max(0, ps.invuln - dt); ps.flash = Math.max(0, ps.flash - dt); ps.parryFlash = Math.max(0, ps.parryFlash - dt); ps.blockFlash = Math.max(0, ps.blockFlash - dt); ps.landT = Math.max(0, ps.landT - dt);
  const grounded = ps.y >= GROUND - .5;
  ps.stride += (grounded ? Math.abs(ps.vx) : 0) * dt * .05;
  if (ps.stDelay > 0) ps.stDelay -= dt;
  else if (ps.state !== 'dodge' && ps.state !== 'attack' && ps.state !== 'airdash') ps.st = Math.min(ps.maxst, ps.st + (ps.state === 'free' ? 40 : ps.state === 'block' ? 32 : 22) * dt);
  ps.skill1CD = Math.max(0, ps.skill1CD - dt); ps.skill2CD = Math.max(0, ps.skill2CD - dt);
  switch (ps.state) {
    case 'free': {
      const target = dir * 250; ps.vx += (target - ps.vx) * Math.min(1, dt * (grounded ? 16 : 7)); if (dir) ps.face = dir;
      if (buf.jump > 0 && grounded) { ps.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(ps.x, GROUND, 4); }
      if (buf.dodge > 0 && ps.st > 0 && (grounded || !ps.airDodged)) { if (grounded) coStartDodge(ps, dir); else coStartAirDodge(ps, dir); buf.dodge = 0; }
      else if (buf.parry > 0 && grounded && ps.st > 0) { coStartParry(ps, dir); buf.parry = 0; }
      else if (buf.attack > 0 && ps.st > 0) { if (!grounded && held.down) coStartPlunge(ps); else coStartAttack(ps, 0, dir); buf.attack = 0; }
      else if (buf.heal > 0 && grounded && ps.flasks > 0 && ps.hp < ps.maxhp) { coStartHeal(ps); buf.heal = 0; }
      else if (buf.skill1 > 0 && grounded && ps.skill1CD <= 0) { coStartSkill1(ps, dir); buf.skill1 = 0; }
      else if (buf.skill2 > 0 && grounded && ps.skill2CD <= 0) { coStartSkill2(ps, dir); buf.skill2 = 0; }
      else if (held.block && grounded) { ps.state = 'block'; ps.t = 0; }
      break;
    }
    case 'attack': {
      const A = ATK[ps.combo], tot = A.w + A.a + A.r;
      if (ps.t < A.w + A.a) ps.vx = ps.airAtk ? ps.vx * .98 : ps.face * A.lunge / (A.w + A.a); else ps.vx *= .8;
      if (!ps.airAtk && B.state !== 'dead' && (B.x - ps.x) * ps.face > 0 && Math.abs(B.x - ps.x) < 62) ps.vx = 0;
      if (!ps.fxDone && ps.t >= A.w) {
        ps.fxDone = true; sfx('swing');
        if (A.thrust) addStreak(ps.x + ps.face * 24, ps.y - 64, ps.face * (A.reach - 20), 'rgba(255,232,170,.95)');
        else addArc(ps.x, ps.y - 82, 84, A.a0, A.a1, ps.face, .13, 'rgba(255,214,140,.9)', 9);
      }
      if (ps.t >= A.w && ps.t < A.w + A.a) coHeroHit(ps, A);
      if (ps.t >= A.w + A.a + A.r * .6 && buf.attack > 0 && ps.st > 0 && ps.combo < 2) { coStartAttack(ps, ps.combo + 1, dir); buf.attack = 0; break; }
      if (ps.t >= A.w + A.a && buf.dodge > 0 && ps.st > 0 && (grounded || !ps.airDodged)) { if (grounded) coStartDodge(ps, dir); else coStartAirDodge(ps, dir); buf.dodge = 0; break; }
      if (ps.t >= A.w + A.a && buf.parry > 0 && grounded && ps.st > 0) { coStartParry(ps, dir); buf.parry = 0; break; }
      if (ps.t >= tot) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'airdash': {
      const k = ps.t / .26; ps.vx = ps.dodgeDir * 680 * (1 - k * .45); ps.vy = 0;
      parts.push({ k: 'dot', x: ps.x, y: ps.y - rnd(30, 80), vx: 0, vy: 0, life: .28, t: 0, col: '255,224,160', g: 0, drag: 1, sz: rnd(4, 8) });
      if (ps.t >= .26) { ps.state = 'free'; ps.t = 0; ps.vx *= .45; ps.vy = 80; }
      break;
    }
    case 'skill1': { ps.vx *= .8; if (!ps.skill1Fired && ps.t >= .1) { ps.skill1Fired = true; coFireSlash(ps); } if (ps.t >= .3) { ps.state = 'free'; ps.t = 0; } break; }
    case 'skill2': {
      ps.vx *= .7;
      if (ps.t < .55 && Math.random() < .7) parts.push({ k: 'dot', x: ps.x + ps.face * 14 + rnd(-6, 6), y: ps.y - 62 + rnd(-8, 8), vx: rnd(-8, 8), vy: rnd(-32, -6), life: .35, t: 0, col: '255,150,60', g: 0, drag: 1, sz: rnd(2, 5) });
      if (!ps.skill2Fired && ps.t >= .55) { ps.skill2Fired = true; coReleaseSkill2(ps); }
      if (ps.t >= .82) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'block': {
      if (dir) ps.face = dir; ps.vx += (dir * 90 - ps.vx) * Math.min(1, dt * 14);
      if (buf.jump > 0 && grounded) { ps.vy = -JUMPV; buf.jump = 0; sfx('jump'); dust(ps.x, GROUND, 4); ps.state = 'free'; ps.t = 0; break; }
      if (buf.dodge > 0 && ps.st > 0) { coStartDodge(ps, dir); buf.dodge = 0; break; }
      if (buf.parry > 0 && ps.st > 0) { coStartParry(ps, dir); buf.parry = 0; break; }
      if (buf.attack > 0 && ps.st > 0) { coStartAttack(ps, 0, dir); buf.attack = 0; break; }
      if (buf.heal > 0 && ps.flasks > 0 && ps.hp < ps.maxhp) { coStartHeal(ps); buf.heal = 0; break; }
      if (buf.skill1 > 0 && ps.skill1CD <= 0) { coStartSkill1(ps, dir); buf.skill1 = 0; break; }
      if (buf.skill2 > 0 && ps.skill2CD <= 0) { coStartSkill2(ps, dir); buf.skill2 = 0; break; }
      if (!held.block || !grounded) { ps.state = 'free'; ps.t = 0; }
      break;
    }
    case 'dodge': {
      const k = ps.t / .34; ps.vx = ps.dodgeDir * 720 * (1 - k * .55);
      if (Math.random() < .5) dust(ps.x - ps.dodgeDir * 10, GROUND, 1);
      if (ps.t >= .34) { ps.state = 'free'; ps.t = 0; ps.vx *= .3; }
      break;
    }
    case 'parry': { ps.vx *= .8; if (ps.t >= ps.endT) { ps.state = 'free'; ps.t = 0; } break; }
    case 'plunge': {
      ps.vx = 0; ps.vy = 1050;
      const pb = GROUND - ps.y;
      if (!ps.plungeHit && B.state !== 'dead' && B.state !== 'intro' && Math.abs(ps.x - B.x) < B.hw + 18 && pb < B.h + B.hh + 4 && pb > B.h + 10) {
        ps.plungeHit = true; hitBoss(120, .09); ps.state = 'free'; ps.t = 0; ps.vy = -560; ps.vx = -ps.face * 120; spark(ps.x, ps.y, 10, '#ffe2a0', 400, .4);
      }
      break;
    }
    case 'hurt': { ps.vx *= .92; if (ps.t > .3) { ps.state = 'free'; ps.t = 0; } break; }
    case 'heal': {
      ps.vx = dir * 60;
      if (!ps.healed && ps.t >= .5) {
        ps.healed = true; ps.flasks--; const before = ps.hp; ps.hp = Math.min(ps.maxhp, ps.hp + Math.round(ps.maxhp * .7)); sfx('heal');
        addText(ps.x, ps.y - 125, '+' + Math.round(ps.hp - before), '#8ef07a', 24, 1);
        for (let i = 0; i < 26; i++) parts.push({ k: 'dot', x: ps.x + rnd(-16, 16), y: ps.y - rnd(10, 80), vx: rnd(-20, 20), vy: rnd(-90, -30), life: rnd(.6, 1.1), t: 0, col: '140,240,120', g: 0, drag: 1, sz: rnd(2, 4) });
      }
      if (ps.t >= .85) { ps.state = 'free'; ps.t = 0; }
      break;
    }
  }
  coPhysics(ps, dt);
  if (ps.state === 'plunge' && ps.y >= GROUND) {
    ps.y = GROUND; ps.vy = 0; sfx('boom'); doShake(9); dust(ps.x, GROUND, 14); petals(ps.x, GROUND, 14, 300); addRing(ps.x, GROUND - 4, 8, 110, .3, 'rgba(255,225,160,.8)', 4);
    if (!ps.plungeHit && B.state !== 'dead' && B.state !== 'intro' && Math.abs(ps.x - B.x) < 120) { ps.plungeHit = true; hitBoss(120, .09); }
    ps.state = 'free'; ps.t = 0;
  }
}

/* ---- host-authoritative tick / guest display tick ---- */
function coopStep(dt) {
  if (mp.role === 'guest') { coopGuestTick(dt); return; }
  if (phase === 'lobby' || phase === 'coLobby') { return; }
  if (hitstop > 0) { hitstop -= dt; updateFx(dt * .15); coopMaybeSend(); return; }
  phaseT += dt; time += dt;
  if (phase === 'intro' && phaseT > 2.8) { phase = 'fight'; phaseT = 0; B.state = 'idle'; B.cool = .9; musicPlay(bossType === 'art' ? 'battleArt' : 'battleSent'); }
  for (const k in buf) buf[k] = Math.max(0, buf[k] - dt);
  for (const k in remoteBuf) remoteBuf[k] = Math.max(0, remoteBuf[k] - dt);
  if (phase === 'intro' || phase === 'fight') {
    coUpdateOne(CP1, { held, buf }, dt);
    coUpdateOne(CP2, { held: remoteHeld, buf: remoteBuf }, dt);
    // point the single-player boss AI's target at whichever fighter is closest (or the only one alive)
    const aliveCP1 = CP1.state !== 'dead', aliveCP2 = CP2.state !== 'dead';
    let focus = CP1;
    if (aliveCP1 && aliveCP2) focus = Math.abs(CP1.x - B.x) <= Math.abs(CP2.x - B.x) ? CP1 : CP2;
    else if (aliveCP2 && !aliveCP1) focus = CP2;
    P.x = focus.x; P.y = focus.y; P.face = focus.face; P.state = (aliveCP1 || aliveCP2) ? 'free' : 'dead';
    if (B.type === 'art') updateArt(dt); else updateBoss(dt);
    updateOrbs(dt); updateSlashes(dt); updateFx(dt);
    const tx = clamp(((CP1.x + CP2.x) / 2) * .62 + B.x * .38 - W / 2, 0, WORLD - W); cam += (tx - cam) * Math.min(1, dt * 4);
    shake *= .88; if (shake < .2) shake = 0; screenFlash = Math.max(0, screenFlash - dt * 1.6);
  }
  if (phase === 'lost' && phaseT > 2.0) { phase = 'lostUI'; musicStop(2.4); showCoEnd(false); }
  if (phase === 'won' && phaseT > 4.2) { phase = 'wonUI'; musicStop(1.6); sfx('win'); showCoEnd(true); }
  coopMaybeSend();
}
function coopMaybeSend() {
  if (!mp.conn || !mp.conn.open) return;
  netSend({
    t: 'costate', p1: coSnapOut(CP1), p2: coSnapOut(CP2), boss: coBossSnapOut(), phase, phaseT, cam, time, shake, screenFlash, screenFlashCol
  });
}
function coSnapOut(ps) {
  return {
    x: ps.x, y: ps.y, vx: ps.vx, vy: ps.vy, face: ps.face, hp: ps.hp, maxhp: ps.maxhp, st: ps.st, maxst: ps.maxst, flasks: ps.flasks,
    state: ps.state, t: ps.t, combo: ps.combo, invuln: ps.invuln, flash: ps.flash, parrySucc: ps.parrySucc, endT: ps.endT,
    dodgeDir: ps.dodgeDir, airAtk: ps.airAtk, parryFlash: ps.parryFlash, blockFlash: ps.blockFlash, stride: ps.stride,
    skill1CD: ps.skill1CD, skill2CD: ps.skill2CD, deadT: ps.deadT, landT: ps.landT, healed: ps.healed
  };
}
function coBossSnapOut() {
  return {
    type: B.type, x: B.x, y: B.y, face: B.face, hp: B.hp, maxhp: B.maxhp, state: B.state, t: B.t, phase: B.phase, pt: B.pt,
    flash: B.flash, stunT: B.stunT, rage: B.rage, moving: B.moving, dieT: B.dieT, introFill: B.introFill, stride: B.stride, h: B.h,
    expR: B.expR, atk: B.atk ? { type: B.atk.type, w: B.atk.w, a: B.atk.a, r: B.atk.r, lunge: B.atk.lunge } : null
  };
}
function coopGuestTick(dt) {
  time += dt; updateFx(dt);
  if (CP1 && CP2) { const tx = clamp(((CP1.x + CP2.x) / 2) * .62 + B.x * .38 - W / 2, 0, WORLD - W); cam += (tx - cam) * Math.min(1, dt * 4); }
  shake *= .88; if (shake < .2) shake = 0; screenFlash = Math.max(0, screenFlash - dt * 1.6);
  netGuestSendInput();
}
function coGuestReact(prevP, curP) {
  if (!prevP || !curP) return;
  if (curP.hp < prevP.hp) {
    const dmg = prevP.hp - curP.hp;
    if (curP.state === 'block') { spark(curP.x + curP.face * 26, curP.y - 62, 10, '#cfe6ff', 380, .3); sfx('block'); addText(curP.x, curP.y - 118, String(dmg), '#9fd0ff', 18, .7); }
    else { spark(curP.x, curP.y - 55, 12, '#b3202a', 320, .4); sfx('hurt'); addText(curP.x, curP.y - 118, String(dmg), '#ff6a5a', 20, .75); }
    doShake(6);
  }
  if (curP.state === 'parry' && curP.parrySucc && !prevP.parrySucc) { sfx('parry'); doFlash(.3, '255,235,190'); spark(curP.x, curP.y - 66, 18, '#fff2c8', 460, .4); addText(curP.x, curP.y - 130, 'PARRIED', '#ffe9a8', 22, .9); }
  if (curP.state === 'dodge' && prevP.state !== 'dodge') { sfx('dodge'); dust(curP.x, GROUND, 4); }
  if (curP.state === 'heal' && prevP.state !== 'heal') sfx('heal');
  if (curP.state === 'dead' && prevP.state !== 'dead') { sfx('die'); doShake(12); }
}

/* ---- networking wiring (shares the mp/PeerJS layer with the PVP module above) ---- */
function coHost() {
  if (!mpHasPeer()) { mpSetStatus('No internet connection available for online play.'); return; }
  mpTeardown(); mode = 'coop'; mp.role = 'host'; mp.code = mpMakeCode();
  $('coStatus').textContent = 'Opening lobby\u2026';
  try { mp.peer = new Peer('gkd-' + mp.code); } catch (e) { $('coStatus').textContent = 'Could not start hosting.'; return; }
  mp.peer.on('open', () => { $('coCodeBig').textContent = mp.code; $('coStatus').textContent = 'Waiting for an ally to join\u2026'; });
  mp.peer.on('connection', c => { if (mp.conn) { c.close(); return; } mp.conn = c; coWireConn(c); });
  mp.peer.on('error', e => { $('coStatus').textContent = 'Connection error \u2014 try a new lobby.'; });
}
function coJoin(code) {
  if (!mpHasPeer()) { mpSetStatus('No internet connection available for online play.'); return; }
  mpTeardown(); mode = 'coop'; mp.role = 'guest'; mp.code = (code || '').trim().toUpperCase();
  if (mp.code.length < 3) { $('coStatus').textContent = 'Enter the 5-letter code your ally shared.'; return; }
  $('coStatus').textContent = 'Connecting\u2026';
  try { mp.peer = new Peer(); } catch (e) { $('coStatus').textContent = 'Could not connect.'; return; }
  mp.peer.on('open', () => { const c = mp.peer.connect('gkd-' + mp.code, { reliable: true }); mp.conn = c; coWireConn(c); });
  mp.peer.on('error', e => { $('coStatus').textContent = e && e.type === 'peer-unavailable' ? 'No lobby found with that code.' : 'Connection error.'; });
}
function coWireConn(c) {
  c.on('open', () => {
    mp.connected = true; $('coStatus').textContent = 'Connected! Starting duel\u2026';
    if (mp.role === 'host') { netSend({ t: 'costart', boss: coBossType }); coBeginMatch(coBossType); }
  });
  c.on('data', d => coOnData(d));
  c.on('close', () => coOnDisconnect());
  c.on('error', () => coOnDisconnect());
}
function coOnDisconnect() {
  if (mode === 'coop' && (phase === 'intro' || phase === 'fight')) { phase = 'lostUI'; showCoEnd(false, true); }
  mp.connected = false;
}
function coBeginMatch(type) {
  bossType = type; ac(); reset(); CP1 = mkCoPlayer(P.x - 90, 1); CP2 = mkCoPlayer(P.x + 90, 1);
  phase = 'intro'; phaseT = 0; paused = false; clearInputState();
  cam = clamp(((CP1.x + CP2.x) / 2) * .6 + B.x * .4 - W / 2, 0, WORLD - W);
  $('title').classList.add('hide'); $('co').classList.add('hide'); $('coEnd').classList.add('hide'); $('mpQuit').classList.add('hide');
  $('pvpLeaveBtn').classList.remove('hide'); musicStop(1.4);
}
function coOnData(d) {
  if (!d || !d.t) return;
  if (d.t === 'costart') { coBeginMatch(d.boss); }
  else if (d.t === 'costate') {
    if (!CP1 || !CP2 || !B) return;
    const prev1 = mpSnapField(CP1), prev2 = mpSnapField(CP2);
    Object.assign(CP1, d.p1); Object.assign(CP2, d.p2); Object.assign(B, d.boss);
    phase = d.phase; phaseT = d.phaseT; cam = d.cam; time = d.time; shake = d.shake; screenFlash = d.screenFlash; screenFlashCol = d.screenFlashCol;
    coGuestReact(prev1, CP1); coGuestReact(prev2, CP2);
    if (phase === 'lostUI') showCoEnd(false); else if (phase === 'wonUI') showCoEnd(true);
  } else if (d.t === 'input') { Object.assign(remoteHeld, d.held); for (const k of d.edges || []) remoteBuf[k] = BUF; }
  else if (d.t === 'corematch') { coBeginMatch(d.boss); }
  else if (d.t === 'quit') { if (phase === 'intro' || phase === 'fight') showCoEnd(false, true); }
}

/* ---- UI plumbing ---- */
function showCoEnd(win, disconnected) {
  $('pvpLeaveBtn').classList.add('hide');
  const art = B && B.type === 'art';
  $('coEndTitle').textContent = disconnected ? 'ALLY LEFT' : (win ? (art ? 'ARTORIAS HAS FALLEN' : 'THE SENTINEL HAS FALLEN') : 'THOU HAST FALLEN');
  $('coEndSub').textContent = disconnected ? 'The duel ended early.' : (win ? 'Fought and felled together.' : 'Both knights have fallen. Rise and try again.');
  $('coRematchBtn').classList.toggle('hide', !!disconnected || mp.role !== 'host');
  $('coEnd').classList.remove('hide');
}
function coopLeaveToMenu() { mode = 'boss'; mpTeardown(); toTitle(); }

/* ---- wire up the co-op menu ---- */
function coSyncBossPick() {
  const isSent = coBossType !== 'art';
  $('coPickSent').classList.toggle('active', isSent); $('coPickArt').classList.toggle('active', !isSent);
  $('coHostBossName').textContent = isSent ? 'The Violet Sentinel' : 'Artorias the Abysswalker';
}
function coResetLobbyUI() {
  $('coChoice').classList.remove('hide'); $('coBossPick').classList.remove('hide');
  $('coHostPane').classList.add('hide'); $('coJoinPane').classList.add('hide'); $('coStatus').textContent = '';
  coSyncBossPick();
}
$('openCo').addEventListener('click', () => {
  mode = 'coop'; mpTeardown(); $('title').classList.add('hide'); $('co').classList.remove('hide');
  coResetLobbyUI();
});
$('coBack').addEventListener('click', () => { mode = 'boss'; mpTeardown(); $('co').classList.add('hide'); $('title').classList.remove('hide'); });
$('coPickSent').addEventListener('click', () => { coBossType = 'sentinel'; coSyncBossPick(); });
$('coPickArt').addEventListener('click', () => { coBossType = 'art'; coSyncBossPick(); });
$('coHostBtn').addEventListener('click', () => { ac(); $('coChoice').classList.add('hide'); $('coHostPane').classList.remove('hide'); coSyncBossPick(); coHost(); });
$('coJoinBtn').addEventListener('click', () => { ac(); $('coChoice').classList.add('hide'); $('coJoinPane').classList.remove('hide'); $('coCodeInput').value = ''; $('coStatus').textContent = ''; setTimeout(() => $('coCodeInput').focus(), 30); });
$('coCancelHost').addEventListener('click', () => { mpTeardown(); mode = 'coop'; coResetLobbyUI(); });
$('coCancelJoin').addEventListener('click', () => { mpTeardown(); mode = 'coop'; coResetLobbyUI(); });
$('coConnectBtn').addEventListener('click', () => coJoin($('coCodeInput').value));
$('coCodeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('coCodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') coJoin($('coCodeInput').value); });
$('coRematchBtn').addEventListener('click', () => { if (mp.role !== 'host') return; netSend({ t: 'corematch', boss: coBossType }); coBeginMatch(coBossType); });
$('coMenuBtn').addEventListener('click', () => { netSend({ t: 'quit' }); coopLeaveToMenu(); });
function coDrawHUD() {
  ctx.save();
  const side = (ps, x0, label, flip, col1, col2) => {
    if (!ps) return;
    const bx = flip ? W - x0 - 230 : x0;
    drawBar(bx, 24, 230, 15, ps.hp / ps.maxhp, ps.ghost / ps.maxhp, col1, col2);
    ctx.font = '700 11px Cinzel, Georgia, serif'; ctx.textAlign = flip ? 'right' : 'left'; ctx.fillStyle = '#f2e6c8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.fillText(Math.ceil(ps.hp) + ' / ' + ps.maxhp, flip ? bx + 224 : bx + 6, 36); ctx.shadowBlur = 0;
    drawBar(bx, 47, 170, 8, ps.st / ps.maxst, 0, ps.st < 15 ? '#e0a040' : '#5fd6a0', ps.st < 15 ? '#8a5a14' : '#1f8a68');
    ctx.font = '700 10px Cinzel, Georgia, serif'; ctx.fillStyle = flip ? '#e2c8ff' : '#f0d68e'; ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(label, flip ? bx + 170 : bx, 64);
    for (let i = 0; i < 7; i++) drawFlask(flip ? bx + 170 - i * 13 : bx + 7 + i * 13, 76, i < ps.flasks);
  };
  side(CP1, 14, mp.role === 'host' ? 'YOU' : 'ALLY', false, '#e0403c', '#8a1414');
  side(CP2, 14, mp.role === 'guest' ? 'YOU' : 'ALLY', true, '#c98aff', '#5a2090');
  if (phase !== 'title' && B && (B.state !== 'dead' || B.dieT < 2)) {
    const fill = phase === 'intro' ? B.introFill : 1, bw = 560, bxx = (W - bw) / 2, byy = 498;
    ctx.textAlign = 'center'; ctx.font = '700 16px Cinzel, Georgia, serif'; ctx.fillStyle = '#efdcae'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText(B.type === 'art' ? 'ARTORIAS THE ABYSSWALKER' : 'THE VIOLET SENTINEL', W / 2, byy - 10); ctx.shadowBlur = 0;
    drawBar(bxx, byy, bw, 12, (B.hp / B.maxhp) * fill, 0, B.rage ? (B.type === 'art' ? '#5a9bff' : '#b04cff') : '#c93a3a', B.rage ? (B.type === 'art' ? '#1f3f9a' : '#4a1a90') : '#7a1212');
    if (B.rage) { ctx.font = '600 10px Cinzel, Georgia, serif'; ctx.fillStyle = B.type === 'art' ? '#bcd8ff' : '#d9b3ff'; ctx.fillText(B.type === 'art' ? 'PHASE TWO  -  +40% DAMAGE' : 'ENRAGED', W / 2, byy + 28); }
  }
  ctx.restore();
}
function coopRenderFrame() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
  if (!LAY.far || !B) return;
  const snap = v => Math.round(v * RS) / RS;
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake * .7 : 0;
  ctx.drawImage(LAY.far, snap(-cam * .12 + sx * .2), snap(sy * .2), W + (WORLD - W) * .12, H);
  ctx.drawImage(LAY.mid, snap(-cam * .35 + sx * .5), snap(sy * .5), W + (WORLD - W) * .35, H);
  ctx.drawImage(LAY.near, snap(-cam * .8 + sx * .8), snap(sy * .8), W + (WORLD - W) * .8, H);
  ctx.save(); ctx.translate(snap(-cam + sx), snap(sy));
  ctx.drawImage(LAY.ground, 0, 430, WORLD, H - 430);
  const fo = Math.round((time * 9) % 1400); ctx.globalAlpha = .9; ctx.drawImage(LAY.fog, Math.round(cam) - fo, 330, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - fo + 1400, 330, 1400, 220); ctx.globalAlpha = 1;
  drawBlades(430, GROUND + 6); drawFlowers(0, GROUND);
  drawExplosion();
  const isArt = B.type === 'art', bo = isArt ? artObj() : bossObj();
  drawShadow(B.x, 0, isArt ? 54 : 46, clamp(B.h / 170, 0, 1));
  if (CP1) drawShadow(CP1.x, 0, 22, clamp((GROUND - CP1.y) / 170, 0, 1));
  if (CP2) drawShadow(CP2.x, 0, 22, clamp((GROUND - CP2.y) / 170, 0, 1));
  if (B.state === 'dead' && bo.alpha <= 0) { /* gone */ } else if (isArt) drawArtorias(ctx, bo); else drawKnight(ctx, bo);
  if (CP1) drawKnight(ctx, heroObjFrom(CP1, PAL_H));
  if (CP2) drawKnight(ctx, heroObjFrom(CP2, PAL_P2));
  if (B.state === 'stunned') { for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.1; ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(B.x + Math.cos(a) * 30, GROUND - (B.type === 'art' ? 195 : 175) + Math.sin(a) * 7, 3.5, 0, TAU); ctx.fill(); } }
  drawBeam(); drawOrbs(); drawSlashes();
  drawParts(); drawFx();
  drawBlades(GROUND + 6, 600); drawFlowers(GROUND, 600);
  for (const m of motes) { if (m.x < cam - 10 || m.x > cam + W + 10) continue; const a = .25 + .3 * Math.sin(time * 2 + m.ph); ctx.fillStyle = 'rgba(240,235,255,' + a + ')'; if (m.petal) { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(time + m.ph); ctx.beginPath(); ctx.ellipse(0, 0, m.s * 1.6, m.s * .8, 0, 0, TAU); ctx.fill(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(m.x, m.y, m.s * .6, 0, TAU); ctx.fill(); } }
  { const f2 = Math.round(fo * 1.4) % 1400; ctx.globalAlpha = .55; ctx.drawImage(LAY.fog, Math.round(cam) - f2, 400, 1400, 220); ctx.drawImage(LAY.fog, Math.round(cam) - f2 + 1400, 400, 1400, 220); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.drawImage(LAY.vig, 0, 0, W, H);
  if (screenFlash > 0) { ctx.fillStyle = 'rgba(' + screenFlashCol + ',' + Math.min(.7, screenFlash) + ')'; ctx.fillRect(0, 0, W, H); }
  const lowHp = (CP1 && CP1.hp < 120 && CP1.state !== 'dead') || (CP2 && CP2.hp < 120 && CP2.state !== 'dead');
  if (lowHp) { const a = .12 + .08 * Math.sin(time * 6); const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .8); g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(1, 'rgba(160,0,20,' + a * 2.5 + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  coDrawHUD();
  if (phase === 'intro') drawIntro();
  if (phase === 'won' || phase === 'wonUI') { const k = clamp(phaseT / 1.5, 0, 1); ctx.fillStyle = 'rgba(0,0,0,' + (.35 * k) + ')'; ctx.fillRect(0, 0, W, H); if (phase === 'won' && phaseT > 1) { ctx.save(); ctx.globalAlpha = clamp((phaseT - 1) / 1, 0, 1); ctx.textAlign = 'center'; ctx.font = '900 44px Cinzel, Georgia, serif'; ctx.fillStyle = '#f2dc9c'; ctx.shadowColor = '#000'; ctx.shadowBlur = 12; ctx.fillText('BOSS DEFEATED', W / 2, 270); ctx.restore(); } }
  if (phase === 'lost' || phase === 'lostUI') { const k = clamp(phaseT / 1.6, 0, 1); ctx.fillStyle = 'rgba(30,0,4,' + (.55 * k) + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ================= LOOP ================= */
let last = performance.now(), acc = 0;
function frame(now) {
  let d = (now - last) / 1000; last = now; if (d > .1) d = .1; acc += d;
  while (acc >= DT) { step(DT); acc -= DT; }
  render(acc / DT); requestAnimationFrame(frame);
}
reset();
buildBG();
if (document.fonts && document.fonts.load) { Promise.all([document.fonts.load('700 16px Cinzel'), document.fonts.load('900 16px Cinzel')]).then(() => { buildBG(); }).catch(() => { }); }
$('pickSent').addEventListener('click', () => startGame('sentinel'));
$('pickArt').addEventListener('click', () => startGame('art'));
$('endBtn').addEventListener('click', () => startGame());
$('menuBtn').addEventListener('click', toTitle);
if (window.__TEST__) window.__G = { step, render, press, release, startGame, get P() { return P; }, get B() { return B; }, get phase() { return phase; }, set phase(v) { phase = v; }, hurtPlayer, COMBOS, COMBOS_A, renderTrackOffline, TRACKS, get music() { return Music; }, get paused() { return paused; }, get binds() { return binds; }, openPause, closePause, toTitle, get orbs() { return orbs; }, get slashes() { return slashes; }, get bossType() { return bossType; }, SKILL1_CD, SKILL2_CD };
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();
