// Skyhook Senja — deterministic screenshot poses.
// ?shot=start|play|ring|end&seed=1 sets the game into a fixed, readable
// pose so screenshots are reproducible renders of the real game code.
// Nothing here is a mock: the same state machine runs in every mode.

import { MISSIONS } from './config.js';
import { makePlane } from './physics.js';
import { startMission } from './missions.js';
import { makeClouds } from './terrain.js';
import { seededRandom } from './config.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = Number(q.get('seed') || 1);
  if (!shot) return null;
  return { shot, seed };
}

// Returns a fully posed game state for the requested shot, or null.
export function poseForShot(shot, seed) {
  const rnd = seededRandom(seed * 7919 + 13);
  const clouds = makeClouds(seed);

  if (shot === 'start') {
    const mission = startMission(0);
    const plane = makePlane(MISSIONS[0]);
    plane.x = 560;
    plane.alt = 52; // parked on Senja Field
    plane.speed = 0;
    plane.throttle = 0;
    plane.onGround = true;
    return {
      screen: 'title',
      selectedMission: 0,
      missionDefs: MISSIONS,
      mission,
      plane,
      clouds,
      camX: 160,
      birds: [],
      target: null,
      time: 3.2,
    };
  }

  if (shot === 'play') {
    const mission = startMission(0);
    const plane = makePlane(MISSIONS[0]);
    plane.x = 1760;
    plane.alt = 196;
    plane.speed = 41;
    plane.pitch = 6;
    plane.throttle = 0.72;
    plane.fuel = 78;
    mission.score = 100;
    mission.combo = 1;
    mission.bestCombo = 1;
    mission.ringsPassed = 1;
    mission.rings[0].passed = true;
    mission.time = 62;
    mission.message = 'RING 1  +100';
    mission.messageT = 2.0;
    return {
      screen: 'playing',
      selectedMission: 0,
      missionDefs: MISSIONS,
      mission,
      plane,
      clouds,
      camX: plane.x - 430,
      birds: [],
      target: { kind: 'ring', x: 1950, alt: 210 },
      time: 3.2,
    };
  }

  if (shot === 'ring') {
    const mission = startMission(0);
    const plane = makePlane(MISSIONS[0]);
    plane.x = 2894;
    plane.alt = 118;
    plane.speed = 44;
    plane.pitch = 4;
    plane.throttle = 0.8;
    plane.fuel = 71;
    mission.score = 400;
    mission.combo = 3;
    mission.bestCombo = 3;
    mission.ringsPassed = 3;
    mission.rings[0].passed = true;
    mission.rings[1].passed = true;
    mission.rings[2].passed = true;
    mission.rings[2].flash = 0.9;
    mission.time = 88;
    mission.message = 'RING 3  +300  COMBO x3';
    mission.messageT = 2.4;
    return {
      screen: 'playing',
      selectedMission: 0,
      missionDefs: MISSIONS,
      mission,
      plane,
      clouds,
      camX: plane.x - 430,
      birds: [],
      target: { kind: 'ring', x: 3800, alt: 230 },
      time: 3.2,
    };
  }

  if (shot === 'end') {
    const mission = startMission(0);
    const plane = makePlane(MISSIONS[0]);
    plane.x = 7600;
    plane.alt = 200;
    plane.speed = 38;
    plane.pitch = 2;
    plane.throttle = 0.5;
    plane.fuel = 34;
    mission.score = 1250;
    mission.combo = 0;
    mission.bestCombo = 4;
    mission.ringsPassed = 8;
    mission.rings.forEach((r) => { r.passed = true; });
    mission.time = 171;
    mission.fuelBonus = 136;
    mission.timeBonus = 138;
    mission.score = 800 + mission.fuelBonus + mission.timeBonus + 176;
    mission.status = 'complete';
    mission.statusReason = 'ALL RINGS CLEARED';
    return {
      screen: 'end',
      selectedMission: 0,
      missionDefs: MISSIONS,
      mission,
      plane,
      clouds,
      camX: plane.x - 430,
      birds: [],
      target: null,
      time: 3.2,
    };
  }

  return null;
}
