// Skyhook Senja — flight physics for the bush plane.
// Pure step function: given plane state + inputs + dt, returns the new state.
// No drawing here, so the model can be reasoned about on its own.

import { FLIGHT, clamp } from './config.js';

export function makePlane(mission) {
  return {
    x: mission.startX,          // metres along the world
    alt: mission.startAlt,      // metres above sea level
    speed: 24,                  // m/s
    pitch: 0,                   // deg, + = nose up
    throttle: 0.55,             // 0..1
    fuel: mission.fuel,         // percent
    vy: 0,                      // vertical speed m/s (for landing read-out)
    onGround: false,
    stalled: false,
    damage: 0,                  // 0..100
    bank: 0,                    // visual roll deg
  };
}

// inputs: { up, down, left, right, flare } booleans
export function stepPlane(plane, inputs, dt, terrainHeightAt) {
  const F = FLIGHT;

  if (plane.onGround) {
    // Rolling on a strip: throttle builds speed, flare/brake slows us.
    if (inputs.right) plane.throttle = clamp(plane.throttle + 0.7 * dt, 0, 1);
    if (inputs.left) plane.throttle = clamp(plane.throttle - 0.7 * dt, 0, 1);
    const target = plane.throttle * F.maxSpeed;
    plane.speed += (target - plane.speed) * clamp(2.2 * dt, 0, 1);
    if (inputs.flare) plane.speed = Math.max(0, plane.speed - 26 * dt);
    plane.x += plane.speed * dt;
    plane.alt = terrainHeightAt(plane.x);
    plane.vy = 0;
    plane.pitch = 0;
    if (plane.speed > F.stallSpeed + 6 && plane.throttle > 0.6) {
      plane.onGround = false; // rotate!
      plane.pitch = 6;
    }
    plane.fuel = Math.max(0, plane.fuel - (F.fuelIdle + plane.throttle * F.fuelBurn * 0.4) * dt);
    plane.bank = 0;
    return plane;
  }

  // Throttle.
  if (inputs.right) plane.throttle = clamp(plane.throttle + 0.55 * dt, 0, 1);
  if (inputs.left) plane.throttle = clamp(plane.throttle - 0.55 * dt, 0, 1);

  // Pitch from the stick; flare flattens the nose for landing.
  let pitchTarget = 0;
  if (inputs.up) pitchTarget = F.maxPitch;
  if (inputs.down) pitchTarget = -F.maxPitch;
  if (inputs.flare) pitchTarget = clamp(pitchTarget, -4, 4);
  const rate = F.pitchRate * dt;
  plane.pitch += clamp(pitchTarget - plane.pitch, -rate, rate);

  // Speed chases the throttle, with drag.
  const targetSpeed = plane.throttle * F.maxSpeed;
  plane.speed += (targetSpeed - plane.speed) * clamp(F.accel / F.maxSpeed * dt * 2.4, 0, 1);
  plane.speed -= plane.speed * F.drag * dt * 0.25;
  plane.speed = Math.max(0, plane.speed);

  // Stall: too slow and the nose drops, altitude bleeds.
  plane.stalled = plane.speed < F.stallSpeed;
  if (plane.stalled) {
    plane.pitch = Math.max(plane.pitch - 30 * dt, -18);
  }

  // Vertical motion: climb from pitch, sink when stalled or slow.
  const climb = Math.sin((plane.pitch * Math.PI) / 180) * plane.speed * F.climbFactor;
  const sink = plane.stalled ? F.sinkRate : Math.max(0, (F.stallSpeed - plane.speed) * 0.12);
  plane.vy = climb - sink;
  plane.alt += plane.vy * dt;
  plane.x += Math.cos((plane.pitch * Math.PI) / 180) * plane.speed * dt;

  // Gentle visual bank follows pitch changes.
  plane.bank = clamp(plane.bank + (plane.pitch * 0.6 - plane.bank) * clamp(4 * dt, 0, 1), -24, 24);

  // Fuel burns with throttle.
  plane.fuel = Math.max(0, plane.fuel - (F.fuelIdle + plane.throttle * F.fuelBurn) * dt);
  return plane;
}

// Landing quality: returns 'perfect' | 'firm' | 'hard' | null (not touching).
export function landingQuality(plane, groundAlt) {
  if (plane.alt > groundAlt + 2.5) return null;
  const vs = Math.abs(plane.vy);
  const pitchOk = Math.abs(plane.pitch) < 10;
  if (vs < 2.2 && pitchOk) return 'perfect';
  if (vs < 4.5 && pitchOk) return 'firm';
  return 'hard';
}
