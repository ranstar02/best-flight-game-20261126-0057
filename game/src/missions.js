// Skyhook Senja — mission state machine and scoring.
// One mission = one sortie. Tracks rings, landings, fuel, damage, time
// and turns events into score. The game loop owns the plane; this owns
// what the sortie means.

import { MISSIONS, RUNWAYS, SCORE, clamp } from './config.js';
import { makeRings, checkRings, ringsLeft, nextRing } from './rings.js';
import { runwayAt, terrainHeight, inStorm } from './terrain.js';
import { landingQuality } from './physics.js';

export function startMission(index) {
  const def = MISSIONS[index];
  return {
    def,
    rings: makeRings(def.rings),
    score: 0,
    combo: 0,
    bestCombo: 0,
    ringsPassed: 0,
    landingsDone: [],
    nextLanding: 0, // index into def.landings
    time: 0,
    status: 'flying', // flying | complete | crashed | ditched | outoffuel
    statusReason: '',
    message: '',
    messageT: 0,
    stormT: 0,      // seconds inside a storm cell (damage ticks)
    birdHits: 0,
    timeBonus: 0,
    fuelBonus: 0,
  };
}

export function missionRunway(m) {
  const id = m.def.landings[m.nextLanding];
  if (!id) return null;
  return RUNWAYS.find((r) => r.id === id) ?? null;
}

// Called every frame while flying. Returns an event string for audio:
// 'ring' | 'landed' | 'crash' | 'storm' | 'bird' | null.
export function updateMission(m, plane, dt) {
  m.time += dt;
  if (m.messageT > 0) m.messageT -= dt;

  // Rings.
  const hit = checkRings(m.rings, plane);
  if (hit) {
    m.combo += 1;
    m.bestCombo = Math.max(m.bestCombo, m.combo);
    m.ringsPassed += 1;
    const pts = SCORE.ring * m.combo;
    m.score += pts;
    setMessage(m, `RING ${hit.number}  +${pts}${m.combo > 1 ? `  COMBO x${m.combo}` : ''}`);
    if (m.def.id === 'ring-run' && ringsLeft(m.rings) === 0) {
      finishMission(m, plane, 'complete', 'ALL RINGS CLEARED');
      return 'ring';
    }
    return 'ring';
  }

  // Storm damage: lingering inside a cell shakes the plane and hurts.
  if (m.def.storm && inStorm(plane.x, plane.alt)) {
    m.stormT += dt;
    if (m.stormT > 0.9) {
      m.stormT = 0;
      plane.damage = clamp(plane.damage + 6, 0, 100);
      setMessage(m, 'STORM! HOLD HER STEADY');
      if (plane.damage >= 100) {
        finishMission(m, plane, 'crashed', 'TORN APART BY THE STORM');
        return 'crash';
      }
      return 'storm';
    }
  } else {
    m.stormT = 0;
  }

  // Ground / sea contact.
  const ground = terrainHeight(plane.x);
  const rw = runwayAt(plane.x);
  if (plane.alt <= ground + 1.5 && !plane.onGround) {
    const quality = landingQuality(plane, ground);
    const target = missionRunway(m);
    if (rw && target && rw.id === target.id && quality) {
      // A landing on the strip we were sent to.
      plane.onGround = true;
      plane.alt = ground;
      m.landingsDone.push(rw.id);
      m.nextLanding += 1;
      const pts = SCORE.landing + (quality === 'perfect' ? 150 : 0);
      m.score += pts;
      setMessage(m, quality === 'perfect'
        ? `GREASED IT! ${rw.name} +${pts}`
        : quality === 'firm'
          ? `DOWN ON ${rw.name} +${pts}`
          : `HARD LANDING! ${rw.name} +${pts}`);
      if (quality === 'hard') plane.damage = clamp(plane.damage + 18, 0, 100);
      if (m.nextLanding >= m.def.landings.length) {
        finishMission(m, plane, 'complete', 'ALL STRIPS LANDED');
      }
      return 'landed';
    }
    if (rw && quality && (!target || rw.id !== target.id)) {
      // Landed somewhere, but not the assigned strip: roll, no score.
      plane.onGround = true;
      plane.alt = ground;
      setMessage(m, `${rw.name} — WRONG STRIP, TAKE OFF AGAIN`);
      return 'landed';
    }
    // Anything else at ground level is a crash.
    finishMission(m, plane, ground < 2 ? 'ditched' : 'crashed',
      ground < 2 ? 'DITCHED IN THE SEA' : 'TERRAIN STRIKE');
    return 'crash';
  }

  // Fuel out: glide, but if we cannot reach a strip it ends the sortie.
  if (plane.fuel <= 0 && plane.throttle <= 0.02) {
    plane.throttle = 0;
    if (plane.speed < 8 && plane.alt <= ground + 30) {
      finishMission(m, plane, 'outoffuel', 'OUT OF FUEL — GLIDE ENDED SHORT');
      return 'crash';
    }
  }

  // Time limit.
  if (m.time > m.def.timeLimit) {
    finishMission(m, plane, 'outoffuel', 'TIME UP — SORTIE OVER');
    return 'crash';
  }

  return null;
}

export function finishMission(m, plane, status, reason) {
  m.status = status;
  m.statusReason = reason;
  if (status === 'complete') {
    m.fuelBonus = Math.round(plane.fuel) * SCORE.fuelBonusPerPct;
    const left = Math.max(0, m.def.timeLimit - m.time);
    m.timeBonus = Math.round(left) * SCORE.timeBonusPerSec;
    m.score += m.fuelBonus + m.timeBonus;
  }
  m.message = reason;
  m.messageT = 4;
}

export function setMessage(m, text) {
  m.message = text;
  m.messageT = 2.6;
}

export function missionProgress(m) {
  if (m.def.id === 'ring-run') return `${m.ringsPassed}/${m.def.rings.length} RINGS`;
  if (m.def.landings.length) return `${m.landingsDone.length}/${m.def.landings.length} LANDINGS`;
  return `${m.ringsPassed} RINGS`;
}

export function nextTarget(m) {
  const ring = nextRing(m.rings);
  const rw = missionRunway(m);
  if (m.def.id === 'ring-run') return ring ? { kind: 'ring', x: ring.x, alt: ring.alt } : null;
  if (rw && (!ring || rw.x < ring.x)) return { kind: 'runway', x: rw.x, alt: rw.alt };
  if (ring) return { kind: 'ring', x: ring.x, alt: ring.alt };
  return rw ? { kind: 'runway', x: rw.x, alt: rw.alt } : null;
}
