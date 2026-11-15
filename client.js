/*
 * Orbi's Mission Lab - screen and input.
 * Rebuilt from new code during NASA Space Apps Challenge 2026 (14-15 November 2026). Code written with AI assistance (Claude).
 * The rules live in logic.js. Solo games run them right here in the browser; team games run them in a live room on the server.
 */
import * as P from "./sim.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = $("#app");
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } }
const SAVE = Object.assign({ stars: {}, dust: 50, xp: 0, story: false, all: false }, (() => { try { return JSON.parse(ls("oml:save") || "{}"); } catch { return {}; } })());
function save() { ls("oml:save", JSON.stringify(SAVE)); }
/* ---------- languages: English text is the key, other languages are looked up at draw time ---------- */
let LANG = "en", DICT = null, PATS = [];
const LCACHE = new Map();
function setDict(d) {
  DICT = d; LCACHE.clear();
  PATS = Object.keys(d).filter((k) => /\{\d!?\}/.test(k)).sort((x, y) => y.replace(/\{\d!?\}/g, "").length - x.replace(/\{\d!?\}/g, "").length).map((k) => {
    const idx = [], re = new RegExp("^" + k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\d)(!?)\}/g, (m, n, r) => { idx.push([+n, r === "!"]); return "([\\s\\S]+?)"; }) + "$");
    return [re, d[k], idx];
  });
}
function trCore(core, depth) {
  if (Object.prototype.hasOwnProperty.call(DICT, core) && typeof DICT[core] === "string") return DICT[core];
  for (const p of PATS) { const m = p[0].exec(core); if (m) return p[1].replace(/\{(\d)!?\}/g, (x, n) => { const j = p[2].findIndex((q) => q[0] === +n); if (j < 0) return x; const val = m[j + 1]; if (!p[2][j][1] || depth > 2) return val; const t = trCore(val, depth + 1); return t == null ? val : t; }); }
  const pre = /^([^\p{L}\p{N}$+\-(]+\s)([\s\S]+)$/u.exec(core);
  if (pre && depth < 3) { const t = trCore(pre[2], depth + 1); if (t != null) return pre[1] + t; }
  if (core.indexOf(", ") > 0 && depth < 3) { const parts = core.split(", "), t = parts.map((q) => (Object.prototype.hasOwnProperty.call(DICT, q) && typeof DICT[q] === "string" ? DICT[q] : null)); if (t.some((x) => x != null)) return t.map((x, i) => (x == null ? parts[i] : x)).join(", "); }
  return null;
}
function L(s) {
  if (LANG === "en" || !DICT || typeof s !== "string" || !s) return s;
  const c = LCACHE.get(s); if (c !== undefined) return c;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); let out = s;
  if (m[2]) { const t = trCore(m[2], 0); if (t != null) out = m[1] + t + m[3]; }
  if (LCACHE.size > 6000) LCACHE.clear(); LCACHE.set(s, out); return out;
}
function Lf(tpl) { const a = arguments; return L(tpl).replace(/\{(\d)!?\}/g, (m, n) => a[+n + 1]); }
const NOTR = { SCRIPT: 1, STYLE: 1, INPUT: 1, TEXTAREA: 1 };
function trNode(n) {
  if (n.nodeType === 3) { const p = n.parentNode; if (!p || NOTR[p.nodeName] || (p.closest && p.closest("[data-notr]"))) return; const t = L(n.nodeValue); if (t !== n.nodeValue) { if (n.__en === undefined) n.__en = n.nodeValue; n.nodeValue = t; } }
  else if (n.nodeType === 1 && !NOTR[n.nodeName]) { const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(trNode); }
}
new MutationObserver((ms) => { if (LANG === "en" || !DICT) return; for (const m of ms) { if (m.type === "characterData") trNode(m.target); else m.addedNodes.forEach(trNode); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
{ const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, x, y, w) { t = typeof t === "string" ? L(t) : t; return w === undefined ? ft.call(this, t, x, y) : ft.call(this, t, x, y, w); }; }
const LNAME = { en: "EN", kk: "ҚАЗ", ru: "РУС" }, LNEXT = { en: "kk", kk: "ru", ru: "en" };
function setLang(l, first) {
  if (!LNAME[l]) l = "en";
  const apply = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) if (w.currentNode.__en !== undefined) { w.currentNode.nodeValue = w.currentNode.__en; w.currentNode.__en = undefined; }
    LANG = l; SAVE.lang = l; save(); document.documentElement.lang = l; $("#lang").textContent = "🌐 " + LNAME[l]; $("#name").placeholder = { en: "Your name", kk: "Атың", ru: "Твоё имя" }[l];
    if (l !== "en") trNode(document.body);
    if (!first) render();
  };
  if (l === "en") return apply();
  import("./" + l + ".js").then((m) => { setDict(m.default); apply(); if (first) render(); }).catch(() => {});
}
const totalStars = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
const ui = { screen: "home", mounted: null, evKey: null, evAt: 0, lastPhase: null, sheet: null, sheetNew: false, hi: null, auto: null, diff: "cadet", school: null, rewardKey: null, gain: null };

/* ---------- the live 3D stage (falls back to a flat drawing if 3D is not available) ---------- */
let Stage = null, stageEl = null;
import("./scene.js").then((m) => { try { stageEl = document.createElement("canvas"); stageEl.className = "stage3d"; Stage = m.createStage(stageEl); render(); } catch { Stage = null; } }).catch(() => {});
const STARS = Array.from({ length: 150 }, () => [Math.random(), Math.random(), 0.3 + Math.random() * 0.7, Math.random() < 0.2 ? 2 : 1]);
const barPrev = {};
function animateBars() { document.querySelectorAll(".bar i[data-g]").forEach((e) => { const k = e.dataset.g, w = e.style.width, p = barPrev[k]; barPrev[k] = w; if (p && p !== w) { e.style.transition = "none"; e.style.width = p; void e.offsetWidth; e.style.transition = ""; e.style.width = w; } }); }
const ICON = { orbit: "🪐", window: "📅", rocket: "🚀", sats: "🛰️", test: "🧪", bus: "📦", array: "☀️", arraySize: "📐", batt: "🔋", prop: "🔥", fuel: "⛽", adcs: "🎯", comp: "💻", inst: "🔭", plan: "🗺️", band: "📡", dish: "📡", net: "🏢", contact: "⏱️" };

/* ---------- Orbi, the robot co-pilot (drawn here, in code) ---------- */
const ORBI_C = { c0: ["#fff", "#d6daf7"], c1: ["#b8f5dc", "#6fd6ac"], c2: ["#ffc6dc", "#ff8ab5"], c3: ["#ffe58a", "#e6b52e"], c4: ["#5b4bd6", "#3a2ca8"] };
const HATS = {
  h1: `<path d="M44 22L60 -6L76 22z" fill="#ff5c8a" stroke="#c22d5d" stroke-width="2.5"/><path d="M50 12l20 4M47 18l26 3" stroke="#ffe27a" stroke-width="3"/><circle cx="60" cy="-6" r="5" fill="#ffe27a"/>`,
  h2: `<rect x="13" y="10" width="94" height="80" rx="40" fill="rgba(160,220,255,.25)" stroke="#bfe6ff" stroke-width="4"/><path d="M30 26q12 -10 24 -8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  h3: `<path d="M38 22l4 -20l10 12l8 -16l8 16l10 -12l4 20z" fill="#ffd23c" stroke="#d99a00" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="10" r="3.5" fill="#ff5c8a"/>`,
  h4: `<path d="M34 22q26 -24 52 0z" fill="#2ec5ff" stroke="#0a8fce" stroke-width="2.5"/><line x1="60" y1="4" x2="60" y2="-4" stroke="#555" stroke-width="3"/><ellipse class="prop" cx="60" cy="-5" rx="22" ry="4" fill="#ff5c8a"/>`,
  h5: `<path d="M20 50q0 -46 40 -46q40 0 40 46" fill="none" stroke="#333" stroke-width="6"/><rect x="11" y="40" width="16" height="28" rx="7" fill="#ff5c8a"/><rect x="93" y="40" width="16" height="28" rx="7" fill="#ff5c8a"/>`,
};
function orbiG(mood) {
  const sad = mood === "uh", lk = (typeof SAVE !== "undefined" && SAVE.look) || { c: "c0", h: "h0" }, col = ORBI_C[lk.c] || ORBI_C.c0, hat = HATS[lk.h] || "";
  return `<g class="float">${hat && lk.h !== "h5" && lk.h !== "h2" ? "" : `<line x1="60" y1="7" x2="60" y2="20" stroke="#cfd6ff" stroke-width="3.5" stroke-linecap="round"/><circle class="lamp" cx="60" cy="7" r="5.5" fill="#ff5c8a"/>`}
  <g class="arm"><rect x="5" y="50" width="17" height="32" rx="5" fill="#2ec5ff" stroke="#0a8fce" stroke-width="2.5"/><path d="M5 61h17M5 71h17" stroke="#0a8fce" stroke-width="2"/></g>
  <rect x="98" y="50" width="17" height="32" rx="5" fill="#2ec5ff" stroke="#0a8fce" stroke-width="2.5"/><path d="M98 61h17M98 71h17" stroke="#0a8fce" stroke-width="2"/>
  <path class="fl" d="M49 102q11 26 22 0z" fill="#ff8a3d"/><path class="fl" d="M54 102q6 14 12 0z" fill="#ffe27a"/>
  <path d="M40 78h40l-6 24H46z" fill="#ffc93c" stroke="#de9400" stroke-width="2.5" stroke-linejoin="round"/><circle cx="60" cy="90" r="5" fill="#fff" stroke="#de9400" stroke-width="2"/>
  <rect x="21" y="18" width="78" height="64" rx="29" fill="${col[0]}" stroke="${col[1]}" stroke-width="3"/><rect x="31" y="29" width="58" height="36" rx="17" fill="#1a1740"/>
  <g class="eyes"><ellipse cx="47" cy="45" rx="7.5" ry="${sad ? 6 : 9.5}" fill="#5fe3ff"/><ellipse cx="73" cy="45" rx="7.5" ry="${sad ? 6 : 9.5}" fill="#5fe3ff"/><circle cx="49.5" cy="42" r="2.6" fill="#fff"/><circle cx="75.5" cy="42" r="2.6" fill="#fff"/></g>
  <path d="${sad ? "M52 59q8 -5 16 0" : "M51 56q9 8 18 0"}" stroke="#5fe3ff" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="29" cy="64" r="5" fill="#ffb3c9"/><circle cx="91" cy="64" r="5" fill="#ffb3c9"/>${hat}</g>`;
}
function orbi(cls, mood) { return `<svg class="orbi ${cls || ""}" viewBox="0 -12 120 142" role="img" aria-label="Orbi the robot">${orbiG(mood)}</svg>`; }
$("#hOrbi").innerHTML = orbi("sm");

/* ---------- animated cartoon sky behind every screen ---------- */
(() => {
  const cv = $("#bg"), c = cv.getContext("2d"); let W = 0, H = 0, last = 0;
  const st = Array.from({ length: 170 }, () => [Math.random(), Math.random(), Math.random() * 6.28, Math.random() < 0.18]);
  function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  addEventListener("resize", size); size();
  function ball(x, y, r, a, b) { const g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function frame(t) {
    requestAnimationFrame(frame); if (document.hidden || t - last < 40) return; last = t; const s = t / 1000;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1a1152"); g.addColorStop(0.45, "#2a1a7a"); g.addColorStop(1, "#0b0f2e"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sx = W * 0.06, sy = H * 0.14;
    c.strokeStyle = "rgba(255,255,255,.07)"; c.lineWidth = 1.5; for (const r of [0.22, 0.42, 0.66, 0.95]) { c.beginPath(); c.ellipse(sx, sy, W * r, W * r * 0.62, 0.25, 0, 7); c.stroke(); }
    const gl = c.createRadialGradient(sx, sy, 10, sx, sy, 170); gl.addColorStop(0, "rgba(255,190,80,.55)"); gl.addColorStop(1, "rgba(255,190,80,0)"); c.fillStyle = gl; c.fillRect(sx - 180, sy - 180, 360, 360);
    ball(sx, sy, 42, "#ffe9a8", "#ff9d2e");
    const orb = (r, sp, ph) => { const a = s * sp + ph, x = sx + Math.cos(a) * W * r, y = sy + Math.sin(a) * W * r * 0.62; return [Math.cos(0.25) * (x - sx) - Math.sin(0.25) * (y - sy) + sx, Math.sin(0.25) * (x - sx) + Math.cos(0.25) * (y - sy) + sy]; };
    let p = orb(0.22, 0.05, 1.1); ball(p[0], p[1], 11, "#9be3ff", "#2a7de0");
    p = orb(0.42, 0.028, 1.9); c.strokeStyle = "#e8cf9a"; c.lineWidth = 5; c.beginPath(); c.ellipse(p[0], p[1], 48, 13, -0.3, 0, 7); c.stroke(); ball(p[0], p[1], 27, "#ffd28a", "#d9862e");
    p = orb(0.66, 0.017, 0.5); ball(p[0], p[1], 15, "#ffb08a", "#c8452a");
    for (const q of st) { const a = 0.35 + 0.65 * Math.abs(Math.sin(s * 0.9 + q[2])), x = q[0] * W, y = q[1] * H; c.globalAlpha = a; c.fillStyle = "#fff"; if (q[3]) { c.fillRect(x - 4, y - 0.7, 8, 1.4); c.fillRect(x - 0.7, y - 4, 1.4, 8); } else c.fillRect(x, y, 1.6, 1.6); } c.globalAlpha = 1;
    const tx = ((s * 22) % (W + 200)) - 100, ty = H * 0.68 + Math.sin(s * 0.5) * 20; c.save(); c.translate(tx, ty); c.rotate(-0.15); c.fillStyle = "#2b6cff"; c.fillRect(-20, -4, 13, 8); c.fillRect(7, -4, 13, 8); c.fillStyle = "#ffc93c"; c.fillRect(-6, -5, 12, 10); c.restore();
  }
  requestAnimationFrame(frame);
})();
/* ---------- music, composed live by code (Web Audio): calm in the design room, faster when flying ---------- */
const Music = (() => {
  let ctx = null, master = null, step = 0, nextT = 0, mood = "calm", on = true;
  const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(m, t, d, type, vol, cut) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = type; o.frequency.value = hz(m); f.type = "lowpass"; f.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05); }
  function drum(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); }
  function tick() {
    if (!ctx || !on || ctx.state !== "running") return;
    const spb = 60 / (mood === "action" ? 126 : 92) / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.3) {
      const ch = CH[Math.floor(step / 8) % 4], i = step % 8;
      if (i === 0) { ch.forEach((m) => tone(m, nextT, spb * 8, "sawtooth", 0.035, 650)); tone(ch[0] - 24, nextT, spb * 8, "triangle", 0.14, 300); }
      tone(ch[[0, 1, 2, 1, 0, 2, 1, 2][i]] + 12 + (i === 5 ? 12 : 0), nextT, spb * 1.6, "triangle", 0.075, 2400);
      if (mood === "action") { if (i % 4 === 0) drum(nextT); if (i % 2 === 1) tone(96, nextT, 0.03, "square", 0.012, 9000); }
      nextT += spb; step++;
    }
  }
  return {
    kick() { if (!on) return; if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; } try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); setInterval(tick, 80); } catch { /* no audio */ } },
    set(v) { on = v; if (master) master.gain.value = v ? 0.55 : 0; if (v) this.kick(); },
    mood(m) { mood = m; },
  };
})();
document.addEventListener("pointerdown", () => Music.kick());

/* ---------- text table (English first; add "kk" and "ru" columns later) ---------- */
const T = {
  roles: { director: "Flight Director", engineer: "Spacecraft Engineer", science: "Science Lead", capcom: "Comms and Budget" },
  short: { director: "FLIGHT", engineer: "ENGINEER", science: "SCIENCE", capcom: "COMMS" },
  roleDesc: {
    director: "Orbit, rocket, testing. Gives the final GO and flies the launch.",
    engineer: "Body, power, fuel, pointing, computer. Flies the braking burn at Mars.",
    science: "Instruments and the observation plan. Handles storms and faults.",
    capcom: "Radio, ground stations, data and money. Handles space junk and outages.",
  },
  crit: { data: "Data", revisit: "How often you see a place", budget: "Budget", dv: "Fuel (delta-v)", power: "Power" },
  learn: {
    mass: ["Mass", "Everything the rocket has to lift. Every kilogram of sensor needs more structure, more power and more fuel, and maybe a bigger rocket. Engineers call it the mass spiral. The bar compares the launch mass with what your rocket can lift to your orbit."],
    power: ["Power", "Solar panels work only in sunlight. Power = panel area x 1361 W per m2 x cell efficiency (29%) x how squarely the Sun hits them. At Mars sunlight is only 43% as strong as at Earth. The battery has to carry everything through the planet's shadow on every orbit."],
    budget: ["Budget", "Hardware + testing + rocket + ground stations. Each extra identical satellite costs 60% of the first. Leave a reserve: bad news during the mission is paid from it."],
    data: ["Data", "Sensors make data; the radio must bring it home. Data per day = data rate x contact time. In deep space the rate falls with the square of distance: twice as far means four times slower, which is why Mars needs NASA's giant Deep Space Network dishes."],
    dv: ["Push (delta-v)", "Delta-v, the change of speed your engine can make, is the currency of spaceflight. Rocket equation: delta-v = Isp x 9.81 x ln(full mass / empty mass). Fuel is heavy, so every extra m/s costs more than the one before."],
    rel: ["Chance of success", "Chance of success = how reliable the rocket is x the chance that each satellite survives the mission. More testing and a tougher computer raise it, and cost money."],
    sci: ["Science value", "Science = value of each instrument x how well it fits this mission x observation plan x the share of data that actually reaches Earth. A great sensor with a weak radio returns little."],
  },
};


/* ---------- sound (made by code with the Web Audio API) ---------- */
let AC = null;
function beep(f, d, type, vol) {
  if (!soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.value = f; g.gain.value = vol || 0.06; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
  } catch { /* no audio */ }
}
const sfx = { click: () => beep(660, 0.06), ok: () => { beep(660, 0.1); setTimeout(() => beep(990, 0.16), 90); }, alarm: () => { beep(440, 0.25, "square", 0.04); setTimeout(() => beep(330, 0.3, "square", 0.04), 260); }, go: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 110)) };


function craft(v) {
  const d = v.design, M = v.M, cube = M.cls === "cube", w = { cube3: 26, cube6: 40, cube12: 52, small: 66, medium: 84, large: 100 }[d.bus], h = { cube3: 70, cube6: 70, cube12: 78, small: 80, medium: 96, large: 110 }[d.bus];
  const pan = d.array === "body" ? 0 : Math.min(95, 34 + Math.sqrt(M.area) * 22), x0 = 170 - w / 2, y0 = 100 - h / 2;
  let s = `<svg class="craft" viewBox="0 0 340 200" role="img" aria-label="Your spacecraft">`;
  if (pan) for (const sg of [-1, 1]) { const px = sg < 0 ? x0 - pan - 8 : x0 + w + 8; s += `<rect x="${px}" y="${100 - 20}" width="${pan}" height="40" rx="3" fill="#1c3f8f" stroke="#6fa0ff"/><path d="M${px + pan / 3} 80v40M${px + (2 * pan) / 3} 80v40" stroke="#6fa0ff" stroke-width="1"/><path d="M${sg < 0 ? x0 - 8 : x0 + w} 100h8" stroke="#93a4c8" stroke-width="3"/>`; if (d.array === "track") s += `<circle cx="${sg < 0 ? x0 - 4 : x0 + w + 4}" cy="100" r="5" fill="#ffb547"/>`; }
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="${d.array === "body" ? "#1c3f8f" : "#c9a45c"}" stroke="#ffe2a8" stroke-width="1.5"/>`;
  if (d.prop !== "none") s += `<path d="M${170 - 9} ${y0 + h}l-5 14h28l-5-14z" fill="#8792ad"/>`;
  d.inst.forEach((id, i) => { const cx = x0 + 10 + ((i % 3) * (w - 20)) / Math.max(1, Math.min(2, d.inst.length - 1)), cy = y0 + 14 + Math.floor(i / 3) * 18; s += `<circle cx="${d.inst.length === 1 ? 170 : cx}" cy="${cy}" r="6.5" fill="#0b1220" stroke="#3ed6c5" stroke-width="2"/>`; });
  if (v.scn.body !== "earth") { const r = 16 + d.dish * 9; s += `<path d="M${170 - r} ${y0 - 6}q${r} ${-r * 0.9} ${2 * r} 0z" fill="#e8eefc" stroke="#93a4c8"/><path d="M170 ${y0 - 6}v6" stroke="#93a4c8" stroke-width="3"/>`; } else s += `<path d="M${x0 + w - 8} ${y0}v-12" stroke="#e8eefc" stroke-width="2"/>`;
  if (d.adcs !== "mtq") s += `<circle cx="${x0 + 8}" cy="${y0 + h - 9}" r="3.5" fill="#b39dff"/>`;
  return s + `<text x="170" y="192" text-anchor="middle" fill="#93a4c8" font-size="11" font-family="monospace">${d.sats > 1 ? d.sats + " x " : ""}${n1(M.wet)} kg each, ${Math.round(M.gen)} W</text></svg>`;
}
function winDiagram(c) {
  const w = c.win[c.value], R = 38, RM = R * 1.52, pt = (r, lon) => [70 + r * Math.cos((lon * Math.PI) / 180), 70 - r * Math.sin((lon * Math.PI) / 180)], e = pt(R, w.lonE), m = pt(RM, w.lonM);
  return `<svg viewBox="0 0 300 140" style="width:100%;max-width:420px"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#24365c"/><circle cx="70" cy="70" r="${RM}" fill="none" stroke="#24365c"/><circle cx="70" cy="70" r="6" fill="#ffb547"/><circle cx="${e[0]}" cy="${e[1]}" r="5" fill="#3ed6c5"/><circle cx="${m[0]}" cy="${m[1]}" r="4.5" fill="#ff6b6b"/><path d="M70 70L${e[0]} ${e[1]}M70 70L${m[0]} ${m[1]}" stroke="#93a4c8" stroke-dasharray="3 3"/><text x="150" y="40" fill="#3ed6c5" font-size="11" font-family="monospace">Earth</text><text x="150" y="58" fill="#ff6b6b" font-size="11" font-family="monospace">Mars: ${Math.abs(w.lead)} deg ${w.lead < 0 ? "behind" : "ahead"}</text><text x="150" y="76" fill="#93a4c8" font-size="11" font-family="monospace">best: 44 deg ahead</text><text x="150" y="100" fill="#ffb547" font-size="11" font-family="monospace">rocket energy C3 = ${w.c3}</text><text x="150" y="118" fill="#93a4c8" font-size="10" font-family="monospace">orbits: NASA JPL</text></svg>`;
}
function control(c, v) {
  const can = mine(c.role) && v.phase === "design";
  let h = `<div class="ctl" data-ctl="${c.key}"><div class="h"><b>${ICON[c.key] || ""} ${esc(c.label)}</b><span class="dim small">${esc(c.help)}</span></div>`;
  if (c.type === "step") h += `<div class="stepper"><button class="btn" data-a="step" data-k="${c.key}" data-v="${c.value - 1}" ${can && c.value > c.min ? "" : "disabled"}>-</button><div class="t">${esc(c.text)}</div><button class="btn" data-a="step" data-k="${c.key}" data-v="${c.value + 1}" ${can && c.value < c.max ? "" : "disabled"}>+</button></div>`;
  else {
    if (c.win) h += winDiagram(c);
    h += `<div class="grid g3">` + c.options.map((o) => { const sel = c.type === "multi" ? c.value.includes(o.id) : c.value === o.id; return `<button class="card ${sel ? "sel" : ""} ${o.off ? "off" : ""} ${can ? "" : "ro"}" data-a="set" data-k="${c.key}" data-v="${esc(o.id)}" data-n="${typeof o.id === "number" ? 1 : 0}" ${can && !o.off ? "" : "disabled"}><div class="n">${esc(o.n)}</div><div class="s">${esc(o.off || o.s)}</div><div class="d">${esc(o.d)}</div></button>`; }).join("") + `</div>`;
  }
  return h + `</div>`;
}


/* ---------- fire map (real NASA FIRMS hotspots) ---------- */
const CITIES = [[51.17, 71.43, "Astana"], [43.24, 76.89, "Almaty"], [44.85, 65.5, "Kyzylorda"], [47.1, 51.9, "Atyrau"], [50.28, 57.2, "Aktobe"], [50.4, 80.25, "Semey"], [41.3, 69.25, "Tashkent"], [49.25, -123.1, "Vancouver"], [53.55, -113.5, "Edmonton"], [62.45, -114.4, "Yellowknife"], [49.9, -97.1, "Winnipeg"], [45.4, -75.7, "Ottawa"]];
function drawFires(v) {
  const cv = $("#fires"); if (!cv || !v.fires) return;
  const c = cv.getContext("2d"), W = cv.width, H = cv.height, det = v.sim.det;
  c.fillStyle = "#050a16"; c.fillRect(0, 0, W, H);
  const boxes = [{ x: 8, w: W / 2 - 12, lat: [38, 58], lon: [44, 90], n: "Kazakhstan and Central Asia" }, { x: W / 2 + 4, w: W / 2 - 12, lat: [40, 72], lon: [-142, -50], n: "Canada and northern USA" }];
  for (const b of boxes) {
    const X = (lon) => b.x + ((lon - b.lon[0]) / (b.lon[1] - b.lon[0])) * b.w, Y = (lat) => H - 22 - ((lat - b.lat[0]) / (b.lat[1] - b.lat[0])) * (H - 50);
    c.strokeStyle = "#16233f"; c.fillStyle = "#3d4f78"; c.font = "10px monospace"; c.lineWidth = 1;
    for (let lo = Math.ceil(b.lon[0] / 10) * 10; lo < b.lon[1]; lo += 10) { c.beginPath(); c.moveTo(X(lo), 24); c.lineTo(X(lo), H - 22); c.stroke(); c.fillText(Math.abs(lo) + (lo < 0 ? "W" : "E"), X(lo) + 2, H - 8); }
    for (let la = Math.ceil(b.lat[0] / 5) * 5; la <= b.lat[1]; la += 5) { c.beginPath(); c.moveTo(b.x, Y(la)); c.lineTo(b.x + b.w, Y(la)); c.stroke(); c.fillText(la + "N", b.x + 2, Y(la) - 2); }
    c.fillStyle = "#93a4c8"; c.font = "12px monospace"; c.fillText(b.n, b.x + 4, 16);
    for (const ct of CITIES) if (ct[1] >= b.lon[0] && ct[1] <= b.lon[1] && ct[0] >= b.lat[0] && ct[0] <= b.lat[1]) { c.fillStyle = "#5b6f9c"; c.fillRect(X(ct[1]) - 2, Y(ct[0]) - 2, 4, 4); c.font = "10px monospace"; c.fillText(ct[2], X(ct[1]) + 5, Y(ct[0]) + 3); }
    v.fires.forEach((f, i) => { if (f[1] < b.lon[0] || f[1] > b.lon[1]) return; const st = det ? det[i] : 0, r = 2.5 + Math.min(6, Math.sqrt(f[2]) / 2.2); c.beginPath(); c.arc(X(f[1]), Y(f[0]), r, 0, 7); if (st === 1) { c.fillStyle = "#3ed6c5"; c.fill(); } else if (st === 2) { c.strokeStyle = "#ff6b6b"; c.lineWidth = 2; c.stroke(); } else { c.strokeStyle = "#4a5a80"; c.lineWidth = 1; c.stroke(); } });
  }
}

/* ---------- the piloting moments ---------- */
let G = null;
function stopGame() { if (G) { G.dead = true; G = null; } }
function mountGame(v) {
  stopGame();
  const launch = v.phase === "launch", role = launch ? "director" : "engineer", pilot = mine(role);
  if (!pilot) {
    app.innerHTML = `<section class="panel wait"><div class="big">${launch ? "LIFT-OFF" : (CAPB[v.game && v.game.body] || CAPB.mars).a}</div><p>${esc(nameOf(v.roles[role]))} (${T.roles[role]}) is flying ${launch ? "the launch" : "the braking burn"} by hand.</p><p class="dim">Cheer them on. If they have lost contact, the autopilot can take over after one minute, for half marks.</p><p><button class="btn" data-a="auto" data-auto="${v.t0}" disabled>Engage autopilot</button></p></section>`;
    return;
  }
  const g = v.game;
  app.innerHTML = `<section class="panel"><div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:baseline"><h1 style="margin:0">${launch ? "Fly the launch" : (CAPB[g.body] || CAPB.mars).h}</h1><span class="dim small">${launch ? `Target: a circle ${g.alt} km up. Tilt over slowly, stop the engine when the HIGH POINT reaches the target, coast up, then burn sideways until the LOW POINT reaches it too.${g.assist ? " CADET MODE: the autopilot steers for you. You only switch the ENGINE on and off when the big words tell you." : ""}` : (CAPB[g.body] || CAPB.mars).p + " <span>" + (g.target / (CAPB[g.body] || CAPB.mars).R * 3389.5 > 20000 ? Lf("Target: high point near {0} km.", g.target.toLocaleString("en-US").replace(/,/g, " ")) : Lf("Target: high point below {0} km.", g.target.toLocaleString("en-US").replace(/,/g, " "))) + "</span>"}</span></div>
  <canvas id="cv" width="900" height="500" style="margin-top:.5rem"></canvas>
  <div class="pad">${launch ? `<button class="btn" id="bL">TILT UP (left arrow)</button><button class="btn" id="bR">TILT OVER (right arrow)</button><button class="btn go wide" id="bE">IGNITION (space)</button>` : `<button class="btn go wide" id="bE" style="grid-column:1/-1">HOLD TO BURN (space)</button>`}</div>
  <p id="gmsg" class="mono small" style="color:var(--amber);min-height:1.4em"></p><p><button class="btn sm" data-a="auto" data-auto="${v.t0}" disabled>Engage autopilot (half marks, after 60 s)</button></p></section>`;
  (launch ? launchGame : captureGame)(v, g);
}
function hold(el, on, off) { el.addEventListener("pointerdown", (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); on(); }); for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, off); }
function finishGame(g, title, lines, action) {
  g.over = true; const md = medalFor(action.type, action.rating || 0);
  const m = $("#gmsg"); if (m) m.innerHTML = `${md ? `<span class="medal big ${md[0]}">${md[1]} ${esc(L(md[2]))}</span> ` : ""}<b>${esc(L(title))}</b> ${lines.map((x) => esc(L(x))).join(" ")} <button class="btn go" id="gdone">Continue</button>`;
  const b = $("#gdone"); if (b) b.addEventListener("click", () => { b.disabled = true; if (ui.school) return endSchool(); act(action); });
  (action.rating >= 0.6 ? sfx.ok : sfx.alarm)();
}

function launchGame(v, cfg) {
  const g = (G = { s: P.launchInit(), pitch: 0, on: false, started: false, left: false, right: false, over: false, dead: false, trail: [], offT: 0, last: 0 });
  const cv = $("#cv"), c = cv.getContext("2d"), W = cv.width, H = cv.height, tgt = cfg.alt, bE = $("#bE");
  const toggle = () => { if (g.over) return; g.started = true; g.on = !g.on; bE.textContent = g.on ? "ENGINE OFF (space)" : "ENGINE ON (space)"; sfx.click(); };
  bE.addEventListener("click", toggle);
  hold($("#bL"), () => (g.left = true), () => (g.left = false)); hold($("#bR"), () => (g.right = true), () => (g.right = false));
  const kd = (e) => { if (g.dead) return window.removeEventListener("keydown", kd); if (e.code === "ArrowLeft") g.left = true; else if (e.code === "ArrowRight") g.right = true; else if (e.code === "Space" && !e.repeat) toggle(); else return; e.preventDefault(); };
  const ku = (e) => { if (g.dead) return window.removeEventListener("keyup", ku); if (e.code === "ArrowLeft") g.left = false; else if (e.code === "ArrowRight") g.right = false; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  function end(title, lines) { const rating = P.launchRating(g.s, tgt), i = P.launchInfo(g.s); finishGame(g, title, lines.concat([`High point ${Math.round(Math.min(i.apo, 99999))} km, low point ${Math.round(i.peri)} km. Accuracy ${Math.round(rating * 100)}%.`]), { type: "launch", rating, t: Date.now() }); }
  function frame(ts) {
    if (g.dead) return;
    const dt = Math.min(0.05, (ts - (g.last || ts)) / 1000); g.last = ts;
    const s = g.s;
    if (g.started && !g.over) {
      if (cfg.assist) { const q = P.launchGuide(s, tgt), dd = q.pitch - g.pitch; g.pitch += Math.max(-45 * dt, Math.min(45 * dt, dd)); }
      else g.pitch = Math.max(-10, Math.min(125, g.pitch + ((g.right ? 1 : 0) - (g.left ? 1 : 0)) * 28 * dt));
      const i0 = P.launchInfo(s), burning = g.on && s.b2 < P.LV.T2;
      let simT = dt * (burning ? 8 : i0.h > 95 ? 45 : 8);
      while (simT > 0 && !s.crashed) { const d = Math.min(0.1, simT); P.launchStep(s, d, g.pitch, g.on); simT -= d; }
      if (g.trail.length < 900 && (!g.trail.length || s.t - g.trail[g.trail.length - 1][2] > 4)) g.trail.push([s.x, s.y, s.t]);
      const i = P.launchInfo(s);
      g.offT = burning ? 0 : g.offT + dt;
      if (s.crashed) end("The rocket fell back to Earth.", []);
      else if (i.peri > 120 && g.offT > 1.6) end("Orbit!", []);
      else if (s.b2 >= P.LV.T2 && i.peri < 120) end("Out of fuel before reaching orbit.", ["Tilting over too early wastes fuel in thick air; too late wastes it fighting gravity."]);
      else if (!burning && i.vr < 0 && i.h < 95 && s.t > 40) end("The rocket is falling back into the air.", []);
    }
    draw(); requestAnimationFrame(frame);
  }
  function draw() {
    const s = g.s, i = P.launchInfo(s), r = P.RE + i.h, phi = Math.atan2(s.x, s.y), cs = Math.cos(phi), sn = Math.sin(phi);
    const sc = (H * 0.56) / (Math.max(tgt, Math.min(i.h, tgt * 1.6)) + 90), rx = W * 0.36, ry = H * 0.74 - Math.min(i.h, tgt * 1.6) * sc * 0.55;
    const scr = (x, y) => { const dx = x - s.x, dy = y - s.y; return [rx + (dx * cs - dy * sn) * sc, ry - (dx * sn + dy * cs) * sc]; };
    const sky = Math.max(0, 1 - i.h / 90), gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgb(${Math.round(6 + 24 * sky)},${Math.round(8 + 70 * sky)},${Math.round(30 + 160 * sky)})`); gr.addColorStop(1, `rgb(${Math.round(24 + 150 * sky)},${Math.round(18 + 150 * sky)},${Math.round(58 + 180 * sky)})`); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff"; for (const st of STARS) { c.globalAlpha = (1 - sky) * st[2]; c.fillRect(st[0] * W, st[1] * H, st[3], st[3]); } c.globalAlpha = 1;
    const cy = ry + r * sc;
    c.beginPath(); c.arc(rx, cy, P.RE * sc, 0, 7); const eg = c.createLinearGradient(0, cy - P.RE * sc, 0, cy - P.RE * sc + 280); eg.addColorStop(0, "#35a0e8"); eg.addColorStop(0.25, "#1a66a8"); eg.addColorStop(1, "#0a2a52"); c.fillStyle = eg; c.fill(); c.shadowColor = "#6fd0ff"; c.shadowBlur = 26; c.strokeStyle = "#8fe3ff"; c.lineWidth = 2.5; c.stroke(); c.shadowBlur = 0;
    c.beginPath(); c.arc(rx, cy, (P.RE + 90) * sc, 0, 7); c.strokeStyle = "rgba(120,180,255,.25)"; c.lineWidth = 1; c.stroke();
    c.setLineDash([8, 8]); c.beginPath(); c.arc(rx, cy, (P.RE + tgt) * sc, 0, 7); c.strokeStyle = "#ffb547"; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
    c.fillStyle = "#ffb547"; c.font = "12px monospace"; c.fillText("target orbit " + tgt + " km", rx + 60, cy - (P.RE + tgt) * sc - 6);
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.5; c.beginPath(); g.trail.forEach((p, k) => { const q = scr(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
    if (g.started) { let x = s.x, y = s.y, vx = s.vx, vy = s.vy; c.strokeStyle = "#6ee787"; c.lineWidth = 1.5; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(rx, ry); for (let k = 0; k < 420; k++) { const rr = Math.hypot(x, y); if (rr < P.RE) break; const a = -P.MU / (rr * rr * rr); vx += a * x * 12; vy += a * y * 12; x += vx * 12; y += vy * 12; const q = scr(x, y); c.lineTo(q[0], q[1]); } c.stroke(); c.setLineDash([]); }
    const pr = (g.pitch * Math.PI) / 180;
    c.save(); c.translate(rx, ry); c.rotate(pr);
    if (g.on && s.thr > 0) { const fl = 26 + Math.random() * 16, fg = c.createLinearGradient(0, 12, 0, 12 + fl); fg.addColorStop(0, "#fff6c9"); fg.addColorStop(0.4, "#ffb547"); fg.addColorStop(1, "rgba(255,90,120,0)"); c.fillStyle = fg; c.beginPath(); c.moveTo(-6, 12); c.quadraticCurveTo(0, 12 + fl * 1.3, 6, 12); c.fill(); }
    c.fillStyle = "#ff7ac6"; c.beginPath(); c.moveTo(-6, 2); c.lineTo(-13, 14); c.lineTo(-6, 12); c.fill(); c.beginPath(); c.moveTo(6, 2); c.lineTo(13, 14); c.lineTo(6, 12); c.fill();
    c.fillStyle = "#eef2ff"; c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(8, -8, 6, 12); c.lineTo(-6, 12); c.quadraticCurveTo(-8, -8, 0, -22); c.fill(); c.fillStyle = "#5aa2ff"; c.beginPath(); c.arc(0, -7, 2.8, 0, 7); c.fill(); c.restore();
    c.fillStyle = "rgba(5,10,22,.72)"; c.fillRect(10, 10, 250, 168);
    c.font = "13px monospace"; const row = (k, l, val, col) => { c.fillStyle = "#93a4c8"; c.fillText(l, 20, 32 + k * 20); c.fillStyle = col || "#e8eefc"; c.fillText(val, 140, 32 + k * 20); };
    row(0, "ALTITUDE", Math.round(i.h) + " km"); row(1, "SPEED", i.v.toFixed(2) + " km/s"); row(2, "CLIMB", (i.vr * 1000).toFixed(0) + " m/s", i.vr < 0 ? "#ff6b6b" : "#e8eefc");
    row(3, "HIGH POINT", Math.round(Math.min(i.apo, 99999)) + " km", Math.abs(i.apo - tgt) < 25 ? "#6ee787" : "#ffb547"); row(4, "LOW POINT", Math.round(i.peri) + " km", i.peri > tgt - 25 ? "#6ee787" : i.peri > 120 ? "#ffb547" : "#ff6b6b"); row(5, "TILT", Math.round(g.pitch) + " deg");
    c.fillStyle = "#93a4c8"; c.fillText("FUEL", 20, 32 + 6 * 20); c.fillStyle = "#24365c"; c.fillRect(140, 142, 100, 10); c.fillStyle = i.fuel2 < 0.15 ? "#ff6b6b" : "#3ed6c5"; c.fillRect(140, 142, 100 * Math.max(0, (i.fuel1 * P.LV.T1 + i.fuel2 * P.LV.T2) / (P.LV.T1 + P.LV.T2)), 10);
    const dx = W - 110, dy = H - 30, R = 80; c.strokeStyle = "#24365c"; c.lineWidth = 2; c.beginPath(); c.arc(dx, dy, R, Math.PI, Math.PI * 1.5); c.stroke(); c.fillStyle = "#93a4c8"; c.font = "11px monospace"; c.fillText("up", dx - 8, dy - R - 6); c.fillText("sideways", dx + 6, dy + 4);
    const needle = (deg, col, w) => { const a = -Math.PI / 2 + (deg * Math.PI) / 180; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + R * Math.cos(a), dy + R * Math.sin(a)); c.stroke(); };
    if (cfg.guide && !g.over) { const q = P.launchGuide(s, tgt); needle(q.pitch, "rgba(110,231,135,.75)", 6); c.fillStyle = "#6ee787"; c.font = "13px monospace"; c.fillText("Flight computer: " + (g.started ? q.say + (q.on ? "" : " [engine OFF]") : "press IGNITION"), 20, H - 16); }
    needle(g.pitch, "#ffb547", 3);
    if (cfg.assist && !g.over) { const q = P.launchGuide(s, tgt), want = g.started ? q.on : true; if (want !== g.on && Math.floor(performance.now() / 350) % 2 === 0) { c.font = "800 34px Rubik, sans-serif"; c.textAlign = "center"; c.fillStyle = want ? "#6ee787" : "#ffd84d"; c.fillText(!g.started ? "PRESS IGNITION!" : want ? "ENGINE ON NOW!" : "ENGINE OFF NOW!", W / 2, 70); c.textAlign = "left"; } }
  }
  requestAnimationFrame(frame);
}

const CAPB = {
  mars: { R: 3389.5, V: 1, c: ["#ffb98a", "#cc5a2e", "#4f1a10", "#ff9a5a", "rgba(255,140,90,.28)"], t: ["Too deep: the spacecraft hit the air of Mars.", "Fly-by: Mars could not hold you.", "Captured into orbit around Mars!"], h: "Brake into Mars orbit", a: "ARRIVING AT MARS", p: "Hold BURN around the closest point to Mars. Fuel works hardest where you move fastest (the Oberth effect)." },
  moon: { R: 1737.4, V: 0.47, c: ["#f2f2f7", "#a9a9b8", "#4a4a5c", "#d8dcff", "rgba(200,205,255,.18)"], t: ["Too low: the spacecraft hit the Moon.", "Fly-by: the Moon could not hold you.", "Captured into orbit around the Moon!"], h: "Brake into Moon orbit", a: "ARRIVING AT THE MOON", p: "Hold BURN around the closest point to the Moon. Fuel works hardest where you move fastest (the Oberth effect)." },
  jupiter: { R: 71492, V: 11.8, c: ["#f6e2c0", "#c98d5a", "#5a3218", "#ffd9a0", "rgba(255,210,150,.22)"], t: ["Too deep: the spacecraft fell into Jupiter's clouds.", "Fly-by: Jupiter could not hold you.", "Captured into orbit around Jupiter!"], h: "Brake into Jupiter orbit", a: "ARRIVING AT JUPITER", p: "Hold BURN around the closest point to Jupiter. Fuel works hardest where you move fastest (the Oberth effect)." },
};
function captureGame(v, cfg) {
  const BP = CAPB[cfg.body || "mars"] || CAPB.mars, Lk = BP.R / P.RM, Vk = BP.V, tg = cfg.target / Lk, km = (x) => Math.round(x * Lk).toLocaleString("en-US").replace(/,/g, " ");
  const best = P.capBest(tg) || { r: 3900, used: 1 };
  const g = (G = { s: P.capInit(best.used * cfg.fuel), burn: false, over: false, dead: false, trail: [], offT: 0, last: 0, acc: 0 });
  const cv = $("#cv"), c = cv.getContext("2d"), W = cv.width, H = cv.height, bE = $("#bE"), fuel0 = g.s.left;
  hold(bE, () => (g.burn = true), () => (g.burn = false));
  const kd = (e) => { if (g.dead) return window.removeEventListener("keydown", kd); if (e.code === "Space") { g.burn = true; e.preventDefault(); } };
  const ku = (e) => { if (g.dead) return window.removeEventListener("keyup", ku); if (e.code === "Space") g.burn = false; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  function end(title, lines) { const r = P.capRating(g.s, tg, best.used); finishGame(g, title, lines.concat(r.captured ? [`Burn efficiency ${Math.round(r.rating * 100)}%.`] : []), { type: "capture", rating: r.rating, dvUsed: g.s.used, captured: r.captured }); }
  function frame(ts) {
    if (g.dead) return;
    const dt = Math.min(0.05, (ts - (g.last || ts)) / 1000); g.last = ts;
    const s = g.s;
    if (!g.over) {
      const i0 = P.capInfo(s);
      g.acc += dt * (i0.r > 16000 ? 600 : i0.r > 9000 ? 150 : 45);
      while (g.acc >= 1 && !s.crashed) { P.capStep(s, 1, g.burn); g.acc -= 1; }
      if (g.trail.length < 900 && (!g.trail.length || s.t - g.trail[g.trail.length - 1][2] > 40)) g.trail.push([s.x, s.y, s.t]);
      const i = P.capInfo(s);
      g.offT = s.burning ? 0 : g.offT + dt;
      if (s.crashed) end(BP.t[0], []);
      else if (s.passed && !i.bound && i.r > 26000) end(BP.t[1], ["The burn was too short or too late."]);
      else if (s.passed && i.bound && g.offT > 1.8 && (i.apo < tg * 1.6 || s.left <= 0 || i.r > 9000)) end(BP.t[2], [`High point ${km(i.apo)} km, low point ${km(i.peri)} km.`]);
    }
    draw(); requestAnimationFrame(frame);
  }
  function draw() {
    const s = g.s, i = P.capInfo(s), sc = Math.min(0.05, (H * 0.44) / Math.max(i.r * 1.1, 7000)), cx = W * 0.52, cy = H * 0.5, scr = (x, y) => [cx + x * sc, cy - y * sc];
    c.fillStyle = "#050a16"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#fff"; for (const st of STARS) { c.globalAlpha = st[2]; c.fillRect(st[0] * W, st[1] * H, st[3], st[3]); } c.globalAlpha = 1;
    c.shadowColor = BP.c[3]; c.shadowBlur = 30; c.beginPath(); c.arc(cx, cy, (P.RM + 80) * sc, 0, 7); c.fillStyle = BP.c[4]; c.fill(); c.shadowBlur = 0;
    { const R = P.RM * sc, mg = c.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R); mg.addColorStop(0, BP.c[0]); mg.addColorStop(0.55, BP.c[1]); mg.addColorStop(1, BP.c[2]); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = mg; c.fill(); }
    if (cfg.guide) { c.setLineDash([6, 8]); c.strokeStyle = "#6ee787"; c.beginPath(); c.arc(cx, cy, (best.r + 250) * sc, 0, 7); c.stroke(); c.setLineDash([]); }
    c.strokeStyle = "rgba(255,255,255,.35)"; c.beginPath(); g.trail.forEach((p, k) => { const q = scr(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
    { let x = s.x, y = s.y, vx = s.vx, vy = s.vy; c.strokeStyle = i.bound ? "#6ee787" : "#ffb547"; c.setLineDash([3, 5]); c.beginPath(); const p0 = scr(x, y); c.moveTo(p0[0], p0[1]); for (let k = 0; k < 700; k++) { const rr = Math.hypot(x, y); if (rr < P.RM || rr > 90000) break; const h = Math.max(8, rr / 180), a = -P.MUM / (rr * rr * rr); vx += a * x * h; vy += a * y * h; x += vx * h; y += vy * h; const q = scr(x, y); c.lineTo(q[0], q[1]); } c.stroke(); c.setLineDash([]); }
    const p = scr(s.x, s.y); if (s.burning) { const vv = Math.hypot(s.vx, s.vy); c.strokeStyle = "#ffb547"; c.lineWidth = 4; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + (s.vx / vv) * 22, p[1] - (s.vy / vv) * 22); c.stroke(); c.lineWidth = 1; }
    c.fillStyle = "#e8eefc"; c.beginPath(); c.arc(p[0], p[1], 5, 0, 7); c.fill();
    c.fillStyle = "rgba(5,10,22,.72)"; c.fillRect(10, 10, 280, 128); c.font = "13px monospace";
    const row = (k, l, val, col) => { c.fillStyle = "#93a4c8"; c.fillText(l, 20, 32 + k * 20); c.fillStyle = col || "#e8eefc"; c.fillText(val, 130, 32 + k * 20); };
    row(0, "DISTANCE", km(i.r) + " km", cfg.guide && i.r < best.r + 250 && !s.passed ? "#6ee787" : "#e8eefc"); row(1, "SPEED", (i.v * Vk).toFixed(2) + " km/s"); row(2, "ORBIT", i.bound ? "high point " + km(i.apo) + " km" : "escape path", i.bound ? "#6ee787" : "#ffb547"); row(3, "TARGET", tg > 20000 ? "near " + km(tg) + " km" : "below " + km(tg) + " km");
    c.fillStyle = "#93a4c8"; c.fillText("FUEL", 20, 32 + 4 * 20); c.fillStyle = "#24365c"; c.fillRect(130, 102, 140, 10); c.fillStyle = s.left / fuel0 < 0.15 ? "#ff6b6b" : "#3ed6c5"; c.fillRect(130, 102, 140 * Math.max(0, s.left / fuel0), 10);
    if (cfg.guide && !g.over) { c.fillStyle = "#6ee787"; c.fillText("Flight computer: " + (i.bound && i.apo < tg * 1.05 ? "release now" : !s.passed && i.r > best.r + 250 ? "wait for the green ring (" + km(best.r + 250) + " km)" : "BURN and hold"), 20, H - 16); }
  }
  requestAnimationFrame(frame);
}


/* ---------- playing alone (rules run in this browser) or with friends (rules run in a live room) ---------- */
let myId = null; try { myId = sessionStorage.getItem("oml:id"); if (!myId) { myId = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("oml:id", myId); } } catch { myId = Math.random().toString(36).slice(2, 10); }
let myName = ls("oml:name") || ""; $("#name").value = myName;
let mode = null, room = "", socket = null, retry = 0, S = null, soundOn = true, RULES = null, localState = null, gotState = false, wantCfg = null;
const PING = "__ping", PONG = "__pong";
function pushSolo() { S = { type: "state", you: myId, view: RULES.viewFor(localState, myId) }; onState(); }
function startSolo(scn, diff) {
  mode = "solo"; localState = RULES.setup([myId]); const t = Date.now();
  for (const a of [{ type: "sit", name: myName || "Pilot" }, { type: "config", scn, diff }, { type: "start", t }, { type: "ready", t }]) localState = RULES.applyAction(localState, myId, a);
  ui.sheet = null; ui.hi = null; ui.lastPhase = null; pushSolo();
}
function startRoom(code, cfg) { mode = "room"; room = code; wantCfg = cfg || null; gotState = false; S = null; retry = 0; ui.lastPhase = null; try { history.replaceState(null, "", "?room=" + room); } catch { /* fine */ } render(); connect(); }
function leave(to) { mode = null; S = null; localState = null; const s = socket; socket = null; if (s) try { s.close(); } catch { /* gone */ } try { history.replaceState(null, "", location.pathname); } catch { /* fine */ } stopGame(); ui.mounted = null; ui.sheet = null; ui.screen = to || "map"; Music.mood("calm"); render(); }
function connect() {
  if (mode !== "room") return;
  const sk = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/${encodeURIComponent(room)}`); socket = sk;
  sk.addEventListener("open", () => { retry = 0; send({ type: "join", playerId: myId }); });
  sk.addEventListener("message", (e) => {
    if (e.data === PONG || socket !== sk) return;
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === "error") return toast(m.error);
    if (m.type !== "state") return;
    gotState = true; S = m;
    if (wantCfg && m.view && m.view.known && m.view.phase === "lobby" && m.view.host === m.you) { const c = wantCfg; wantCfg = null; act({ type: "config", scn: c.scn, diff: c.diff }); }
    onState();
  });
  sk.addEventListener("close", () => {
    if (socket !== sk || mode !== "room") return;
    retry = Math.min(retry + 1, 6); setTimeout(connect, 500 * 2 ** (retry - 1));
    if (!gotState && retry >= 2) app.innerHTML = `<div class="white wait" style="max-width:640px;margin:40px auto"><div class="orbirow" style="justify-content:center">${orbi("", "uh")}</div><h2>Orbi cannot reach the team room.</h2><p class="dim">Still trying. You can always play alone: that needs no connection.</p><p><button class="btn yellow big" data-a="exit">Play alone</button></p></div>`;
  });
}
function send(m) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m)); }
function act(a) {
  if (mode === "solo") { const ok = RULES.validateAction(localState, myId, a); if (!ok.ok) return toast(ok.error || "not allowed"); localState = RULES.applyAction(localState, myId, a); return pushSolo(); }
  send({ type: "action", action: a });
}
setInterval(() => { if (socket && socket.readyState === WebSocket.OPEN) socket.send(PING); }, 30000);
let toastT = 0;
function toast(t, good) { const e = $("#toast"); e.textContent = L(t); e.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove("on"), 3200); if (!good) beep(180, 0.15); }

/* ---------- state handling ---------- */
function nameOf(id) { const p = S.view.players.find((x) => x.id === id); return p ? p.name : "nobody"; }
function mine(role) { return S.view.myRoles.indexOf(role) >= 0; }
function onState() {
  const v = S.view; if (!v) return;
  if (!v.known) { act({ type: "sit", name: myName || "Pilot" }); return; }
  if (v.phase !== ui.lastPhase) { if (ui.lastPhase) (v.phase === "launch" ? sfx.go : sfx.ok)(); ui.lastPhase = v.phase; ui.sheet = null; ui.hi = null; window.scrollTo(0, 0); app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter"); setTimeout(() => app.classList.remove("enter"), 900); }
  Music.mood(v.phase === "launch" || v.phase === "capture" || v.event ? "action" : "calm");
  if (v.event) { const k = v.event.id + ":" + v.event.t0; if (k !== ui.evKey) { ui.evKey = k; ui.evAt = performance.now(); sfx.alarm(); } } else ui.evKey = null;
  if (v.phase === "report") { const k = v.scnId + ":" + v.attempt + ":" + v.report.total; if (ui.rewardKey !== k) { ui.rewardKey = k; const st = v.report.stars, xp = Math.round(v.report.total / 10), dust = 5 + st * 15; SAVE.stars[v.scnId] = Math.max(SAVE.stars[v.scnId] || 0, st); SAVE.xp += xp; SAVE.dust += dust; save(); ui.gain = { xp, dust }; } }
  render();
}
function header(v) {
  $("#hBack").hidden = !mode && ui.screen === "home"; $("#hMission").textContent = v && v.scn ? v.scn.n : "";
  $("#hStars").textContent = totalStars(); $("#hDust").textContent = SAVE.dust; $("#hRoom").hidden = mode !== "room"; $("#hRoom").textContent = "Room " + room;
}
function render() {
  if (ui.school || ui.hand) return;
  if (!mode) { stopGame(); ui.mounted = null; header(null); app.innerHTML = (UI[ui.screen] || UI.home)(); placeStage(null); return; }
  if (!S || !S.view || !S.view.known) { header(null); if (!gotState || mode === "solo") app.innerHTML = `<div class="wait"><div class="orbirow" style="justify-content:center">${orbi("big")}</div><div class="big">Opening room ${esc(room)}...</div></div>`; return; }
  const v = S.view; header(v);
  if (v.phase === "launch" || v.phase === "capture") { const key = v.phase + ":" + v.attempt + ":" + v.t0; if (ui.mounted !== key) { ui.mounted = key; mountGame(v); } return; }
  stopGame(); ui.mounted = null;
  const old = $("#sheet"), top = old ? old.scrollTop : 0;
  app.innerHTML = SCREEN[v.phase](v);
  placeStage(v); animateBars(); applyHi();
  const sh = $("#sheet"); if (sh) { sh.scrollTop = top; if (!ui.sheetNew) sh.style.animation = "none"; ui.sheetNew = false; }
  if (v.phase === "ops" || v.phase === "report") drawFires(v);
}
function placeStage(v) { const slot = $("#slot3d"); if (slot && Stage) { slot.appendChild(stageEl); Stage.update(v ? { body: v.scn ? v.scn.body : "earth", design: v.design, area: v.M ? v.M.area : 0, paint: SHIPC[(SAVE.look || {}).s] } : { paint: SHIPC[(SAVE.look || {}).s] }); } }

/* ---------- small builders ---------- */
const ROLES = ["director", "engineer", "science", "capcom"], RICON = { director: "🚀", engineer: "🔧", science: "🔬", capcom: "📡" };
const roleChip = (r) => `<span class="role ${r}">${T.roles[r]}</span>`;
function fmtM(x) { return x < 0.995 ? "$" + Math.round(x * 1000) + "k" : "$" + (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : Math.round(x)) + "M"; }
function n1(x) { return x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2); }
function stage(v, cls) { return Stage ? `<div class="stagebox ${cls || ""}" id="slot3d"></div>` : v && v.design ? `<div class="stagebox ${cls || ""}">${craft(v)}</div>` : `<div class="stagebox ${cls || ""}"></div>`; }
function reqList(reqs) { return reqs.map((r) => `<div class="req ${r.ok ? "ok" : "no"}"><i>${r.ok ? "✔" : "✘"}</i><div>${esc(r.t)}</div><span>${esc(r.v || "")}</span></div>`).join(""); }
function issueList(v) { const rank = { block: 0, red: 1, amber: 2 }, IS = v.issues.slice().sort((a, b) => rank[a.sev] - rank[b.sev]); return IS.length ? IS.map((i) => `<div class="issue ${i.sev}">${solo(v) ? "" : roleChip(i.role) + " "}${esc(i.msg)}${i.fix ? `<div class="fix">${esc(i.fix)}</div>` : ""}</div>`).join("") : `<p class="dim small">No problems. Every light is green!</p>`; }
function secrets(v) { return v.cards.map((c) => `<div class="secret">🤫 ${solo(v) ? "" : roleChip(c.role) + " "}Bonus goal: <b>${esc(c.text)}</b></div>`).join(""); }
const solo = (v) => v.players.length === 1;
const SHIPS = ["Blip", "Comet", "Pixel", "Nova", "Zippy", "Bolt", "Twinkle", "Dash"];
function shipName(v) { let h = 0; for (const ch of v.scnId + v.host) h = (h * 31 + ch.charCodeAt(0)) % 997; return SHIPS[(h + v.attempt) % SHIPS.length]; }

function meters(v) {
  const M = v.M, c = v.scn.crit, mars = v.scn.body !== "earth", fire = v.scnId === "fire";
  const row = (key, icon, name, ok, warn, frac, text, crit) => `<button class="meter ${ok ? (warn ? "warn" : "ok") : "bad"}" data-a="learn" data-k="${key}"><i>${icon}</i><div><div class="mh"><b>${name}${crit ? " ★" : ""}</b><em>${ok ? (warn ? "Careful" : "Good") : "Problem!"}</em></div><div class="bar"><i data-g="${name}" style="width:${Math.round(Math.max(0.04, Math.min(1, frac)) * 100)}%"></i></div><span>${text}</span></div></button>`;
  return row("mass", "⚖️", "Weight", M.massMargin >= 0, M.massMargin < 0.1, M.launchMass / Math.max(1, M.cap), `${n1(M.launchMass)} kg, rocket lifts ${Math.round(M.cap)} kg`) +
    row("power", "⚡", "Electricity", M.pMargin >= 0 && M.battOk, M.pMargin < 0.2, M.load / Math.max(0.1, M.gen), `makes ${n1(M.gen)} W, needs ${n1(M.load)} W`, c.includes("power")) +
    row("budget", "💰", "Money", M.bMargin >= 0, M.bMargin < 0.08, M.total / M.budget, `${fmtM(M.total)} of ${fmtM(M.budget)}`, c.includes("budget")) +
    row("data", "💾", "Data home", M.genGB > 0 && M.dataRatio >= 0.9, M.dataRatio < 1, M.genGB > 0 ? M.dataRatio : 0.04, M.genGB > 0 ? `${Math.round(M.dataRatio * 100)}% of ${n1(M.genGB)} GB a day reaches Earth` : "no sensors yet", c.includes("data")) +
    row("dv", "⛽", "Fuel", M.dv >= M.dvNeed - 1e-9, M.dvNeed > 0 && M.dvMargin < 0.15, M.dvNeed > 0 ? M.dv / M.dvNeed : 1, mars ? `has ${M.dv.toFixed(2)} km/s, needs ${M.dvNeed.toFixed(2)}` : `has ${Math.round(M.dv * 1000)} m/s, needs ${Math.round(M.dvNeed * 1000)}`, c.includes("dv")) +
    (M.revisit != null ? row("sci", "👁️", fire ? "Sees each place" : "Full picture", M.revisit <= (fire ? 12 : 7), false, (fire ? 12 : 7) / M.revisit, fire ? `every ${n1(M.revisit)} hours, goal 12` : `every ${n1(M.revisit)} days, goal 7`, true) : "") +
    row("rel", "🛡️", "Safety", M.pMission >= 0.6, M.pMission < 0.8, M.pMission, `${Math.round(M.pMission * 100)}% chance of success`) +
    row("sci", "🔬", "Science", M.sciPct >= 0.3, M.sciPct < 0.6, M.sciPct, `${Math.round(M.sciPct * 100)}% of the best possible`);
}
const SLOTS = [["goals", "Goals", "🎯", []], ["where", "Where?", "🪐", ["orbit", "window"]], ["rocket", "Rocket", "🚀", ["rocket", "sats", "test"]], ["body", "Body", "📦", ["bus", "adcs", "comp"]], ["power", "Power", "☀️", ["array", "arraySize", "batt"]], ["engine", "Engine", "🔥", ["prop", "fuel"]], ["tools", "Tools", "🔭", ["inst", "plan"]], ["radio", "Radio", "📡", ["band", "dish", "net", "contact"]]];
function slotInfo(v, sl) {
  if (sl[0] === "goals") { const ok = v.reqs.filter((r) => r.ok).length; return { text: ok + " of " + v.reqs.length + " goals OK", st: ok === v.reqs.length ? "" : "amber", role: null }; }
  const cs = v.controls.filter((c) => sl[3].includes(c.key)), f = cs[0]; let text = "";
  if (f) { if (f.type === "multi") text = f.value.length ? f.options.filter((o) => f.value.includes(o.id)).map((o) => o.n).join(", ") : "Nothing yet"; else if (f.type === "pick") { const o = f.options.find((x) => x.id === f.value); text = o ? o.n : ""; } else text = f.text; }
  if (sl[0] === "rocket" && v.design.sats > 1) text += ", " + v.design.sats + " satellites";
  const iss = v.issues.filter((i) => i.go && sl[3].includes(i.go.k));
  return { text, st: iss.some((i) => i.sev !== "amber") ? "red" : iss.length ? "amber" : "", role: f ? f.role : null };
}
function slotOf(key) { const s = SLOTS.find((x) => x[3].includes(key)); return s ? s[0] : null; }
function sheet(v) {
  const sl = SLOTS.find((s) => s[0] === ui.sheet); if (!sl) return "";
  const cs = v.controls.filter((c) => sl[3].includes(c.key)), role = cs[0] ? cs[0].role : null;
  const body = sl[0] === "goals" ? `<div class="white" style="box-shadow:none;border:3px solid var(--line)"><h3>What ${esc(v.scn.client)} needs</h3>${reqList(v.reqs)}<p class="tiny">Miss one goal and the mission gets two stars at most.</p></div><div style="height:10px"></div>${secrets(v)}<p class="small" style="color:var(--muted)">Extra important here: ${v.scn.crit.map((c) => T.crit[c]).join(", ")}. Budget ${esc(v.scn.budget)}, mission length ${v.scn.years} ${v.scn.years === 1 ? "year" : "years"}.</p>` : (role && !mine(role) ? `<p class="small" style="color:var(--muted)">${roleChip(role)} This part belongs to ${esc(nameOf(v.roles[role]))}. You can look, and talk them into changes.</p>` : "") + cs.map((c) => control(c, v)).join("");
  return `<div class="sheetwrap" data-a="sheetClose"></div><div class="sheet" id="sheet"><div class="sheethead"><h2>${sl[2]} ${sl[1]}</h2><button class="btn yellow" data-a="sheetClose">Done</button></div>${body}</div>`;
}
function fixValue(v, go) {
  const c = v.controls && go && go.k ? v.controls.find((x) => x.key === go.k) : null; if (!c || !mine(c.role)) return undefined;
  if (c.type === "step") return c.value < c.max ? c.value + 1 : undefined;
  if (go.o === "" || go.o == null) return undefined;
  const o = c.options.find((x) => String(x.id) === String(go.o)); if (!o || o.off) return undefined;
  return (c.type === "multi" ? c.value.includes(o.id) : c.value === o.id) ? undefined : o.id;
}
function applyHi() {
  const h = ui.hi || ui.auto; if (!h || !h.k) return;
  const sl = slotOf(h.k), sc = document.querySelector(`.slot[data-v="${sl}"]`); if (sc && !ui.sheet) sc.classList.add("pulse");
  const c = document.querySelector(`.ctl[data-ctl="${h.k}"]`); if (!c) return;
  c.classList.add("glow"); if (h.o !== "" && h.o != null) { const o = c.querySelector(`[data-v="${h.o}"]`); if (o && !o.classList.contains("sel")) o.classList.add("pulse"); }
  if (h.scroll) { h.scroll = false; c.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

/* ---------- what Orbi says: always the one next thing to do ---------- */
function orbiSay(v) {
  const ph = v.phase, host = v.host === S.you;
  if (ph === "lobby") return { t: host ? "This is your team room! Send the link to your friends, let everyone pick a job, then press START." : "Welcome aboard! Tap a free job to take it. " + nameOf(v.host) + " will start the mission." };
  if (ph === "brief") return { t: "Here is what our client needs. Everyone reads the goals, then anyone presses the big button." };
  if (ph === "design") {
    const rank = { block: 0, red: 1, amber: 2 }, IS = v.issues.filter((i) => i.sev !== "amber").sort((a, b) => mine(b.role) - mine(a.role) || rank[a.sev] - rank[b.sev]);
    if (IS.length) { const i = IS[0]; return { mood: "uh", t: (mine(i.role) ? "" : Lf("{0}, this one is yours:", nameOf(v.roles[i.role])) + " ") + L(i.msg) + (i.fix ? " " + L(i.fix) : ""), go: { r: i.role, k: i.go ? i.go.k : "", o: i.go && i.go.o != null ? i.go.o : "" }, left: IS.length }; }
    if (v.M.sciPct < 0.6 && v.diff !== "director") return { ok: true, t: "It flies! But the science meter is only " + Math.round(v.M.sciPct * 100) + "%. Want three stars? Try more tools, a wider plan or more satellites, and keep every meter green." };
    return { ok: true, t: "Every meter is green. What a beauty! Ready for the crew check?" };
  }
  if (ph === "review") { const voted = v.myRoles.every((r) => v.votes[r] !== null), all = Object.values(v.votes).every((x) => x !== null), red = v.issues.some((i) => i.sev === "red"); if (solo(v)) return { mood: red ? "uh" : "", t: red ? "Hmm. We still have red problems. We can launch anyway, but the mission will pay for each one. Your call, boss!" : "All systems look good. Say the word and we light the engines!" }; if (v.myRoles.length && !voted) return { t: "Crew check! Is your part ready? Say GO or NO-GO." }; return { t: mine("director") ? (all ? "Everyone has answered. Flight Director, the final call is yours!" : "Waiting for the rest of the crew...") : "Waiting for the Flight Director's final GO." }; }
  if (ph === "ops") { const ev = v.event; if (ev) return { mood: "uh", t: mine(ev.role) ? (ev.tip ? "Beep! My advice: " + ev.tip : "Quick, your call! The purple line tells you what our ship can take.") : "Help " + nameOf(v.roles[ev.role]) + " decide. Shout your idea!" }; return { t: v.sim.round === 0 ? "We made it to space! Press the big button to fly the first months." : "Nice flying. Press the button for the next months and keep an eye on the log." }; }
  if (ph === "report") { const r = v.report; return { mood: r.lost ? "uh" : "", t: r.lost ? "Oh no, we lost this one. It happens to every space agency! Read why, then let's try again." : r.stars === 3 ? "THREE STARS! You are a real mission designer. A new planet is waiting on the map!" : "Mission complete! Every red line below is a point you can win back next time." }; }
  return null;
}
function orbiRow(v, extra) { const o = orbiSay(v); ui.auto = o && o.go && o.go.k ? o.go : null; return o ? `<div class="orbirow">${orbi("", o.mood)}<div class="bubble"><p>${esc(o.t)}</p>${extra ? `<div class="row">${extra(o)}</div>` : ""}</div></div>` : ""; }

/* ---------- game screens ---------- */
const SCREEN = {
  lobby(v) {
    const host = v.host === S.you, link = location.origin + "/?room=" + room;
    return orbiRow(v) + `<div class="cols"><div class="white"><h2 style="margin-top:0">Team room</h2><div class="code">${esc(room)}</div><p class="small dim" style="word-break:break-all">${esc(link)}</p><p><button class="btn cyan" data-a="copy">Copy invite link</button></p><h3 style="margin-top:14px">Crew: ${v.players.length} of 4</h3><p>${v.players.map((p) => `<span class="chip"><b>${esc(p.name)}</b>${p.id === v.host ? " host" : ""}${p.id === S.you ? " (you)" : ""}</span>`).join(" ")}</p><p class="tiny">Type your name at the top of the screen.</p></div>
    <div class="white"><h2 style="margin-top:0">Mission ${host ? "" : "(the host picks)"}</h2><div class="grid g2">${v.scns.map((s) => `<button class="card ${s.id === v.scnId ? "sel" : ""}" data-a="config" data-k="scn" data-v="${s.id}" ${host ? "" : "disabled"}><div class="n">${esc(s.n)}</div><div class="s">${esc(s.tag)}, budget ${esc(s.budget)}</div></button>`).join("")}</div><h3 style="margin-top:12px">Level</h3><div class="grid g3">${v.diffs.map((d) => `<button class="card ${d.id === v.diff ? "sel" : ""}" data-a="config" data-k="diff" data-v="${d.id}" ${host ? "" : "disabled"}><div class="n">${esc(d.n)}</div><div class="d">${esc(d.d)}</div></button>`).join("")}</div></div></div>
    <h2>Pick your job</h2><div class="crew">${ROLES.map((r) => { const o = v.roles[r]; return `<button class="crewm" data-a="role" data-v="${r}" ${o && o !== S.you ? "disabled" : ""}><i>${RICON[r]}</i><b>${T.roles[r]}</b><span class="small" style="color:var(--muted)">${T.roleDesc[r]}</span><br><em class="${o ? "go" : ""}">${o ? esc(nameOf(o)) + (o === S.you ? " (you)" : "") : "free: tap to take"}</em></button>`; }).join("")}</div><p class="tiny">Jobs nobody takes are shared out at the start.</p>
    <p style="text-align:center;margin-top:16px">${host ? `<button class="btn yellow huge" data-a="start">Start</button>` : `<span class="dim">Waiting for ${esc(nameOf(v.host))} to start...</span>`}</p>`;
  },
  brief(v) {
    return orbiRow(v) + `<div class="cols"><div class="white"><div class="tiny">MISSION BRIEFING</div><h1 style="color:var(--ink)">${esc(v.scn.n)}</h1><p class="dim">For: ${esc(v.scn.client)}</p><p>${esc(v.scn.brief)}</p><p><span class="chip">Budget <b>${esc(v.scn.budget)}</b></span> <span class="chip">Mission <b>${v.scn.years} ${v.scn.years === 1 ? "year" : "years"}</b></span></p><h3>Goals</h3>${v.reqs.map((r) => `<div class="req"><i>🎯</i><div>${esc(r.t)}</div></div>`).join("")}</div>
    <div class="white"><h3>Your crew</h3>${ROLES.map((r) => `<div class="req">${roleChip(r)}<div>${esc(nameOf(v.roles[r]))}${mine(r) ? " (you)" : ""}</div></div>`).join("")}<h3 style="margin-top:12px">Your secret bonus goal</h3>${secrets(v)}<p class="tiny">Everyone has a different secret goal, so you will have to bargain!</p></div></div><p style="text-align:center;margin-top:16px"><button class="btn yellow huge" data-a="ready">To the workshop!</button></p>`;
  },
  design(v) {
    const blocks = v.issues.some((i) => i.sev === "block"), dir = mine("director");
    const row = orbiRow(v, (o) => (o.go ? `${o.go.k ? `<button class="btn cyan sm" data-a="show">Show me</button>` : ""}${fixValue(v, o.go) !== undefined ? `<button class="btn green sm" data-a="fix">Orbi fixes it (−25 points)</button>` : ""}${o.left > 1 ? `<span class="small" style="color:var(--muted)">${o.left} problems left</span>` : ""}` : dir ? `<button class="btn yellow sm" data-a="toReview">Crew check</button>` : ""));
    return `<div class="build"><aside class="meters"><h3>Spaceship meters</h3><div style="height:8px"></div>${meters(v)}<p class="tiny">Tap a meter and Orbi explains it. ★ means extra important for this mission.</p></aside>
    <section><p style="margin:0 0 8px;font-weight:900">Tap a part to change it. Pick a card and it snaps onto your ship!</p><div class="shipbox"><div class="shipname"><b>${shipName(v)}</b><span>${v.design.sats > 1 ? v.design.sats + " x " : ""}${n1(v.M.wet)} kg, ${Math.round(v.M.gen)} W</span></div>${stage(v)}</div>${row}
    <div class="launchbar"><span class="timer" data-timer="${v.t0}" data-limit="${v.timeLimit}"></span><span class="sp"></span>${dir ? `<button class="btn yellow big" data-a="toReview" ${blocks ? "disabled" : ""}>Crew check and launch</button>` : `<span class="dim small">${esc(nameOf(v.roles.director))} calls the crew check.</span>`}</div></section>
    <aside class="slots">${SLOTS.map((sl) => { const i = slotInfo(v, sl); if (sl[0] !== "goals" && !v.controls.some((c) => sl[3].includes(c.key))) return ""; return `<button class="slot ${i.st}" data-a="sheet" data-v="${sl[0]}"><i>${sl[2]}</i><div><b>${sl[1]}</b><span>${esc(i.text)}</span>${!solo(v) && i.role ? roleChip(i.role) : ""}</div></button>`; }).join("")}</aside></div>` + sheet(v);
  },
  review(v) {
    const all = ROLES.every((r) => v.votes[r] !== null), blocks = v.issues.filter((i) => i.sev === "block").length, one = solo(v);
    return orbiRow(v) + `<div class="crew">${ROLES.map((r) => `<div class="crewm"><i>${RICON[r]}</i><b>${T.roles[r]}</b><span class="small" style="color:var(--muted)">${one ? "" : esc(nameOf(v.roles[r]))}</span><br><em class="${v.votes[r] === null ? "" : v.votes[r] ? "go" : "nogo"}">${v.votes[r] === null ? (one ? "ready when you are" : "thinking...") : v.votes[r] ? "GO!" : "NO-GO"}</em></div>`).join("")}</div>
    <div class="cols"><div class="glass"><h3>Problems</h3><div style="height:8px"></div>${issueList(v)}</div><div><div class="shipbox">${stage(v)}</div><div class="glass" style="margin-top:12px"><h3>Goals</h3>${reqList(v.reqs)}</div></div></div>
    <p class="row" style="justify-content:center;margin-top:18px">${one ? `<button class="btn yellow huge" data-a="goall" ${blocks ? "disabled" : ""}>Launch!</button>` : `${v.myRoles.length ? `<button class="btn green big" data-a="vote" data-v="1">My part is GO</button><button class="btn pink big" data-a="vote" data-v="0">NO-GO</button>` : ""}${mine("director") ? `<button class="btn yellow huge" data-a="go" ${blocks || !all ? "disabled" : ""}>Launch!</button>` : ""}`} ${mine("director") ? `<button class="btn ghost" data-a="back">Back to the workshop</button>` : ""}</p>`;
  },
  ops(v) {
    const s = v.sim, ev = v.event, mars = v.scn.body !== "earth";
    let mid;
    if (ev) { const own = mine(ev.role); mid = `<div class="event"><div class="row">${solo(v) ? "" : roleChip(ev.role)}<span class="timer" data-ev="1"></span></div><h1>⚠️ ${esc(ev.title)}</h1><p>${esc(ev.text)}</p><p class="info">${esc(ev.info)}</p><div class="grid g3">${ev.opts.map((o) => `<button class="card ${own ? "" : "ro"}" data-a="respond" data-v="${o.id}" ${o.off || !own ? "disabled" : ""}><div class="n">${esc(o.l)}</div><div class="d">${esc(o.off || o.h)}</div></button>`).join("")}</div>${own && ev.id === "tumble" && ev.opts.some((o) => o.id === "thr" && !o.off) ? `<p style="text-align:center"><button class="btn yellow big" data-a="handSpin">🕹️ Stop the spin by hand</button></p>` : ""}${own ? "" : `<p><button class="btn sm" data-a="timeout" data-ev-late="1" disabled>Take over (after 45 s)</button></p>`}</div>`; }
    else mid = `<p style="text-align:center"><button class="btn yellow huge" data-a="next">${s.round === 0 ? "Start the mission" : "Fly on: period " + (s.round + 1)}</button> <button class="btn cyan big" data-a="cabin">📷 Cabin window</button></p>`;
    const log = s.log.slice().reverse().map((l) => `<div class="log ${l.ok ? "" : "no"}">${esc(l.t)}${l.fix ? `<div class="fix">${esc(l.fix)}</div>` : ""}</div>`).join("");
    return `<div class="row" style="margin-bottom:10px"><span class="chip">Period <b>${Math.max(1, s.round)} of ${s.total}</b></span><span class="chip">Spacecraft alive <b>${s.alive}</b></span><span class="chip">Fuel <b>${mars ? s.dv.toFixed(2) + " km/s" : Math.round(s.dv * 1000) + " m/s"}</b></span><span class="chip">Science so far <b>${Math.round(s.sciPct * 100)}%</b></span></div>` + orbiRow(v) + mid +
      `<div class="cols" style="margin-top:14px"><div>${v.fires ? `<div class="glass"><h3>Real fires, 7 to 14 Nov 2026 (NASA FIRMS)</h3><div style="height:8px"></div><canvas id="fires" width="900" height="420"></canvas><p class="tiny">Green: found by your satellites. Red: missed. Grey: not reached yet. Bigger dot = stronger fire.</p></div>` : `<div class="shipbox">${stage(v, "tall")}</div>`}</div><div class="glass"><h3>Mission log</h3><div style="height:8px"></div>${log || `<p class="dim small">Nothing yet.</p>`}${v.fires ? `<div class="shipbox" style="margin-top:10px">${stage(v)}</div>` : ""}</div></div>`;
  },
  report(v) {
    const r = v.report, host = v.host === S.you, g = ui.gain;
    return `<div style="text-align:center"><div class="stars">${[1, 2, 3].map((i) => (i <= r.stars ? "<b>★</b>" : "<s>★</s>")).join("")}</div><div class="score">${r.total} <span style="font-size:20px" class="dim">of 1000 points</span></div><p>${g ? `<span class="gain">✨ +${g.dust} Stardust</span><span class="gain">⬆️ +${g.xp} XP</span>` : ""}</p></div>` + orbiRow(v) +
      `<p class="row" style="justify-content:center;margin:14px 0">${host ? `<button class="btn yellow big" data-a="again" data-v="fly">Fly again</button><button class="btn cyan big" data-a="again" data-v="design">Improve my ship</button>` : ""}<button class="btn pink big" data-a="exit">${mode === "solo" ? "Back to the map" : "Leave the room"}</button></p>
      <div class="cols"><div><div class="white"><h2 style="margin-top:0">Why this result?</h2>${r.lost ? `<div class="log no"><b>Mission lost.</b> ${esc(r.lost)}</div>` : ""}${r.why.map((w) => `<div class="log ${w.ok ? "" : "no"}">${esc(w.t)}${w.fix ? `<div class="fix">${esc(L("Next time:"))} ${esc(L(w.fix))}</div>` : ""}</div>`).join("")}</div>${v.fires ? `<div class="glass" style="margin-top:14px"><h3>Fires found: ${r.det[0]} of ${r.det[1]}</h3><div style="height:8px"></div><canvas id="fires" width="900" height="420"></canvas></div>` : ""}</div>
      <div><div class="white"><h2 style="margin-top:0">Points</h2>${r.parts.map((p) => `<div style="margin:8px 0"><div class="row" style="justify-content:space-between"><span>${esc(p[0])}</span><b>${p[1]} / ${p[2]}</b></div><div class="bar" style="background:#e4e1fa"><i style="width:${Math.round((p[1] / p[2]) * 100)}%;background:var(--purple)"></i></div></div>`).join("")}<h3 style="margin-top:14px">Goals</h3>${reqList(r.reqs)}<h3 style="margin-top:14px">Bonus goals</h3>${r.cards.map((c) => `<div class="req ${c.ok ? "ok" : "no"}"><i>${c.ok ? "✔" : "✘"}</i><div>${esc(c.text)}</div></div>`).join("")}</div>
      <div class="white" style="margin-top:14px"><h2 style="margin-top:0">You and the real thing</h2><table><tr><td colspan="2"><b>Your mission</b></td></tr>${r.ours.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}<tr><td colspan="2"><b>${esc(r.cmp.n)}</b></td></tr>${r.cmp.rows.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table><p class="tiny">Source: ${esc(r.cmp.src)}</p></div><div class="shipbox" style="margin-top:14px">${stage(v)}</div></div></div>`;
  },
};

/* ---------- menu screens (no game running) ---------- */
const MISSIONS = [{ id: "first", need: 0, x: 8, y: 74, pl: "earth", ic: "🛰️" }, { id: "fire", need: 1, x: 22, y: 30, pl: "fire", ic: "🔥" }, { id: "aral", need: 2, x: 36, y: 74, pl: "aral", ic: "🌊" }, { id: "scope", need: 3, x: 50, y: 30, pl: "scope", ic: "🔭" }, { id: "moon", need: 4, x: 63, y: 74, pl: "moon", ic: "🌕" }, { id: "mars", need: 6, x: 77, y: 30, pl: "mars", ic: "🤖" }, { id: "jupiter", need: 8, x: 91, y: 72, pl: "jupiter", ic: "🪐" }];
function scnInfo(id, diff) { const st = RULES.applyAction(RULES.setup(["x"]), "x", { type: "config", diff: diff || ui.diff }); return RULES.viewFor(st, "x").scns.find((s) => s.id === id); }
const UI = {
  home() {
    const lvl = 1 + Math.floor(SAVE.xp / 100), into = SAVE.xp % 100;
    return `<div class="home"><h1 class="title" data-notr><small>Orbi's</small>Mission Lab</h1><p class="tag">Build a spacecraft, launch it on a real rocket and keep it alive in space. Real physics, real prices, real fun.</p>
    <div class="stats"><div class="stat"><div class="lvl">${lvl}</div><div><b style="color:var(--yellow)">${["Space Cadet", "Junior Engineer", "Rocket Builder", "Orbit Master", "Mission Director"][Math.min(4, lvl - 1)]}</b><div class="xp"><i style="width:${into}%"></i></div><span>${into} of 100 XP to level ${lvl + 1}</span></div></div><div class="stat"><i>✨</i><div><b>${SAVE.dust}</b><span>Stardust</span></div></div><div class="stat"><i>⭐</i><div><b>${totalStars()}</b><span>stars earned</span></div></div></div>
    <div class="orbirow">${orbi("big")}<div class="bubble"><p>${totalStars() ? "Welcome back, engineer! The next planet is waiting for us." : "Beep boop! I'm Orbi, your robot co-pilot. Shall we build a real spacecraft together?"}</p></div></div>
    <div class="cta"><button class="btn yellow huge" data-a="play">Play</button><button class="btn pink huge" data-a="friends">With friends</button></div>
    <div class="tiles"><button class="tile c1" data-a="career"><i>🏢</i><b>Career</b><span>Run your own space agency</span></button><button class="tile c4" data-a="school"><i>🧑‍🚀</i><b>Pilot School</b><span>Practise flying a rocket</span></button><button class="tile c2" data-a="howto"><i>❓</i><b>How to play</b><span>Five steps, one minute</span></button><button class="tile c3" data-a="story"><i>📖</i><b>The story</b><span>Watch it again</span></button><button class="tile c5" data-a="join"><i>🔑</i><b>Join a room</b><span>Type a friend's code</span></button><button class="tile c1" data-a="credits"><i>🛰️</i><b>Real data</b><span>NASA, CSA and credits</span></button><button class="tile c2" data-a="cabin"><i>📷</i><b>Cabin window</b><span>Photograph Earth, Moon, Mars, Jupiter</span></button><button class="tile c3" data-a="album"><i>🖼️</i><b>Photo album</b><span>${ALB.length} photos</span></button><button class="tile c4" data-a="quiz"><i>🧠</i><b>Space Quiz</b><span>Win Stardust</span></button><button class="tile c5" data-a="shop"><i>🛍️</i><b>Orbi's shop</b><span>Paint and hats</span></button><button class="tile c1" data-a="cards"><i>🃏</i><b>Space cards</b><span>${(SAVE.cards || []).length} of 7 collected</span></button></div>
    <p class="tiny" style="margin-top:18px">1 to 4 players. Made during the NASA Space Apps Challenge 2026.</p></div>`;
  },
  map() {
    const tot = totalStars(), next = MISSIONS.find((m) => (SAVE.all || tot >= m.need) && !(SAVE.stars[m.id] > 0));
    return `<div class="row"><h1>Pick your mission</h1><span class="sp"></span>${SAVE.all ? "" : `<button class="btn ghost sm" data-a="unlock">Unlock every mission (teachers and judges)</button>`}</div><p class="dim">You have ${tot} ${tot === 1 ? "star" : "stars"}. Win up to 3 on each mission to open new planets. The glowing one is a good one to try next.</p>
    <div class="map"><svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${MISSIONS.map((m) => m.x + "," + (m.y - 6)).join(" ")}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".5" stroke-dasharray=".4 1.2" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:4px;stroke-dasharray:2 12"/></svg>
    ${MISSIONS.map((m) => { const open = SAVE.all || tot >= m.need, st = SAVE.stars[m.id] || 0, s = RULES ? scnInfo(m.id) : { n: m.id }; return `<button class="node ${open ? "" : "locked"} ${next && next.id === m.id ? "next" : ""}" style="left:${m.x}%;top:${m.y}%" data-a="${open ? "brief" : "locked"}" data-v="${m.id}" data-need="${m.need - tot}"><div class="pl ${m.pl}">${open ? m.ic : "🔒"}</div><b>${esc(s.n)}</b>${open ? `<div class="st3">${[1, 2, 3].map((i) => (i <= st ? "<em>★</em>" : "★")).join("")}</div>${m.need === 0 && !st ? `<span class="tagp go">Start here</span>` : ""}` : `<span class="tagp">Need ${m.need - tot} more ${m.need - tot === 1 ? "star" : "stars"}</span>`}</button>`; }).join("")}</div>`;
  },
};
function openBrief(id) {
  const s = scnInfo(id), d = ui.diff, DN = { cadet: ["Cadet", "Orbi helps a lot. Easy flying."], engineer: ["Engineer", "Normal money. You steer the rocket."], director: ["Director", "Little money, no hints."] };
  modal(`<div class="row">${orbi()}<div style="flex:1"><div class="tiny" style="color:var(--muted)">MISSION</div><h1>${esc(s.n)}</h1></div></div><p>${esc(s.brief)}</p><p><span class="chip">Budget <b>${esc(s.budget)}</b></span> <span class="chip">Mission <b>${s.years} ${s.years === 1 ? "year" : "years"}</b></span> <span class="chip">${esc(s.tag)}</span></p>
  <h3>How hard?</h3><div class="grid g3" style="margin:8px 0 14px">${Object.keys(DN).map((k) => `<button class="card ${k === d ? "sel" : ""}" data-a="diff" data-v="${k}" data-id="${id}"><div class="n">${DN[k][0]}</div><div class="d">${DN[k][1]}</div></button>`).join("")}</div>
  <div class="row"><button class="btn yellow big" data-a="solo" data-v="${id}">Just me</button><button class="btn pink big" data-a="team" data-v="${id}">Team, 2 to 4 players</button></div>`, true);
}
function newCode() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ"; let c = ""; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }

/* ---------- the story (comic panels drawn in code) ---------- */
const SKY = `<rect width="900" height="420" fill="#0d0a3a"/>` + Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 137) % 900}" cy="${(i * 89) % 300}" r="${i % 5 === 0 ? 2.2 : 1.2}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`).join("");
const EARTH = `<circle cx="450" cy="800" r="520" fill="#2a6fe0" stroke="#7fc0ff" stroke-width="8"/><path d="M200 420q60-90 170-70t150-40q90-30 170 30t60 80z" fill="#35b56a"/><path d="M620 330q50-30 110 0t60 90H640z" fill="#2e9b55"/>`;
const SAT = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s}) rotate(-12)"><rect x="-70" y="-14" width="46" height="28" rx="4" fill="#2b6cff" stroke="#9cc4ff" stroke-width="3"/><rect x="24" y="-14" width="46" height="28" rx="4" fill="#2b6cff" stroke="#9cc4ff" stroke-width="3"/><rect x="-22" y="-22" width="44" height="44" rx="8" fill="#ffc93c" stroke="#de9400" stroke-width="4"/><circle cx="0" cy="0" r="9" fill="#1a1740" stroke="#5fe3ff" stroke-width="3"/></g>`;
const Q = (x, y, e) => `<circle cx="${x}" cy="${y}" r="36" fill="#fff" stroke="#221e52" stroke-width="5"/><text x="${x}" y="${y + 14}" font-size="40" text-anchor="middle">${e}</text><text x="${x + 44}" y="${y - 26}" font-size="40" fill="#ffc93c" font-family="Lilita One, sans-serif">?</text>`;
const STORY = [
  ["Earth has questions!", "Where are the forest fires tonight? Is the Aral Sea still shrinking? What is hiding on Mars? From the ground, nobody can see it all.", SKY + EARTH + Q(300, 210, "🔥") + Q(450, 150, "🌊") + Q(610, 215, "🔴")],
  ["Spacecraft can find out.", "From space you can watch a whole country in one look. But somebody has to design the spacecraft, pay for it and launch it.", SKY + EARTH + `<path d="M470 150L330 400h280z" fill="#ffe27a" opacity=".28"/>` + SAT(470, 140, 1.3)],
  ["That somebody is you.", "And me! I'm Orbi, your robot co-pilot. I know rockets, radios and the price of everything.", SKY + `<circle cx="450" cy="230" r="150" fill="#3a2aa0"/><g transform="translate(300 60) scale(2.5)">${orbiG()}</g>`],
  ["Build it. Keep the meters green.", "Pick a body, power, tools and a radio. Every part costs weight, electricity and money. Red meter? Something has to change.", SKY + SAT(250, 210, 1.7) + [["#3ed07e", 0.8], ["#3ed07e", 0.55], ["#ff4f5e", 0.95], ["#ffc93c", 0.7]].map((m, i) => `<rect x="520" y="${110 + i * 62}" width="300" height="34" rx="17" fill="#2a2470"/><rect x="520" y="${110 + i * 62}" width="${300 * m[1]}" height="34" rx="17" fill="${m[0]}"/>`).join("")],
  ["Then fly it yourself!", "Steer the rocket into orbit with real physics, brake at Mars, and save your ship from solar storms and space junk.", SKY + `<circle cx="450" cy="900" r="560" fill="#2a6fe0" stroke="#7fc0ff" stroke-width="8"/><path d="M200 420q260-60 360-250" stroke="#fff" stroke-width="6" stroke-dasharray="4 16" fill="none" stroke-linecap="round" opacity=".7"/><g transform="translate(590 140) rotate(40)"><path d="M-16 40q16 70 32 0z" fill="#ff8a3d"/><path d="M0-60q34 40 22 100h-44q-12-60 22-100z" fill="#fff" stroke="#d6daf7" stroke-width="4"/><circle cx="0" cy="-8" r="11" fill="#2ec5ff" stroke="#0a8fce" stroke-width="4"/><path d="M-22 20l-20 26 20-6zM22 20l20 26-20-6z" fill="#ff5c8a"/></g>`],
  ["Win three stars.", "Meet every goal, spend wisely and fly well. Stars open new planets. Play alone, or with up to three friends: each one takes a job.", SKY + [0, 1, 2].map((i) => `<text x="${290 + i * 160}" y="${250 - (i === 1 ? 30 : 0)}" font-size="150" text-anchor="middle" fill="#ffc93c" stroke="#de9400" stroke-width="5">★</text>`).join("")],
];
function showStory(then) {
  const el = $("#story"); let i = 0, typed = 0, timer = 0, tx = ""; el.hidden = false;
  function slide() { const s = STORY[i]; tx = L(s[1]); el.innerHTML = `<div><div class="comic"><svg viewBox="0 0 900 420">${s[2]}</svg><div class="cap"><h2>${s[0]}</h2><p id="storyT" data-notr></p></div></div><div class="storybar"><div class="dots">${STORY.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div><span class="sp"></span><button class="btn ghost sm" data-s="skip">Skip story</button><button class="btn yellow big" data-s="next">${i === STORY.length - 1 ? "Let's go!" : "Next"}</button></div></div>`; typed = 0; clearInterval(timer); timer = setInterval(() => { const t = $("#storyT"); if (!t) return clearInterval(timer); typed += 2; t.textContent = tx.slice(0, typed); if (typed >= tx.length) clearInterval(timer); else if (typed % 6 === 0) beep(520 + (typed % 5) * 40, 0.03, "triangle", 0.02); }, 26); }
  function done() { clearInterval(timer); el.hidden = true; el.innerHTML = ""; el.onclick = null; SAVE.story = true; save(); if (then) then(); }
  el.onclick = (e) => { Music.kick(); const b = e.target.closest("[data-s]"); if (b && b.dataset.s === "skip") return done(); if (typed < tx.length && !b) { typed = tx.length; clearInterval(timer); $("#storyT").textContent = tx; return; } i++; if (i >= STORY.length) done(); else slide(); };
  slide();
}

/* ---------- pilot school: practise the flying games ---------- */
function school(kind) {
  ui.school = kind; mode = null; $("#hBack").hidden = false;
  if (kind === "land") return landGame();
  if (kind === "spin") return spinGame(null);
  S = { you: myId, view: { phase: kind, known: true, attempt: 0, t0: Date.now(), roles: { director: myId, engineer: myId }, myRoles: ["director", "engineer"], players: [{ id: myId, name: "You" }], game: kind === "launch" ? { alt: 400, rocket: "training rocket", guide: true, assist: false } : { orbit: "mell", target: 33000, fuel: 1.3, guide: true } } };
  $("#hBack").hidden = false; mountGame(S.view);
}
function endSchool() { ui.school = null; S = null; stopGame(); ui.screen = "home"; SAVE.xp += 5; save(); render(); }

/* ---------- input ---------- */
function modal(html, noClose) { $("#modalBox").innerHTML = html + (noClose ? `<p style="margin-top:14px"><button class="btn sm" data-a="close">Close</button></p>` : `<p style="margin-top:14px"><button class="btn yellow" data-a="close">OK</button></p>`); $("#modal").hidden = false; }
function goBack() { if (ui.school) return endSchool(); if (mode) { if (S && S.view && S.view.phase !== "report" && S.view.phase !== "lobby" && !confirmLeave()) return; return leave(mode === "solo" ? "map" : "home"); } ui.screen = "home"; render(); }
function confirmLeave() { return window.confirm(L("Leave this mission? Your ship will not be saved.")); }
const HOWTO = `<h1>How to play</h1><ol><li><b>Pick a mission</b> on the map. Each planet is a job, like finding forest fires or helping rovers on Mars.</li><li><b>Build your spaceship.</b> Tap a part (rocket, body, power, tools, radio) and pick a card.</li><li><b>Keep the meters green.</b> Red means a problem. Orbi tells you what is wrong. If he fixes it for you, it costs 25 points.</li><li><b>Crew check, then launch.</b> You fly the rocket yourself!</li><li><b>Keep it alive.</b> Storms, space junk and bad luck will test your design. Win up to three stars.</li></ol><p>With friends: press "With friends", send them the link, and each of you takes a job: Flight Director, Engineer, Science Lead, or Comms and Budget.</p>`;
const CREDITS = `<h1>Real data and credits</h1><p>Orbi's Mission Lab was rebuilt from new code during the NASA Space Apps Challenge 2026 (14 and 15 November 2026) for the challenge "Space Mission Design Game".</p><ul><li>NASA FIRMS: MODIS active fire detections, 7 to 14 November 2026. These are the fire dots in Fire Watch.</li><li>NASA JPL Solar System Dynamics: orbit numbers for Earth and Mars, used to place the planets for each launch month.</li><li>NASA mission facts for comparison: Mars Reconnaissance Orbiter, Landsat 9, CubeSat 101.</li><li>Canadian Space Agency: WildFireSat mission goals.</li><li>Rocket prices and records are public figures from 2025 and 2026; some are estimates.</li></ul><p>Use of AI: the code and text were written with AI assistance (Claude by Anthropic) during the hackathon. The Kazakh and Russian translations were also made with AI. Orbi, the planets, the story pictures, the 3D spaceship (three.js library, MIT licence), the cabin window views of real places, the flying games and Orbi's hats are all drawn by code. The music and sounds are made by code in your browser. This version shows no AI-generated images, video or audio.</p><p>A student project. Not affiliated with or endorsed by NASA or the Canadian Space Agency.</p>`;
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  const a = b.dataset.a, val = b.dataset.v, t = Date.now(), v = S && S.view;
  sfx.click();
  if (a === "play") { const go = () => { ui.screen = "map"; render(); }; if (!SAVE.story) showStory(go); else go(); }
  else if (a === "friends") startRoom(newCode(), null);
  else if (a === "join") modal(`<h1>Join a room</h1><p>Type the 4 letters your friend sees on their screen.</p><p><input id="joinCode" maxlength="8" style="font:400 34px var(--fd);width:220px;text-transform:uppercase;border:3px solid var(--line);border-radius:14px;padding:8px 12px;color:var(--ink)" /></p><p><button class="btn yellow big" data-a="joinGo">Join</button></p>`, true);
  else if (a === "joinGo") { const c = ($("#joinCode").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length >= 3) { $("#modal").hidden = true; startRoom(c, null); } }
  else if (a === "school") modal(`<h1>Pilot School</h1><p>Practise flying. No mission, no risk. Win bronze, silver or gold medals.</p><div class="grid g2"><button class="card" data-a="schoolGo" data-v="launch"><div class="n">🚀 Launch to orbit</div><div class="d">Tilt, coast and circle the Earth at 400 km.</div>${medalTag("launch")}</button><button class="card" data-a="schoolGo" data-v="capture"><div class="n">🔴 Brake at Mars</div><div class="d">Burn at the closest point and let Mars catch you.</div>${medalTag("capture")}</button><button class="card" data-a="schoolGo" data-v="land"><div class="n">🌕 Land on the Moon</div><div class="d">Slow down, stay straight and touch the pad gently.</div>${medalTag("land")}</button><button class="card" data-a="schoolGo" data-v="spin"><div class="n">🌀 Stop the spin</div><div class="d">Emergency drill: steady a tumbling spacecraft before the battery dies.</div>${medalTag("spin")}</button></div>`);
  else if (a === "schoolGo") { $("#modal").hidden = true; school(val); }
  else if (a === "howto") modal(page("howto"));
  else if (a === "credits") modal(page("credits"));
  else if (a === "lang") setLang(LNEXT[LANG] || "en");
  else if (a === "story") showStory(null);
  else if (a === "unlock") { SAVE.all = true; save(); render(); }
  else if (a === "locked") toast("Win " + b.dataset.need + " more " + (b.dataset.need === "1" ? "star" : "stars") + " to open this planet.");
  else if (a === "brief") openBrief(val);
  else if (a === "diff") { ui.diff = val; openBrief(b.dataset.id); }
  else if (a === "solo") { $("#modal").hidden = true; startSolo(val, ui.diff); }
  else if (a === "team") { $("#modal").hidden = true; startRoom(newCode(), { scn: val, diff: ui.diff }); }
  else if (a === "exit") { if (mode === "room" && v && v.phase === "report" && v.host === S.you) act({ type: "again", mode: "lobby", t }); leave(mode === "solo" ? "map" : "home"); }
  else if (a === "copy") { const link = location.origin + "/?room=" + room; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast("Link copied!", true)).catch(() => modal(`<h1>Invite link</h1><p style="word-break:break-all">${esc(link)}</p>`)); }
  else if (a === "config") act({ type: "config", [b.dataset.k]: val });
  else if (a === "role") act({ type: "role", role: val });
  else if (a === "start") act({ type: "start", t });
  else if (a === "ready") act({ type: "ready", t });
  else if (a === "sheet") { ui.sheet = val; ui.sheetNew = true; ui.hi = null; render(); }
  else if (a === "sheetClose") { ui.sheet = null; ui.hi = null; render(); }
  else if (a === "show") { const g = ui.auto; if (g) { ui.sheet = slotOf(g.k); ui.sheetNew = true; ui.hi = { k: g.k, o: g.o, scroll: true }; render(); } }
  else if (a === "fix") { const g = ui.auto, val2 = g ? fixValue(v, g) : undefined; if (val2 !== undefined) { act({ type: "fix", key: g.k, value: val2 }); toast("Orbi fixed it. −25 points!", true); } }
  else if (a === "set") { if (ui.hi && ui.hi.k === b.dataset.k) ui.hi = null; act({ type: "set", key: b.dataset.k, value: b.dataset.n === "1" ? Number(val) : val }); }
  else if (a === "step") { if (ui.hi && ui.hi.k === b.dataset.k) ui.hi = null; act({ type: "set", key: b.dataset.k, value: Number(val) }); }
  else if (a === "toReview") { ui.sheet = null; act({ type: "toReview", t }); }
  else if (a === "vote") act({ type: "vote", go: val === "1" });
  else if (a === "goall") { act({ type: "vote", go: true }); act({ type: "go", t }); }
  else if (a === "back") act({ type: "back" });
  else if (a === "go") act({ type: "go", t });
  else if (a === "next") act({ type: "next", t });
  else if (a === "respond") act({ type: "respond", opt: val, ms: Math.round(performance.now() - ui.evAt), t });
  else if (a === "timeout") act({ type: "timeout", t });
  else if (a === "auto") { if (ui.school) endSchool(); else act({ type: "auto", t }); }
  else if (a === "again") act({ type: "again", mode: val, t });
  else if (a === "learn") { const kk = LANG !== "en" && DICT && DICT["learn:" + b.dataset.k], Lr = kk || T.learn[b.dataset.k]; modal(`<div class="row">${orbi()}<h1 style="flex:1">${Lr[0]}</h1></div><p>${Lr[1]}</p>`); }
  else if (a === "close") $("#modal").hidden = true;
});
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });
$("#hBack").addEventListener("click", goBack);
$("#hHome").addEventListener("click", () => { if (mode || ui.school) goBack(); else { ui.screen = "home"; render(); } });
function page(k) { return LANG !== "en" && DICT && DICT["page:" + k] ? DICT["page:" + k] : k === "howto" ? HOWTO : CREDITS; }
$("#help").addEventListener("click", () => modal(page("howto")));
$("#credits").addEventListener("click", () => modal(page("credits")));
$("#lang").addEventListener("click", () => { sfx.click(); setLang(LNEXT[LANG] || "en"); });
$("#snd").addEventListener("click", () => { soundOn = !soundOn; $("#snd").innerHTML = "&#127925; Music " + (soundOn ? "on" : "off"); Music.set(soundOn); });
$("#name").addEventListener("change", () => { myName = $("#name").value.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 14); ls("oml:name", myName); if (myName && mode) act({ type: "sit", name: myName }); });

/* ---------- clocks ---------- */
setInterval(() => {
  const now = Date.now();
  document.querySelectorAll("[data-timer]").forEach((e) => { const left = Number(e.dataset.limit) - (now - Number(e.dataset.timer)) / 1000, a = Math.abs(Math.round(left)); e.textContent = (left < 0 ? "⏰ over time +" : "⏰ ") + Math.floor(a / 60) + ":" + String(a % 60).padStart(2, "0"); e.classList.toggle("late", left < 0); });
  const el = (performance.now() - ui.evAt) / 1000;
  document.querySelectorAll("[data-ev]").forEach((e) => { e.textContent = el < 45 ? "⏰ decide in " + Math.ceil(45 - el) + " s" : "⏰ time is up"; e.classList.toggle("late", el >= 35); });
  document.querySelectorAll("[data-ev-late]").forEach((e) => { e.disabled = el < 47; });
  document.querySelectorAll("[data-auto]").forEach((e) => { e.disabled = !ui.school && now - Number(e.dataset.auto) < 61000; if (ui.school) e.textContent = "Leave the lesson"; });
}, 500);

/* ---------- start ---------- */
import("./logic.js").then((m) => {
  RULES = m;
  const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (code) startRoom(code, null); else render();
  if (SAVE.lang && SAVE.lang !== "en") setLang(SAVE.lang, true);
});

/* ---------- extras: medals, Moon landing, spin drill, cabin photos, quiz, shop ---------- */
SAVE.medals = SAVE.medals || {}; SAVE.own = SAVE.own || ["c0", "h0"]; if (!SAVE.own.includes("s0")) SAVE.own.push("s0"); SAVE.look = SAVE.look || { c: "c0", h: "h0" }; SAVE.look.s = SAVE.look.s || "s0"; SAVE.cards = SAVE.cards || []; SAVE.cardData = SAVE.cardData || {};
const MRANK = { bronze: 1, silver: 2, gold: 3 };
function medalOf(r) { return r >= 0.9 ? ["gold", "🥇", "Gold medal"] : r >= 0.75 ? ["silver", "🥈", "Silver medal"] : r >= 0.5 ? ["bronze", "🥉", "Bronze medal"] : null; }
function medalFor(kind, r) { const m = medalOf(r); if (!m) return null; if (!SAVE.medals[kind] || MRANK[m[0]] > MRANK[SAVE.medals[kind]]) { SAVE.medals[kind] = m[0]; save(); } return m; }
function medalTag(kind) { const m = SAVE.medals[kind]; return m ? `<span class="medal ${m}">${{ gold: "🥇", silver: "🥈", bronze: "🥉" }[m]} ${esc(L(m === "gold" ? "Gold medal" : m === "silver" ? "Silver medal" : "Bronze medal"))}</span>` : `<span class="medal none">${esc(L("No medal yet"))}</span>`; }
(function () {
  const st = document.createElement("style");
  st.textContent = `.medal{display:inline-block;padding:3px 10px;border-radius:999px;font:800 14px var(--fb,Nunito),sans-serif;margin:2px 6px 2px 0;background:#fff;color:#221e52}
.medal.gold{background:linear-gradient(#ffe27a,#ffb400)}.medal.silver{background:linear-gradient(#f4f6ff,#b9c1dd)}.medal.bronze{background:linear-gradient(#ffd2a6,#d9813a)}.medal.none{opacity:.6}
.medal.big{font-size:22px;padding:6px 16px;animation:pop .5s ease-out}@keyframes pop{0%{transform:scale(.3)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
#cabin{position:fixed;inset:0;z-index:60;background:rgba(8,6,30,.92);display:flex;align-items:center;justify-content:center;padding:12px}
#cabin .cbox{width:min(980px,100%);max-height:100%;overflow:auto;background:linear-gradient(#2a2370,#1a1548);border:4px solid #4b40b8;border-radius:26px;padding:14px;color:#fff}
#cabin canvas{width:100%;height:auto;border-radius:18px;display:block;touch-action:none}
#cabin .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.album{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.album figure{margin:0;background:#fff;color:#221e52;border-radius:12px;padding:6px;font:700 12px var(--fb,Nunito),sans-serif;text-align:center}.album img{width:100%;border-radius:8px;display:block}
.goal{display:inline-block;margin:3px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.12);font-size:14px}.goal.ok{background:#29c46a}
.shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.shop .card{text-align:center}.shop .card svg{width:70px;height:76px}.shop .card.on{outline:4px solid var(--yellow,#ffc93c)}
.quizq{font:800 22px var(--fb,Nunito),sans-serif;margin:8px 0 12px}.qopt.ok{background:#29c46a!important;color:#fff}.qopt.no{background:#ff5c7a!important;color:#fff}
@media (max-width:640px){#cabin .cbox{padding:8px;border-radius:16px}.quizq{font-size:18px}}
@media (max-width:760px){.map{height:auto!important;min-height:0!important;display:grid;grid-template-columns:1fr 1fr;gap:10px}.map svg.path{display:none}.map .node{position:static;transform:none;width:auto}}`;
  document.head.appendChild(st);
})();

/* simple keyboard + hold helpers for the extra flying games */
function keys(g, map) {
  const kd = (e) => { if (g.dead) return window.removeEventListener("keydown", kd); const f = map[e.code]; if (!f) return; e.preventDefault(); if (!e.repeat) f(true); };
  const ku = (e) => { if (g.dead) return window.removeEventListener("keyup", ku); const f = map[e.code]; if (f) f(false); };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
}
function hudBox(c, rows) {
  c.fillStyle = "rgba(15,12,50,.82)"; c.fillRect(10, 10, 250, 26 + rows.length * 21); c.font = "15px ui-monospace,monospace";
  rows.forEach((r, i) => { c.fillStyle = "#9aa6ff"; c.fillText(L(r[0]), 20, 32 + i * 21); c.fillStyle = r[2] || "#fff"; c.fillText(r[1], 140, 32 + i * 21); });
}
function gamePanel(title, help, pad) {
  stopGame();
  app.innerHTML = `<section class="panel"><div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:baseline"><h1 style="margin:0">${title}</h1><span class="dim small">${help}</span></div><canvas id="cv" width="900" height="500" style="margin-top:.5rem"></canvas><div class="pad">${pad}</div><p id="gmsg" class="mono small" style="color:var(--amber);min-height:1.4em"></p></section>`;
}

/* ---------- Moon landing (Pilot School) ---------- */
function landGame() {
  gamePanel("Land on the Moon", "Hold the ENGINE to slow down. Tilt to stop sliding sideways. Touch the green pad slower than 2 m/s, standing straight. Moon gravity is 1.62 m/s², one sixth of Earth's.", `<button class="btn" id="bL">TILT LEFT (left arrow)</button><button class="btn" id="bR">TILT RIGHT (right arrow)</button><button class="btn go wide" id="bE">HOLD ENGINE (space)</button>`);
  const g = (G = { x: -420, y: 760, vx: 16, vy: -22, a: 0, fuel: 1, on: false, l: false, r: false, over: false, dead: false, last: 0, t: 0 });
  hold($("#bE"), () => (g.on = true), () => (g.on = false)); hold($("#bL"), () => (g.l = true), () => (g.l = false)); hold($("#bR"), () => (g.r = true), () => (g.r = false));
  keys(g, { Space: (d) => (g.on = d), ArrowLeft: (d) => (g.l = d), ArrowRight: (d) => (g.r = d), ArrowUp: (d) => (g.on = d) });
  const cv = $("#cv"), c = cv.getContext("2d"), W = 900, H = 500, GY = 440, SX = 0.45, SY = 0.5, ACC = 4.1, GM = 1.62;
  let rs = 7; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  const craters = Array.from({ length: 14 }, () => [rnd() * 2200 - 1100, 10 + rnd() * 40]);
  const stars = Array.from({ length: 70 }, () => [rnd() * W, rnd() * 380, rnd() * 1.6 + 0.3]);
  function end(ok, title, line) {
    let rating = 0.15;
    if (ok) rating = Math.min(1, 0.45 + 0.3 * Math.min(1, g.fuel / 0.45) + 0.25 * Math.max(0, 1 - Math.abs(g.x) / 35) - Math.max(0, -g.vy - 1) * 0.08);
    g.over = true; const md = ok ? medalFor("land", rating) : null; sfx[ok ? "ok" : "alarm"]();
    $("#gmsg").innerHTML = `${md ? `<span class="medal big ${md[0]}">${md[1]} ${esc(L(md[2]))}</span> ` : ""}<b>${esc(L(title))}</b> ${esc(L(line))} <button class="btn go" id="gdone">Continue</button>`;
    $("#gdone").addEventListener("click", () => endSchool());
  }
  function frame(ts) {
    if (g.dead) return; const dt = Math.min(0.05, (ts - (g.last || ts)) / 1000); g.last = ts;
    if (!g.over) {
      for (let k = 0; k < 3; k++) {
        const h = dt * 0.6; g.a = Math.max(-0.9, Math.min(0.9, g.a + ((g.r ? 1 : 0) - (g.l ? 1 : 0)) * 1.4 * h));
        const thr = g.on && g.fuel > 0 ? ACC : 0; if (thr) g.fuel = Math.max(0, g.fuel - h / 40);
        g.vx += thr * Math.sin(g.a) * h; g.vy += (thr * Math.cos(g.a) - GM) * h; g.x += g.vx * h; g.y += g.vy * h; g.t += h;
      }
      if (g.y <= 0) {
        g.y = 0; const soft = g.vy > -2.2 && Math.abs(g.vx) < 1.5 && Math.abs(g.a) < 0.22, onPad = Math.abs(g.x) < 35;
        if (!soft) end(false, "Crash!", `You hit the ground at ${Math.abs(g.vy).toFixed(1)} m/s. Start braking earlier and keep the lander straight.`);
        else if (!onPad) end(true, "Safe landing, but off the pad.", `You landed ${Math.round(Math.abs(g.x))} m from the pad.`);
        else end(true, "The Eagle has landed!", `Touchdown at ${Math.abs(g.vy).toFixed(1)} m/s with ${Math.round(g.fuel * 100)}% fuel left.`);
      }
      if (Math.abs(g.x) > 1300 || g.y > 1600) end(false, "Lost in space!", "You drifted too far from the landing site.");
    }
    c.fillStyle = "#07061c"; c.fillRect(0, 0, W, H); stars.forEach((s) => { c.fillStyle = "rgba(255,255,255,.8)"; c.fillRect(s[0], s[1], s[2], s[2]); });
    c.fillStyle = "#3b6fe0"; c.beginPath(); c.arc(780, 90, 34, 0, 7); c.fill(); c.fillStyle = "#5fd47a"; c.beginPath(); c.ellipse(772, 82, 13, 9, 0.5, 0, 7); c.fill();
    const cx = W / 2 - g.x * SX * 0.35, X = (x) => cx + x * SX, Y = (y) => GY - y * SY;
    c.fillStyle = "#9c9cab"; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 20) { const wx = (x - cx) / SX; c.lineTo(x, GY + (Math.abs(wx) < 45 ? 0 : 6 * Math.sin(wx / 37) + 4 * Math.sin(wx / 13))); } c.lineTo(W, H); c.fill();
    craters.forEach((k) => { if (Math.abs(k[0]) < 70) return; c.fillStyle = "#86869a"; c.beginPath(); c.ellipse(X(k[0]), GY + 22, k[1] * SX, k[1] * SX * 0.25, 0, 0, 7); c.fill(); });
    c.fillStyle = "#3ee07a"; c.fillRect(X(-35), GY - 3, 70 * SX, 7); c.fillStyle = "#fff"; c.font = "13px ui-monospace,monospace"; c.fillText(L("LANDING PAD"), X(-35), GY + 24);
    const px = X(g.x), py = Y(g.y) - 22;
    c.save(); c.translate(px, py); c.rotate(g.a);
    if (g.on && g.fuel > 0 && !g.over) { c.fillStyle = "#ffb43d"; c.beginPath(); c.moveTo(-7, 16); c.lineTo(0, 30 + Math.random() * 14); c.lineTo(7, 16); c.fill(); }
    c.strokeStyle = "#ffe27a"; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, 8); c.lineTo(-20, 22); c.moveTo(12, 8); c.lineTo(20, 22); c.stroke();
    c.fillStyle = "#ffc93c"; c.fillRect(-14, -2, 28, 16); c.fillStyle = "#e8ecff"; c.beginPath(); c.arc(0, -10, 13, 0, 7); c.fill(); c.fillStyle = "#1a1740"; c.beginPath(); c.arc(0, -11, 7, 0, 7); c.fill(); c.fillStyle = "#5fe3ff"; c.beginPath(); c.arc(-2.5, -12, 2, 0, 7); c.arc(3, -12, 2, 0, 7); c.fill();
    c.restore();
    const need = Math.sqrt(Math.max(0, 2 * (ACC - GM) * 0.8 * g.y));
    hudBox(c, [["ALTITUDE", Math.round(g.y) + " m"], ["DOWN SPEED", (-g.vy).toFixed(1) + " m/s", -g.vy > 2.2 && g.y < 30 ? "#ff6b81" : "#fff"], ["SIDE SPEED", g.vx.toFixed(1) + " m/s", Math.abs(g.vx) > 1.5 && g.y < 30 ? "#ff6b81" : "#fff"], ["TO THE PAD", Math.round(-g.x) + " m"], ["FUEL", Math.round(g.fuel * 100) + "%", g.fuel < 0.2 ? "#ff6b81" : "#3ee07a"]]);
    if (!g.over) { const say = -g.vy > need + 2 ? "ENGINE ON NOW!" : -g.vy < 1 && g.y > 40 && g.on ? "ENGINE OFF NOW!" : Math.abs(g.vx) > 2 ? (g.vx > 0 ? "TILT LEFT!" : "TILT RIGHT!") : ""; if (say) { c.font = "34px 'Lilita One',sans-serif"; c.fillStyle = "#ffe27a"; c.textAlign = "center"; c.fillText(L(say), W / 2, 90); c.textAlign = "left"; } }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Stop the spin (emergency drill and real tumbling events) ---------- */
function spinGame(onDone) {
  gamePanel("Stop the spin!", "A reaction wheel jammed and the spacecraft is tumbling. Fire the thrusters AGAINST the spin to stop it before the battery runs flat. Too much and it spins the other way!", `<button class="btn wide" id="bL">⟲ PUSH LEFT (left arrow)</button><button class="btn wide" id="bR">PUSH RIGHT ⟳ (right arrow)</button>`);
  const g = (G = { w: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 0.8), ang: 0, batt: 1, fuel: 1, l: false, r: false, calm: 0, over: false, dead: false, last: 0 });
  hold($("#bL"), () => (g.l = true), () => (g.l = false)); hold($("#bR"), () => (g.r = true), () => (g.r = false));
  keys(g, { ArrowLeft: (d) => (g.l = d), ArrowRight: (d) => (g.r = d) });
  const cv = $("#cv"), c = cv.getContext("2d"), W = 900, H = 500;
  function end(ok) {
    g.over = true; const rating = ok ? Math.min(1, 0.5 + 0.3 * g.batt + 0.2 * g.fuel) : 0.1, md = ok ? medalFor("spin", rating) : null; sfx[ok ? "ok" : "alarm"]();
    $("#gmsg").innerHTML = `${md ? `<span class="medal big ${md[0]}">${md[1]} ${esc(L(md[2]))}</span> ` : ""}<b>${esc(L(ok ? "Spin stopped!" : "The battery ran flat."))}</b> ${esc(L(ok ? "The spacecraft is steady and pointing again." : "Without power the spacecraft cannot talk to Earth. In a real mission it could be lost."))} <button class="btn go" id="gdone">Continue</button>`;
    $("#gdone").addEventListener("click", () => (onDone ? onDone(ok) : endSchool()));
  }
  function frame(ts) {
    if (g.dead) return; const dt = Math.min(0.05, (ts - (g.last || ts)) / 1000); g.last = ts;
    if (!g.over) {
      const push = (g.r ? 1 : 0) - (g.l ? 1 : 0); if (push && g.fuel > 0) { g.w += push * 0.9 * dt; g.fuel = Math.max(0, g.fuel - dt / 9); }
      g.ang += g.w * dt; g.batt -= dt * (0.035 + Math.min(0.08, Math.abs(g.w) * 0.03));
      g.calm = Math.abs(g.w) < 0.08 ? g.calm + dt : 0;
      if (g.calm > 1.2) end(true); else if (g.batt <= 0) { g.batt = 0; end(false); }
    }
    c.fillStyle = "#0b0930"; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { c.fillStyle = "rgba(255,255,255,.7)"; c.fillRect((i * 151) % W, (i * 97) % H, 1.5, 1.5); }
    c.fillStyle = "#2a6fe0"; c.beginPath(); c.arc(W / 2, H + 380, 470, 0, 7); c.fill();
    c.save(); c.translate(W / 2, 230); c.rotate(g.ang);
    c.fillStyle = "#3d7bff"; c.fillRect(-150, -18, 100, 36); c.fillRect(50, -18, 100, 36); c.strokeStyle = "#9cc0ff"; c.lineWidth = 2; for (let x = -140; x < 150; x += 20) if (Math.abs(x) > 50) { c.beginPath(); c.moveTo(x, -18); c.lineTo(x, 18); c.stroke(); }
    c.fillStyle = "#ffc93c"; c.fillRect(-45, -45, 90, 90); c.fillStyle = "#e8ecff"; c.beginPath(); c.arc(0, -45, 16, Math.PI, 0); c.fill(); c.fillStyle = "#1a1740"; c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill();
    if (g.l && g.fuel > 0 && !g.over) { c.fillStyle = "#bfe8ff"; c.beginPath(); c.moveTo(45, -40); c.lineTo(80, -50); c.lineTo(45, -30); c.fill(); }
    if (g.r && g.fuel > 0 && !g.over) { c.fillStyle = "#bfe8ff"; c.beginPath(); c.moveTo(-45, -40); c.lineTo(-80, -50); c.lineTo(-45, -30); c.fill(); }
    c.restore();
    c.strokeStyle = "#ffe27a"; c.lineWidth = 6; c.beginPath(); const sw = Math.max(-1.4, Math.min(1.4, g.w)); c.arc(W / 2, 230, 130, -Math.PI / 2, -Math.PI / 2 + sw, sw < 0); c.stroke();
    hudBox(c, [["SPIN", g.w.toFixed(2) + " rad/s", Math.abs(g.w) < 0.08 ? "#3ee07a" : "#ffb43d"], ["BATTERY", Math.round(g.batt * 100) + "%", g.batt < 0.25 ? "#ff6b81" : "#3ee07a"], ["FUEL", Math.round(g.fuel * 100) + "%"]]);
    if (!g.over) { c.font = "32px 'Lilita One',sans-serif"; c.fillStyle = "#ffe27a"; c.textAlign = "center"; c.fillText(L(Math.abs(g.w) < 0.08 ? "HOLD STEADY..." : g.w > 0 ? "PUSH LEFT!" : "PUSH RIGHT!"), W / 2, 470); c.textAlign = "left"; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Cabin window: take real photos ---------- */
const BODIES = {
  earth: { n: "Earth", spots: [["caspian", "The Caspian Sea", 520], ["aral", "The Aral Sea", 1500], ["balkhash", "Lake Balkhash", 2500], ["tianshan", "The Tian Shan mountains", 3150]] },
  moon: { n: "The Moon", spots: [["tranq", "Sea of Tranquillity (Apollo 11)", 800], ["copernicus", "Copernicus crater", 1900], ["tycho", "Tycho crater", 2950]] },
  mars: { n: "Mars", spots: [["olympus", "Olympus Mons", 700], ["valles", "Valles Marineris", 2050], ["polar", "The north polar ice cap", 3100]] },
  jupiter: { n: "Jupiter", spots: [["grs", "The Great Red Spot", 1200], ["ovals", "The white storms", 2600]] },
};
const WW = 3600;
const ALB = (() => { try { return JSON.parse(ls("oml:album") || "[]"); } catch { return []; } })();
function saveAlbum() { while (ALB.length > 16) ALB.shift(); try { ls("oml:album", JSON.stringify(ALB)); } catch { ALB.shift(); try { ls("oml:album", JSON.stringify(ALB)); } catch { /* full */ } } }
const WORLD = {};
function blob(c, pts, sx, sy, ox, oy) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, ox + p[0] * sx, oy + p[1] * sy)); c.closePath(); }
function world(b) {
  if (WORLD[b]) return WORLD[b];
  const cv = document.createElement("canvas"); cv.width = WW; cv.height = 500; const c = cv.getContext("2d");
  let rs = 11; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  if (b === "earth") {
    const gr = c.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, "#9cc66a"); gr.addColorStop(0.45, "#c9c47a"); gr.addColorStop(1, "#e9c98c"); c.fillStyle = gr; c.fillRect(0, 0, WW, 500);
    for (let i = 0; i < 900; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(120,90,40,.10)" : "rgba(255,255,255,.10)"; c.beginPath(); c.arc(rnd() * WW, rnd() * 500, 2 + rnd() * 9, 0, 7); c.fill(); }
    c.fillStyle = "#2f7fd9"; blob(c, [[0, 0], [30, -10], [55, 5], [70, 40], [60, 80], [80, 120], [95, 170], [80, 230], [100, 300], [70, 360], [30, 380], [10, 330], [25, 270], [-5, 210], [10, 150], [-20, 90], [-10, 30]], 2.2, 1.1, 420, 40); c.fill();
    c.strokeStyle = "#7cc2ff"; c.lineWidth = 6; c.stroke();
    // Aral Sea: 1960 shoreline (dashed), dry salt bed, today's water
    blob(c, [[0, 0], [60, -20], [130, 0], [170, 60], [160, 150], [120, 230], [60, 250], [10, 200], [-10, 120], [-20, 50]], 1.6, 1.15, 1390, 110);
    c.fillStyle = "#f4efe2"; c.fill(); c.setLineDash([12, 10]); c.strokeStyle = "#5a7fb0"; c.lineWidth = 3; c.stroke(); c.setLineDash([]);
    c.fillStyle = "#2f7fd9"; blob(c, [[0, 0], [40, -12], [75, 5], [70, 40], [30, 50], [5, 35]], 1.6, 1.15, 1430, 100); c.fill();
    c.fillStyle = "#3a9be0"; blob(c, [[0, 0], [18, 10], [22, 90], [8, 150], [-6, 90]], 1.6, 1.15, 1415, 205); c.fill();
    c.strokeStyle = "#3a8ad9"; c.lineWidth = 5; c.beginPath(); c.moveTo(1560, 130); c.bezierCurveTo(1700, 150, 1800, 120, 1950, 160); c.stroke();
    c.beginPath(); c.moveTo(1560, 400); c.bezierCurveTo(1640, 470, 1700, 430, 1800, 500); c.stroke();
    c.fillStyle = "#2f7fd9"; blob(c, [[0, 0], [60, -15], [140, -10], [230, 10], [300, 40], [300, 55], [230, 30], [140, 15], [60, 18], [0, 18]], 1.5, 1.4, 2290, 230); c.fill();
    c.fillStyle = "#3cc0c0"; blob(c, [[150, -8], [230, 10], [300, 40], [300, 55], [230, 30], [150, 17]], 1.5, 1.4, 2290, 230); c.fill();
    for (let i = 0; i < 9; i++) { const x = 2950 + i * 60, y = 380 + (i % 2) * 25; c.fillStyle = "#8a7a6a"; c.beginPath(); c.moveTo(x - 50, y + 60); c.lineTo(x, y - 40); c.lineTo(x + 50, y + 60); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(x - 16, y - 8); c.lineTo(x, y - 40); c.lineTo(x + 16, y - 8); c.fill(); }
    for (let i = 0; i < 26; i++) { const x = rnd() * WW, y = rnd() * 460; if (Math.abs(x - 1500) < 260 || Math.abs(x - 520) < 140 || Math.abs(x - 2500) < 260) continue; c.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + k * 18, y + (k % 2) * 6, 14 + rnd() * 8, 0, 7); c.fill(); } }
  } else if (b === "moon") {
    c.fillStyle = "#b8b8c6"; c.fillRect(0, 0, WW, 500);
    c.fillStyle = "#7d7d92"; [[800, 230, 260, 170], [1300, 120, 200, 110], [450, 330, 160, 90], [2200, 300, 240, 120]].forEach((m) => { c.beginPath(); c.ellipse(m[0], m[1], m[2], m[3], 0.3, 0, 7); c.fill(); });
    const crater = (x, y, r) => { c.fillStyle = "#9a9aac"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = "#d8d8e4"; c.beginPath(); c.arc(x - r * 0.12, y - r * 0.12, r * 0.86, 0, 7); c.fill(); c.fillStyle = "#a6a6b8"; c.beginPath(); c.arc(x + r * 0.05, y + r * 0.05, r * 0.78, 0, 7); c.fill(); };
    for (let i = 0; i < 160; i++) { const x = rnd() * WW, y = rnd() * 500; if (Math.abs(x - 1900) < 120 || Math.abs(x - 2950) < 150) continue; crater(x, y, 4 + rnd() * rnd() * 30); }
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 7; for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; c.beginPath(); c.moveTo(2950, 250); c.lineTo(2950 + Math.cos(a) * (300 + rnd() * 250), 250 + Math.sin(a) * (200 + rnd() * 150)); c.stroke(); }
    crater(2950, 250, 60); c.fillStyle = "#c8c8d6"; c.beginPath(); c.arc(2950, 250, 10, 0, 7); c.fill();
    crater(1900, 220, 80); c.fillStyle = "#c0c0cf"; c.beginPath(); c.arc(1895, 222, 12, 0, 7); c.arc(1910, 214, 8, 0, 7); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(800, 250, 6, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.arc(800, 250, 16, 0, 7); c.stroke();
  } else if (b === "mars") {
    const gr = c.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, "#e08a55"); gr.addColorStop(1, "#c3592c"); c.fillStyle = gr; c.fillRect(0, 0, WW, 500);
    for (let i = 0; i < 60; i++) { c.fillStyle = "rgba(110,40,20,.18)"; c.beginPath(); c.ellipse(rnd() * WW, rnd() * 500, 30 + rnd() * 120, 15 + rnd() * 60, rnd() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 70; i++) { const x = rnd() * WW, y = rnd() * 500, r = 3 + rnd() * 14; c.fillStyle = "rgba(90,30,10,.35)"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    [[700, 250, 170], [1050, 180, 55], [1120, 260, 55], [1190, 340, 55]].forEach((v, k) => { for (let i = 6; i > 0; i--) { c.fillStyle = `hsl(${18 + i * 2},${55 + i * 3}%,${30 + i * 6}%)`; c.beginPath(); c.arc(v[0], v[1], (v[2] * i) / 6, 0, 7); c.fill(); } c.fillStyle = "#6e2a14"; c.beginPath(); c.arc(v[0], v[1], v[2] * (k ? 0.18 : 0.14), 0, 7); c.fill(); });
    c.fillStyle = "#5a200f"; c.beginPath(); c.moveTo(1650, 230); for (let x = 1650; x <= 2450; x += 40) c.lineTo(x, 230 + Math.sin(x / 70) * 14 - 18); for (let x = 2450; x >= 1650; x -= 40) c.lineTo(x, 252 + Math.sin(x / 55) * 16 + 18); c.fill();
    c.strokeStyle = "#7a3418"; c.lineWidth = 8; [[1800, 1760, 160], [2000, 2040, 330], [2250, 2200, 150]].forEach((s) => { c.beginPath(); c.moveTo(s[0], 240); c.lineTo(s[1], s[2]); c.stroke(); });
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(2800, 0); for (let x = 2800; x <= 3400; x += 30) c.lineTo(x, 40 + 150 * Math.sin(((x - 2800) / 600) * Math.PI) + Math.sin(x / 23) * 10); c.lineTo(3400, 0); c.fill();
  } else {
    const cols = ["#f3e2c4", "#c98d5a", "#efe0c8", "#b97a4b", "#f6ead6", "#cf9a6a", "#e8d2b0", "#a86a40", "#f1e4cc"];
    for (let i = 0; i < 9; i++) { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, i * 56); for (let x = 0; x <= WW; x += 40) c.lineTo(x, i * 56 + Math.sin(x / 90 + i) * 8); c.lineTo(WW, 500); c.lineTo(0, 500); c.fill(); }
    for (let i = 0; i < 120; i++) { c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 3; c.beginPath(); const x = rnd() * WW, y = rnd() * 500; c.arc(x, y, 6 + rnd() * 16, 0, 3 + rnd() * 2); c.stroke(); }
    for (let i = 5; i > 0; i--) { c.fillStyle = `hsl(${8 + i * 3},${60 + i * 4}%,${42 + i * 5}%)`; c.beginPath(); c.ellipse(1200, 300, 34 * i, 20 * i, 0, 0, 7); c.fill(); }
    c.strokeStyle = "rgba(255,240,220,.5)"; c.lineWidth = 3; for (let i = 1; i < 5; i++) { c.beginPath(); c.ellipse(1200, 300, 34 * i - 10, 20 * i - 6, 0.1, 0.5, 5.5); c.stroke(); }
    [[2500, 190], [2620, 210], [2740, 190]].forEach((o) => { c.fillStyle = "#fff"; c.beginPath(); c.ellipse(o[0], o[1], 44, 24, 0, 0, 7); c.fill(); c.strokeStyle = "#e6cfae"; c.beginPath(); c.ellipse(o[0], o[1], 28, 14, 0, 0, 7); c.stroke(); });
  }
  return (WORLD[b] = cv);
}
function cabin(bodies, onClose) {
  stopCabin(); let b = bodies[0];
  const el = document.createElement("div"); el.id = "cabin"; document.body.appendChild(el);
  const st = { x: 0, speed: 70, push: 0, dead: false, last: 0, flash: 0, msg: "" };
  CAB = st;
  const goals = () => BODIES[b].spots.map((s) => `<span class="goal ${ALB.some((p) => p.id === s[0]) ? "ok" : ""}">${ALB.some((p) => p.id === s[0]) ? "✔" : "📷"} ${esc(L(s[1]))}</span>`).join("");
  function draw() {
    el.innerHTML = `<div class="cbox"><div class="row"><h1 style="margin:0">📷 ${esc(L("Cabin window"))}</h1><span class="sp" style="flex:1"></span>${bodies.length > 1 ? bodies.map((x) => `<button class="btn sm ${x === b ? "yellow" : ""}" data-c="${x}">${esc(L(BODIES[x].n))}</button>`).join("") : ""}<button class="btn sm pink" data-c="close">${esc(L("Close"))}</button></div>
    <p class="small" style="margin:6px 0">${esc(L("You are looking out of the window. The ground slides by as you orbit. When a place on your list is inside the frame, press SNAP!"))}</p><div>${goals()}</div>
    <canvas id="ccv" width="900" height="520" style="margin-top:8px"></canvas><div class="row" style="margin-top:8px;justify-content:center"><button class="btn" id="cSlow">◀ ${esc(L("Slower"))}</button><button class="btn yellow big" id="cSnap">📸 ${esc(L("SNAP!"))}</button><button class="btn" id="cFast">${esc(L("Faster"))} ▶</button><button class="btn cyan" data-c="album">🖼️ ${esc(L("Photo album"))}</button></div></div>`;
    el.querySelectorAll("[data-c]").forEach((x) => x.addEventListener("click", () => { const k = x.dataset.c; sfx.click(); if (k === "close") { stopCabin(); if (onClose) onClose(); } else if (k === "album") { stopCabin(); showAlbum(); } else { b = k; st.x = 0; draw(); } }));
    hold($("#cSlow"), () => (st.push = -1), () => (st.push = 0)); hold($("#cFast"), () => (st.push = 1), () => (st.push = 0));
    $("#cSnap").addEventListener("click", snap);
  }
  const kd = (e) => { if (st.dead) return window.removeEventListener("keydown", kd); if (e.code === "Space") { e.preventDefault(); if (!e.repeat) snap(); } else if (e.code === "ArrowLeft") st.push = -1; else if (e.code === "ArrowRight") st.push = 1; };
  const ku = (e) => { if (st.dead) return window.removeEventListener("keyup", ku); if (e.code === "ArrowLeft" || e.code === "ArrowRight") st.push = 0; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  const FX = 450, FY = 230, FW = 300, FH = 200;
  function snap() {
    const wv = world(b), sx = (st.x + FX - FW / 2) % WW;
    const spot = BODIES[b].spots.find((s) => { const d = (((s[2] - (st.x + FX)) % WW) + WW * 1.5) % WW - WW / 2; return Math.abs(d) < 105; });
    st.flash = 1; beep(1200, 0.05, "square", 0.08);
    if (!spot) { st.msg = "Nothing on your list is in the frame. Wait for it!"; return; }
    st.want = spot; sfx.ok();
  }
  function keep(spot, cv) {
    const pc = document.createElement("canvas"); pc.width = 360; pc.height = 240; const c = pc.getContext("2d");
    c.drawImage(cv, FX - FW / 2, FY - FH / 2, FW, FH, 0, 0, 360, 240);
    c.fillStyle = "rgba(10,8,40,.7)"; c.fillRect(0, 212, 360, 28); c.fillStyle = "#fff"; c.font = "bold 15px Nunito,sans-serif"; c.fillText(spot[1], 10, 231);
    const fresh = !ALB.some((p) => p.id === spot[0]);
    const i = ALB.findIndex((p) => p.id === spot[0]); if (i >= 0) ALB.splice(i, 1);
    ALB.push({ id: spot[0], b, n: spot[1], img: pc.toDataURL("image/jpeg", 0.72), t: Date.now() }); saveAlbum();
    if (fresh) { SAVE.dust += 10; save(); $("#hDust").textContent = SAVE.dust; }
    st.msg = fresh ? "New photo: " + spot[1] + "! +10 Stardust" : "Photo saved: " + spot[1];
    const gl = el.querySelector(".cbox > div:nth-of-type(2)"); if (gl) gl.innerHTML = goals();
  }
  function frame(ts) {
    if (st.dead) return; const dt = Math.min(0.05, (ts - (st.last || ts)) / 1000); st.last = ts;
    st.speed = Math.max(15, Math.min(260, st.speed + st.push * 160 * dt)); st.x = (st.x + st.speed * dt) % WW;
    const cv = $("#ccv"); if (!cv) return requestAnimationFrame(frame); const c = cv.getContext("2d"), wv = world(b);
    c.fillStyle = "#151036"; c.fillRect(0, 0, 900, 520);
    c.save(); c.beginPath(); c.roundRect(40, 30, 820, 400, 120); c.clip();
    const sx = st.x % WW; c.drawImage(wv, sx, 0, Math.min(900, WW - sx), 500, 0, -20, Math.min(900, WW - sx), 500); if (WW - sx < 900) c.drawImage(wv, 0, 0, 900 - (WW - sx), 500, WW - sx, -20, 900 - (WW - sx), 500);
    if (st.want) { const sp = st.want; st.want = null; keep(sp, cv); }
    const sky = c.createLinearGradient(0, 30, 0, 110); sky.addColorStop(0, "rgba(40,90,220,.55)"); sky.addColorStop(1, "rgba(40,90,220,0)"); c.fillStyle = sky; c.fillRect(0, 30, 900, 80);
    c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 3; c.setLineDash([16, 10]); c.strokeRect(FX - FW / 2, FY - FH / 2, FW, FH); c.setLineDash([]);
    c.beginPath(); c.moveTo(FX - 14, FY); c.lineTo(FX + 14, FY); c.moveTo(FX, FY - 14); c.lineTo(FX, FY + 14); c.stroke();
    if (st.flash > 0) { c.fillStyle = `rgba(255,255,255,${st.flash})`; c.fillRect(0, 0, 900, 520); st.flash = Math.max(0, st.flash - dt * 3); }
    c.fillStyle = "rgba(255,255,255,.08)"; c.beginPath(); c.ellipse(220, 110, 160, 40, -0.4, 0, 7); c.fill();
    c.restore();
    c.strokeStyle = "#6c62e0"; c.lineWidth = 16; c.beginPath(); c.roundRect(40, 30, 820, 400, 120); c.stroke(); c.strokeStyle = "#a99fff"; c.lineWidth = 3; c.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.fillStyle = "#c9c3ff"; c.beginPath(); c.arc(450 + Math.cos(a) * 426, 230 + Math.sin(a) * 208, 5, 0, 7); c.fill(); }
    c.fillStyle = "#231c5c"; c.fillRect(0, 440, 900, 80); c.fillStyle = "#fff"; c.font = "16px ui-monospace,monospace";
    const next = BODIES[b].spots.map((s) => [s, ((s[2] - (st.x + FX)) % WW + WW) % WW]).sort((p, q) => p[1] - q[1])[0];
    c.fillText(L("SPEED") + " " + Math.round(st.speed) + "   " + Lf("Next: {0} in {1} s", L(next[0][1]), Math.round(next[1] / st.speed)), 60, 470);
    if (st.msg) { c.fillStyle = "#ffe27a"; c.font = "bold 18px Nunito,sans-serif"; c.fillText(L(st.msg), 60, 500); }
    requestAnimationFrame(frame);
  }
  draw(); requestAnimationFrame(frame);
}
let CAB = null;
function stopCabin() { if (CAB) CAB.dead = true; CAB = null; const e = $("#cabin"); if (e) e.remove(); }
function showAlbum() {
  const all = Object.keys(BODIES).reduce((n, k) => n + BODIES[k].spots.length, 0);
  modal(`<h1>🖼️ Photo album</h1><p>${Lf("{0} of {1} places photographed.", ALB.length, all)} ${esc(L("Every new place gives you 10 Stardust."))}</p>${ALB.length ? `<div class="album">${ALB.slice().reverse().map((p) => `<figure><img src="${p.img}" alt=""><figcaption>${esc(L(p.n))} · ${esc(L(BODIES[p.b].n))}</figcaption></figure>`).join("")}</div>` : `<p class="dim">No photos yet. Open the cabin window and snap your first one!</p>`}<p><button class="btn yellow" data-a="cabin">📷 Cabin window</button></p>`);
}

/* ---------- Quiz ---------- */
const QUIZ = [
  ["What keeps a satellite in orbit?", ["It falls around Earth so fast that it keeps missing the ground", "There is no gravity in space", "Its engines push it all the time", "Magnets in the sky"], 0, "A satellite is always falling, but it moves sideways so fast (about 7.7 km/s) that the ground curves away beneath it."],
  ["How fast does the International Space Station fly?", ["About 28,000 km/h", "About 1,000 km/h", "About 300 km/h", "It does not move"], 0, "The ISS goes around Earth once every 90 minutes."],
  ["What is a CubeSat?", ["A small satellite made of 10 cm cubes", "A cube-shaped planet", "A space rock", "A rocket engine"], 0, "One unit (1U) is a 10 cm cube of about 1.3 kg. Many schools build them."],
  ["Why do spacecraft need batteries if they have solar panels?", ["To keep working in the planet's shadow", "Batteries are lighter", "Solar panels only work on Earth", "To make the radio louder"], 0, "In low Earth orbit a satellite spends about 35 minutes of every orbit in darkness."],
  ["What does delta-v mean?", ["How much a spacecraft can change its speed", "The size of the rocket", "The distance to Mars", "The colour of the flame"], 0, "Delta-v is the 'money' of space flight: every manoeuvre costs some."],
  ["How strong is sunlight at Mars compared with Earth?", ["About 43%", "About the same", "Twice as strong", "About 5%"], 0, "Mars is 1.5 times farther from the Sun, so light is spread over 1.5 × 1.5 = 2.3 times more area."],
  ["How often do Earth and Mars line up for a cheap trip?", ["Every 26 months", "Every month", "Every 10 years", "Every day"], 0, "That is why Mars missions launch in short 'windows'."],
  ["What did the Aral Sea in Kazakhstan and Uzbekistan lose since 1960?", ["Most of its water", "All of its fish names", "Its salt", "Nothing"], 0, "Rivers were used to water cotton fields. The Kok-Aral dam (2005) helped the North Aral Sea come back."],
  ["Which NASA system finds active fires from space every day?", ["FIRMS", "GPS", "Hubble", "Voyager"], 0, "FIRMS uses the MODIS and VIIRS sensors. Our Fire Watch mission uses its real data."],
  ["What is the Great Red Spot on Jupiter?", ["A giant storm bigger than Earth", "A volcano", "A red moon", "A lake of lava"], 0, "It has been raging for at least 190 years."],
  ["What is Olympus Mons?", ["The tallest volcano in the Solar System, on Mars", "A mountain in Greece", "A crater on the Moon", "A star"], 0, "It is about 22 km tall, two and a half times Mount Everest."],
  ["How strong is gravity on the Moon?", ["One sixth of Earth's", "The same as Earth's", "Zero", "Twice Earth's"], 0, "That is why astronauts could hop around in heavy suits."],
  ["Where did Yuri Gagarin start the first human spaceflight in 1961?", ["Baikonur, Kazakhstan", "Cape Canaveral, USA", "Kourou, French Guiana", "Paris, France"], 0, "Baikonur Cosmodrome in Kazakhstan is the oldest and largest spaceport in the world."],
  ["Why do engineers test spacecraft on a shaking table?", ["A rocket launch shakes very hard", "To mix the fuel", "To wake up the computer", "For fun"], 0, "Parts that survive the shake test usually survive the real launch."],
  ["Why do faraway spacecraft need giant antennas on Earth?", ["The signal gets weaker with the square of the distance", "Space is noisy", "Radios do not work in space", "To see the spacecraft"], 0, "Twice as far means four times weaker. NASA's Deep Space Network uses dishes up to 70 m wide."],
  ["What makes a rocket go up?", ["Hot gas pushed down pushes the rocket up", "It floats like a balloon", "Wings lift it", "Magnets"], 0, "Newton's third law: every action has an equal and opposite reaction."],
  ["What is space junk?", ["Old satellites and broken pieces still orbiting Earth", "Rubbish thrown from the ISS", "Asteroids", "Clouds"], 0, "Radars track more than 30,000 pieces. Even a small piece hits like a bullet."],
  ["What can a solar storm do to a satellite?", ["Damage its electronics", "Make it faster", "Paint it red", "Nothing at all"], 0, "That is why spacecraft have a 'safe mode'."],
];
function quiz() {
  const pool = QUIZ.map((q, i) => i).sort(() => Math.random() - 0.5).slice(0, 6), st = { i: 0, ok: 0 };
  function show() {
    if (st.i >= pool.length) { const gain = st.ok * 3 + (st.ok === pool.length ? 10 : 0); SAVE.dust += gain; SAVE.xp += st.ok * 2; save(); $("#hDust").textContent = SAVE.dust; modal(`<h1>🧠 ${esc(L("Space Quiz"))}</h1><p class="quizq">${Lf("You got {0} of {1} right!", st.ok, pool.length)}</p><p><span class="gain">✨ +${gain} Stardust</span></p><p><button class="btn yellow" data-a="quiz">${esc(L("Play again"))}</button></p>`); if (st.ok === pool.length) sfx.ok(); return; }
    const q = QUIZ[pool[st.i]], order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    modal(`<h1>🧠 Space Quiz <span class="dim small">${st.i + 1} / ${pool.length}</span></h1><p class="quizq">${esc(L(q[0]))}</p><div class="grid g2">${order.map((k) => `<button class="card qopt" data-q="${k}"><div class="n">${esc(L(q[1][k]))}</div></button>`).join("")}</div><p id="qwhy" class="small" style="min-height:2.6em"></p>`, true);
    $("#modalBox").querySelectorAll("[data-q]").forEach((btn) => btn.addEventListener("click", () => {
      if (st.done) return; st.done = true; const good = +btn.dataset.q === q[2]; if (good) st.ok++;
      btn.classList.add(good ? "ok" : "no"); $("#modalBox").querySelector(`[data-q="${q[2]}"]`).classList.add("ok"); (good ? sfx.ok : sfx.alarm)();
      $("#qwhy").innerHTML = `<b>${esc(L(good ? "Correct!" : "Not quite."))}</b> ${esc(L(q[3]))} <button class="btn sm yellow" id="qnext">${esc(L("Next"))}</button>`;
      $("#qnext").addEventListener("click", () => { st.i++; st.done = false; show(); });
    }));
  }
  show();
}

/* ---------- Shop: paint and hats for Orbi ---------- */
const SHIPC = { s0: 0xe8ae3c, s1: 0xd6dcea, s2: 0xe0405a, s3: 0x2e8fe0, s4: 0x8a5ae0 };
const SHOP = [["s0", "Gold foil", 0], ["s1", "Silver", 15], ["s2", "Ruby red", 25], ["s3", "Ocean blue", 25], ["s4", "Royal purple", 30], ["c0", "White", 0], ["c1", "Mint", 20], ["c2", "Bubblegum", 20], ["c3", "Sunshine", 30], ["c4", "Galaxy", 40], ["h0", "No hat", 0], ["h1", "Party hat", 15], ["h2", "Astronaut helmet", 35], ["h3", "Crown", 50], ["h4", "Propeller cap", 25], ["h5", "Headphones", 30]];
function shop() {
  const svg = (look) => { const keep = SAVE.look; SAVE.look = look; const s = `<svg viewBox="0 0 120 130">${orbiG()}</svg>`; SAVE.look = keep; return s; };
  modal(`<h1>🛍️ ${esc(L("Orbi's shop"))}</h1><p>${Lf("You have {0} Stardust. Win missions, take photos and answer the quiz to earn more.", SAVE.dust)}</p><h3>${esc(L("Spaceship paint"))}</h3><div class="shop">${SHOP.filter((x) => x[0][0] === "s").map((x) => item(x, `<svg viewBox="0 0 120 130"><rect x="30" y="35" width="60" height="60" rx="8" fill="#${SHIPC[x[0]].toString(16).padStart(6, "0")}" stroke="#221e52" stroke-width="4"/><rect x="2" y="55" width="26" height="20" fill="#3d7bff" stroke="#221e52" stroke-width="3"/><rect x="92" y="55" width="26" height="20" fill="#3d7bff" stroke="#221e52" stroke-width="3"/><circle cx="60" cy="65" r="12" fill="#1a1740"/></svg>`)).join("")}</div><h3>${esc(L("Paint"))}</h3><div class="shop">${SHOP.filter((x) => x[0][0] === "c").map((x) => item(x, svg({ c: x[0], h: SAVE.look.h }))).join("")}</div><h3>${esc(L("Hats"))}</h3><div class="shop">${SHOP.filter((x) => x[0][0] === "h").map((x) => item(x, svg({ c: SAVE.look.c, h: x[0] }))).join("")}</div>`);
  function item(x, pic) { const own = SAVE.own.includes(x[0]), on = SAVE.look[x[0][0]] === x[0]; return `<button class="card ${on ? "on" : ""}" data-a="buy" data-v="${x[0]}">${pic}<div class="n">${esc(L(x[1]))}</div><div class="d">${on ? esc(L("Wearing")) : own ? esc(L("Tap to wear")) : "✨ " + x[2]}</div></button>`; }
}
function buy(id) {
  const x = SHOP.find((s) => s[0] === id); if (!x) return;
  if (!SAVE.own.includes(id)) { if (SAVE.dust < x[2]) { toast("Not enough Stardust yet."); return; } SAVE.dust -= x[2]; SAVE.own.push(id); sfx.ok(); }
  SAVE.look[id[0]] = id; save(); $("#hOrbi").innerHTML = orbi("sm"); $("#hDust").textContent = SAVE.dust; shop(); placeStage(null);
}

/* ---------- hooks ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  const a = b.dataset.a, val = b.dataset.v;
  if (a === "cabin") { $("#modal").hidden = true; const v = S && S.view; cabin(v && v.scn ? [BODIES[v.scn.body] ? v.scn.body : "earth"] : ["earth", "moon", "mars", "jupiter"]); }
  else if (a === "album") showAlbum();
  else if (a === "quiz") quiz();
  else if (a === "shop") shop();
  else if (a === "buy") buy(val);
  else if (a === "handSpin") { const v = S.view, ev = v.event; ui.hand = true; spinGame((ok) => { ui.hand = false; render(); act({ type: "respond", opt: ok ? "thr" : "wheels", ms: 9000, t: Date.now() }); }); }
});
window.__oml = { get cab() { return CAB; } };

/* ---------- Career: run your own space agency ---------- */
SAVE.car = SAVE.car || null;
const RIVAL = "Nova Orbital";
const CONTRACTS = [["first", 0, "🛰️"], ["aral", 10, "🌊"], ["fire", 20, "🔥"], ["scope", 30, "🔭"], ["moon", 40, "🌕"], ["mars", 60, "🤖"], ["jupiter", 90, "🪐"]];
const UPG = [["investor", "Investor club", 4, "Every contract comes with 20% more budget (Cadet money)."], ["control", "Mission control room", 5, "+25% profit from every contract."], ["pr", "Press team", 3, "+50% fame from every contract."]];
const RANKS = [[0, "Garage startup"], [20, "Regional agency"], [50, "National agency"], [90, "Interplanetary agency"]];
function rankOf(f) { let r = RANKS[0][1]; for (const x of RANKS) if (f >= x[0]) r = x[1]; return r; }
function carNew() { SAVE.car = { money: 10, fame: 0, flown: {}, rival: 0, up: [], log: [] }; save(); }
UI.career = function () {
  const c = SAVE.car; if (!c) carNew();
  const k = SAVE.car, avail = CONTRACTS.filter((x) => RULES && scnOk(x[0]));
  return `<div class="row"><h1>🏢 ${esc(L("Your space agency"))}</h1><span class="sp"></span><button class="btn ghost sm" data-a="carReset">${esc(L("Start a new agency"))}</button></div>
  <p class="dim">${esc(L("Win contracts, pay the real costs and keep the money that is left. Fame unlocks bigger missions. Every contract flies only once, so think before you launch!"))}</p>
  <div class="stats"><div class="stat"><i>💰</i><div><b>${fmtM(k.money)}</b><span>${esc(L("Agency money"))}</span></div></div><div class="stat"><i>🌟</i><div><b>${k.fame}</b><span>${esc(L("Fame"))}</span></div></div><div class="stat"><i>🏅</i><div><b>${esc(L(rankOf(k.fame)))}</b><span>${esc(L("Rank"))}</span></div></div></div>
  <div class="white" style="margin:14px 0"><h3 style="margin-top:0">🏁 ${esc(Lf("The race with {0}", RIVAL))}</h3><p class="small">${esc(Lf("{0} is a rival agency. Each time you fly a contract, they finish one too. Be first at a planet for double fame!", RIVAL))}</p><div class="row">${avail.map((x, i) => `<span class="chip">${x[2]} ${esc(L(scnInfo(x[0]).n))}: ${k.flown[x[0]] ? (k.flown[x[0]].first ? "🥇 " + esc(L("You were first")) : "🥈 " + esc(Lf("{0} was first", RIVAL))) : i < k.rival ? "🚩 " + esc(Lf("{0} was first", RIVAL)) : "…"}</span>`).join(" ")}</div></div>
  <h2>${esc(L("Contracts"))}</h2><div class="grid g2">${avail.map((x, i) => { const s = scnInfo(x[0], "engineer"), done = k.flown[x[0]], open = k.fame >= x[1]; return `<div class="card ${done ? "ro" : ""}" style="text-align:left"><div class="n">${x[2]} ${esc(s.n)}</div><div class="d">${esc(L(s.tag))} · ${esc(L("Budget"))} ${esc(s.budget)} · ${esc(L("Bid fee"))} $0.5M</div>${done ? `<p class="small"><b>${"★".repeat(done.stars)}${"☆".repeat(3 - done.stars)}</b> ${esc(Lf("Score {0}, profit {1}, fame +{2}", done.score, fmtM(done.profit), done.fame))}</p>` : open ? `<p><button class="btn yellow" data-a="carFly" data-v="${x[0]}">${esc(L("Take this contract"))}</button></p>` : `<p class="small">🔒 ${esc(Lf("Needs {0} fame", x[1]))}</p>`}</div>`; }).join("")}</div>
  <h2>${esc(L("Upgrades"))}</h2><div class="grid g3">${UPG.map((u) => `<button class="card" data-a="carBuy" data-v="${u[0]}" ${k.up.includes(u[0]) ? "disabled" : ""}><div class="n">${esc(L(u[1]))}</div><div class="d">${esc(L(u[3]))}</div><div class="d"><b>${k.up.includes(u[0]) ? "✔ " + esc(L("Owned")) : "$" + u[2] + "M"}</b></div></button>`).join("")}</div>
  ${k.log.length ? `<h2>${esc(L("Agency news"))}</h2>${k.log.slice(-6).reverse().map((t) => `<div class="log">${esc(L(t[0]))} ${t[1] ? esc(t[1]) : ""}</div>`).join("")}` : ""}`;
};
function scnOk(id) { try { return !!scnInfo(id); } catch { return false; } }
function carFly(id) {
  const k = SAVE.car; if (!k || k.flown[id]) return;
  k.money = Math.round((k.money - 0.5) * 100) / 100; save(); ui.career = id; ui.carGain = null; startSolo(id, k.up.includes("investor") ? "cadet" : "engineer");
}
function carDone(v) {
  const k = SAVE.car, id = ui.career; if (!k || !id || v.scnId !== id || k.flown[id]) return;
  const r = v.report, order = CONTRACTS.filter((x) => scnOk(x[0])).map((x) => x[0]), idx = order.indexOf(id), first = idx >= k.rival;
  let profit = r.lost ? -0.1 * (r.bud || 0) : Math.max(0, (r.bud || 0) - r.spent) + r.stars * 1.5;
  if (k.up.includes("control") && profit > 0) profit *= 1.25;
  let fame = r.lost ? 0 : r.stars * 5 + (first ? 10 : 0); if (first && !r.lost) fame *= 2; if (k.up.includes("pr")) fame = Math.round(fame * 1.5);
  profit = Math.round(profit * 100) / 100; k.money = Math.round((k.money + profit) * 100) / 100; k.fame += fame;
  k.flown[id] = { stars: r.stars, score: r.total, profit, fame, first };
  k.rival = Math.min(order.length, k.rival + 1);
  k.log.push([r.lost ? "Contract lost:" : first ? "First at the target! Contract done:" : "Contract done:", scnInfo(id).n + " (" + (profit >= 0 ? "+" : "") + fmtM(Math.abs(profit)) + ")"]);
  save(); ui.carGain = { profit, fame, first };
}
{ const on0 = onState; onState = function () { const v = S && S.view; if (v && v.phase === "report" && ui.career) carDone(v); return on0(); }; }
{ const lv0 = leave; leave = function (to) { if (ui.career) { ui.career = null; to = "career"; } return lv0(to); }; }
{ const rp0 = SCREEN.report; SCREEN.report = function (v) { const g = ui.career && ui.carGain; const box = g ? `<div class="white" style="text-align:center;margin:10px auto;max-width:640px"><b>🏢 ${esc(L("Your space agency"))}:</b> ${esc(Lf("profit {0}, fame +{1}", (g.profit >= 0 ? "+" : "−") + fmtM(Math.abs(g.profit)), g.fame))}${g.first ? " · 🥇 " + esc(Lf("first ahead of {0}!", RIVAL)) : ""}</div>` : ""; return box + rp0(v).replace(/<button class="btn yellow big" data-a="again" data-v="fly">[^<]*<\/button><button class="btn cyan big" data-a="again" data-v="design">[^<]*<\/button>/, ui.career ? "" : "$&"); }; }
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  const a = b.dataset.a, val = b.dataset.v;
  if (a === "career") { if (!SAVE.car) carNew(); ui.screen = "career"; render(); }
  else if (a === "carFly") carFly(val);
  else if (a === "carReset") { if (window.confirm(L("Start a new agency? Your old agency will be closed."))) { carNew(); render(); } }
  else if (a === "carBuy") { const k = SAVE.car, u = UPG.find((x) => x[0] === val); if (!u || k.up.includes(val)) return; if (k.money < u[2]) { toast("Not enough agency money."); return; } k.money -= u[2]; k.up.push(val); save(); sfx.ok(); render(); }
});

/* ---------- Space cards: collect a real spacecraft for every mission you finish ---------- */
const CARDIC = { first: "🛰️", fire: "🔥", aral: "🌊", scope: "🔭", moon: "🌕", mars: "🤖", jupiter: "🪐" };
function cardGet(v) { const r = v.report; if (!r || r.lost || r.stars < 1 || !r.cmp) return; if (!SAVE.cards.includes(v.scnId)) { SAVE.cards.push(v.scnId); SAVE.cardData[v.scnId] = r.cmp; save(); ui.newCard = v.scnId; } }
{ const on1 = onState; onState = function () { const v = S && S.view; if (v && v.phase === "report") cardGet(v); else ui.newCard = null; return on1(); }; }
{ const rp1 = SCREEN.report; SCREEN.report = function (v) { const nc = ui.newCard === v.scnId && SAVE.cardData[v.scnId]; return (nc ? `<div class="white" style="text-align:center;margin:10px auto;max-width:640px">🃏 <b>${esc(L("New space card!"))}</b> ${esc(L(nc.n))}</div>` : "") + rp1(v); }; }
function showCards() {
  const ids = Object.keys(CARDIC);
  modal(`<h1>🃏 ${esc(L("Space cards"))}</h1><p>${esc(L("Finish a mission with at least one star to win the card of the real spacecraft that inspired it."))}</p><div class="album">${ids.map((id) => { const c = SAVE.cardData[id]; return c ? `<figure style="text-align:left;padding:10px;background:linear-gradient(#fff,#efeaff)"><div style="font-size:34px;text-align:center">${CARDIC[id]}</div><b>${esc(L(c.n))}</b>${c.rows.map((r) => `<div class="tiny">${esc(L(r[0]))}: ${esc(L(r[1]))}</div>`).join("")}</figure>` : `<figure style="opacity:.5"><div style="font-size:34px">❔</div>${esc(L("Locked"))}</figure>`; }).join("")}</div>`);
}

/* ---------- First-time guide: Orbi points at every part of the workshop ---------- */
const TUT = [[".meters", "These meters show your spaceship. Green is good, red is a problem. Tap one and I explain it."], [".slots", "These are the parts of your ship. Tap one, then pick a card. It snaps onto the ship!"], [".orbirow", "I always tell you the next problem to fix. Press Show me and I light up the right card."], [".launchbar", "When every meter is green, press this button for the crew check and the launch!"]];
function tutorial(i) {
  const old = $("#tut"); if (old) old.remove(); document.querySelectorAll(".tuthi").forEach((x) => x.classList.remove("tuthi"));
  if (i >= TUT.length) { SAVE.tut = true; save(); return; }
  const el = document.querySelector(TUT[i][0]); if (!el) { SAVE.tut = true; save(); return; }
  ui.tutI = i; el.classList.add("tuthi"); el.scrollIntoView({ block: "center", behavior: "smooth" });
  const box = document.createElement("div"); box.id = "tut";
  box.innerHTML = `<div class="orbirow">${orbi("", "")}<div class="bubble"><p>${esc(L(TUT[i][1]))}</p><p style="margin-top:8px"><button class="btn yellow" id="tutNext">${esc(L(i === TUT.length - 1 ? "Got it!" : "Next"))}</button> <button class="btn ghost sm" id="tutSkip">${esc(L("Skip"))}</button> <span class="tiny">${i + 1} / ${TUT.length}</span></p></div></div>`;
  document.body.appendChild(box);
  $("#tutNext").addEventListener("click", () => { sfx.click(); tutorial(i + 1); }); $("#tutSkip").addEventListener("click", () => tutorial(TUT.length));
}
(function () { const st = document.createElement("style"); st.textContent = `#tut{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:70;width:min(620px,94vw)}#tut .orbi{width:90px}.tuthi{outline:5px solid #ffc93c!important;outline-offset:4px;border-radius:16px;box-shadow:0 0 0 9999px rgba(8,6,30,.55)!important;position:relative;z-index:65}`; document.head.appendChild(st); })();
{ const rd0 = render; render = function () { rd0(); const v = S && S.view; if ($("#tut") && ui.tutI != null && TUT[ui.tutI]) { const el = document.querySelector(TUT[ui.tutI][0]); if (el) el.classList.add("tuthi"); } if (!SAVE.tut && v && v.phase === "design" && mode === "solo" && !$("#tut")) setTimeout(() => { if (!SAVE.tut && !$("#tut") && S && S.view && S.view.phase === "design") tutorial(0); }, 700); else if (!v || v.phase !== "design") { const t = $("#tut"); if (t) t.remove(); document.querySelectorAll(".tuthi").forEach((x) => x.classList.remove("tuthi")); } }; }
document.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b && b.dataset.a === "cards") showCards(); });
