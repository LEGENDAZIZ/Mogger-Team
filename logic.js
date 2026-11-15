/*
 * Mission Control Live - game rules.
 * NASA Space Apps Challenge 2026, "Space Mission Design Game".
 * Written during the hackathon (14-15 November 2026). Code written with AI assistance (Claude).
 * Numbers are public facts (launch prices, physics, NASA/CSA mission data); several are estimates.
 */

export const meta = { game: "Orbi's Mission Lab", minPlayers: 1, maxPlayers: 4 };

const ROLES = ["director", "engineer", "science", "capcom"];
const BODY = {
  mars: { n: "Mars", mu: 42828.37, R: 3389.5, vinf: 2.65, au: [1.7, 2.64], c3: null, heat: 2 },
  moon: { n: "the Moon", mu: 4902.8, R: 1737.4, vinf: 0.8, au: [0.00257, 0.0027], c3: -2, heat: 1.3 },
  jupiter: { n: "Jupiter", mu: 126686534, R: 71492, vinf: 5.6, au: [4.2, 6.2], c3: 82, heat: 3 },
};
const G0 = 9.80665, MU_E = 398600.4418, R_E = 6378.137, MU_M = 42828.37, R_M = 3389.5, AU_KM = 149597870.7;
const DIFF = {
  cadet: { n: "Cadet", b: 1.2, hints: true, time: 480, d: "20% more money, hints on." },
  engineer: { n: "Engineer", b: 1, hints: true, time: 360, d: "Normal budget, hints on." },
  director: { n: "Director", b: 0.88, hints: false, time: 300, d: "Tight budget, no hints, no mercy." },
};

/* ---------- parts catalogue (mass kg, power W, cost $M) ---------- */
const BUS = {
  cube3: { n: "3U CubeSat", cls: "cube", cu: 3, dry: 1.0, cost: 0.6, max: 6, U: 2, face: 0.034, d: "A satellite the size of a loaf of bread. Cheap and tiny: 6 kg at most." },
  cube6: { n: "6U CubeSat", cls: "cube", cu: 6, dry: 1.8, cost: 0.85, max: 12, U: 4.5, face: 0.083, d: "Two loaves side by side. Room for a bigger sensor." },
  cube12: { n: "12U CubeSat", cls: "cube", cu: 12, dry: 3.0, cost: 1.1, max: 24, U: 10, face: 0.083, d: "The biggest CubeSat. Room for fuel and several sensors." },
  small: { n: "Small satellite", cls: "small", frac: 0.15, base: 20, cost: 5, max: 450, d: "Washing-machine size, up to 450 kg." },
  medium: { n: "Medium spacecraft", cls: "medium", frac: 0.17, base: 80, cost: 110, max: 3000, d: "Car size, up to 3 tonnes. The classic planetary orbiter." },
  large: { n: "Large spacecraft", cls: "large", frac: 0.19, base: 200, cost: 210, max: 8000, d: "Bus size, up to 8 tonnes. Powerful and very expensive." },
};
const INST = {
  cam: { n: "Mini colour camera", cls: ["cube", "small"], m: 1.2, p: 4, gb: 17, c: 0.3, val: 40, pt: 2, ifov: 7.5, sw: 2.9, u: 1, tags: ["img"], d: "A 9 cm telescope. Sharp daytime photos of a narrow strip." },
  tirc: { n: "Thermal fire camera", cls: ["cube", "small"], m: 1.6, p: 8, gb: 54, c: 0.8, val: 60, pt: 1, ifov: 400, sw: 45, u: 2, minU: 6, tags: ["fire"], d: "Uncooled heat sensor. Sees fires day and night across a wide strip, but blurry." },
  mwir: { n: "Cooled infrared fire imager", cls: ["small", "medium"], m: 25, p: 60, gb: 108, c: 12, val: 110, pt: 0.5, ifov: 100, sw: 60, tags: ["fire"], d: "A chilled detector that spots small fires early. Heavy and power-hungry." },
  hyper: { n: "Hyperspectral imager", cls: ["small", "medium"], m: 30, p: 50, gb: 259, c: 15, val: 100, pt: 0.1, ifov: 60, sw: 8, tags: ["img", "minerals"], d: "Splits light into 285 colours: salt, dust, plant health. Enormous data." },
  hrcam: { n: "Sharp telescope camera", cls: ["small", "medium"], m: 60, p: 80, gb: 324, c: 20, val: 120, pt: 0.05, ifov: 1.3, sw: 1.2, tags: ["img"], d: "Half-metre telescope. Sees cars, but only a thin strip." },
  relay: { n: "Rover relay radio", cls: ["small", "medium", "large"], m: 20, p: 120, gb: 0.5, c: 15, val: 90, pt: 1, fixed: true, tags: ["relay"], d: "Listens to rovers on the ground and passes their data on to Earth." },
  ctx: { n: "Context camera", cls: ["small", "medium", "large"], m: 4, p: 8, gb: 2, c: 5, val: 80, pt: 0.1, ifov: 20, tags: ["map"], d: "Maps wide areas at about 6 m per pixel." },
  nac: { n: "Telescope camera", cls: ["small", "medium", "large"], m: 45, p: 60, gb: 3, c: 35, val: 120, pt: 0.02, ifov: 1, tags: ["map"], d: "Sees rocks the size of a desk. Needs very steady pointing." },
  spec: { n: "Mineral spectrometer", cls: ["small", "medium", "large"], m: 33, p: 46, gb: 1.5, c: 40, val: 100, pt: 0.05, tags: ["map", "minerals"], d: "Reads the colours of rocks to find minerals made by water." },
  sounder: { n: "Ice-finding radar", cls: ["medium", "large"], m: 15, p: 15, gb: 0.5, c: 20, val: 80, pt: 2, tags: ["ice"], d: "Radio waves look under the ground for buried ice. Works only from a low orbit." },
  wac: { n: "Weather camera", cls: ["small", "medium", "large"], m: 4, p: 6, gb: 0.3, c: 3, val: 40, pt: 1, tags: ["map", "weather"], d: "A wide-angle daily picture of dust storms and clouds." },
  skyscope: { n: "Sky telescope", cls: ["small", "medium"], m: 55, p: 45, gb: 25, c: 18, val: 140, pt: 0.002, tags: ["sky"], d: "Four wide cameras stare at the stars and catch the tiny dip in light when a planet passes in front of its star." },
  mwr: { n: "Microwave radiometer", cls: ["medium", "large"], m: 40, p: 35, gb: 0.2, c: 25, val: 110, pt: 1, tags: ["deep"], d: "Six antennas listen to microwaves from deep under the clouds, to measure water hidden inside the planet." },
  mag: { n: "Magnetometer", cls: ["small", "medium", "large"], m: 2, p: 1.5, gb: 0.01, c: 0.4, val: 35, pt: 10, tags: ["fields"], d: "Measures the magnetic field. Light, cheap, tiny data." },
};
const PLAN = {
  target: { n: "Targets only", f: 0.05, v: 0.6, d: "Switch on only above the main target. Very little data." },
  region: { n: "Regional", f: 0.3, v: 1, d: "Observe the whole region the client cares about." },
  full: { n: "Everything, always", f: 1, v: 1.25, d: "Observe the whole planet. Most science, a flood of data." },
};
const ARR = {
  body: { n: "Body-mounted cells", cosf: 0.5, k: 1, kg: 0, c0: 0, c1: 0, cubeOnly: true, d: "Solar cells glued to the sides. Free and simple, but weak." },
  fixed: { n: "Fold-out panels", cosf: 0.65, k: 3, kg: 2.5, c0: 0.03, c1: 0.4, d: "Wings that unfold in orbit. The Sun often hits them at an angle." },
  track: { n: "Sun-tracking panels", cosf: 0.95, k: 3, kg: 3, drive: true, c0: 0.08, c1: 0.55, d: "A motor keeps the wings facing the Sun. Most power, more cost." },
};
const ARRSIZE = { small: [1, 2, 3, 4, 6, 8], medium: [4, 6, 8, 12, 16, 20, 30], large: [6, 8, 12, 16, 20, 30, 40, 60] };
const BATT = { cube: [20, 40, 80, 160], small: [200, 400, 800, 1600], medium: [1000, 2000, 4000, 8000], large: [2000, 4000, 8000, 16000] };
const HEAT = { cube: 0.5, small: 12, medium: 50, large: 110 };
const FUEL = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.8, 1.2, 1.8, 2.5];
const PROP = {
  none: { n: "No thrusters", isp: 0, d: "Nothing to push with. Light and cheap; you stay where the rocket leaves you." },
  cold: { n: "Cold gas", isp: 65, tank: 0.6, u: 1, by: { cube: { m: 0.4, c: 0.06 }, small: { m: 3, c: 0.4 } }, d: "Squirts stored gas. Simple and safe, very weak." },
  green: { n: "Green monopropellant", isp: 230, tank: 0.2, u: 1.5, by: { cube: { m: 1, c: 0.25 }, small: { m: 6, c: 1.2 } }, d: "Non-toxic fuel. A good push in a small package." },
  hydra: { n: "Hydrazine", isp: 220, tank: 0.12, by: { small: { m: 6, c: 1.5 }, medium: { m: 20, c: 4 }, large: { m: 40, c: 8 } }, d: "The old workhorse: reliable, toxic." },
  biprop: { n: "Bipropellant engine", isp: 318, tank: 0.1, by: { small: { m: 15, c: 4 }, medium: { m: 45, c: 10 }, large: { m: 90, c: 20 } }, d: "Fuel plus oxidiser. Strong and efficient: made for braking into orbit." },
};
const ADCS = {
  mtq: { n: "Magnetorquers", by: { cube: { m: 0.3, p: 0.6, c: 0.03, acc: 5, u: 0.2 }, small: { m: 3, p: 5, c: 0.25, acc: 3 } }, d: "Electromagnets push against Earth's magnetic field. Points within a few degrees, cannot aim sideways." },
  rw: { n: "Reaction wheels + star tracker", by: { cube: { m: 1, p: 3, c: 0.15, acc: 0.05, u: 0.5 }, small: { m: 15, p: 40, c: 2, acc: 0.02 }, medium: { m: 60, p: 60, c: 7, acc: 0.01 }, large: { m: 150, p: 90, c: 18, acc: 0.005 } }, d: "Spinning wheels turn the craft and a star camera tells it where it looks. Can aim sideways at a target." },
  fine: { n: "Precision pointing", by: { cube: { m: 2, p: 6, c: 0.6, acc: 0.002, u: 1 }, small: { m: 25, p: 60, c: 6, acc: 0.001 }, medium: { m: 90, p: 90, c: 15, acc: 0.0005 }, large: { m: 220, p: 140, c: 40, acc: 0.0002 } }, d: "Wheels plus a fine guidance sensor. Telescope grade: images 8% better." },
};
const COMP = {
  cots: { n: "Commercial computer", tid: 10, hit: 0.6, by: { cube: { m: 0.1, p: 1, c: 0.015 }, small: { m: 2, p: 6, c: 0.15 }, medium: { m: 5, p: 12, c: 0.5 }, large: { m: 8, p: 18, c: 1 } }, d: "Fast, cheap, phone-style chips. Radiation makes it reset. Survives about 10 krad." },
  radtol: { n: "Radiation-tolerant computer", tid: 50, hit: 0.25, by: { cube: { m: 0.25, p: 2.5, c: 0.09 }, small: { m: 4, p: 10, c: 0.9 }, medium: { m: 8, p: 18, c: 2.5 }, large: { m: 12, p: 25, c: 4 } }, d: "Toughened design. Survives about 50 krad." },
  radhard: { n: "Radiation-hardened computer", tid: 300, hit: 0.05, by: { cube: { m: 0.8, p: 6, c: 0.35 }, small: { m: 7, p: 15, c: 2.5 }, medium: { m: 12, p: 22, c: 5 }, large: { m: 18, p: 30, c: 8 } }, d: "Slow, costly, nearly unbreakable. Survives about 300 krad." },
};
const BAND = {
  uhf: { n: "UHF radio", f: 437e6, eff: 0.4, by: { cube: { m: 0.1, c: 0.01, rf: 2, rate: 0.0192, u: 0.2, rx: 0.3 }, small: { m: 1, c: 0.1, rf: 5, rate: 0.0192, rx: 1 } }, d: "Amateur-radio band. Works with a simple antenna, slow as a 1990s modem." },
  s: { n: "S-band radio", f: 2.25e9, eff: 0.3, by: { cube: { m: 0.2, c: 0.05, rf: 2, rate: 4, u: 0.3, rx: 0.5 }, small: { m: 3, c: 0.8, rf: 10, rate: 10, rx: 3 }, medium: { m: 6, c: 2, rf: 20, rate: 20, rx: 8 }, large: { m: 10, c: 4, rf: 40, rate: 20, rx: 8 } }, d: "The standard small-satellite link: a few megabits per second." },
  x: { n: "X-band radio", f: 8.45e9, eff: 0.3, atm: 0.8, by: { cube: { m: 0.3, c: 0.15, rf: 5, rate: 150, u: 0.3, rx: 0.5 }, small: { m: 5, c: 2, rf: 20, rate: 500, rx: 3 }, medium: { m: 10, c: 5, rf: 100, rate: 1200, rx: 10 }, large: { m: 15, c: 8, rf: 100, rate: 1200, rx: 10 } }, d: "Fast and reliable in any weather. The choice of imaging satellites and deep space." },
  ka: { n: "Ka-band radio", f: 32e9, eff: 0.25, atm: 2.5, wx: 0.9, by: { cube: { m: 0.4, c: 0.4, rf: 2, rate: 400, u: 0.4, rx: 0.5 }, small: { m: 7, c: 3, rf: 20, rate: 2000, rx: 3 }, medium: { m: 12, c: 7, rf: 60, rate: 3500, rx: 10 }, large: { m: 18, c: 10, rf: 150, rate: 3500, rx: 10 } }, d: "The fastest radio, but rain at the ground station blocks it about 1 day in 10." },
};
const DISH = [{ n: "1 m dish", D: 1, m: 8, c: 1 }, { n: "2 m dish", D: 2, m: 20, c: 3 }, { n: "3 m dish", D: 3, m: 40, c: 6 }];
const NET = {
  uni: { n: "University ground station", bands: ["uhf", "s"], setup: 0.15, perYr: 0.03, fixedMin: 30, d: "One antenna on a campus roof. Almost free, but it sees each satellite only about 30 minutes a day." },
  com: { n: "Commercial station network", bands: ["s", "x", "ka"], setup: 0.25, perYr: 0.05, perMin: { s: 4e-6, x: 8e-6, ka: 15e-6 }, d: "Ten rented stations around the world, some near the poles. You pay per minute." },
  dsn34: { n: "Deep Space Network, 34 m", bands: ["x", "ka"], dish: 34, ts: { x: 30, ka: 40 }, setup: 2, perYr: 0.3, perHr: 0.0016, d: "NASA's 34 m dishes in California, Spain and Australia. About $1,600 per hour." },
  dsn70: { n: "Deep Space Network, 70 m", bands: ["x"], dish: 70, ts: { x: 25 }, setup: 2, perYr: 0.3, perHr: 0.0065, d: "The giant dishes: four times the signal, four times the price, always busy." },
};
const CONTACT_E = [20, 60, 120], CONTACT_M = [4, 8, 12];
const ROCKET = {
  rideCube: { n: "CubeSat rideshare slot", kind: "slot", perU: 0.05, maxEach: 24, orbit: "sso525", rel: 0.997, d: "A seat in a dispenser on a shared Falcon 9, about $50,000 per unit of size. Goes to 525 km only. Free NASA CSLI launches are only for US teams; teams from Kazakhstan can apply to KiboCUBE (UN and JAXA) for a free ride from the space station." },
  rideSSO: { n: "Rideshare port", kind: "plate", base: 0.35, baseKg: 50, perKg: 0.007, maxEach: 450, orbit: "sso525", rel: 0.997, d: "Your own port on a shared Falcon 9: $350,000 for the first 50 kg, then $7,000 per kg. 525 km only." },
  electron: { n: "Electron", kind: "own", price: 8.4, cap: { sso350: 230, sso525: 195, sso700: 165 }, rel: 0.96, d: "A small rocket all to yourself. Flies to exactly the orbit you choose." },
  alpha: { n: "Firefly Alpha", kind: "own", price: 15, cap: { sso350: 700, sso525: 620, sso700: 540 }, rel: 0.6, d: "Lifts three times more than Electron, but several of its first flights failed." },
  f9: { n: "Falcon 9 (reusable)", kind: "own", price: 74, cap: { sso350: 9500, sso525: 9000, sso700: 8500 }, mLEO: 17500, ms: 5897, isp: 348, rel: 0.997, d: "The workhorse of the world. Very reliable; the booster lands and flies again." },
  f9x: { n: "Falcon 9 (expendable)", kind: "own", price: 95, mLEO: 22800, ms: 5472, isp: 348, rel: 0.997, d: "The booster is thrown away to lift more. About 4 tonnes to Mars." },
  newglenn: { n: "New Glenn", kind: "own", price: 68, mLEO: 45000, ms: 27990, isp: 445, rel: 0.8, d: "A huge new rocket with a short flight record. Price is an estimate." },
  a64: { n: "Ariane 64", kind: "own", price: 140, mLEO: 21650, ms: 2418, isp: 457, rel: 0.95, d: "Europe's heavy launcher with a very efficient hydrogen upper stage." },
  vulcan: { n: "Vulcan Centaur", kind: "own", price: 150, mLEO: 27200, ms: 2952, isp: 453, rel: 0.97, d: "Powerful hydrogen upper stage, made for deep space." },
  fh: { n: "Falcon Heavy (expendable)", kind: "own", price: 130, mLEO: 63800, ms: 8536, isp: 348, rel: 0.98, d: "Three Falcon boosters strapped together. About 16 tonnes to Mars." },
};
const ORB = {
  sso350: { n: "Very low orbit, 350 km", alt: 350, sun: 0.6, ecl: 0.61, drag: 90, deorb: { cube: 0, small: 0 }, dose: 0.5, d: "Closest to the ground: the sharpest pictures. Thin air drags you down within a year unless you keep pushing." },
  sso525: { n: "Sun-synchronous, 525 km", alt: 525, sun: 0.63, ecl: 0.59, drag: 0, deorb: { cube: 0, small: 30 }, dose: 1.5, d: "Passes over every place at the same local time. Where the rideshare flights go." },
  sso700: { n: "High sun-synchronous, 700 km", alt: 700, sun: 0.65, ecl: 0.58, drag: 0, deorb: { cube: 95, small: 95 }, dose: 4, d: "Sees a wider strip, a little blurrier. Stays up for decades, so you must carry fuel to come down." },
  mlow: { body: "mars", rp: 300, apo: 300, tgt: 6000, n: "Low Mars orbit, 300 km", alt: 300, sun: 0.62, ecl: 0.67, dose: 6, img: 1, relay: 1, d: "Best for mapping. Needs a long, hard braking burn." },
  mell: { body: "mars", rp: 300, apo: 33000, tgt: 33000, n: "Tall elliptical orbit", alt: 300, sun: 0.92, ecl: 1.4, dose: 6, img: 0.55, relay: 1.3, d: "Swings out to 33,000 km. Half the braking fuel and long talks with rovers, but pictures from far away." },
  maero: { body: "mars", rp: 300, apo: 33000, tgt: 33000, n: "Aerobraking to low orbit", alt: 300, sun: 0.62, ecl: 0.67, dose: 6, img: 1, relay: 1, aero: true, d: "Brake into the tall orbit, then skim the air hundreds of times to shrink it. Saves fuel, costs half a year." },
};
const ORB2 = {
  lolo: { body: "moon", rp: 100, apo: 100, tgt: 3000, n: "Low lunar orbit, 100 km", alt: 100, sun: 0.62, ecl: 0.8, dose: 2, img: 1, relay: 1, d: "Close to the ground: the sharpest maps of the dark polar craters. Needs the biggest braking burn." },
  lell: { body: "moon", rp: 100, apo: 17000, tgt: 17000, n: "Tall lunar orbit", alt: 100, sun: 0.9, ecl: 1.1, dose: 2, img: 0.55, relay: 1, d: "Swings out to about 17,000 km. A small braking burn, but the maps are blurrier." },
  jpol: { body: "jupiter", rp: 4200, apo: 8100000, tgt: 700000, n: "Long polar orbit around Jupiter", alt: 4200, sun: 1, ecl: 0.2, dose: 120, img: 1, relay: 1, d: "Like NASA's Juno: dives just above the clouds, then swings far out to escape the worst radiation." },
};
const TEST = {
  min: { n: "Minimal testing", f: 0.05, infant: 3, d: "Switch it on, see that it works, ship it. Problems show up in orbit." },
  std: { n: "Standard testing", f: 0.12, infant: 1, d: "Shake it like the rocket will, then bake and freeze it in a vacuum chamber." },
  full: { n: "Full qualification", f: 0.2, infant: 0.45, d: "Test like you fly: shock, radio noise, life tests. Finds most problems on the ground." },
};

Object.assign(ORB, ORB2);
/* NASA FIRMS MODIS active-fire hotspots, 7-14 Nov 2026: [lat, lon, fire power MW, day index, night flag] */
const FIRES = {"src":"NASA FIRMS MODIS C6.1 NRT active fires, 7-day files downloaded 2026-11-14","days":["2026-11-07","2026-11-08","2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13","2026-11-14"],"kz":[[40.86,69.53,8.7,0,1],[54.32,72.97,35.6,0,0],[54.3,73.01,35.7,0,0],[42.9,73.44,14.3,0,0],[46.83,74.93,11.6,0,1],[43.5,77.16,6.5,0,0],[43.55,77.33,20.7,0,0],[43.55,77.34,20.0,0,0],[44.88,78.78,6.6,0,0],[44.2,80.67,10.7,0,0],[44.21,80.68,5.4,0,0],[43.76,80.89,9.6,0,0],[43.84,80.96,9.2,0,0],[43.52,83.34,8.3,0,0],[55.91,63.21,69.6,1,0],[41.38,68.07,9.7,1,0],[40.97,68.53,65.0,1,0],[40.91,68.56,9.8,1,0],[40.91,68.65,11.2,1,1],[40.6,69.04,9.8,1,0],[40.6,69.06,9.3,1,0],[40.75,73.22,43.6,1,0],[43.12,75.0,126.1,1,0],[43.12,75.01,128.9,1,0],[42.91,75.04,8.4,1,0],[42.8,75.06,20.0,1,1],[43.32,77.15,16.4,1,0],[43.78,77.24,73.3,1,0],[43.52,77.58,16.6,1,0],[43.61,78.19,22.4,1,0],[46.18,81.21,44.6,1,0],[46.17,81.21,86.7,1,0],[46.17,81.22,138.1,1,0],[46.18,81.23,53.1,1,1],[46.18,81.24,40.0,1,1],[46.18,81.25,142.0,1,0],[46.19,81.25,216.9,1,0],[46.19,81.25,169.8,1,0],[46.17,81.26,119.4,1,0],[46.18,81.26,205.9,1,0],[46.16,81.27,271.5,1,0],[46.18,81.31,92.7,1,0],[48.36,83.75,22.1,1,0],[48.36,83.78,22.7,1,0],[51.87,54.75,22.3,2,1],[54.07,60.5,31.2,2,0],[54.06,60.5,37.6,2,0],[54.07,60.51,57.3,2,0],[51.94,61.07,18.1,2,0],[51.93,61.07,10.7,2,0],[51.94,61.09,18.1,2,0],[52.53,61.19,11.9,2,0],[53.96,61.47,12.9,2,0],[53.41,62.6,14.5,2,0],[53.63,62.93,17.1,2,0],[53.62,62.93,46.2,2,0],[53.62,62.95,15.3,2,0],[53.66,62.98,21.4,2,1],[53.84,63.47,82.5,2,0],[53.06,64.2,9.3,2,0],[55.47,64.39,16.3,2,0],[55.14,64.4,10.8,2,0],[55.74,64.47,14.6,2,0],[55.65,64.55,92.6,2,0],[55.66,64.56,22.0,2,0],[55.65,64.56,25.6,2,0],[54.76,65.14,26.1,2,0],[53.41,65.95,9.0,2,0],[53.42,65.95,21.7,2,0],[43.79,81.78,7.3,2,0],[43.78,81.79,10.6,2,0],[48.32,84.12,10.8,2,0],[48.32,84.13,9.7,2,0],[51.94,61.08,21.1,3,0],[53.69,63.33,24.3,3,0],[53.69,63.35,29.6,3,0],[53.69,63.35,23.1,3,0],[53.5,65.38,41.2,3,0],[53.49,65.38,41.6,3,0],[55.41,65.48,14.3,3,0],[53.63,66.49,24.9,3,0],[53.64,66.51,12.4,3,0],[53.47,68.19,11.7,3,0],[53.89,68.5,11.4,3,0],[55.38,68.68,12.0,3,0],[44.84,78.24,11.9,3,0],[44.84,78.25,8.3,3,0],[45.49,84.98,24.4,4,0],[45.49,85.0,27.5,4,0],[42.19,86.09,15.4,5,0],[40.2,49.47,10.1,6,1],[48.4,57.33,16.6,6,1],[40.87,69.53,9.8,6,1],[40.86,69.54,16.0,7,1]],"ca":[[49.83,-113.55,66.0,0,1],[50.26,-102.13,17.3,0,0],[48.58,-99.38,13.2,0,0],[48.58,-99.37,11.0,0,0],[56.28,-117.99,43.2,2,0],[55.54,-116.72,23.4,2,1],[47.0,-116.32,205.8,2,0],[47.05,-116.22,17.9,2,0],[47.17,-115.89,89.5,2,0],[46.52,-115.76,112.7,2,0],[46.51,-115.76,37.8,2,0],[46.73,-115.66,49.8,2,0],[49.03,-115.28,23.1,2,0],[42.68,-111.59,23.2,2,0],[52.44,-110.11,16.4,2,0],[49.87,-101.86,40.7,2,0],[48.99,-99.57,43.4,2,0],[48.18,-98.57,33.8,2,0],[45.98,-98.24,38.6,2,0],[46.51,-98.05,153.3,2,0],[44.46,-95.66,35.8,2,0],[44.5,-95.06,25.1,2,0],[44.5,-95.03,65.7,2,0],[44.32,-90.07,9.8,2,0],[43.33,-89.39,26.6,2,0],[43.14,-88.91,33.0,2,0],[43.17,-123.91,8.7,3,0],[42.01,-123.57,18.5,3,0],[54.19,-122.74,87.8,3,0],[56.46,-121.05,21.8,3,0],[42.29,-120.38,423.5,3,0],[42.28,-120.37,310.6,3,0],[57.63,-117.26,75.1,3,0],[57.75,-116.76,24.2,3,1],[54.4,-113.83,10.2,3,0],[51.15,-107.46,17.0,3,0],[43.21,-124.32,20.0,4,1],[43.21,-124.19,26.0,4,0],[45.1,-123.63,21.7,4,0],[44.44,-122.19,110.3,4,0],[57.06,-117.68,134.8,4,1],[58.0,-116.66,46.1,4,0],[42.73,-116.62,97.0,4,0],[42.74,-116.61,67.6,4,0],[49.42,-82.68,10.7,4,0],[44.62,-119.96,114.8,5,1],[42.51,-119.78,33.3,5,0],[42.68,-116.6,20.9,5,0],[42.74,-116.58,7.4,5,0],[42.72,-116.57,7.3,5,0],[42.72,-116.56,6.2,5,0],[42.72,-116.45,26.8,5,0],[42.74,-116.43,64.3,5,0],[44.77,-115.89,12.5,5,0],[46.27,-98.37,16.8,5,0],[46.21,-97.64,14.8,5,0],[46.55,-97.59,22.6,5,0],[44.95,-96.09,25.2,5,0],[48.38,-117.53,51.9,6,0],[48.81,-98.96,13.6,6,0]]};
const HOT = FIRES.kz.concat(FIRES.ca);

/* JPL "Approximate Positions of the Planets" Keplerian elements (J2000, valid 1800-2050) */
const EL = {
  earth: { a: 1.00000261, e: 0.01671123, L: 100.46457166, w: 102.93768193, dL: 35999.37244981, dw: 0.32327364 },
  mars: { a: 1.52371034, e: 0.0933941, L: -4.55343205, w: -23.94362959, dL: 19140.30268499, dw: 0.44441088 },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function helio(b, year) {
  const E = EL[b], T = (year - 2000) / 100, w = E.w + E.dw * T;
  const Mn = (((E.L + E.dL * T - w) % 360) * Math.PI) / 180;
  let x = Mn;
  for (let i = 0; i < 10; i++) x = x - (x - E.e * Math.sin(x) - Mn) / (1 - E.e * Math.cos(x));
  const nu = 2 * Math.atan2(Math.sqrt(1 + E.e) * Math.sin(x / 2), Math.sqrt(1 - E.e) * Math.cos(x / 2));
  return { lon: ((((nu * 180) / Math.PI + w) % 360) + 360) % 360, r: E.a * (1 - E.e * Math.cos(x)) };
}
function windows() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const mi = WIN0 + i, year = 2028 + mi / 12, e = helio("earth", year), m = helio("mars", year);
    let lead = (((m.lon - e.lon) % 360) + 540) % 360 - 180;
    const off = lead - 44.3;
    out.push({ n: "1 " + MONTHS[mi % 12] + " " + (2028 + Math.floor(mi / 12)), lonE: Math.round(e.lon), lonM: Math.round(m.lon), rM: Math.round(m.r * 100) / 100, lead: Math.round(lead), c3: Math.round((11 + 0.09 * off * off) * 10) / 10 });
  }
  return out;
}
const WIN0 = 9; // from 1 October 2028

/* ---------- scenarios ---------- */
const SCN = {
  first: {
    id: "first", n: "First Satellite", tag: "Earth orbit", body: "earth", sunAU: 1, budget: 2, years: 1, lat: 45, maxSats: 1, cardInst: 2, sciRef: 40,
    client: "Your school's space club",
    brief: "Every space engineer starts small. Build a CubeSat the size of a loaf of bread, give it a camera, and bring its first photos of Earth home.",
    crit: ["budget", "data"],
    opts: { bus: ["cube3", "cube6"], inst: ["cam", "tirc"], orbit: ["sso525"], rocket: ["rideCube", "rideSSO"], prop: ["none", "cold"], adcs: ["mtq", "rw"], band: ["uhf", "s", "x"], net: ["uni", "com"] },
    rel: { cam: 1, tirc: 0.5 },
    events: ["storm", "junk", "tumble", "outage", "instfault", "battery"],
    start: { bus: "cube3", array: "body", arraySize: 0, batt: 0, prop: "none", fuel: 0, adcs: "mtq", comp: "cots", inst: [], plan: "target", band: "uhf", dish: 0, net: "uni", contact: 0, orbit: "sso525", rocket: "rideCube", test: "std", sats: 1, window: 0 },
    cmp: { n: "A typical university CubeSat", rows: [["Size", "10 x 10 x 30 cm (called 3U)"], ["Mass", "about 4 kg"], ["Ride to orbit", "a shared rocket"]], src: "NASA CubeSat 101" },
  },
  fire: {
    id: "fire", n: "Fire Watch", tag: "Earth orbit", body: "earth", sunAU: 1, budget: 65, years: 3, lat: 55, maxSats: 8, cardInst: 2, sciRef: 180,
    client: "Forest services of Canada and Kazakhstan",
    brief: "Every summer wildfires burn forest and steppe in Canada and Kazakhstan. Build satellites that find every fire twice a day, the goal of the Canadian Space Agency's planned WildFireSat. The fire dots you will hunt are real NASA FIRMS detections from 7-14 November 2026.",
    crit: ["data", "revisit"],
    opts: { bus: ["cube6", "cube12", "small"], inst: ["tirc", "mwir", "cam", "hyper"], orbit: ["sso350", "sso525", "sso700"], rocket: ["rideCube", "rideSSO", "electron", "alpha", "f9"], prop: ["none", "cold", "green", "hydra"], adcs: ["mtq", "rw", "fine"], band: ["uhf", "s", "x", "ka"], net: ["uni", "com"] },
    rel: { tirc: 1, mwir: 1, hyper: 0.4, cam: 0.3 },
    events: ["storm", "junk", "tumble", "budget", "outage", "instfault", "battery"],
    start: { bus: "cube6", array: "body", arraySize: 0, batt: 0, prop: "none", fuel: 0, adcs: "mtq", comp: "cots", inst: [], plan: "region", band: "uhf", dish: 0, net: "uni", contact: 0, orbit: "sso525", rocket: "rideCube", test: "std", sats: 1, window: 0 },
    cmp: { n: "WildFireSat (Canadian Space Agency, planned)", rows: [["Launch", "planned for 2029"], ["Goal", "fire data for Canada twice a day"], ["Mission length", "5 years"]], src: "asc-csa.gc.ca" },
  },
  aral: {
    id: "aral", n: "Aral Sea Watch", tag: "Earth orbit", body: "earth", sunAU: 1, budget: 4, years: 2, lat: 45, maxSats: 4, cardInst: 2, sciRef: 62,
    client: "Water scientists in Kazakhstan",
    brief: "The Aral Sea has lost most of its water since 1960. Scientists in Kazakhstan need a fresh, sharp picture of the North Aral Sea and its dam every week to follow the shoreline, the salt and the dust. The budget is tiny: think CubeSat and rideshare.",
    crit: ["budget", "revisit"],
    opts: { bus: ["cube3", "cube6", "cube12", "small"], inst: ["cam", "tirc", "hyper", "hrcam"], orbit: ["sso350", "sso525", "sso700"], rocket: ["rideCube", "rideSSO", "electron"], prop: ["none", "cold", "green", "hydra"], adcs: ["mtq", "rw", "fine"], band: ["uhf", "s", "x"], net: ["uni", "com"] },
    rel: { cam: 1, hrcam: 1, hyper: 1, tirc: 0.4 },
    events: ["storm", "junk", "tumble", "budget", "outage", "instfault", "battery"],
    start: { bus: "cube3", array: "body", arraySize: 0, batt: 0, prop: "none", fuel: 0, adcs: "mtq", comp: "cots", inst: [], plan: "target", band: "uhf", dish: 0, net: "uni", contact: 0, orbit: "sso525", rocket: "rideCube", test: "std", sats: 1, window: 0 },
    cmp: { n: "Landsat 9 (NASA / USGS, 2021)", rows: [["Sharpness", "30 m per pixel"], ["Same place every", "16 days (8 with Landsat 8)"], ["Orbit", "705 km"], ["Launch mass", "2,711 kg"]], src: "nasa.gov" },
  },
  mars: {
    id: "mars", n: "Red Planet Relay", tag: "Mars orbit", body: "mars", sunAU: 1.524, budget: 480, years: 2, maxSats: 1, cardInst: 4, sciRef: 520,
    client: "An international Mars exploration programme",
    brief: "Rovers on Mars can only whisper to Earth. Put an orbiter around Mars that relays their data home and maps the ground for future landings. Mars lines up with Earth only every 26 months: choose your launch month with the planet positions from NASA JPL.",
    crit: ["dv", "data", "power"],
    opts: { bus: ["small", "medium", "large"], inst: ["relay", "ctx", "nac", "spec", "sounder", "wac", "mag"], orbit: ["mlow", "mell", "maero"], rocket: ["f9", "f9x", "newglenn", "a64", "vulcan", "fh"], prop: ["hydra", "biprop"], adcs: ["rw", "fine"], band: ["x", "ka"], net: ["dsn34", "dsn70"] },
    rel: { relay: 1, ctx: 1, nac: 1, spec: 1, sounder: 1, wac: 1, mag: 0.5 },
    events: ["storm", "tumble", "budget", "outage", "instfault", "dust"],
    start: { bus: "medium", array: "fixed", arraySize: 0, batt: 0, prop: "hydra", fuel: 3, adcs: "rw", comp: "cots", inst: [], plan: "region", band: "x", dish: 0, net: "dsn34", contact: 0, orbit: "mlow", rocket: "f9x", test: "std", sats: 1, window: 0 },
    cmp: { n: "Mars Reconnaissance Orbiter (NASA, 2005)", rows: [["Cost", "about $720M"], ["Launch mass", "2,180 kg"], ["Antenna", "3 m dish, 100 W X-band"], ["Getting into orbit", "braking burn, then 6 months of aerobraking"]], src: "nasa.gov" },
  },
  scope: {
    id: "scope", n: "Planet Hunter", tag: "Earth orbit", body: "earth", sunAU: 1, budget: 140, years: 2, lat: 0, maxSats: 1, cardInst: 2, sciRef: 165,
    client: "Astronomers looking for planets around other stars",
    brief: "Are there other Earths out there? Put a small space telescope above the air, point it very steadily at bright nearby stars and catch the tiny dip in starlight when a planet passes in front. This is how NASA's TESS has found hundreds of new planets.",
    crit: ["data", "safety"],
    opts: { bus: ["small", "medium"], inst: ["skyscope", "cam", "mag"], orbit: ["sso525", "sso700"], rocket: ["rideSSO", "electron", "alpha", "f9"], prop: ["none", "cold", "green", "hydra"], adcs: ["mtq", "rw", "fine"], band: ["s", "x", "ka"], net: ["uni", "com"] },
    rel: { skyscope: 1, cam: 0.15, mag: 0.2 },
    events: ["storm", "junk", "tumble", "budget", "outage", "instfault", "battery"],
    start: { bus: "small", array: "fixed", arraySize: 0, batt: 0, prop: "none", fuel: 0, adcs: "mtq", comp: "cots", inst: [], plan: "region", band: "s", dish: 0, net: "uni", contact: 0, orbit: "sso525", rocket: "rideSSO", test: "std", sats: 1, window: 0 },
    cmp: { n: "TESS (NASA, 2018)", rows: [["Launch mass", "362 kg"], ["Cameras", "4 wide-field cameras"], ["Orbit", "a long loop that reaches out towards the Moon"], ["Result", "hundreds of confirmed planets"]], src: "nasa.gov" },
  },
  moon: {
    id: "moon", n: "Moon Ice Finder", tag: "Moon orbit", body: "moon", sunAU: 1, budget: 320, years: 1, maxSats: 1, cardInst: 3, sciRef: 330,
    client: "Lunar base planners",
    brief: "Astronauts will need water on the Moon to drink and to make rocket fuel. Some craters near the poles never see the Sun and may hide ice. Fly to the Moon, brake into orbit and map those craters, like NASA's Lunar Reconnaissance Orbiter.",
    crit: ["dv", "data", "power"],
    opts: { bus: ["small", "medium"], inst: ["ctx", "nac", "spec", "sounder", "mag"], orbit: ["lolo", "lell"], rocket: ["f9", "f9x", "newglenn", "vulcan"], prop: ["hydra", "biprop"], adcs: ["rw", "fine"], band: ["s", "x", "ka"], net: ["dsn34", "dsn70"] },
    rel: { ctx: 0.8, nac: 0.9, spec: 1, sounder: 1, mag: 0.3 },
    events: ["storm", "tumble", "budget", "outage", "instfault", "battery"],
    start: { bus: "medium", array: "fixed", arraySize: 0, batt: 0, prop: "hydra", fuel: 2, adcs: "rw", comp: "cots", inst: [], plan: "region", band: "x", dish: 0, net: "dsn34", contact: 0, orbit: "lolo", rocket: "f9", test: "std", sats: 1, window: 0 },
    cmp: { n: "Lunar Reconnaissance Orbiter (NASA, 2009)", rows: [["Launch mass", "1,916 kg"], ["Orbit", "50 km above the Moon at first"], ["Instruments", "7, including cameras and an ice radar"], ["Still working", "more than 15 years later"]], src: "nasa.gov" },
  },
  jupiter: {
    id: "jupiter", n: "Jupiter Deep Dive", tag: "Jupiter orbit", body: "jupiter", sunAU: 5.2, budget: 1100, years: 2, maxSats: 1, cardInst: 3, sciRef: 300,
    client: "Planetary scientists",
    brief: "Jupiter is the biggest planet, wrapped in storms and deadly radiation. Sunlight there is 27 times weaker than at Earth, so you need giant solar panels, a tough computer and a big antenna. Measure the water hidden under the clouds, like NASA's Juno.",
    crit: ["power", "safety", "dv"],
    opts: { bus: ["medium", "large"], inst: ["mwr", "mag", "wac", "spec"], orbit: ["jpol"], rocket: ["f9x", "newglenn", "vulcan", "fh"], prop: ["hydra", "biprop"], adcs: ["rw", "fine"], band: ["x", "ka"], net: ["dsn34", "dsn70"] },
    rel: { mwr: 1, mag: 1, wac: 0.7, spec: 0.5 },
    events: ["storm", "tumble", "budget", "outage", "instfault", "battery"],
    start: { bus: "large", array: "track", arraySize: 4, batt: 1, prop: "biprop", fuel: 2, adcs: "rw", comp: "cots", inst: [], plan: "region", band: "x", dish: 1, net: "dsn34", contact: 0, orbit: "jpol", rocket: "fh", test: "std", sats: 1, window: 0 },
    cmp: { n: "Juno (NASA, 2011)", rows: [["Launch mass", "3,625 kg"], ["Solar panels", "about 60 m², to work five times farther from the Sun than Earth"], ["Radiation vault", "titanium walls around the computer"], ["Cost", "about $1.1 billion"]], src: "nasa.gov" },
  },
};

const CARDS = {
  director: [["Fly on a rocket that works at least 95 times in 100.", (M) => M.rocketRel >= 0.95], ["Insist on full qualification testing.", (M, d) => d.test === "full"], ["Keep at least 10% spare lifting power on the rocket.", (M) => M.massMargin >= 0.1]],
  engineer: [["Keep a power margin of 25% or more.", (M) => M.pMargin >= 0.25], ["Carry thrusters with 30% more push than the mission needs.", (M) => M.dv > 0 && M.dvMargin >= 0.3], ["Fly a radiation-tolerant or radiation-hardened computer.", (M, d) => d.comp !== "cots"]],
  science: [["Fly at least {n} instruments.", (M, d, S) => d.inst.length >= S.cardInst], ["Observe with the widest plan: everything, always.", (M, d) => d.plan === "full"], ["Reach 85% of the best possible science.", (M) => M.sciPct >= 0.85]],
  capcom: [["Finish under 85% of the budget.", (M) => M.bMargin >= 0.15], ["Keep 30% spare downlink.", (M) => M.genGB > 0 && M.downGB >= 1.3 * M.genGB], ["Keep the chance of mission success at 85% or more.", (M) => M.pMission >= 0.85]],
};

/* ---------- helpers ---------- */
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function money(x) { return x < 0.995 ? "$" + Math.round(x * 1000) + "k" : "$" + (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : String(Math.round(x))) + "M"; }
function nf(x) { return x >= 100 ? String(Math.round(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2); }
function pct(x) { return Math.round(x * 100) + "%"; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
function next(st) { st.seed = (st.seed + 0x6d2b79f5) | 0; let t = st.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function capDv(o) { const O = ORB[o], B = BODY[O.body], rp = B.R + O.rp, a = (rp + B.R + O.apo) / 2; return Math.sqrt(B.vinf * B.vinf + (2 * B.mu) / rp) - Math.sqrt(B.mu * (2 / rp - 1 / a)) + (O.aero ? 0.12 : 0); }
function payloadC3(rk, c3) { const r = R_E + 200, dv = Math.sqrt(c3 + (2 * MU_E) / r) - Math.sqrt(MU_E / r); return Math.max(0, (rk.mLEO + rk.ms) * Math.exp((-dv * 1000) / (rk.isp * G0)) - rk.ms); }
function linkRate(bandId, P, D, net, au) {
  const B = BAND[bandId], lam = 299792458 / B.f, dist = au * AU_KM * 1000;
  const gt = 0.55 * Math.pow((Math.PI * D) / lam, 2), gr = 0.6 * Math.pow((Math.PI * net.dish) / lam, 2);
  const pr = P * gt * gr * Math.pow(lam / (4 * Math.PI * dist), 2);
  return pr / (1.380649e-23 * net.ts[bandId]) / Math.pow(10, (6 + (B.atm || 0)) / 10) / 1e6;
}
function propOk(p, cls) { return p === "none" || !!PROP[p].by[cls]; }

function normalize(S, d) {
  const cls = BUS[d.bus].cls;
  if (!propOk(d.prop, cls) || S.opts.prop.indexOf(d.prop) < 0) d.prop = S.opts.prop.filter((p) => propOk(p, cls))[0];
  if (d.prop === "none") d.fuel = 0;
  if (!ADCS[d.adcs].by[cls]) d.adcs = "rw";
  if (!BAND[d.band].by[cls]) d.band = "x";
  if (cls !== "cube" && d.array === "body") d.array = "fixed";
  d.arraySize = cls === "cube" ? 0 : clamp(d.arraySize, 0, ARRSIZE[cls].length - 1);
  d.inst = d.inst.filter((i) => INST[i].cls.indexOf(cls) >= 0);
  d.sats = clamp(d.sats, 1, S.maxSats);
  return d;
}

/* ---------- the engineering model: every number on the dashboard ---------- */
function compute(S, d, diffId) {
  const bus = BUS[d.bus], cls = bus.cls, n = d.sats, orb = ORB[d.orbit], mars = S.body !== "earth", isMars = S.body === "mars", BD = BODY[S.body], years = S.years;
  const insts = d.inst.map((i) => INST[i]), plan = PLAN[d.plan];
  const band = BAND[d.band], hw = band.by[cls], net = NET[d.net], netOk = net.bands.indexOf(d.band) >= 0;
  const dish = mars ? DISH[d.dish] : null;
  const contactMin = mars ? CONTACT_M[d.contact] * 60 : net.fixedMin || CONTACT_E[d.contact];
  let rate = hw.rate, worst = 0;
  if (mars) { rate = netOk ? linkRate(d.band, hw.rf, dish.D, net, BD.au[0]) : 0; worst = netOk ? linkRate(d.band, hw.rf, dish.D, net, BD.au[1]) : 0; }
  const downGB = netOk ? ((rate * contactMin * 60) / 8000) * (band.wx || 1) : 0;
  const genGB = insts.reduce((s, i) => s + i.gb * (i.fixed ? 1 : plan.f), 0);
  const dataRatio = genGB > 0 ? Math.min(1, downGB / genGB) : 0;

  // power
  const arr = ARR[d.array], area = cls === "cube" ? bus.face * arr.k : ARRSIZE[cls][d.arraySize];
  const gen = (area * 1361 * 0.29 * arr.cosf * orb.sun * 0.95) / (S.sunAU * S.sunAU);
  const adcs = ADCS[d.adcs].by[cls], comp = COMP[d.comp].by[cls];
  const instW = insts.reduce((s, i) => s + i.p * (i.fixed ? 1 : 0.3 + 0.7 * plan.f), 0);
  const txW = (hw.rf / band.eff) * (contactMin / 1440) + hw.rx;
  const load = instW + adcs.p + comp.p + txW + HEAT[cls] * (mars ? BD.heat : 1);
  const pMargin = gen / load - 1;
  const batt = BATT[cls][d.batt], battNeed = (load * orb.ecl) / (mars ? 0.6 : 0.35), battOk = batt >= battNeed;

  // mass
  const prop = PROP[d.prop], pby = d.prop === "none" ? null : prop.by[cls];
  const parts = insts.reduce((s, i) => s + i.m, 0) + adcs.m + comp.m + hw.m + (dish ? dish.m : 0) + batt / 150 + area * arr.kg + (arr.drive ? (cls === "cube" ? 0.3 : 8) : 0) + (pby ? pby.m : 0);
  let dry = cls === "cube" ? bus.dry + parts : (parts + bus.base) / (1 - bus.frac);
  const fuel = pby ? dry * FUEL[d.fuel] : 0;
  dry += pby ? fuel * prop.tank : 0;
  const wet = dry + fuel;
  const dv = fuel > 0 ? (prop.isp * G0 * Math.log(wet / dry)) / 1000 : 0;
  const usedU = cls === "cube" ? insts.reduce((s, i) => s + (i.u || 0), 0) + adcs.u + hw.u + (pby ? prop.u * (1 + FUEL[d.fuel]) : 0) : 0;

  // launch
  const rk = ROCKET[d.rocket];
  let cap = 0, launchCost = 0, c3 = null, launchMass = wet * n * (rk.kind === "own" && !mars ? 1.1 : 1), massMargin, rideErr = null;
  const win = isMars ? windows()[d.window] : null;
  if (mars) { c3 = isMars ? win.c3 : BD.c3; cap = payloadC3(rk, c3); launchCost = rk.price; massMargin = cap / launchMass - 1; }
  else if (rk.kind === "slot") { launchCost = n * bus.cu * rk.perU; cap = rk.maxEach * n; massMargin = 1 - wet / rk.maxEach; if (cls !== "cube") { rideErr = "cube"; launchCost = n * 12 * rk.perU; } }
  else if (rk.kind === "plate") { launchCost = n * (rk.base + Math.max(0, wet - rk.baseKg) * rk.perKg); cap = rk.maxEach * n; massMargin = 1 - wet / rk.maxEach; }
  else { cap = rk.cap[d.orbit]; launchCost = rk.price; massMargin = cap / launchMass - 1; }
  const orbitOk = !rk.orbit || rk.orbit === d.orbit;

  // delta-v
  const deorb = mars ? 0 : orb.deorb[cls === "cube" ? "cube" : "small"];
  const dvNeed = mars ? 0.05 + capDv(d.orbit) + 0.05 * years : (orb.drag * years + deorb) / 1000;
  const dvMargin = dvNeed > 0 ? dv / dvNeed - 1 : 1;

  // coverage and sharpness
  const T = 2 * Math.PI * Math.sqrt(Math.pow(R_E + orb.alt, 3) / MU_E), opd = 86400 / T, agile = d.adcs !== "mtq";
  let revisit = null, gsd = null, revOk = true, resOk = true, thr = null;
  if (S.id === "fire") {
    const fs = insts.filter((i) => i.tags.indexOf("fire") >= 0);
    if (fs.length) {
      const pr = fs.reduce((a, b) => (b.sw > a.sw ? b : a)), sw = 2 * orb.alt * Math.tan((pr.sw * Math.PI) / 360);
      revisit = Math.max(1.5, 24 / (((sw * opd * 2) / (40075 * Math.cos((S.lat * Math.PI) / 180))) * n));
      gsd = Math.min.apply(null, fs.map((i) => (i.ifov * orb.alt) / 1000));
      thr = 25 * Math.pow(gsd / 210, 1.2);
    }
    revOk = revisit !== null && revisit <= 12 && d.plan !== "target";
  } else if (S.id === "aral") {
    const im = insts.filter((i) => i.tags.indexOf("img") >= 0);
    if (im.length) {
      const pr = im.reduce((a, b) => (b.ifov < a.ifov ? b : a)), sw = 2 * orb.alt * Math.tan((pr.sw * Math.PI) / 360);
      gsd = (pr.ifov * orb.alt) / 1000;
      const reach = agile ? 2 * orb.alt * Math.tan(Math.PI / 6) : sw;
      revisit = Math.ceil(100 / sw) / (((reach * opd) / (40075 * Math.cos((S.lat * Math.PI) / 180))) * n);
    }
    resOk = gsd !== null && gsd <= 10;
    revOk = revisit !== null && revisit <= 7;
  }

  // science
  let pot = 0;
  const blur = [];
  for (const id of d.inst) {
    const i = INST[id];
    let q = S.rel[id] || 0.3;
    if (adcs.acc > i.pt) { q *= 0.3; blur.push(i); }
    if (d.adcs === "fine" && i.ifov) q *= 1.08;
    if (mars) { if (id === "relay") q *= orb.relay; else if (i.tags.indexOf("map") >= 0) q *= orb.img; if (id === "sounder" && orb.apo > 3000) q *= 0.3; }
    if (S.id === "aral" && i.tags.indexOf("img") >= 0 && (i.ifov * orb.alt) / 1000 > 10) q *= 0.5;
    pot += i.val * q * (i.fixed ? 1 : plan.v);
  }
  if (!mars) pot *= Math.pow(n, 0.25);
  const sciRate = pot * dataRatio * Math.min(1, gen / load) * (battOk ? 1 : 0.75);
  const sciPct = Math.min(1, sciRate / S.sciRef);

  // cost
  const hwCost = bus.cost + insts.reduce((s, i) => s + i.c, 0) + adcs.c + comp.c + hw.c + (dish ? dish.c : 0) + arr.c0 + arr.c1 * area * (cls === "cube" ? 1 : 1) + batt * 0.0005 + (pby ? pby.c : 0);
  const fleet = hwCost * (1 + 0.6 * (n - 1)), testCost = fleet * TEST[d.test].f;
  let ground = net.setup + net.perYr * years;
  if (net.perMin) ground += (net.perMin[d.band] || 0) * contactMin * 365 * years * n;
  if (net.perHr) ground += net.perHr * CONTACT_M[d.contact] * 365 * years;
  const total = fleet + testCost + launchCost + ground, budget = S.budget * DIFF[diffId].b, bMargin = 1 - total / budget;

  // reliability
  const dose = orb.dose * years, tid = COMP[d.comp].tid, radF = dose > tid ? 4 : dose > 0.5 * tid ? 1.6 : 1;
  const lam = 0.07 * TEST[d.test].infant * radF, pSat = Math.exp(-lam * years), pMission = rk.rel * pSat;

  // where the coach should point for each kind of problem
  const fitRocket = S.opts.rocket.find((id) => { const r = ROCKET[id]; if (r.orbit && r.orbit !== d.orbit) return false; if (r.kind === "slot") return cls === "cube" && wet <= r.maxEach; if (r.kind === "plate") return wet <= r.maxEach; return (mars ? payloadC3(r, c3) : r.cap[d.orbit]) >= wet * n * (mars ? 1 : 1.1); });
  const busI = S.opts.bus.indexOf(d.bus), biggerBus = busI >= 0 && busI < S.opts.bus.length - 1 ? { k: "bus", o: S.opts.bus[busI + 1] } : { k: "inst" };
  let bestWin = 0; if (isMars) { const W = windows(); W.forEach((w, i) => { if (w.c3 < W[bestWin].c3) bestWin = i; }); }
  const goRocket = isMars && Math.abs(win.lead - 44.3) > 7 ? { k: "window", o: bestWin } : fitRocket ? { k: "rocket", o: fitRocket } : { k: "rocket" };
  const goPower = cls === "cube" ? (d.array === "body" ? { k: "array", o: "fixed" } : d.array === "fixed" ? { k: "array", o: "track" } : biggerBus) : d.arraySize < ARRSIZE[cls].length - 1 ? { k: "arraySize" } : { k: "array", o: "track" };
  const goData = !mars ? (d.net === "uni" ? { k: "net", o: "com" } : d.band === "uhf" || d.band === "s" ? { k: "band", o: "x" } : d.contact < 2 ? { k: "contact" } : { k: "plan", o: d.plan === "full" ? "region" : "target" }) : d.dish < 2 ? { k: "dish" } : d.contact < 2 ? { k: "contact" } : d.band === "x" && d.net === "dsn34" ? { k: "band", o: "ka" } : { k: "plan", o: d.plan === "full" ? "region" : "target" };
  const goDv = d.prop === "none" ? { k: "prop", o: cls === "cube" ? "green" : "hydra" } : d.fuel < FUEL.length - 1 ? { k: "fuel" } : mars && d.prop !== "biprop" ? { k: "prop", o: "biprop" } : { k: "orbit", o: mars ? S.opts.orbit[S.opts.orbit.length - 1] : "sso525" };
  // issues, addressed to the console that can fix them
  const issues = [], add = (role, sev, msg, fix, go) => issues.push({ role, sev, msg, fix, go: go || null });
  if (!d.inst.length) add("science", "block", "No instruments yet. A spacecraft with no sensors returns no science.", "Science Lead: add at least one instrument.", { k: "inst", o: S.id === "fire" ? "tirc" : S.body === "mars" ? "relay" : S.id === "scope" ? "skyscope" : S.body === "moon" ? "ctx" : S.body === "jupiter" ? "mwr" : "cam" });
  if (cls === "cube" && usedU > bus.U + 1e-9) add("engineer", "block", "The parts need " + nf(usedU) + "U of room but this CubeSat has only " + bus.U + "U free.", "Engineer: pick a bigger body, or remove a part or some fuel.", biggerBus);
  for (const i of insts) if (i.minU && cls === "cube" && bus.cu < i.minU) add("engineer", "block", i.n + " does not fit in a body smaller than " + i.minU + "U.", "Engineer: choose a 6U or bigger body.", { k: "bus", o: "cube6" });
  if (wet > bus.max) add("engineer", "block", "The spacecraft weighs " + nf(wet) + " kg but this body can carry only " + bus.max + " kg in total.", "Engineer: bigger body, fewer parts or less fuel.", biggerBus);
  if (!netOk) add("capcom", "block", net.n + " cannot hear " + band.n + ".", "Comms: change the radio band or the ground network.", { k: "band", o: net.bands.indexOf("x") >= 0 ? "x" : net.bands[net.bands.length - 1] });
  if (!orbitOk) add("director", "block", rk.n + " only flies to " + ORB[rk.orbit].n + ".", "Flight Director: pick that orbit, or buy your own rocket.", { k: "orbit", o: rk.orbit });
  if (rideErr) add("director", "block", "CubeSat slots only take CubeSats.", "Flight Director: use a rideshare port or your own rocket.", { k: "rocket", o: "rideSSO" });
  if (massMargin < 0 && orbitOk && !rideErr) add("director", "red", "Launch mass is " + Math.round(launchMass) + " kg, but " + rk.n + " lifts only " + Math.round(cap) + " kg " + (isMars ? "to Mars in that month." : mars ? "on that path." : "there."), isMars ? "Bigger rocket, lighter spacecraft, or a launch month closer to the best line-up." : "Bigger rocket or lighter spacecraft.", goRocket);
  if (pMargin < 0) add("engineer", "red", "The spacecraft uses " + nf(load) + " W but its panels make only " + nf(gen) + " W.", "Engineer: bigger or sun-tracking panels. Science: fewer power-hungry sensors.", goPower);
  else if (pMargin < 0.2) add("engineer", "amber", "Power margin is thin: " + pct(pMargin) + ". Ageing panels or a storm could switch you off.", "Engineer: aim for 20% spare power or more.", goPower);
  if (!battOk) add("engineer", "red", "The battery holds " + batt + " Wh but needs " + Math.ceil(battNeed) + " Wh to get through the planet's shadow.", "Engineer: a bigger battery.", { k: "batt" });
  if (dvNeed > 0 && dv < dvNeed) add("engineer", "red", mars ? "Braking into this orbit needs " + dvNeed.toFixed(2) + " km/s of push; the tanks give " + dv.toFixed(2) + " km/s." : "This orbit needs " + Math.round(dvNeed * 1000) + " m/s of push (air drag, coming down at the end); the spacecraft has " + Math.round(dv * 1000) + " m/s.", mars ? "Engineer: more fuel or a more efficient engine. Flight Director: an easier orbit." : "Engineer: add thrusters and fuel. Flight Director: 525 km needs none for CubeSats.", goDv);
  if (!mars && dv === 0) add("engineer", "amber", "No thrusters: this spacecraft cannot dodge space junk.", "Optional: a small cold-gas or green thruster.", { k: "prop" });
  for (const i of blur) add("engineer", "red", i.n + " needs to be held within " + i.pt + " degrees, but this pointing system manages " + adcs.acc + " degrees. Its data will be blurred.", "Engineer: reaction wheels or precision pointing.", { k: "adcs", o: S.opts.adcs.find((x) => ADCS[x].by[cls] && ADCS[x].by[cls].acc <= i.pt) || "fine" });
  if (genGB > 0 && netOk && dataRatio < 0.9) add("capcom", "red", "The sensors make " + nf(genGB) + " GB a day but the radio link can bring home only " + nf(downGB) + " GB.", "Comms: a faster band, a bigger dish or more contact time. Science: a lighter observation plan.", goData);
  if (bMargin < 0) add("capcom", "red", "The mission costs " + money(total) + ", over the " + money(budget) + " budget.", "Everyone: find the most expensive part you can live without.");
  else if (bMargin < 0.05) add("capcom", "amber", "Only " + pct(bMargin) + " of the budget is left as a reserve.", "A reserve of 8% or more absorbs bad news later.");
  if (rk.rel < 0.9) add("director", "amber", rk.n + " fails about 1 launch in " + Math.round(1 / (1 - rk.rel)) + ".", "Flight Director: a rocket with a longer record costs more and fails less.", { k: "rocket" });
  if (d.test === "min") add("director", "amber", "Minimal testing: three times more failures in orbit.", "Flight Director: standard testing is the usual balance.", { k: "test", o: "std" });
  if (dose > tid) add("engineer", "red", "This orbit gives " + nf(dose) + " krad of radiation over the mission, more than the computer survives (" + tid + " krad).", "Engineer: a tougher computer.", { k: "comp", o: d.comp === "cots" ? "radtol" : "radhard" });
  if (S.id === "fire" && d.inst.length) {
    if (revisit === null) add("science", "red", "No fire sensor on board.", "Science Lead: add a thermal or infrared fire sensor.", { k: "inst", o: "tirc" });
    else if (d.plan === "target") add("science", "red", "The observation plan only looks at a few test sites, not at the forests.", "Science Lead: choose the regional or the full plan.", { k: "plan", o: "region" });
    else if (revisit > 12) add("director", "red", "Each place is seen once every " + nf(revisit) + " hours. The goal is 12.", "Flight Director: more satellites or a higher orbit. Science: a sensor with a wider view.", { k: "sats" });
  }
  if (S.id === "aral" && d.inst.length) {
    if (gsd === null) add("science", "red", "No camera on board.", "Science Lead: add a camera.", { k: "inst", o: "cam" });
    else {
      if (!resOk) add("science", "red", "The sharpest camera sees details of " + nf(gsd) + " m. The goal is 10 m.", "Science Lead: a sharper camera. Flight Director: a lower orbit.", { k: "inst", o: "cam" });
      if (!revOk) add(agile ? "director" : "engineer", "red", "A full picture of the sea takes " + nf(revisit) + " days. The goal is 7.", agile ? "Flight Director: add a satellite. A higher orbit also sees a wider strip." : "Engineer: reaction wheels let the satellite aim sideways at the sea.", { k: agile ? "sats" : "adcs", o: "rw" });
    }
  }
  if (S.id === "first" && d.inst.length && !insts.some((i) => i.tags.indexOf("img") >= 0)) add("science", "red", "No camera on board. The club wants photos!", "Science Lead: add the mini colour camera.", { k: "inst", o: "cam" });
  if (S.body === "moon" && d.inst.length) {
    if (!insts.some((i) => i.tags.indexOf("map") >= 0)) add("science", "red", "No mapping instrument on board.", "Science Lead: add at least one camera or spectrometer.", { k: "inst", o: "ctx" });
    if (!insts.some((i) => i.tags.indexOf("ice") >= 0 || i.tags.indexOf("minerals") >= 0)) add("science", "red", "Nothing on board can look for water ice.", "Science Lead: add the ice-finding radar or the mineral spectrometer.", { k: "inst", o: "spec" });
    if (d.inst.indexOf("sounder") >= 0 && orb.apo > 3000) add("science", "amber", "The ice radar hardly works from the tall orbit.", "Flight Director: a low orbit, or Science: drop the radar.");
  }
  if (S.body === "jupiter" && d.inst.length) {
    if (d.inst.indexOf("mwr") < 0) add("science", "red", "No microwave radiometer: nobody can measure the water deep inside Jupiter.", "Science Lead: add the microwave radiometer.", { k: "inst", o: "mwr" });
    if (d.inst.indexOf("mag") < 0) add("science", "amber", "No magnetometer: Jupiter's giant magnetic field stays a mystery.", "Science Lead: add the magnetometer. It is light and cheap.", { k: "inst", o: "mag" });
  }
  if (S.id === "scope" && d.inst.length && d.inst.indexOf("skyscope") < 0) add("science", "red", "No sky telescope on board: no planets will be found.", "Science Lead: add the sky telescope.", { k: "inst", o: "skyscope" });
  if (isMars) {
    if (d.inst.length && d.inst.indexOf("relay") < 0) add("science", "red", "No relay radio: the rovers have nobody to talk to.", "Science Lead: add the rover relay radio.", { k: "inst", o: "relay" });
    if (d.inst.length && !insts.some((i) => i.tags.indexOf("map") >= 0)) add("science", "red", "No mapping instrument on board.", "Science Lead: add at least one camera or spectrometer.", { k: "inst", o: "ctx" });
    if (d.inst.indexOf("sounder") >= 0 && orb.apo > 3000) add("science", "amber", "The ice radar hardly works from the tall orbit.", "Flight Director: a low orbit, or Science: drop the radar.");
    if (Math.abs(win.lead - 44.3) > 7) add("director", "amber", "On " + win.n + " Mars is " + Math.abs(win.lead) + " degrees " + (win.lead < 0 ? "behind" : "ahead of") + " Earth. The cheapest trip starts when it is about 44 degrees ahead.", "Flight Director: try another launch month.", { k: "window", o: bestWin });
  }

  const works = !issues.some((x) => x.sev === "block") && massMargin >= 0 && pMargin >= 0 && battOk && blur.length === 0;
  const reqs = [{ t: "Spacecraft works: fits the rocket, has power, points steadily", ok: works }];
  if (S.id === "fire") reqs.push({ t: "Carry a fire sensor", ok: revisit !== null }, { t: "See every place at least every 12 hours", ok: revOk, v: revisit === null ? "" : nf(revisit) + " h" });
  if (S.id === "first") reqs.push({ t: "Carry a camera", ok: insts.some((i) => i.tags.indexOf("img") >= 0) });
  if (S.id === "aral") reqs.push({ t: "See details of 10 m or smaller", ok: resOk, v: gsd === null ? "" : nf(gsd) + " m" }, { t: "A full picture of the sea every 7 days", ok: revOk, v: revisit === null ? "" : nf(revisit) + " days" });
  if (isMars) reqs.push({ t: "Carry the rover relay radio and a mapping instrument", ok: d.inst.indexOf("relay") >= 0 && insts.some((i) => i.tags.indexOf("map") >= 0) });
  if (S.body === "moon") reqs.push({ t: "Map the Moon and look for water ice", ok: insts.some((i) => i.tags.indexOf("map") >= 0) && insts.some((i) => i.tags.indexOf("ice") >= 0 || i.tags.indexOf("minerals") >= 0) });
  if (S.body === "jupiter") reqs.push({ t: "Carry the microwave radiometer", ok: d.inst.indexOf("mwr") >= 0 });
  if (S.id === "scope") reqs.push({ t: "Carry a sky telescope and hold it very steady", ok: d.inst.indexOf("skyscope") >= 0 && !blur.some((i) => i === INST.skyscope) });
  reqs.push({ t: isMars ? "Enough fuel to brake into Mars orbit" : S.body === "moon" ? "Enough fuel to brake into orbit around the Moon" : S.body === "jupiter" ? "Enough fuel to brake into orbit around Jupiter" : "Stay in orbit for the mission and come down afterwards", ok: dv >= dvNeed - 1e-9 });
  reqs.push({ t: "Send home at least 90% of the data", ok: genGB > 0 && dataRatio >= 0.9, v: genGB > 0 ? pct(dataRatio) : "" });
  reqs.push({ t: "Stay inside the budget", ok: bMargin >= 0, v: money(total) });

  return { cls, n, wet, dry, fuel, busMax: bus.max, usedU, freeU: bus.U || 0, launchMass, cap, massMargin, c3, gen, load, pMargin, batt, battNeed, battOk, dv, dvNeed, dvMargin, genGB, downGB, dataRatio, rate, worst, contactMin, revisit, gsd, thr, sciRate, sciPct, pot, hwCost, fleet, testCost, launchCost, ground, total, budget, bMargin, rocketRel: rk.rel, pSat, pMission, lam, dose, area, issues, reqs, blocks: issues.filter((x) => x.sev === "block").length, reds: issues.filter((x) => x.sev === "red").length, deorb, win };
}

/* ---------- the cards each console can play ---------- */
function controls(S, d, diffId) {
  const bus = BUS[d.bus], cls = bus.cls, mars = S.body !== "earth", isMars = S.body === "mars", C = [], M = compute(S, d, diffId);
  const pick = (key, role, label, help, opts) => C.push({ key, role, label, help, type: "pick", value: d[key], options: opts });
  const step = (key, role, label, help, min, max, text) => C.push({ key, role, label, help, type: "step", value: d[key], min, max, text });
  // Flight Director
  pick("orbit", "director", "Orbit", "Where the spacecraft will live.", S.opts.orbit.map((id) => ({ id, n: ORB[id].n, d: ORB[id].d, s: mars ? "Braking burn " + capDv(id).toFixed(2) + " km/s" : "Fuel needed: " + Math.round(ORB[id].drag * S.years + ORB[id].deorb[cls === "cube" ? "cube" : "small"]) + " m/s" })));
  if (isMars) { const W = windows(); C.push({ key: "window", role: "director", label: "Launch month", help: "Mars must be about 44 degrees ahead of Earth when you leave. Positions from NASA JPL orbit data.", type: "pick", value: d.window, options: W.map((w, i) => ({ id: i, n: w.n, d: "Mars is " + Math.abs(w.lead) + " degrees " + (w.lead < 0 ? "behind" : "ahead of") + " Earth.", s: "Rocket energy needed (C3): " + w.c3 })), win: W }); }
  pick("rocket", "director", "Launch vehicle", "The rocket must lift everything to the orbit you chose.", S.opts.rocket.map((id) => {
    const r = ROCKET[id]; let s;
    if (r.kind === "slot") s = bus.cu ? money(r.perU * bus.cu) + " per satellite, up to 24 kg each" : "Only for CubeSats, up to 24 kg each";
    else if (r.kind === "plate") s = money(r.base + Math.max(0, M.wet - r.baseKg) * r.perKg) + " per satellite, up to 450 kg each";
    else s = money(r.price) + ", lifts " + Math.round(mars ? payloadC3(r, M.c3) : r.cap[d.orbit]) + " kg " + (isMars ? "to Mars" : S.body === "moon" ? "to the Moon" : S.body === "jupiter" ? "to Jupiter" : "there");
    return { id, n: r.n, d: r.d, s: s + ". Works " + (r.rel * 100).toFixed(r.rel > 0.99 ? 1 : 0) + " times in 100." };
  }));
  if (S.maxSats > 1) step("sats", "director", "Number of satellites", "Identical copies see each place more often. Each extra copy costs 60% of the first.", 1, S.maxSats, d.sats + (d.sats === 1 ? " satellite" : " satellites"));
  pick("test", "director", "Testing", "Testing costs money now and saves the mission later.", Object.keys(TEST).map((id) => ({ id, n: TEST[id].n, d: TEST[id].d, s: "Adds " + pct(TEST[id].f) + " to the hardware cost" })));
  // Spacecraft Engineer
  pick("bus", "engineer", "Body", "The frame that carries everything.", S.opts.bus.map((id) => ({ id, n: BUS[id].n, d: BUS[id].d, s: money(BUS[id].cost) + ", carries up to " + BUS[id].max + " kg" })));
  pick("array", "engineer", "Solar panels", "Sunlight at Mars is only 43% as strong as at Earth.", Object.keys(ARR).filter((id) => cls === "cube" || !ARR[id].cubeOnly).map((id) => ({ id, n: ARR[id].n, d: ARR[id].d, s: "Catches " + pct(ARR[id].cosf) + " of the sunlight that reaches it" })));
  if (cls !== "cube") step("arraySize", "engineer", "Panel area", "More area, more power, more mass.", 0, ARRSIZE[cls].length - 1, ARRSIZE[cls][d.arraySize] + " m2, makes " + Math.round(M.gen) + " W on average");
  step("batt", "engineer", "Battery", "Must carry the spacecraft through the planet's shadow on every orbit.", 0, BATT[cls].length - 1, BATT[cls][d.batt] + " Wh (needs " + Math.ceil(M.battNeed) + " Wh)");
  pick("prop", "engineer", "Thrusters", "Rocket equation: push = engine efficiency x 9.81 x ln(full mass / empty mass).", S.opts.prop.map((id) => ({ id, n: PROP[id].n, d: PROP[id].d, s: id === "none" ? "0 kg" : propOk(id, cls) ? "Efficiency (Isp) " + PROP[id].isp + " s, " + money(PROP[id].by[cls].c) : "", off: propOk(id, cls) ? null : "Not made for this body size" })));
  if (d.prop !== "none") step("fuel", "engineer", "Fuel load", "More fuel gives more push, but fuel is heavy and the rocket must lift it.", 0, FUEL.length - 1, nf(M.fuel) + " kg of fuel gives " + (mars ? M.dv.toFixed(2) + " km/s" : Math.round(M.dv * 1000) + " m/s") + " of push");
  pick("adcs", "engineer", "Pointing", "Sharp sensors need a steady hand.", S.opts.adcs.map((id) => ({ id, n: ADCS[id].n, d: ADCS[id].d, s: ADCS[id].by[cls] ? "Holds within " + ADCS[id].by[cls].acc + " degrees, " + money(ADCS[id].by[cls].c) : "", off: ADCS[id].by[cls] ? null : "Not made for this body size" })));
  pick("comp", "engineer", "Computer", "Space radiation flips bits and slowly kills chips.", Object.keys(COMP).map((id) => ({ id, n: COMP[id].n, d: COMP[id].d, s: money(COMP[id].by[cls].c) + ". This mission: " + nf(M.dose) + " krad" })));
  // Science Lead
  C.push({ key: "inst", role: "science", label: "Instruments", help: "Each sensor adds science, and also mass, power, cost and data.", type: "multi", value: d.inst, options: S.opts.inst.map((id) => { const i = INST[id], ok = i.cls.indexOf(cls) >= 0; return { id, n: i.n, d: i.d, s: nf(i.m) + " kg, " + nf(i.p) + " W, " + money(i.c) + ", " + nf(i.gb) + " GB a day" + (i.ifov && !mars ? ", sees " + nf((i.ifov * ORB[d.orbit].alt) / 1000) + " m details" : ""), off: ok ? null : "Does not fit this body size" }; }) });
  pick("plan", "science", "Observation plan", "How much of the time the sensors are switched on.", Object.keys(PLAN).map((id) => ({ id, n: PLAN[id].n, d: PLAN[id].d, s: "Data x" + PLAN[id].f + ", science x" + PLAN[id].v })));
  // Comms and Budget
  pick("band", "capcom", "Radio band", "Higher frequency carries more data but needs better aim and clear weather.", S.opts.band.map((id) => { const h = BAND[id].by[cls]; return { id, n: BAND[id].n, d: BAND[id].d, s: h ? (mars ? h.rf + " W transmitter, " : nf(h.rate) + " Mbps, ") + money(h.c) : "", off: h ? null : "Not made for this body size" }; }));
  if (mars) step("dish", "capcom", "Antenna dish", "Doubling the dish width gives four times the data rate.", 0, DISH.length - 1, DISH[d.dish].n + ": " + nf(M.rate) + " Mbps on an average day, " + nf(M.worst) + " Mbps when Mars is farthest");
  pick("net", "capcom", "Ground stations", "Somebody on Earth has to listen.", S.opts.net.map((id) => ({ id, n: NET[id].n, d: NET[id].d, s: "Hears: " + NET[id].bands.map((b) => BAND[b].n.replace(" radio", "")).join(", ") })));
  if (!NET[d.net].fixedMin) step("contact", "capcom", "Contact time", "More listening time brings home more data and costs more.", 0, 2, mars ? CONTACT_M[d.contact] + " hours a day" : CONTACT_E[d.contact] + " minutes a day per satellite");
  return C;
}

/* ---------- room state ---------- */
export function setup(players) {
  return { phase: "lobby", players: players.map((id, i) => ({ id, name: "Player " + (i + 1) })), host: players[0] || null, roles: { director: null, engineer: null, science: null, capcom: null }, scn: "first", diff: "cadet", seed: 1, fixes: 0, attempt: 0, cards: null, design: null, votes: null, t0: 0, sim: null, event: null, report: null };
}
function ownerOf(st, role) { return st.roles[role]; }
function isNum(x) { return typeof x === "number" && isFinite(x); }
const no = (error) => ({ ok: false, error });

export function validateAction(st, pid, a) {
  if (!a || typeof a !== "object" || typeof a.type !== "string") return no("bad action");
  const me = st.players.some((p) => p.id === pid), S = SCN[st.scn];
  if (a.type === "sit") return typeof a.name === "string" ? { ok: true } : no("name needed");
  if (!me) return no("press Join first");
  const host = st.host === pid;
  switch (a.type) {
    case "role": return st.phase !== "lobby" ? no("the mission has started") : ROLES.indexOf(a.role) < 0 ? no("unknown console") : st.roles[a.role] && st.roles[a.role] !== pid ? no("that console is taken") : { ok: true };
    case "assign": return !host ? no("only the host can do that") : ROLES.indexOf(a.role) >= 0 && st.players.some((p) => p.id === a.to) ? { ok: true } : no("bad assignment");
    case "config": return st.phase !== "lobby" ? no("the mission has started") : !host ? no("only the host chooses the mission") : (a.scn === undefined || SCN[a.scn]) && (a.diff === undefined || DIFF[a.diff]) ? { ok: true } : no("unknown choice");
    case "start": return st.phase !== "lobby" ? no("already started") : !host ? no("only the host can start") : isNum(a.t) ? { ok: true } : no("bad time");
    case "ready": return st.phase === "brief" && isNum(a.t) ? { ok: true } : no("not now");
    case "fix":
    case "set": {
      if (st.phase !== "design") return no("design is closed");
      const c = controls(S, st.design, st.diff).find((x) => x.key === a.key);
      if (!c) return no("unknown setting");
      if (ownerOf(st, c.role) !== pid) return no("that belongs to another console");
      if (c.type === "step") return Number.isInteger(a.value) && a.value >= c.min && a.value <= c.max ? { ok: true } : no("out of range");
      const o = c.options.find((x) => x.id === a.value);
      return o && !o.off ? { ok: true } : no("not available");
    }
    case "toReview": return st.phase === "design" && ownerOf(st, "director") === pid && isNum(a.t) ? { ok: true } : no("only the Flight Director can call the review");
    case "vote": return st.phase === "review" && typeof a.go === "boolean" && ROLES.some((r) => st.roles[r] === pid) ? { ok: true } : no("not now");
    case "back": return st.phase === "review" && ownerOf(st, "director") === pid ? { ok: true } : no("only the Flight Director can reopen the design");
    case "go": {
      if (st.phase !== "review" || ownerOf(st, "director") !== pid || !isNum(a.t)) return no("only the Flight Director gives the final GO");
      if (compute(S, st.design, st.diff).blocks) return no("fix the blocking problems first");
      if (ROLES.some((r) => st.votes[r] === null) && a.t - st.t0 < 60000) return no("wait for every console to vote");
      return { ok: true };
    }
    case "launch": return st.phase === "launch" && ownerOf(st, "director") === pid && isNum(a.rating) && a.rating >= 0 && a.rating <= 1 ? { ok: true } : no("not your console");
    case "capture": return st.phase === "capture" && ownerOf(st, "engineer") === pid && isNum(a.rating) && a.rating >= 0 && a.rating <= 1 && isNum(a.dvUsed) && a.dvUsed >= 0 && a.dvUsed <= 20 && typeof a.captured === "boolean" ? { ok: true } : no("not your console");
    case "auto": return (st.phase === "launch" || st.phase === "capture") && isNum(a.t) && a.t - st.t0 >= 60000 ? { ok: true } : no("too early for the autopilot");
    case "next": return st.phase === "ops" && !st.event ? { ok: true } : no("not now");
    case "respond": {
      if (st.phase !== "ops" || !st.event) return no("no event");
      if (ownerOf(st, st.event.role) !== pid) return no("this decision belongs to another console");
      const o = st.event.opts.find((x) => x.id === a.opt);
      return o && !o.off && isNum(a.ms) && a.ms >= 0 ? { ok: true } : no("not available");
    }
    case "timeout": return st.phase === "ops" && st.event && isNum(a.t) && a.t - st.event.t0 >= 45000 ? { ok: true } : no("too early");
    case "again": return st.phase === "report" && host && ["fly", "design", "lobby"].indexOf(a.mode) >= 0 && isNum(a.t) ? { ok: true } : no("only the host can restart");
    default: return no("unknown action");
  }
}

function log(st, ok, t, fix) { st.sim.log.push({ r: st.sim.round, ok, t, fix: fix || "" }); }

function startSim(st, t) {
  const S = SCN[st.scn], d = st.design, M = compute(S, d, st.diff);
  const pool = S.events.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(next(st) * (i + 1)), x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
  st.sim = { round: 0, total: 6, alive: d.sats, dv: M.dv, qual: 1, sci: 0, extra: 0, lost: null, decayed: false, ops: 0, log: [], det: S.id === "fire" ? HOT.map(() => 0) : null, plan: [null, pool[0], pool[1], pool[2], pool[3], null], evq: [], ms: [], launch: null, capture: null, allGo: ROLES.every((r) => st.votes[r] === true), reds: M.reds, period: 1 };
  st.phase = "launch"; st.t0 = t; st.event = null; st.report = null;
}

function doLaunch(st, rating, t) {
  const S = SCN[st.scn], d = st.design, M = compute(S, d, st.diff), sim = st.sim, rk = ROCKET[d.rocket], mars = S.body !== "earth";
  sim.launch = rating;
  const roll = next(st);
  if (M.massMargin < 0) sim.lost = "The rocket ran out of fuel before reaching orbit: the cargo was " + nf(M.launchMass - M.cap) + " kg too heavy.";
  else if (roll > rk.rel) sim.lost = rk.n + " failed during the climb. This rocket works " + Math.round(rk.rel * 100) + " times in 100, and this was not one of them.";
  else if (rating < 0.12 && st.diff === "director") sim.lost = "The launch left the spacecraft in an orbit that dips into the air. It burned up on the second lap.";
  if (sim.lost) { log(st, false, sim.lost, M.massMargin < 0 ? "Check the rocket's lifting power before the final GO." : "A rocket with a longer flight record fails less often."); return makeReport(st); }
  const need = (1 - rating) * (mars ? 0.04 : 0.08);
  if (rating >= 0.85) log(st, true, "Launch: a clean ride to orbit (" + pct(rating) + " accuracy).");
  else if (sim.dv >= need) { sim.dv -= need; log(st, rating >= 0.5, "Launch: the orbit was off target. Fixing it burned " + Math.round(need * 1000) + " m/s of the spacecraft's own fuel.", "Tilt over smoothly, cut the engine when the high point reaches the target, then finish the circle at the top."); }
  else { sim.qual *= 0.75 + 0.25 * rating; sim.dv = 0; log(st, false, "Launch: the orbit was off target and there was not enough fuel to fix it. Science is weaker for the whole mission.", "Fly the launch more accurately, or carry thrusters."); }
  if (mars) { st.phase = "capture"; st.t0 = t; } else st.phase = "ops";
}

const BTX = {
  mars: ["There was not enough fuel to brake. The spacecraft flew past Mars into orbit around the Sun.", "The braking burn went wrong: the spacecraft did not end up in a safe orbit around Mars.", "Mars arrival: captured into orbit using {0} km/s (a perfect burn needs {1}).", "Centre the burn on the closest point to Mars: fuel works hardest where you move fastest (Oberth effect).", "Mars arrival: captured, but the tanks ran dry before reaching the planned orbit. Science is weaker for the whole mission."],
  moon: ["There was not enough fuel to brake. The spacecraft flew past the Moon and was lost.", "The braking burn went wrong: the spacecraft did not end up in a safe orbit around the Moon.", "Moon arrival: captured into orbit using {0} km/s (a perfect burn needs {1}).", "Centre the burn on the closest point to the Moon: fuel works hardest where you move fastest (Oberth effect).", "Moon arrival: captured, but the tanks ran dry before reaching the planned orbit. Science is weaker for the whole mission."],
  jupiter: ["There was not enough fuel to brake. The spacecraft flew past Jupiter into deep space.", "The braking burn went wrong: the spacecraft did not end up in a safe orbit around Jupiter.", "Jupiter arrival: captured into orbit using {0} km/s (a perfect burn needs {1}).", "Centre the burn on the closest point to Jupiter: fuel works hardest where you move fastest (Oberth effect).", "Jupiter arrival: captured, but the tanks ran dry before reaching the planned orbit. Science is weaker for the whole mission."],
};
function doCapture(st, rating, dvUsed, captured) {
  const d = st.design, sim = st.sim, ideal = capDv(d.orbit), X = BTX[ORB[d.orbit].body] || BTX.mars;
  sim.capture = rating;
  sim.dv -= 0.05; // course corrections on the way
  if (!captured || sim.dv < ideal * 0.97) { sim.lost = captured ? X[0] : X[1]; log(st, false, sim.lost, "Start the burn before the closest point and keep it centred there. Carry the fuel the dashboard asks for."); return makeReport(st); }
  const used = ideal * (1 + (1 - rating) * 0.35);
  if (sim.dv >= used) { sim.dv -= used; log(st, rating >= 0.6, X[2].replace("{0}", used.toFixed(2)).replace("{1}", ideal.toFixed(2)), rating >= 0.85 ? "" : X[3]); }
  else { sim.dv = 0; sim.qual *= 0.7; log(st, false, X[4], "A burn centred on the closest point wastes less fuel."); }
  if (ORB[d.orbit].aero) {
    if (next(st) < 0.03) { sim.lost = "During aerobraking the spacecraft dipped too deep into the Martian air and overheated."; log(st, false, sim.lost, "Aerobraking saves fuel but carries a small risk."); return makeReport(st); }
    log(st, true, "Aerobraking: hundreds of gentle passes through the thin air shrank the orbit. It took the whole first period.");
  }
  st.phase = "ops";
}

const EV = {
  storm: { role: "science", title: "Solar storm", text: "The Sun has thrown a cloud of fast particles at you. It arrives in minutes.", def: "safe" },
  junk: { role: "capcom", title: "Space junk warning", text: "Tracking radars say an old rocket fragment may pass very close in two days. The prediction is still fuzzy.", def: "wait" },
  junk2: { role: "capcom", title: "Space junk: it is real", text: "New tracking confirms it: the fragment will pass within 50 m in three hours.", def: "brace" },
  tumble: { role: "engineer", title: "Tumbling", text: "A reaction wheel has jammed and the spacecraft is slowly spinning. The sensors cannot hold their target.", def: "wheels" },
  budget: { role: "director", title: "Budget cut", text: "The client's own funding was cut. They ask you to give back 8% of the budget.", def: "passes" },
  outage: { role: "capcom", title: "Ground station down", text: "A storm has knocked out your main ground station for weeks.", def: "wait" },
  instfault: { role: "science", title: "Instrument fault", text: "The main instrument keeps restarting every few minutes.", def: "reboot" },
  battery: { role: "engineer", title: "Battery ageing", text: "The battery is losing capacity faster than planned.", def: "reduce" },
  dust: { role: "engineer", title: "Global dust storm", text: "Dust has wrapped the whole of Mars. For this period only half the sunlight gets through.", def: "hib" },
};

function makeEvent(st, id, t) {
  const S = SCN[st.scn], d = st.design, sim = st.sim, M = compute(S, d, st.diff), e = EV[id], dvms = Math.round(sim.dv * 1000);
  const reserve = M.bMargin - sim.extra / M.budget;
  let info = "", opts = [];
  const o = (oid, l, h, off) => opts.push({ id: oid, l, h, off: off || null });
  if (id === "storm") { info = "Your computer: " + COMP[d.comp].n + "."; o("safe", "Safe mode now", "Instruments off until it passes. Lose half of this period's data."); o("keep", "Keep observing", "Full data if the computer copes."); }
  if (id === "junk") { info = "Fuel on board: " + dvms + " m/s of push."; o("push", "Push now (1 m/s)", "A tiny push two days early moves you kilometres away.", sim.dv < 0.001 ? "No fuel on board" : null); o("wait", "Wait for better tracking", "It may be a false alarm. If it is real, a late push costs much more."); }
  if (id === "junk2") { info = "Fuel on board: " + dvms + " m/s of push."; o("dodge", "Emergency push (12 m/s)", "Late pushes need far more fuel.", sim.dv < 0.012 ? "Not enough fuel" : null); o("brace", "Turn edge-on and hope", "A smaller target. One chance in three of a hit."); }
  if (id === "tumble") { info = "Fuel on board: " + dvms + " m/s of push."; o("thr", "Fire thrusters against the spin (5 m/s)", "Stops it in minutes.", sim.dv < 0.005 ? "Not enough fuel" : null); if (S.body === "earth") o("mag", "Let the magnets slow it down", "Safe, but it takes days."); o("wheels", "Spin the other wheels harder", "Quick, but they may overheat."); }
  if (id === "budget") { info = "Budget reserve: " + pct(Math.max(0, reserve)) + "."; o("reserve", "Pay from the reserve", "Nothing changes in orbit.", reserve < 0.08 ? "The reserve is smaller than 8%" : null); o("passes", "Buy fewer ground passes", "20% less data for the rest of the mission."); o("early", "End the mission one period early", "Lose the last period completely."); }
  if (id === "outage") { info = "Budget reserve: " + pct(Math.max(0, reserve)) + "."; o("rent", "Rent emergency passes", "Costs 2% of the budget. No data lost."); o("wait", "Wait for repairs", "Data piles up on board and the oldest is overwritten."); }
  if (id === "instfault") { info = "Your computer: " + COMP[d.comp].n + "."; o("reboot", "Full restart and recalibration", "Safe. Loses 40% of this period's data."); o("patch", "Patch the software live", "No data lost if it works. Tougher computers take patches better."); }
  if (id === "battery") { info = "Battery: " + M.batt + " Wh, the shadow needs " + Math.ceil(M.battNeed) + " Wh."; o("reduce", "Observe less in the shadow", "10% less science for the rest of the mission."); o("push", "Keep the full plan", "Fine if the battery has 30% to spare."); }
  if (id === "dust") { info = "Power margin: " + pct(M.pMargin) + "."; o("hib", "Hibernate", "Safe. Lose 80% of this period's data."); o("relay", "Relay only", "Keep the rovers connected, sensors off. Needs 20% spare power."); o("usual", "Carry on as usual", "Needs twice the power you normally use."); }
  let tip = "";
  if (id === "storm") tip = d.comp === "cots" ? "Your computer is the cheap kind. Safe mode is the wise call." : d.comp === "radhard" ? "Your hardened computer can work through a storm." : "Your computer is fairly tough. Safe mode is still the careful choice.";
  if (id === "junk") tip = sim.dv >= 0.001 ? "An early push costs almost nothing. Waiting can cost twelve times more." : "You have no fuel, so you can only wait.";
  if (id === "junk2") tip = sim.dv >= 0.012 ? "You have the fuel. Push!" : "No fuel for a push. Turn edge-on and hope.";
  if (id === "tumble") tip = sim.dv >= 0.005 ? "Thrusters stop a spin fast and safely." : S.body === "earth" ? "No fuel: the magnets are slow but safe." : "No fuel: the wheels are your only hope.";
  if (id === "budget") tip = reserve >= 0.08 ? "You kept a reserve for exactly this. Use it." : "No reserve left. Fewer passes hurts less than ending early.";
  if (id === "outage") tip = "Renting passes costs little compared with losing science.";
  if (id === "instfault") tip = d.comp === "cots" ? "Live patches often crash a cheap computer. The full restart is safer." : "Your computer handles live patches well.";
  if (id === "battery") tip = M.batt >= 1.3 * M.battNeed ? "Your battery has spare capacity. Keep the full plan." : "Your battery is tight. Observe less in the shadow.";
  if (id === "dust") tip = M.pMargin >= 1 ? "Your panels are huge. Carry on as usual." : M.pMargin >= 0.2 ? "You have spare power for the relay, but not for everything." : "Power is tight. Hibernate.";
  st.event = { id, role: e.role, title: e.title, text: e.text, info, tip, opts, def: opts.some((x) => x.id === e.def && !x.off) ? e.def : opts.filter((x) => !x.off)[0].id, t0: t };
}

function resolveEvent(st, opt, ms, t) {
  const S = SCN[st.scn], d = st.design, sim = st.sim, ev = st.event, M = compute(S, d, st.diff), comp = COMP[d.comp];
  let f = 1, q = 1, txt = "", ok = true, fix = "";
  const R = () => next(st);
  if (ev.id === "storm") {
    if (opt === "safe") { f = 0.5; q = d.comp === "cots" ? 1 : d.comp === "radtol" ? 0.75 : 0.45; txt = "Solar storm: safe mode protected the electronics. Half of this period's data was lost."; if (d.comp === "radhard") fix = "Your hardened computer could have worked through the storm."; }
    else if (R() < comp.hit) { sim.qual *= 0.75; f = 0.6; q = 0.1; ok = false; txt = "Solar storm: particles damaged a detector while it was switched on. Science is 25% weaker for the rest of the mission."; fix = "With a commercial computer, safe mode is the wise call. A tougher computer rides storms out."; if (d.comp === "cots" && sim.alive > 1 && R() < 0.3) { sim.alive--; txt += " One satellite never woke up."; } }
    else { q = d.comp === "radhard" ? 1 : 0.6; txt = "Solar storm: the computer rode it out. No data lost."; }
  } else if (ev.id === "junk") {
    if (opt === "push") { sim.dv -= 0.001; q = 0.85; txt = "Space junk: a tiny early push moved you out of the way. Cost: 1 m/s."; }
    else if (R() < 0.5) { txt = "Space junk: better tracking showed it will miss by 4 km. No fuel spent."; }
    else { sim.evq.push(0.5); makeEvent(st, "junk2", t); sim.ms.push(ms); return; }
  } else if (ev.id === "junk2") {
    sim.evq.pop();
    if (opt === "dodge") { sim.dv -= 0.012; q = 0.6; f = 0.9; txt = "Space junk: the late push worked, but it burned 12 m/s, twelve times more than an early push."; fix = "Drift grows with time: about 3 x push x seconds. Pushing early is cheap."; }
    else if (R() < 0.35) { sim.alive--; q = 0; f = 0.5; ok = false; txt = "Space junk: a fragment hit a satellite at 14 km/s. It is gone."; fix = "Carry a little fuel and push early."; }
    else { q = 0.3; txt = "Space junk: it missed by 200 m. That was luck, not skill."; fix = "Carry a little fuel and push early."; }
  } else if (ev.id === "tumble") {
    if (opt === "thr") { sim.dv -= 0.005; f = 0.9; txt = "Tumbling: thrusters stopped the spin in minutes."; }
    else if (opt === "mag") { f = 0.4; q = 0.6; txt = "Tumbling: the magnets needed days to calm the spin. Most of this period's data was lost."; fix = "Thrusters stop a tumble much faster."; }
    else if (R() < 0.4) { sim.qual *= 0.7; f = 0.7; q = 0.15; ok = false; txt = "Tumbling: a second wheel overheated. Pointing is shaky for the rest of the mission."; fix = "Thrusters are the safe way to stop a spin."; }
    else { f = 0.9; q = 0.7; txt = "Tumbling: the remaining wheels took the load."; }
  } else if (ev.id === "budget") {
    if (opt === "reserve") { sim.extra += 0.08 * M.budget; txt = "Budget cut: your reserve absorbed it. Nothing was lost in orbit."; }
    else if (opt === "passes") { sim.qual *= 0.8; q = 0.5; txt = "Budget cut: fewer ground passes, 20% less data for the rest of the mission."; fix = "A budget reserve of 8% or more would have absorbed the cut."; }
    else { sim.total = 5; q = 0.4; txt = "Budget cut: the mission will end one period early."; fix = "A budget reserve of 8% or more would have absorbed the cut."; }
  } else if (ev.id === "outage") {
    if (opt === "rent") { sim.extra += 0.02 * M.budget; q = M.bMargin - sim.extra / M.budget >= 0 ? 1 : 0.6; txt = "Ground station down: emergency passes on another network saved the data."; }
    else { f = 0.4; q = 0.5; txt = "Ground station down: data piled up on board and the oldest was overwritten."; fix = "Renting passes elsewhere costs little compared with lost science."; }
  } else if (ev.id === "instfault") {
    if (opt === "reboot") { f = 0.6; q = 0.75; txt = "Instrument fault: a full restart fixed it. 40% of this period's data was lost."; }
    else if (R() < (d.comp === "cots" ? 0.45 : 0.8)) { txt = "Instrument fault: the live software patch worked. No data lost."; }
    else { f = 0.3; sim.qual *= 0.9; q = 0.2; ok = false; txt = "Instrument fault: the live patch crashed the computer. Most of this period's data was lost."; fix = "Live patches are risky on a commercial computer."; }
  } else if (ev.id === "battery") {
    const spare = M.batt >= 1.3 * M.battNeed;
    if (opt === "reduce") { sim.qual *= 0.9; q = spare ? 0.6 : 1; txt = "Battery ageing: observing less in the shadow keeps the battery healthy. 10% less science from now on."; if (spare) fix = "Your battery had spare capacity: you could have kept the full plan."; }
    else if (spare) { txt = "Battery ageing: your spare capacity covers the loss. Nothing changes."; }
    else if (R() < 0.5) { f = 0.3; q = 0.1; ok = false; txt = "Battery ageing: the battery ran flat in the shadow and the spacecraft restarted again and again."; fix = "A battery with 30% spare capacity shrugs this off."; }
    else { q = 0.4; txt = "Battery ageing: the battery just held. A close call."; fix = "A battery with 30% spare capacity shrugs this off."; }
  } else if (ev.id === "dust") {
    const pm = M.pMargin;
    if (opt === "hib") { f = 0.2; q = pm >= 1 ? 0.4 : pm >= 0.2 ? 0.6 : 1; txt = "Dust storm: the spacecraft slept through it. Most of this period's data was lost."; if (pm >= 0.2) fix = "With your power margin you could have kept relaying."; }
    else if (opt === "relay") { if (pm >= 0.2) { f = 0.5; q = pm >= 1 ? 0.7 : 1; txt = "Dust storm: sensors off, relay on. The rovers stayed connected."; } else if (R() < 0.3) { sim.lost = "During the dust storm the battery ran flat and the spacecraft never answered again."; q = 0; f = 0; ok = false; txt = sim.lost; fix = "A power margin of 20% or more keeps the relay alive in a storm."; } else { f = 0.3; q = 0.2; ok = false; txt = "Dust storm: power ran so low that the spacecraft kept shutting down."; fix = "A power margin of 20% or more keeps the relay alive in a storm."; } }
    else if (pm >= 1) { txt = "Dust storm: your large panels kept everything running. No data lost."; }
    else if (R() < 0.6) { sim.qual *= 0.7; f = 0.3; q = 0.05; ok = false; txt = "Dust storm: carrying on as usual drained the battery and damaged it. Science is weaker from now on."; fix = "Only a spacecraft with double the power it needs can ignore a global dust storm."; }
    else { f = 0.6; q = 0.3; txt = "Dust storm: you carried on and got away with brownouts."; fix = "Only a spacecraft with double the power it needs can ignore a global dust storm."; }
  }
  sim.evq.push(q); sim.ms.push(ms); sim.dv = Math.max(0, sim.dv);
  log(st, ok, txt, fix);
  st.event = null;
  finishRound(st, f);
}

function finishRound(st, f) {
  const S = SCN[st.scn], d = st.design, sim = st.sim, orb = ORB[d.orbit], mars = S.body !== "earth";
  if (sim.alive > 0 && !sim.lost) {
    const lam0 = compute(S, d, st.diff).lam, pf = 1 - Math.exp((-lam0 * S.years) / 6);
    let died = 0;
    for (let i = 0, k = sim.alive; i < k; i++) if (next(st) < pf) died++;
    if (died) { sim.alive -= died; log(st, false, died === 1 ? "A satellite stopped answering: an electronics failure." : died + " satellites stopped answering.", "More testing on the ground finds weak parts before launch."); }
  }
  if (sim.alive <= 0 && !sim.lost) sim.lost = "Every spacecraft has failed. The mission is over.";
  let Ma = null;
  if (!sim.lost) {
    Ma = compute(S, Object.assign({}, d, { sats: sim.alive }), st.diff);
    if (!mars && orb.drag) { const use = (orb.drag * S.years) / 6 / 1000; if (sim.dv >= use) sim.dv -= use; else if (!sim.decayed) { sim.decayed = true; log(st, false, "Out of fuel: air drag pulled the orbit down and the satellites burned up.", "At 350 km you need about 90 m/s of push every year just to stay up."); } }
    if (sim.decayed) f = 0;
    if (orb.aero && sim.round === 1) f = 0;
    sim.period = f;
    if (f > 0) sim.ops++;
    sim.sci += (Ma.sciRate * f * sim.qual) / 6;
  }
  if (sim.det) for (let i = 0; i < HOT.length; i++) if (i % 6 === sim.round - 1) {
    const roll = next(st);
    sim.det[i] = Ma && f > 0 && Ma.thr !== null && HOT[i][2] >= Ma.thr && roll < clamp(12 / Ma.revisit, 0.15, 1) * f * sim.qual * Ma.dataRatio * (d.plan === "target" ? 0.2 : 1) ? 1 : 2;
  }
  if (sim.lost || sim.round >= sim.total) makeReport(st);
}

function makeReport(st) {
  const S = SCN[st.scn], d = st.design, sim = st.sim, M = compute(S, d, st.diff), mars = S.body !== "earth";
  if (sim.det) for (let i = 0; i < sim.det.length; i++) if (!sim.det[i]) sim.det[i] = 2;
  const spent = M.total + sim.extra, bM = 1 - spent / M.budget;
  const reqs = M.reqs.map((r) => ({ t: r.t, ok: r.ok, v: r.v || "" }));
  reqs[reqs.length - 1] = { t: "Stay inside the budget", ok: bM >= 0, v: money(spent) };
  if (!mars) { const i = reqs.findIndex((r) => r.t.indexOf("Stay in orbit") === 0); if (i >= 0 && !sim.lost) reqs[i].ok = !sim.decayed && sim.dv * 1000 >= M.deorb - 1e-6; }
  reqs.push({ t: "Survive the whole mission", ok: !sim.lost && !sim.decayed });
  const okN = reqs.filter((r) => r.ok).length, opsFrac = sim.ops / 6;
  const perf = (300 * okN) / reqs.length * (0.3 + 0.7 * opsFrac);
  let sciF = Math.min(1, sim.sci / S.sciRef), detN = 0;
  if (sim.det) { detN = sim.det.filter((x) => x === 1).length; sciF = 0.5 * sciF + 0.5 * (detN / sim.det.length); }
  const sci = 250 * sciF;
  const eff = bM < 0 ? 0 : 60 * clamp(bM / 0.12, 0, 1) + 30 * clamp(M.massMargin / 0.1, 0, 1) + 30 * clamp(M.pMargin / 0.2, 0, 1) + 30 * clamp(M.dvMargin / 0.2, 0, 1);
  const evAvg = sim.evq.length ? sim.evq.reduce((a, b) => a + b, 0) / sim.evq.length : sim.lost ? 0 : 1;
  let dec = (sim.launch === null ? 0 : sim.launch * (mars ? 40 : 60)) + (mars ? (sim.capture || 0) * 20 : 0) + evAvg * 60 * (sim.evq.length ? 1 : opsFrac) + (sim.reds === 0 ? 30 : 0);
  const fixes = st.fixes || 0;
  dec = Math.max(0, dec - 25 * fixes);
  const cards = ROLES.map((r) => { const c = CARDS[r][st.cards[r]]; return { role: r, text: c[0].replace("{n}", S.cardInst), ok: !!c[1](M, d, S) }; });
  const speed = sim.ms.length ? sim.ms.reduce((a, m) => a + clamp(1 - (m - 8000) / 32000, 0, 1), 0) / sim.ms.length : 0.5;
  const col = (sim.allGo ? 30 : 10) + 20 * cards.filter((c) => c.ok).length + 40 * speed;
  const total = Math.round(perf + sci + eff + dec + col);
  let stars = total >= 870 ? 3 : total >= 750 ? 2 : total >= 600 ? 1 : 0;
  const mainFail = reqs.some((r) => !r.ok);
  if (mainFail) stars = Math.min(stars, 2);
  if (sim.lost) stars = 0;
  const why = [];
  if (sim.lost) why.push({ ok: false, t: sim.lost, fix: "" });
  for (const r of reqs) if (!r.ok) { why.push({ ok: false, t: "Requirement missed: " + r.t + (r.v ? " (" + r.v + ")" : "") + ".", fix: "" }); }
  for (const x of M.issues) if (x.sev !== "amber") why.push({ ok: false, t: x.msg, fix: x.fix });
  for (const l of sim.log) why.push({ ok: l.ok, t: l.t, fix: l.fix });
  if (sim.det) why.push({ ok: detN / sim.det.length >= 0.6, t: "Your satellites found " + detN + " of the " + sim.det.length + " real fires NASA detected that week" + (M.thr !== null ? " (smallest fire your sensor can see: about " + nf(M.thr) + " MW)." : "."), fix: detN / sim.det.length >= 0.6 ? "" : "A sharper sensor or a lower orbit sees smaller fires; more satellites catch them sooner." });
  if (!sim.lost && sciF < 0.5 && !sim.det) why.push({ ok: false, t: "Only " + pct(sciF) + " of the best possible science came home.", fix: "More or better instruments, a wider observation plan, and a link that can carry the data." });
  if (fixes) why.push({ ok: false, t: "Orbi fixed " + fixes + (fixes === 1 ? " problem" : " problems") + " for you: 25 points each.", fix: "Fix the problems yourself to keep those points." });
  if (bM >= 0.12) why.push({ ok: true, t: "The mission finished " + pct(bM) + " under budget.", fix: "" });
  const ours = [["Satellites", String(d.sats)], ["Launch mass", nf(M.launchMass) + " kg"], ["Total cost", money(spent)]];
  if (M.revisit !== null) ours.push(["Same place every", S.id === "fire" ? nf(M.revisit) + " hours" : nf(M.revisit) + " days"]);
  if (M.gsd !== null) ours.push(["Sharpness", nf(M.gsd) + " m per pixel"]);
  if (mars) ours.push(["Data home per day", nf(Math.min(M.genGB, M.downGB)) + " GB"]);
  st.report = { total, stars, lost: sim.lost, mainFail, parts: [["Mission performance", Math.round(perf), 300], ["Science value", Math.round(sci), 250], ["Resource efficiency", Math.round(eff), 150], ["Decision quality", Math.round(dec), 150], ["Team collaboration", Math.round(col), 150]], reqs, why, cards, cmp: S.cmp, ours, sciPct: sciF, det: sim.det ? [detN, sim.det.length] : null, spent, bud: M.budget };
  st.phase = "report"; st.event = null;
}

export function applyAction(state, pid, a) {
  const st = JSON.parse(JSON.stringify(state)), S = SCN[st.scn];
  switch (a.type) {
    case "sit": {
      const name = a.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 14) || "Player";
      const p = st.players.find((x) => x.id === pid);
      if (p) p.name = name; else if (st.players.length < 4) st.players.push({ id: pid, name });
      if (!st.host) st.host = pid;
      break;
    }
    case "role": st.roles[a.role] = st.roles[a.role] === pid ? null : pid; break;
    case "assign": st.roles[a.role] = a.to; break;
    case "config": if (a.scn) st.scn = a.scn; if (a.diff) st.diff = a.diff; break;
    case "start": {
      const load = {};
      st.players.forEach((p) => (load[p.id] = 0));
      ROLES.forEach((r) => { if (st.roles[r] && load[st.roles[r]] !== undefined) load[st.roles[r]]++; else st.roles[r] = null; });
      ROLES.forEach((r) => { if (!st.roles[r]) { let best = st.players[0].id; st.players.forEach((p) => { if (load[p.id] < load[best]) best = p.id; }); st.roles[r] = best; load[best]++; } });
      st.seed = hash(st.host + ":" + a.t + ":" + st.attempt);
      st.cards = {};
      ROLES.forEach((r) => (st.cards[r] = Math.floor(next(st) * CARDS[r].length)));
      st.design = normalize(S, JSON.parse(JSON.stringify(S.start)));
      st.phase = "brief"; st.sim = null; st.report = null; st.event = null; st.fixes = 0;
      break;
    }
    case "ready": st.phase = "design"; st.t0 = a.t; break;
    case "fix": st.fixes = (st.fixes || 0) + 1; // Orbi did it for you: it costs points. Falls through to "set".
    case "set": {
      const d = st.design;
      if (a.key === "inst") { const i = d.inst.indexOf(a.value); if (i >= 0) d.inst.splice(i, 1); else d.inst.push(a.value); }
      else d[a.key] = a.value;
      normalize(S, d);
      break;
    }
    case "toReview": st.phase = "review"; st.votes = { director: null, engineer: null, science: null, capcom: null }; st.onTime = a.t - st.t0 <= DIFF[st.diff].time * 1000; st.t0 = a.t; break;
    case "vote": ROLES.forEach((r) => { if (st.roles[r] === pid) st.votes[r] = a.go; }); break;
    case "back": st.phase = "design"; break;
    case "go": st.seed = (st.seed ^ hash("go" + a.t)) | 0; startSim(st, a.t); break;
    case "launch": doLaunch(st, a.rating, a.t || st.t0); break;
    case "capture": doCapture(st, a.rating, a.dvUsed, a.captured); break;
    case "auto": if (st.phase === "launch") doLaunch(st, 0.5, a.t); else doCapture(st, 0.5, capDv(st.design.orbit) * 1.15, true); break;
    case "next": { st.sim.round++; const id = st.sim.plan[st.sim.round - 1]; if (id) makeEvent(st, id, isNum(a.t) ? a.t : 0); else finishRound(st, 1); break; }
    case "respond": resolveEvent(st, a.opt, Math.min(a.ms, 600000), isNum(a.t) ? a.t : st.event.t0); break;
    case "timeout": resolveEvent(st, st.event.def, 45000, a.t); break;
    case "again": {
      st.attempt++;
      if (a.mode === "lobby") { st.phase = "lobby"; st.design = null; st.sim = null; st.report = null; }
      else if (a.mode === "design") { st.phase = "design"; st.t0 = a.t; st.sim = null; st.report = null; }
      else { st.phase = "review"; st.votes = { director: null, engineer: null, science: null, capcom: null }; st.t0 = a.t; st.sim = null; st.report = null; }
      break;
    }
  }
  return st;
}

export function isGameOver() { return { over: false }; }

export function viewFor(st, pid) {
  const S = SCN[st.scn], me = st.players.some((p) => p.id === pid), myRoles = ROLES.filter((r) => st.roles[r] === pid);
  const v = { phase: st.phase, scnId: st.scn, diff: st.diff, host: st.host, known: me, myRoles, attempt: st.attempt, roles: st.roles, players: st.players.map((p) => ({ id: p.id, name: p.name, roles: ROLES.filter((r) => st.roles[r] === p.id) })) };
  if (st.phase === "lobby") {
    v.scns = Object.keys(SCN).map((k) => ({ id: k, n: SCN[k].n, tag: SCN[k].tag, brief: SCN[k].brief, budget: money(SCN[k].budget * DIFF[st.diff].b), years: SCN[k].years }));
    v.diffs = Object.keys(DIFF).map((k) => ({ id: k, n: DIFF[k].n, d: DIFF[k].d }));
    return v;
  }
  const M = compute(S, st.design, st.diff), hints = DIFF[st.diff].hints;
  v.scn = { n: S.n, tag: S.tag, body: S.body, client: S.client, brief: S.brief, crit: S.crit, years: S.years, budget: money(M.budget) };
  v.design = st.design;
  v.M = Object.assign({}, M, { issues: undefined, reqs: undefined });
  v.reqs = M.reqs;
  v.issues = M.issues.map((x) => ({ role: x.role, sev: x.sev, msg: x.msg, fix: hints ? x.fix : "", go: hints ? x.go : null }));
  v.cards = myRoles.map((r) => ({ role: r, text: CARDS[r][st.cards[r]][0].replace("{n}", S.cardInst) }));
  v.t0 = st.t0; v.timeLimit = DIFF[st.diff].time; v.fixes = st.fixes || 0;
  if (st.phase === "design" || st.phase === "review" || st.phase === "brief") v.controls = controls(S, st.design, st.diff);
  if (st.phase === "review") v.votes = st.votes;
  if (st.sim) {
    const s = st.sim;
    v.sim = { round: s.round, total: s.total, alive: s.alive, dv: s.dv, qual: s.qual, sciPct: Math.min(1, s.sci / S.sciRef), lost: s.lost, log: s.log, det: s.det, launch: s.launch, capture: s.capture, period: s.period, extra: s.extra };
    if (st.phase === "launch") v.game = { alt: S.body !== "earth" ? 200 : ORB[st.design.orbit].alt, rocket: ROCKET[st.design.rocket].n, guide: st.diff !== "director", assist: st.diff === "cadet" };
    if (st.phase === "capture") v.game = { body: S.body, orbit: st.design.orbit, target: ORB[st.design.orbit].tgt, fuel: Math.max(0, s.dv - 0.05) / (capDv(st.design.orbit) - (ORB[st.design.orbit].aero ? 0.12 : 0)), guide: st.diff !== "director" };
    if (s.det) v.fires = HOT;
  }
  if (st.event) v.event = st.diff === "cadet" ? st.event : Object.assign({}, st.event, { tip: "" });
  if (st.report) v.report = st.report;
  return v;
}
