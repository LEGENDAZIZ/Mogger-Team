/*
 * Mission Control Live - the live 3D stage: a planet, stars and YOUR spacecraft, rebuilt from the design.
 * Everything here is drawn by code (three.js, MIT licence). No AI-generated images.
 * Written during NASA Space Apps Challenge 2026 with AI assistance (Claude).
 */
import * as THREE from "./three.min.js";

const NOISE = `
float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }`;
const VERT = `varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const PLANET = `precision highp float; uniform float uT; uniform float uMars; uniform vec3 uSun; varying vec3 vP; varying vec3 vN; varying vec3 vW; ${NOISE}
void main(){
  float e = fbm(vP*2.2+3.1); vec3 col;
  if (uMars > 2.5) { float b = vP.y*7. + fbm(vP*3.+vec3(uT*.01,0.,0.))*1.6; col = mix(vec3(.95,.86,.70), vec3(.72,.45,.27), .5+.5*sin(b*3.1)); float sp = length((vP.xy-vec2(.55,-.32))*vec2(1.,1.7)); col = mix(vec3(.80,.30,.18), col, smoothstep(.10,.16,sp)); }
  else if (uMars > 1.5) { col = mix(vec3(.42,.42,.47), vec3(.82,.82,.86), smoothstep(.3,.7,e)); col = mix(col, vec3(.30,.30,.36), smoothstep(.55,.75,fbm(vP*4.+5.))*.7); }
  else if (uMars > .5) { col = mix(vec3(.52,.22,.11), vec3(.90,.55,.30), smoothstep(.3,.7,e)); col = mix(col, vec3(.33,.14,.09), smoothstep(.5,.72,fbm(vP*5.+9.))*.65); col = mix(col, vec3(.96,.93,.9), smoothstep(.9,.97,abs(vP.y)+e*.08)); }
  else { float land = smoothstep(.5,.54,e); vec3 sea = mix(vec3(.01,.10,.36), vec3(.04,.34,.62), smoothstep(.28,.5,e));
    vec3 ground = mix(vec3(.10,.44,.17), vec3(.62,.50,.27), smoothstep(.56,.72,e+(1.-abs(vP.y))*.07-.03)); col = mix(sea, ground, land);
    col = mix(col, vec3(.96), smoothstep(.82,.92,abs(vP.y)+e*.12));
    float c = smoothstep(.48,.74,fbm(vP*3.5+vec3(uT*.012,0.,uT*.007)+20.)); col = mix(col, vec3(1.), c*.8); }
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW); float d = max(dot(N, normalize(uSun)), 0.);
  float rim = pow(1.-max(dot(N,V),0.), 2.6); vec3 atm = uMars>2.5 ? vec3(1.,.85,.6) : uMars>1.5 ? vec3(.0) : uMars>.5 ? vec3(1.,.55,.32) : vec3(.35,.65,1.);
  gl_FragColor = vec4(col*(.05+.95*pow(d,.75)) + atm*rim*(.25+.9*d), 1.);
}`;
const GLOW = `precision highp float; uniform vec3 uC; varying vec3 vN; varying vec3 vW;
void main(){ float k = abs(dot(normalize(vN), normalize(cameraPosition - vW))); gl_FragColor = vec4(uC, smoothstep(0.,.5,k)*.55); }`;

function panelTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, "#1a3fb0"); g.addColorStop(0.5, "#2b6cff"); g.addColorStop(1, "#16308a"); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = "rgba(190,220,255,.55)"; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.stroke(); } for (let j = 0; j <= 4; j++) { x.beginPath(); x.moveTo(0, j * 32); x.lineTo(256, j * 32); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const BUS = { cube3: [0.36, 1.0, 0.36], cube6: [0.72, 1.0, 0.36], cube12: [0.72, 1.0, 0.72], small: [0.95, 1.1, 0.95], medium: [1.15, 1.4, 1.15], large: [1.35, 1.7, 1.35] };
const DEMO = { bus: "cube6", array: "track", prop: "green", adcs: "rw", inst: ["a", "b"], sats: 1, dish: 0 };

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 2, 0.1, 400); cam.position.set(0, 0.5, 7.2); cam.lookAt(0, 0, 0);
  const sunDir = new THREE.Vector3(-0.6, 0.55, 0.6).normalize();
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.2); sun.position.copy(sunDir).multiplyScalar(10); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9cc4ff, 0x20304a, 1.1)); const fill = new THREE.PointLight(0x3ed6c5, 14, 30); fill.position.set(4, -2, 5); scene.add(fill);

  // stars
  { const N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 60); pos.set([v.x, v.y, v.z], i * 3); const k = Math.random(), c = k < 0.15 ? [1, 0.75, 0.55] : k < 0.3 ? [0.6, 0.8, 1] : [1, 1, 1]; col.set(c, i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 }))); }

  // planet + air glow
  const uni = { uT: { value: 0 }, uMars: { value: 0 }, uSun: { value: sunDir } }, glowC = { value: new THREE.Color(0x4f9dff) };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(9, 96, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: PLANET }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(9.9, 64, 48), new THREE.ShaderMaterial({ uniforms: { uC: glowC }, vertexShader: VERT, fragmentShader: GLOW, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const world = new THREE.Group(); world.add(planet, glow); world.position.set(5.2, -10.6, -9); scene.add(world);

  // spacecraft
  const tex = panelTexture(), pivot = new THREE.Group(), fleet = new THREE.Group(); scene.add(pivot, fleet);
  const M = {
    foil: new THREE.MeshStandardMaterial({ color: 0xe8ae3c, metalness: 0.55, roughness: 0.36, emissive: 0x4a2a00, emissiveIntensity: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x39425a, metalness: 0.5, roughness: 0.45 }),
    panel: new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.3, emissive: 0x0b2a88, emissiveIntensity: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f5ff, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0a1a2a, metalness: 0.2, roughness: 0.1, emissive: 0x3ed6c5, emissiveIntensity: 0.9 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0xff8a00, emissiveIntensity: 0.6, roughness: 0.4 }),
    violet: new THREE.MeshStandardMaterial({ color: 0xb39dff, emissive: 0x6a4dff, emissiveIntensity: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa6c0, metalness: 0.7, roughness: 0.35 }),
  };
  function build(d, area, mars) {
    const g = new THREE.Group(), b = BUS[d.bus] || BUS.cube6, cube = d.bus.indexOf("cube") === 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(b[0], b[1], b[2]), d.array === "body" ? M.panel : cube ? M.dark : M.foil); g.add(body);
    if (cube) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0xcfd8ff })); g.add(e); }
    if (d.array !== "body") { const L = Math.min(3.4, 0.9 + Math.sqrt(area || 0.1) * 0.5), w = b[1] * 0.82;
      for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(L, w, 0.03), M.panel); wing.position.set(s * (b[0] / 2 + 0.18 + L / 2), 0, 0); g.add(wing);
        const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2), M.steel); yoke.rotation.z = Math.PI / 2; yoke.position.set(s * (b[0] / 2 + 0.09), 0, 0); g.add(yoke);
        if (d.array === "track") { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), M.amber); m.position.set(s * (b[0] / 2 + 0.17), 0, 0); g.add(m); wing.rotation.x = -0.35; } } }
    if (mars) { const r = 0.5 + (d.dish || 0) * 0.24, dish = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, 1.0), M.white); dish.scale.set(1, 0.42, 1); dish.rotation.x = Math.PI; dish.position.y = b[1] / 2 + r * 0.42 + 0.12; g.add(dish);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, r * 0.7), M.steel); feed.position.y = b[1] / 2 + 0.12 + r * 0.35; g.add(feed); }
    else { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), M.steel); a.position.set(b[0] / 2 - 0.06, b[1] / 2 + 0.25, 0); g.add(a); }
    const n = d.inst.length; d.inst.forEach((id, i) => { const r = Math.min(b[0] * 0.24, 0.11 + (i % 2) * 0.03), cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 24), M.steel); cyl.rotation.x = Math.PI / 2;
      const cols = Math.min(n, 2), x = cols === 1 ? 0 : (i % 2 ? 1 : -1) * b[0] * 0.22, y = b[1] * 0.3 - Math.floor(i / 2) * Math.min(0.34, b[1] / 3.2); cyl.position.set(x, y, b[2] / 2 + 0.08); g.add(cyl);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 24), M.lens); lens.position.set(x, y, b[2] / 2 + 0.165); g.add(lens); });
    if (d.prop && d.prop !== "none") { const k = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 20, 1, true), M.steel); k.position.y = -b[1] / 2 - 0.13; g.add(k); }
    if (d.adcs && d.adcs !== "mtq") { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.14, 16), M.violet); s.position.set(-b[0] / 2 + 0.09, b[1] / 2 + 0.07, -b[2] / 2 + 0.09); g.add(s); }
    return g;
  }
  let craft = null, key = "", pop = 1, yaw = 0.6, tilt = 0.25, drag = null, auto = true, t0 = performance.now(), dead = false, lastW = 0, lastH = 0;
  function update(o) {
    M.foil.color.setHex(o.paint || 0xe8ae3c);
    const d = o.design || DEMO, mars = !!o.body && o.body !== "earth", k = JSON.stringify([d.bus, d.array, d.prop, d.adcs, d.inst, d.sats, d.dish, Math.round((o.area || 0) * 10), mars]);
    const kind = { mars: 1, moon: 2, jupiter: 3 }[o.body] || 0; uni.uMars.value = kind; glowC.value.set([0x4f9dff, 0xff8a4a, 0x9aa0b8, 0xffc98a][kind]);
    if (k === key) return; key = k;
    if (craft) pivot.remove(craft); fleet.clear();
    craft = build(d, o.area, mars); pivot.add(craft); pop = 0.6;
    const size = (BUS[d.bus] || BUS.cube6)[1] + (d.array === "body" ? 0 : Math.min(3.4, 0.9 + Math.sqrt(o.area || 0.1) * 0.5) * 1.3); pivot.userData.s = Math.min(1.25, 3.4 / size);
    for (let i = 1; i < Math.min(8, d.sats || 1); i++) { const c = craft.clone(); c.scale.setScalar(0.3); c.position.set(-2.6 - i * 0.95, 1.5 + i * 0.16, -3 - i * 2.2); c.rotation.set(0.3, 0.5 + i, 0.2); fleet.add(c); }
  }
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; auto = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; yaw += (e.clientX - drag[0]) * 0.01; tilt = Math.max(-1.2, Math.min(1.2, tilt + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; });
  for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => { drag = null; setTimeout(() => (auto = true), 2500); });
  function frame(now) {
    if (dead) return; requestAnimationFrame(frame);
    if (!canvas.isConnected || document.hidden) return;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (w !== lastW || h !== lastH) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1.3 ? 50 : 38; cam.updateProjectionMatrix(); lastW = w; lastH = h; }
    const t = (now - t0) / 1000; uni.uT.value = t; planet.rotation.y = t * 0.02;
    if (auto && !drag) yaw += 0.0045;
    pop += (1 - pop) * 0.12; const s = (pivot.userData.s || 1) * pop;
    pivot.scale.setScalar(s); pivot.rotation.set(tilt, yaw, 0); pivot.position.y = Math.sin(t * 0.8) * 0.06;
    fleet.children.forEach((c, i) => { c.rotation.y += 0.004; c.position.y += Math.sin(t * 0.7 + i) * 0.0008; });
    renderer.render(scene, cam);
  }
  requestAnimationFrame(frame);
  update({});
  return { update, dispose() { dead = true; renderer.dispose(); } };
}
