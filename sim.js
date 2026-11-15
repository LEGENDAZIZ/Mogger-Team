/*
 * Mission Control Live - flight physics for the two piloting moments.
 * Real point-mass physics (gravity, thrust, a simple air-drag law), shared by the game screen and the test bot.
 * Written during NASA Space Apps Challenge 2026 with AI assistance (Claude).
 */
export const RE = 6378.137, MU = 398600.4418, RM = 3389.5, MUM = 42828.37;

export function orbitOf(x, y, vx, vy, mu, R) {
  const r = Math.hypot(x, y), eps = (vx * vx + vy * vy) / 2 - mu / r, h = x * vy - y * vx;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (mu * mu))), peri = (h * h) / mu / (1 + e) - R;
  if (eps >= 0) return { bound: false, e, apo: Infinity, peri };
  const a = -mu / (2 * eps);
  return { bound: true, a, e, apo: a * (1 + e) - R, peri };
}

/* ---- launch: a two-stage rocket, about 9.6 km/s of push in total ---- */
export const LV = { T1: 175, T2: 295, VE1: 3.2, TAU1: 235, VE2: 4.4, TAU2: 367, DRAG: 0.04, GK: 60 };
export function launchInit() { return { t: 0, x: 0, y: RE, vx: 0, vy: 0, b1: 0, b2: 0, thr: 0, crashed: false }; }
export function launchStep(s, dt, pitchDeg, on) {
  const r = Math.hypot(s.x, s.y), ux = s.x / r, uy = s.y / r, hx = uy, hy = -ux, h = r - RE;
  let ax = (-MU * s.x) / (r * r * r), ay = (-MU * s.y) / (r * r * r), thr = 0;
  if (on) {
    if (s.b1 < LV.T1) { thr = LV.VE1 / (LV.TAU1 - s.b1); s.b1 += dt; }
    else if (s.b2 < LV.T2) { thr = LV.VE2 / (LV.TAU2 - s.b2); s.b2 += dt; }
  }
  const p = (pitchDeg * Math.PI) / 180;
  ax += thr * (Math.cos(p) * ux + Math.sin(p) * hx);
  ay += thr * (Math.cos(p) * uy + Math.sin(p) * hy);
  if (h < 90) { const k = LV.DRAG * Math.exp(-h / 7.5) * Math.hypot(s.vx, s.vy); ax -= k * s.vx; ay -= k * s.vy; }
  s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt; s.thr = thr;
  if (Math.hypot(s.x, s.y) < RE) {
    if (s.b1 < 3 || s.t < 3) { s.x = 0; s.y = RE; s.vx = 0; s.vy = 0; } else s.crashed = true;
  }
  return s;
}
export function launchInfo(s) {
  const r = Math.hypot(s.x, s.y), o = orbitOf(s.x, s.y, s.vx, s.vy, MU, RE);
  return { h: r - RE, v: Math.hypot(s.vx, s.vy), vr: (s.x * s.vx + s.y * s.vy) / r, apo: o.bound ? o.apo : 99999, peri: o.peri, fuel1: 1 - s.b1 / LV.T1, fuel2: 1 - s.b2 / LV.T2 };
}
/* The flight computer's suggestion, also used by the test bot: climb, coast to the high point, then finish the circle. */
export function launchGuide(s, target) {
  const i = launchInfo(s), r = RE + i.h;
  if (i.peri > 120 && i.apo + i.peri >= 2 * target - 4) return { pitch: 90, on: false, done: true, say: "Orbit reached: engine off" };
  if (s.b1 < LV.T1) return { pitch: i.h < 1.2 ? 0 : Math.min(72, 90 * (1 - Math.exp(-(i.h - 1.2) / LV.GK))), on: true, say: i.h < 1.2 ? "Straight up" : "Tilt over slowly" };
  if (i.apo < target - 5 && i.h < target - 40) return { pitch: 82, on: true, say: "Burn until the high point reaches the target" };
  if (i.vr > 0.06 && i.h < target - 8) return { pitch: 90, on: false, say: "Engine off: coast up to the high point" };
  const vh = Math.sqrt(Math.max(0, i.v * i.v - i.vr * i.vr)), geff = MU / (r * r) - (vh * vh) / r;
  const acc = LV.VE2 / (LV.TAU2 - Math.min(s.b2, LV.T2 - 1));
  const c = Math.max(-0.3, Math.min(1, (geff - i.vr / 8 + (target - i.h) / 2500) / acc));
  return { pitch: (Math.acos(c) * 180) / Math.PI, on: true, say: "Burn sideways until the low point reaches the target" };
}
export function launchRating(s, target) {
  const i = launchInfo(s);
  if (s.crashed || i.peri < 100) return Math.max(0, Math.min(0.3, 0.3 * (1 + i.peri / 3000)));
  const err = (Math.abs(i.apo - target) + Math.abs(i.peri - target)) / 2;
  return Math.max(0.3, Math.min(1, 1.06 - err / 350));
}

/* ---- arrival at Mars: a hyperbolic fly-by that the engine must turn into an orbit ---- */
export const CAP = { ACC: 0.0025, VINF: 2.65, RP: RM + 300, R0: 30000 };
export function capInit(dvAvail) {
  const a = -MUM / (CAP.VINF * CAP.VINF), e = 1 - CAP.RP / a, p = a * (1 - e * e), nu = -Math.acos((p / CAP.R0 - 1) / e), k = Math.sqrt(MUM / p);
  return { t: 0, x: CAP.R0 * Math.cos(nu), y: CAP.R0 * Math.sin(nu), vx: -k * Math.sin(nu), vy: k * (e + Math.cos(nu)), used: 0, left: dvAvail, crashed: false, passed: false };
}
export function capStep(s, dt, burn) {
  const r = Math.hypot(s.x, s.y);
  let ax = (-MUM * s.x) / (r * r * r), ay = (-MUM * s.y) / (r * r * r);
  s.burning = false;
  if (burn && s.left > 0) { const v = Math.hypot(s.vx, s.vy), d = Math.min(CAP.ACC * dt, s.left); ax -= ((d / dt) * s.vx) / v; ay -= ((d / dt) * s.vy) / v; s.used += d; s.left -= d; s.burning = true; }
  s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
  if (s.y > 0) s.passed = true;
  if (Math.hypot(s.x, s.y) < RM + 80) s.crashed = true;
  return s;
}
export function capInfo(s) { const o = orbitOf(s.x, s.y, s.vx, s.vy, MUM, RM), r = Math.hypot(s.x, s.y); return { r, h: r - RM, v: Math.hypot(s.vx, s.vy), bound: o.bound, apo: o.apo, peri: o.peri, vr: (s.x * s.vx + s.y * s.vy) / r }; }
/* Fly the arrival with a simple rule: start the burn at distance rStart, stop when the high point is low enough. */
export function capBot(rStart, targetApo, dvAvail) {
  const s = capInit(dvAvail);
  for (let n = 0; n < 40000; n++) {
    const i = capInfo(s), burn = i.r <= rStart && (!i.bound || i.apo > targetApo);
    capStep(s, 2, burn);
    if (s.crashed) return { ok: false, used: s.used };
    if (i.bound && i.apo <= targetApo && !burn) return { ok: true, used: s.used, apo: i.apo, peri: i.peri };
    if (s.passed && i.r > 40000 && !i.bound) return { ok: false, used: s.used };
  }
  return { ok: false, used: s.used };
}
export function capBest(targetApo) {
  let best = null;
  for (let r = 3800; r <= 14000; r += 300) { const b = capBot(r, targetApo, 99); if (b.ok && b.peri > 120 && (!best || b.used < best.used)) best = { r, used: b.used, apo: b.apo, peri: b.peri }; }
  return best;
}
export function capRating(s, targetApo, best) {
  const i = capInfo(s);
  if (s.crashed || !i.bound || i.peri < 80) return { captured: false, rating: 0 };
  const off = targetApo < 20000 ? Math.max(0, i.apo / targetApo - 1.1) : Math.abs(i.apo - targetApo) / targetApo - 0.15;
  const close = Math.max(0.4, 1 - Math.max(0, off));
  return { captured: true, rating: Math.max(0.05, Math.min(1, (best / Math.max(s.used, 0.01)) * close)) };
}
