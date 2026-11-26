// Skyhook Senja — game loop, screen state machine and wiring.
// Screens: title → playing ⇄ paused → end. The loop steps physics and
// the mission, feeds audio, and draws every frame.

import { VIEW_W, VIEW_H, MISSIONS, clamp } from './config.js';
import { makePlane, stepPlane } from './physics.js';
import { terrainHeight, makeClouds, inStorm } from './terrain.js';
import { startMission, updateMission, nextTarget, setMessage } from './missions.js';
import { tickRings } from './rings.js';
import { makeInput, inRect } from './input.js';
import { makeAudio } from './audio.js';
import { render, missionCardRects } from './render.js';
import { parseShot, poseForShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = makeInput(canvas);
const audio = makeAudio();

const game = {
  screen: 'title',
  selectedMission: 0,
  missionDefs: MISSIONS,
  mission: startMission(0),
  plane: makePlane(MISSIONS[0]),
  clouds: makeClouds(1),
  camX: 0,
  birds: [],
  target: null,
  time: 0,
  hover: null,
  missionRects: missionCardRects(),
};

function makeBirds(n, seed) {
  const birds = [];
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    birds.push({
      x: 1500 + rnd() * 8500,
      alt: 120 + rnd() * 160,
      phase: rnd() * 6.28,
      vx: 6 + rnd() * 8,
    });
  }
  return birds;
}

function startSortie(index) {
  game.selectedMission = index;
  game.mission = startMission(index);
  game.plane = makePlane(MISSIONS[index]);
  game.birds = makeBirds(MISSIONS[index].birds, 41 + index * 17);
  game.camX = game.plane.x - 430;
  game.target = nextTarget(game.mission);
  game.screen = 'playing';
  setMessage(game.mission, `${MISSIONS[index].name.toUpperCase()} — FLY!`);
  audio.unlock();
  audio.click();
}

function endSortieToTitle() {
  game.screen = 'title';
  game.mission = startMission(game.selectedMission);
  game.plane = makePlane(MISSIONS[game.selectedMission]);
  game.plane.x = 560;
  game.plane.alt = 52;
  game.plane.speed = 0;
  game.plane.throttle = 0;
  game.plane.onGround = true;
  game.camX = 160;
  game.birds = [];
}

function update(dt) {
  game.time += dt;

  // Edge-triggered keys.
  if (input.consumePressed('mute')) {
    const muted = audio.toggleMute();
    setMessage(game.mission, muted ? 'SOUND OFF' : 'SOUND ON');
  }

  if (game.screen === 'title') {
    const click = input.consumeClick();
    if (click) {
      const rects = missionCardRects();
      for (let i = 0; i < rects.length; i++) {
        if (inRect(click, rects[i])) { startSortie(i); return; }
      }
    }
    if (input.consumePressed('restart')) startSortie(game.selectedMission);
    // Idle plane parked on the home strip, prop idling.
    game.plane.throttle = 0.12;
    return;
  }

  if (game.screen === 'playing') {
    if (input.consumePressed('pause')) {
      game.screen = 'paused';
      audio.update(0, 0, false);
      return;
    }
    if (input.consumePressed('restart')) { startSortie(game.selectedMission); return; }

    const keys = input.keys;
    const wasGround = game.plane.onGround;
    stepPlane(game.plane, keys, dt, terrainHeight);
    tickRings(game.mission.rings, dt);

    // Birds drift and can clip the plane.
    for (const b of game.birds) {
      b.x += b.vx * dt;
      if (Math.abs(b.x - game.plane.x) < 26 && Math.abs(b.alt - game.plane.alt) < 14) {
        game.plane.damage = clamp(game.plane.damage + 12, 0, 100);
        b.x = game.plane.x + 900; // shoo it away after the hit
        setMessage(game.mission, 'BIRD STRIKE! -12% AIRFRAME');
        audio.crash();
        if (game.plane.damage >= 100) {
          game.mission.status = 'crashed';
          game.mission.statusReason = 'AIRFRAME LOST TO BIRD STRIKES';
          game.screen = 'end';
          audio.update(0, 0, false);
          return;
        }
      }
    }

    const ev = updateMission(game.mission, game.plane, dt);
    if (ev === 'ring') audio.ring(game.mission.combo);
    if (ev === 'landed') audio.thud();
    if (ev === 'crash') { audio.crash(); game.screen = 'end'; }
    if (ev === 'storm') audio.crash();
    if (game.mission.status === 'complete' && game.screen === 'playing') {
      game.screen = 'end';
      audio.fanfare();
    }
    if (game.mission.status !== 'flying' && game.screen === 'playing') {
      game.screen = 'end';
    }
    if (wasGround && !game.plane.onGround) setMessage(game.mission, 'AIRBORNE — GEAR UP, FLY THE RINGS');

    // Camera follows the plane, clamped to the world start.
    game.camX = Math.max(-40, game.plane.x - 430);
    game.target = nextTarget(game.mission);
    audio.update(game.plane.throttle, game.plane.speed, !game.plane.onGround);
    return;
  }

  if (game.screen === 'paused') {
    if (input.consumePressed('pause')) { game.screen = 'playing'; return; }
    if (input.consumePressed('restart')) { startSortie(game.selectedMission); return; }
    const click = input.consumeClick();
    if (click) game.screen = 'playing';
    return;
  }

  if (game.screen === 'end') {
    audio.update(0, 0, false);
    if (input.consumePressed('restart')) { startSortie(game.selectedMission); return; }
    const click = input.consumeClick();
    if (click) endSortieToTitle();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(ctx, game, game.time);
  requestAnimationFrame(frame);
}

// Track mouse hover for title card highlight.
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  game.hover = {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
});

// Deterministic screenshot poses (?shot=...&seed=1): render one frozen
// frame of the real game state, no loop needed beyond a single draw.
const shot = parseShot();
if (shot) {
  const posed = poseForShot(shot.shot, shot.seed);
  if (posed) {
    Object.assign(game, posed);
    game.time = posed.time;
    render(ctx, game, game.time);
    window.__skyhook = game;
    document.title = `Skyhook Senja — shot ${shot.shot}`;
  } else {
    requestAnimationFrame(frame);
  }
} else {
  // Title screen: plane parked on Senja Field.
  game.plane.x = 560;
  game.plane.alt = 52;
  game.plane.speed = 0;
  game.plane.throttle = 0;
  game.plane.onGround = true;
  game.camX = 160;
  window.__skyhook = game;
  requestAnimationFrame(frame);
}
