// Skyhook Senja — shared tuning and mission definitions.
// Everything the other modules need to agree on lives here: canvas size,
// flight model constants, world layout and the three sorties.

export const VIEW_W = 1280;
export const VIEW_H = 800;

// Screen line of the sea in pixels; altitude (m) maps to pixels above it.
export const SEA_Y = 692;
export const ALT_SCALE = 1.55; // px per metre of altitude

// Flight model.
export const FLIGHT = {
  maxSpeed: 58,        // m/s at full throttle
  stallSpeed: 17,      // m/s — below this the nose drops
  accel: 9,            // m/s^2 toward target speed
  drag: 0.12,          // extra drag per second
  pitchRate: 42,       // deg/s of pitch change from the stick
  maxPitch: 26,        // deg
  climbFactor: 0.92,   // how much of speed turns into climb
  sinkRate: 6,         // m/s sink when stalled
  fuelBurn: 0.55,      // % fuel per second at full throttle
  fuelIdle: 0.05,      // % fuel per second at idle
  runwayLength: 280,   // metres of flat strip
};

export const SCORE = {
  ring: 100,
  landing: 500,
  fuelBonusPerPct: 4,
  timeBonusPerSec: 2,
};

// Islands: centre x (m), half-width (m), peak height (m).
export const ISLANDS = [
  { x: 700,  w: 420, h: 52 },
  { x: 2400, w: 520, h: 68 },
  { x: 4300, w: 460, h: 44 },
  { x: 6100, w: 560, h: 74 },
  { x: 7900, w: 480, h: 50 },
  { x: 9800, w: 620, h: 66 },
];

// Runways sit on flat-topped islands: centre x (m), strip elevation (m).
export const RUNWAYS = [
  { id: 'home',   name: 'Senja Field',  x: 700,  alt: 52, heading: 90 },
  { id: 'kelapa', name: 'Kelapa Strip', x: 2400, alt: 68, heading: 90 },
  { id: 'karang', name: 'Karang Strip', x: 6100, alt: 74, heading: 90 },
  { id: 'senja',  name: 'Senja Far',    x: 9800, alt: 66, heading: 90 },
];

export const MISSIONS = [
  {
    id: 'ring-run',
    index: 0,
    name: 'Ring Run',
    tag: '8 SKY RINGS',
    desc: 'Thread all 8 glowing sky rings before the fuel runs dry. Chain them for combo bonus.',
    fuel: 100,
    startX: 300,
    startAlt: 120,
    rings: [
      { x: 1150, alt: 150 }, { x: 1950, alt: 210 }, { x: 2900, alt: 120 },
      { x: 3800, alt: 230 }, { x: 4750, alt: 160 }, { x: 5600, alt: 240 },
      { x: 6650, alt: 130 }, { x: 7600, alt: 200 },
    ],
    landings: [],
    storm: false,
    birds: 0,
    timeLimit: 240,
  },
  {
    id: 'island-hop',
    index: 1,
    name: 'Island Hop',
    tag: '2 SHORT STRIPS',
    desc: 'Land soft on Kelapa Strip, take off again, then grease it on Karang Strip. Hard touchdowns hurt.',
    fuel: 100,
    startX: 300,
    startAlt: 120,
    rings: [
      { x: 1500, alt: 180 }, { x: 3300, alt: 170 }, { x: 5200, alt: 190 },
    ],
    landings: ['kelapa', 'karang'],
    storm: false,
    birds: 2,
    timeLimit: 300,
  },
  {
    id: 'storm-run',
    index: 2,
    name: 'Storm Run',
    tag: 'THROUGH THE STORM',
    desc: 'Punch through the storm wall and the bird flocks to reach Senja Far. Fuel is tight — fly clean.',
    fuel: 78,
    startX: 300,
    startAlt: 120,
    rings: [
      { x: 2100, alt: 190 }, { x: 4700, alt: 150 }, { x: 7300, alt: 210 },
    ],
    landings: ['senja'],
    storm: true,
    birds: 7,
    timeLimit: 300,
  },
];

// Deterministic pseudo-random from a seed (mulberry32 style).
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
