// Skyhook Senja — terrain: island chain, sea and runways.
// The world is a function of x (metres): height above sea level.
// Islands are gaussian bumps; runways flatten the top of their island.

import { ISLANDS, RUNWAYS, FLIGHT, smoothstep, clamp } from './config.js';

const SEED = 20261126;

function baseRoll(x) {
  // Gentle rolling swell between islands, deterministic.
  return 6
    + 9 * Math.sin(x * 0.0016 + 1.7)
    + 5 * Math.sin(x * 0.0041 + 0.4)
    + 3 * Math.sin(x * 0.0093 + 2.9);
}

function islandBump(x) {
  let h = 0;
  for (const isl of ISLANDS) {
    const d = (x - isl.x) / isl.w;
    h += isl.h * Math.exp(-d * d * 2.2);
  }
  return h;
}

export function terrainHeight(x) {
  let h = baseRoll(x) + islandBump(x);
  // Flatten a shelf around every runway so the strip is landable.
  for (const rw of RUNWAYS) {
    const half = FLIGHT.runwayLength / 2 + 60;
    const d = Math.abs(x - rw.x);
    if (d < half) {
      const t = smoothstep(half, half * 0.45, d);
      h = h + (rw.alt - h) * t;
    }
  }
  return h;
}

export function isSea(x) {
  return terrainHeight(x) < 2;
}

export function runwayAt(x) {
  for (const rw of RUNWAYS) {
    if (Math.abs(x - rw.x) <= FLIGHT.runwayLength / 2) return rw;
  }
  return null;
}

// Seeded cloud puffs for the sky (screen-space parallax, world-anchored).
export function makeClouds(seed) {
  let s = (seed ^ SEED) >>> 0;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: rnd() * 11000,
      y: 40 + rnd() * 260,
      w: 90 + rnd() * 190,
      h: 18 + rnd() * 26,
      par: 0.25 + rnd() * 0.5,
      dark: rnd() < 0.22,
    });
  }
  return clouds;
}

// Storm cells for Storm Run: world x ranges where the sky turns ugly.
export const STORM_CELLS = [
  { x0: 3400, x1: 4600, top: 60, bottom: 300 },
  { x0: 5800, x1: 7200, top: 80, bottom: 320 },
  { x0: 8300, x1: 9300, top: 50, bottom: 280 },
];

export function inStorm(x, alt) {
  for (const c of STORM_CELLS) {
    if (x >= c.x0 && x <= c.x1 && alt >= c.top && alt <= c.bottom) return c;
  }
  return null;
}
