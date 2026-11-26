// Skyhook Senja — all drawing: dusk sky, island terrain, the bush plane,
// rings, runways, HUD, lit instrument cluster, title / pause / end screens.
// Canvas 2D only, every pixel drawn in code.

import { VIEW_W, VIEW_H, SEA_Y, ALT_SCALE, FLIGHT, RUNWAYS, clamp, lerp } from './config.js';
import { terrainHeight, STORM_CELLS } from './terrain.js';
import { RING_RADIUS } from './rings.js';
import { inRect } from './input.js';

const PLANE_SX = 430; // plane's fixed screen x (chase view)

function screenY(alt) { return SEA_Y - alt * ALT_SCALE; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSky(ctx, time, storm) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  if (storm) {
    g.addColorStop(0, '#2b1a4a'); g.addColorStop(0.45, '#5c2a52');
    g.addColorStop(0.75, '#8a3a3a'); g.addColorStop(1, '#1c1030');
  } else {
    g.addColorStop(0, '#3b1d5e'); g.addColorStop(0.35, '#7a2d6d');
    g.addColorStop(0.62, '#c65a3c'); g.addColorStop(0.8, '#f08a3c');
    g.addColorStop(1, '#2a1240');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Low sun, glowing.
  const sunX = 1010, sunY = 470;
  const sg = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
  sg.addColorStop(0, 'rgba(255, 214, 130, 0.95)');
  sg.addColorStop(0.35, 'rgba(255, 150, 70, 0.55)');
  sg.addColorStop(1, 'rgba(255, 120, 50, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath(); ctx.arc(sunX, sunY, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff9e4d';
  ctx.beginPath(); ctx.arc(sunX, sunY, 52, 0, Math.PI * 2); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
  // Early stars up high.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 26; i++) {
    const sx = (i * 173.3) % VIEW_W;
    const sy = (i * 61.7) % 150;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(time * 0.7 + i));
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawClouds(ctx, camX, clouds, storm) {
  for (const c of clouds) {
    const sx = ((c.x - camX * c.par) % 1500 + 1500) % 1500 - 110;
    const sy = c.y;
    ctx.fillStyle = c.dark || storm ? 'rgba(52, 32, 66, 0.85)' : 'rgba(255, 190, 150, 0.55)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + c.w * 0.28, sy + 6, c.w / 3, c.h / 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - c.w * 0.28, sy + 8, c.w / 3.2, c.h / 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMountains(ctx, camX) {
  // Far ridge, slow parallax.
  ctx.fillStyle = '#4a2560';
  ctx.beginPath();
  ctx.moveTo(0, SEA_Y);
  for (let sx = 0; sx <= VIEW_W; sx += 32) {
    const wx = sx + camX * 0.18;
    const h = 90 + 70 * Math.sin(wx * 0.0021 + 1.2) + 34 * Math.sin(wx * 0.0053 + 4.0);
    ctx.lineTo(sx, SEA_Y - h);
  }
  ctx.lineTo(VIEW_W, SEA_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 170, 110, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, SEA_Y);
  for (let sx = 0; sx <= VIEW_W; sx += 32) {
    const wx = sx + camX * 0.18;
    const h = 90 + 70 * Math.sin(wx * 0.0021 + 1.2) + 34 * Math.sin(wx * 0.0053 + 4.0);
    ctx.lineTo(sx, SEA_Y - h);
  }
  ctx.lineTo(VIEW_W, SEA_Y - 40);
  ctx.lineTo(0, SEA_Y - 40);
  ctx.closePath();
  ctx.fill();
}

function drawSeaAndTerrain(ctx, camX, time) {
  // Sea.
  const sg = ctx.createLinearGradient(0, SEA_Y, 0, VIEW_H);
  sg.addColorStop(0, '#e8763f'); sg.addColorStop(0.25, '#7a3a6e'); sg.addColorStop(1, '#241238');
  ctx.fillStyle = sg;
  ctx.fillRect(0, SEA_Y, VIEW_W, VIEW_H - SEA_Y);
  // Sun glitter on the water.
  ctx.fillStyle = 'rgba(255, 200, 120, 0.5)';
  for (let i = 0; i < 22; i++) {
    const gx = 760 + ((i * 97 + Math.sin(time * 1.3 + i) * 30) % 500);
    const gy = SEA_Y + 12 + ((i * 53) % 88);
    ctx.fillRect(gx, gy, 26 + (i % 3) * 14, 2);
  }
  // Terrain silhouette.
  ctx.beginPath();
  ctx.moveTo(-20, VIEW_H);
  for (let sx = -20; sx <= VIEW_W + 20; sx += 16) {
    const wx = camX + sx;
    const h = terrainHeight(wx);
    ctx.lineTo(sx, screenY(Math.max(h, 0)));
  }
  ctx.lineTo(VIEW_W + 20, VIEW_H);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, 380, 0, SEA_Y);
  tg.addColorStop(0, '#3f6b34'); tg.addColorStop(0.6, '#2c4a26'); tg.addColorStop(1, '#1d3018');
  ctx.fillStyle = tg;
  ctx.fill();
  // Sand fringe where land meets sea.
  ctx.strokeStyle = 'rgba(240, 210, 140, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let sx = -20; sx <= VIEW_W + 20; sx += 16) {
    const wx = camX + sx;
    const h = terrainHeight(wx);
    if (h < 6) continue;
    const y = screenY(h);
    if (sx === -20) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
  }
  ctx.stroke();
  // Palm silhouettes on the islands.
  ctx.strokeStyle = '#16301a';
  ctx.fillStyle = '#16301a';
  ctx.lineWidth = 3;
  for (let sx = 0; sx < VIEW_W; sx += 90) {
    const wx = camX + sx;
    const h = terrainHeight(wx);
    if (h < 26 || Math.sin(wx * 0.37) < 0.2) continue;
    const bx = sx, by = screenY(h);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 4, by - 26); ctx.stroke();
    for (let a = 0; a < 5; a++) {
      const ang = -Math.PI * (0.15 + a * 0.16);
      ctx.beginPath(); ctx.moveTo(bx + 4, by - 26);
      ctx.quadraticCurveTo(bx + 4 + Math.cos(ang) * 14, by - 26 + Math.sin(ang) * 12 - 6,
        bx + 4 + Math.cos(ang) * 24, by - 26 + Math.sin(ang) * 14 + 8);
      ctx.stroke();
    }
  }
}

function drawRunways(ctx, camX, time) {
  for (const rw of RUNWAYS) {
    const cx = rw.x - camX;
    if (cx < -220 || cx > VIEW_W + 220) continue;
    const y = screenY(rw.alt);
    const half = FLIGHT.runwayLength / 2;
    // Strip.
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(cx - half, y - 6, FLIGHT.runwayLength, 12);
    ctx.fillStyle = '#54545e';
    ctx.fillRect(cx - half, y - 6, FLIGHT.runwayLength, 3);
    // Centreline dashes.
    ctx.fillStyle = '#f5e6b0';
    for (let d = -half + 18; d < half - 10; d += 44) ctx.fillRect(cx + d, y - 1.5, 24, 3);
    // Threshold chevrons.
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(cx - half + 4, y - 6, 6, 12);
    ctx.fillRect(cx + half - 10, y - 6, 6, 12);
    // Edge lights, warm glow.
    for (let d = -half + 8; d <= half - 8; d += 36) {
      for (const side of [-10, 10]) {
        const glow = 0.6 + 0.4 * Math.sin(time * 3 + d);
        ctx.fillStyle = `rgba(255, 190, 60, ${glow})`;
        ctx.beginPath(); ctx.arc(cx + d, y + side, 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Windsock.
    const wx = cx + half - 26;
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(wx, y - 6); ctx.lineTo(wx, y - 52); ctx.stroke();
    const wave = Math.sin(time * 4 + rw.x) * 4;
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(wx, y - 52);
    ctx.quadraticCurveTo(wx + 16, y - 50 + wave, wx + 30, y - 44 + wave);
    ctx.lineTo(wx + 30, y - 36 + wave);
    ctx.quadraticCurveTo(wx + 14, y - 40 + wave, wx, y - 44);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(wx + 12, y - 49 + wave * 0.7, 5, 9);
    // Name board.
    ctx.fillStyle = 'rgba(20, 12, 34, 0.85)';
    roundRect(ctx, cx - 62, y - 96, 124, 26, 6); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(rw.name.toUpperCase(), cx, y - 78);
  }
}

function drawRings(ctx, camX, rings, time) {
  for (const ring of rings) {
    const sx = ring.x - camX;
    if (sx < -120 || sx > VIEW_W + 120) continue;
    const sy = screenY(ring.alt);
    const r = RING_RADIUS * ALT_SCALE;
    const pulse = 1 + 0.05 * Math.sin(time * 3 + ring.index);
    const glow = ring.passed ? 0.25 : 0.85;
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.lineWidth = ring.passed ? 5 : 9;
    ctx.strokeStyle = ring.passed ? '#7ee787' : '#ff9a2e';
    ctx.shadowColor = ring.passed ? '#7ee787' : '#ff7a1a';
    ctx.shadowBlur = 18 + ring.flash * 30;
    ctx.beginPath(); ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ring.passed ? '#c8ffd2' : '#ffe1a8';
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // Number plate.
    ctx.fillStyle = ring.passed ? 'rgba(40,90,50,0.9)' : 'rgba(30,14,40,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy - r - 18, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ring.passed ? '#b6ffc4' : '#ffd98a';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(ring.number), sx, sy - r - 12);
    if (ring.flash > 0) {
      ctx.save();
      ctx.globalAlpha = ring.flash * 0.8;
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('RING!', sx, sy - r - 44);
      ctx.restore();
    }
  }
}

function drawBirds(ctx, camX, birds, time) {
  ctx.strokeStyle = '#1c1030';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of birds) {
    const sx = b.x - camX;
    if (sx < -40 || sx > VIEW_W + 40) continue;
    const sy = screenY(b.alt) + Math.sin(time * 2 + b.phase) * 8;
    const flap = Math.sin(time * 9 + b.phase) * 7;
    ctx.beginPath();
    ctx.moveTo(sx - 14, sy - flap);
    ctx.quadraticCurveTo(sx - 5, sy + 2, sx, sy);
    ctx.quadraticCurveTo(sx + 5, sy + 2, sx + 14, sy - flap);
    ctx.stroke();
  }
}

function drawStorm(ctx, camX, plane, time) {
  for (const c of STORM_CELLS) {
    const x0 = c.x0 - camX, x1 = c.x1 - camX;
    if (x1 < -50 || x0 > VIEW_W + 50) continue;
    // Dark cell mass.
    ctx.fillStyle = 'rgba(30, 18, 48, 0.55)';
    for (let i = 0; i < 8; i++) {
      const cx = x0 + ((i * 173) % Math.max(60, x1 - x0));
      const cy = screenY(c.top + 40 + (i % 4) * 55);
      ctx.beginPath(); ctx.ellipse(cx, cy, 120, 60, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Rain streaks.
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const rx = x0 + ((i * 89 + time * 220) % Math.max(80, x1 - x0));
      const ry = screenY(c.bottom) - ((i * 61 + time * 260) % 260);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 26); ctx.stroke();
    }
    // Lightning flicker.
    if (Math.sin(time * 0.9 + c.x0) > 0.86) {
      ctx.fillStyle = 'rgba(255, 250, 200, 0.18)';
      ctx.fillRect(Math.max(0, x0), 0, Math.min(VIEW_W, x1) - Math.max(0, x0), VIEW_H);
    }
  }
}

function drawPlane(ctx, plane, time, camX) {
  const sx = PLANE_SX;
  const sy = screenY(plane.alt);
  const propAngle = time * (18 + plane.throttle * 42);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((-plane.pitch * Math.PI) / 180);
  ctx.rotate((plane.bank * 0.35 * Math.PI) / 180);
  if (plane.stalled) ctx.globalAlpha = 0.92;
  // Shadow on the ground below (when low).
  ctx.restore();
  if (plane.alt < 220) {
    const gy = screenY(terrainHeight(plane.x));
    const fade = clamp(1 - plane.alt / 220, 0.15, 0.5);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#120a20';
    ctx.beginPath(); ctx.ellipse(sx, gy + 4, 46, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((-plane.pitch * Math.PI) / 180);
  // Tail.
  ctx.fillStyle = '#e8542f';
  ctx.beginPath();
  ctx.moveTo(-34, -4); ctx.lineTo(-52, -22); ctx.lineTo(-44, -2); ctx.lineTo(-52, 6); ctx.lineTo(-34, 4);
  ctx.closePath(); ctx.fill();
  // Rear fuselage + wing.
  ctx.fillStyle = '#ff8a3c';
  ctx.beginPath(); ctx.ellipse(-6, 6, 26, 7, -0.18, 0, Math.PI * 2); ctx.fill();
  // Main wing (high wing, bush plane).
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath(); ctx.ellipse(2, -12, 30, 6, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b97a1e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-10, 8); ctx.moveTo(8, -6); ctx.lineTo(12, 8); ctx.stroke();
  // Fuselage.
  const fg = ctx.createLinearGradient(0, -14, 0, 12);
  fg.addColorStop(0, '#fff3d6'); fg.addColorStop(0.55, '#ffb35c'); fg.addColorStop(1, '#e8542f');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.quadraticCurveTo(-30, -13, -2, -13);
  ctx.quadraticCurveTo(26, -13, 40, -4);
  ctx.quadraticCurveTo(46, 0, 40, 4);
  ctx.quadraticCurveTo(20, 12, -6, 12);
  ctx.quadraticCurveTo(-30, 12, -38, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a2f14'; ctx.lineWidth = 1.5; ctx.stroke();
  // Cabin windows.
  ctx.fillStyle = '#bfe8ff';
  ctx.beginPath(); ctx.ellipse(8, -6, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(22, -4, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(8, -6, 9, 6, 0, 0, Math.PI * 2); ctx.stroke();
  // Livery stripe + call sign.
  ctx.fillStyle = '#7a1f3d';
  ctx.fillRect(-34, 2, 66, 3);
  ctx.fillStyle = '#7a1f3d';
  ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('SKYHOOK', -2, -15);
  // Fixed gear.
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-14, 10); ctx.lineTo(-18, 20); ctx.moveTo(10, 10); ctx.lineTo(14, 20); ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-18, 21, 5, 0, Math.PI * 2); ctx.arc(14, 21, 5, 0, Math.PI * 2); ctx.fill();
  // Spinning prop + spinner.
  ctx.save();
  ctx.translate(44, -2);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(40, 24, 16, 0.75)';
  ctx.beginPath(); ctx.ellipse(0, -20, 4, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 20, 4, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath(); ctx.arc(44, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Nav lights.
  const blink = Math.sin(time * 5) > 0;
  if (blink) {
    ctx.fillStyle = '#ff4040';
    ctx.beginPath(); ctx.arc(sx - 38, sy - 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#7ee787';
  ctx.beginPath(); ctx.arc(sx + 40, sy - 8, 2.5, 0, Math.PI * 2); ctx.fill();
}

// ---- HUD ----

function hudBar(ctx, game) {
  const { plane, mission } = game;
  ctx.fillStyle = 'rgba(16, 8, 32, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 62);
  ctx.fillStyle = '#ff9a2e';
  ctx.fillRect(0, 62, VIEW_W, 3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const items = [
    { label: 'ALT', value: `${Math.max(0, Math.round(plane.alt))} m`, x: 18 },
    { label: 'SPD', value: `${Math.round(plane.speed * 3.6)} km/h`, x: 158 },
    { label: 'HDG', value: '090° E', x: 330 },
    { label: 'THR', value: `${Math.round(plane.throttle * 100)}%`, x: 452 },
    { label: 'SCORE', value: String(mission.score), x: 560 },
  ];
  for (const it of items) {
    ctx.fillStyle = '#c9a8e8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(it.label, it.x, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(it.value, it.x, 50);
  }
  // Compass strip.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(330, 56, 120, 0);
  // Fuel gauge.
  const fx = 760, fy = 16, fw = 150, fh = 18;
  ctx.fillStyle = '#2a1a44';
  roundRect(ctx, fx, fy, fw, fh, 5); ctx.fill();
  const fuelW = fw * clamp(plane.fuel / 100, 0, 1);
  ctx.fillStyle = plane.fuel < 20 ? '#ff4040' : plane.fuel < 45 ? '#ffb13c' : '#7ee787';
  if (fuelW > 2) { roundRect(ctx, fx, fy, fuelW, fh, 5); ctx.fill(); }
  ctx.strokeStyle = '#c9a8e8'; ctx.lineWidth = 1.5;
  roundRect(ctx, fx, fy, fw, fh, 5); ctx.stroke();
  ctx.fillStyle = '#c9a8e8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('FUEL', fx, fy - 2 + 12 - 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${Math.round(plane.fuel)}%`, fx + fw + 8, fy + 15);
  // Mission progress + timer, right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#c9a8e8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(mission.def.name.toUpperCase(), VIEW_W - 18, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  const tLeft = Math.max(0, mission.def.timeLimit - mission.time);
  ctx.fillText(`${missionProgressText(game)}  ·  ${fmtTime(tLeft)}`, VIEW_W - 18, 50);
  ctx.textAlign = 'left';
}

function missionProgressText(game) {
  const m = game.mission;
  if (m.def.id === 'ring-run') return `${m.ringsPassed}/${m.def.rings.length} RINGS`;
  if (m.def.landings.length) return `${m.landingsDone.length}/${m.def.landings.length} LAND`;
  return `${m.ringsPassed} RINGS`;
}

function fmtTime(s) {
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function dial(ctx, cx, cy, r, label, valueText, frac, color, ticks) {
  // Instrument dial: dark face, lit ticks, needle.
  ctx.save();
  ctx.fillStyle = '#14102a';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6fb8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255, 217, 138, 0.12)';
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8d8ff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= ticks; i++) {
    const a = -Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5;
    const x1 = cx + Math.cos(a) * (r - 6), y1 = cy + Math.sin(a) * (r - 6);
    const x2 = cx + Math.cos(a) * (r - 12), y2 = cy + Math.sin(a) * (r - 12);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  const na = -Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * (r - 16), cy + Math.sin(na) * (r - 16));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8d8ff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r - 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(valueText, cx, cy + 5);
  ctx.restore();
}

function instrumentCluster(ctx, game) {
  const { plane } = game;
  const x = 16, y = VIEW_H - 168, w = 330, h = 152;
  ctx.fillStyle = 'rgba(16, 8, 32, 0.85)';
  roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#6a4a9a';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12); ctx.stroke();
  ctx.fillStyle = '#c9a8e8';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('INSTRUMENTS', x + 12, y + 18);
  // Stall / damage lamps.
  ctx.fillStyle = plane.stalled ? '#ff4040' : 'rgba(255,64,64,0.18)';
  ctx.beginPath(); ctx.arc(x + w - 52, y + 14, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = plane.stalled ? '#fff' : '#c9a8e8';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('STALL', x + w - 40, y + 18);
  ctx.fillStyle = plane.damage > 40 ? '#ff9a2e' : 'rgba(255,154,46,0.18)';
  ctx.beginPath(); ctx.arc(x + w - 52, y + 34, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = plane.damage > 40 ? '#fff' : '#c9a8e8';
  ctx.fillText('DMG ' + Math.round(plane.damage) + '%', x + w - 40, y + 38);
  // Dials.
  dial(ctx, x + 62, y + 88, 46, 'ALT m', String(Math.max(0, Math.round(plane.alt))),
    clamp(plane.alt / 320, 0, 1), '#ffd94d', 8);
  dial(ctx, x + 158, y + 88, 46, 'SPD km/h', String(Math.round(plane.speed * 3.6)),
    clamp(plane.speed / FLIGHT.maxSpeed, 0, 1), '#7ee787', 8);
  // Artificial horizon.
  const hx = x + 262, hy = y + 88, hr = 44;
  ctx.save();
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#3a6ea8';
  ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate((plane.bank * 0.5 * Math.PI) / 180);
  ctx.translate(0, clamp(plane.pitch, -25, 25) * 1.1);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-hr, 0, hr * 2, hr);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-hr, -1.5, hr * 2, 3);
  ctx.restore();
  ctx.strokeStyle = '#ffd94d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(hx - 26, hy); ctx.lineTo(hx - 8, hy); ctx.moveTo(hx + 8, hy); ctx.lineTo(hx + 26, hy); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#8a6fb8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8d8ff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', hx, hy + hr - 6);
  ctx.textAlign = 'left';
}

function drawTargetArrow(ctx, game) {
  const t = game.target;
  if (!t || game.screen !== 'playing') return;
  const dx = t.x - game.plane.x;
  const dy = t.alt - game.plane.alt;
  const dist = Math.round(Math.hypot(dx, dy));
  const sx = clamp(PLANE_SX + dx * 0.9, 60, VIEW_W - 60);
  const sy = clamp(screenY(game.plane.alt + dy * 0.9), 90, VIEW_H - 200);
  const onScreen = Math.abs(dx) < 620 && Math.abs(dy) < 200;
  if (onScreen) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = t.kind === 'ring' ? '#ff9a2e' : '#7ee787';
  ctx.beginPath();
  const dir = dx > 0 ? 1 : -1;
  ctx.moveTo(sx + dir * 18, sy);
  ctx.lineTo(sx - dir * 10, sy - 12);
  ctx.lineTo(sx - dir * 4, sy);
  ctx.lineTo(sx - dir * 10, sy + 12);
  ctx.closePath(); ctx.fill();
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${t.kind === 'ring' ? 'RING' : 'STRIP'} ${dist}m`, sx, sy + 30);
  ctx.restore();
}

function drawMessage(ctx, game) {
  const m = game.mission;
  if (!m.message || m.messageT <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(m.messageT, 0, 1);
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(16,8,32,0.75)';
  const w = ctx.measureText(m.message).width + 44;
  roundRect(ctx, VIEW_W / 2 - w / 2, 84, w, 52, 10); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(m.message, VIEW_W / 2, 120);
  ctx.restore();
  ctx.textAlign = 'left';
}

// ---- Screens ----

export function missionCardRects() {
  return [
    { x: 140, y: 420, w: 320, h: 170 },
    { x: 480, y: 420, w: 320, h: 170 },
    { x: 820, y: 420, w: 320, h: 170 },
  ];
}

function drawTitle(ctx, game, time) {
  ctx.fillStyle = 'rgba(20, 8, 40, 0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 76px monospace';
  ctx.fillText('SKYHOOK SENJA', VIEW_W / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('A bush-plane dusk run over the island chain', VIEW_W / 2, 192);
  ctx.fillStyle = '#ffb35c';
  ctx.font = '17px monospace';
  ctx.fillText('Thread the rings · Mind your fuel · Land it clean', VIEW_W / 2, 226);
  const rects = missionCardRects();
  game.missionRects = rects;
  rects.forEach((r, i) => {
    const def = game.missionDefs[i];
    const hover = game.hover && inRect(game.hover, r);
    ctx.fillStyle = hover ? 'rgba(60, 30, 90, 0.95)' : 'rgba(24, 12, 48, 0.9)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    ctx.strokeStyle = i === game.selectedMission ? '#ffd94d' : '#6a4a9a';
    ctx.lineWidth = i === game.selectedMission ? 3 : 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(def.tag, r.x + r.w / 2, r.y + 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 58);
    ctx.fillStyle = '#d8c8f0';
    ctx.font = '15px monospace';
    wrapText(ctx, def.desc, r.x + r.w / 2, r.y + 86, r.w - 28, 20);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('CLICK TO FLY  ▸', r.x + r.w / 2, r.y + r.h - 18);
  });
  ctx.fillStyle = '#e8d8ff';
  ctx.font = '15px monospace';
  ctx.fillText('↑/W climb   ↓/S descend   →/D throttle up   ←/A throttle down   SPACE flare/brake   P pause   R restart   M mute', VIEW_W / 2, 700);
  ctx.fillStyle = '#c9a8e8';
  ctx.font = '14px monospace';
  ctx.fillText('Original game · canvas + WebAudio synth · no external assets', VIEW_W / 2, 728);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(16, 8, 32, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px monospace';
  ctx.fillText('PAUSED', VIEW_W / 2, 360);
  ctx.fillStyle = '#ffd98a';
  ctx.font = '20px monospace';
  ctx.fillText('P to resume · R to restart · click anywhere to resume', VIEW_W / 2, 410);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, game) {
  const m = game.mission;
  const won = m.status === 'complete';
  ctx.fillStyle = 'rgba(16, 8, 32, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const px = VIEW_W / 2 - 330, py = 150, pw = 660, ph = 480;
  ctx.fillStyle = 'rgba(24, 12, 48, 0.96)';
  roundRect(ctx, px, py, pw, ph, 18); ctx.fill();
  ctx.strokeStyle = won ? '#7ee787' : '#ff6a4d';
  ctx.lineWidth = 3;
  roundRect(ctx, px, py, pw, ph, 18); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#7ee787' : '#ff8a6a';
  ctx.font = 'bold 46px monospace';
  ctx.fillText(won ? 'MISSION COMPLETE' : 'SORTIE OVER', VIEW_W / 2, py + 70);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(m.statusReason, VIEW_W / 2, py + 108);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  const rows = [
    ['MISSION', m.def.name],
    ['SCORE', String(m.score)],
    ['RINGS', `${m.ringsPassed} / ${m.def.rings.length}`],
    ['LANDINGS', `${m.landingsDone.length} / ${m.def.landings.length}`],
    ['BEST COMBO', `x${m.bestCombo}`],
    ['FUEL BONUS', `+${m.fuelBonus}`],
    ['TIME BONUS', `+${m.timeBonus}`],
    ['FUEL LEFT', `${Math.round(game.plane.fuel)}%`],
    ['TIME', fmtTime(m.time)],
  ];
  let yy = py + 158;
  for (const [k, v] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9a8e8';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(k, px + 60, yy);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(v, px + pw - 60, yy);
    yy += 32;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('CLICK or press R to fly again', VIEW_W / 2, py + ph - 28);
  ctx.textAlign = 'left';
}

// ---- Main render entry ----

export function render(ctx, game, time) {
  const camX = game.camX;
  const storm = game.mission && game.mission.def.storm;
  drawSky(ctx, time, storm && game.screen === 'playing');
  drawClouds(ctx, camX, game.clouds, storm);
  drawMountains(ctx, camX);
  drawSeaAndTerrain(ctx, camX, time);
  drawRunways(ctx, camX, time);
  if (game.screen !== 'title') {
    drawRings(ctx, camX, game.mission.rings, time);
    if (game.birds) drawBirds(ctx, camX, game.birds, time);
    if (storm) drawStorm(ctx, camX, game.plane, time);
  }
  drawPlane(ctx, game.plane, time, camX);
  if (game.screen === 'playing' || game.screen === 'paused') {
    hudBar(ctx, game);
    instrumentCluster(ctx, game);
    drawTargetArrow(ctx, game);
    drawMessage(ctx, game);
    if (game.plane.stalled && !game.plane.onGround) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('⚠ STALL — THROTTLE UP, NOSE DOWN ⚠', VIEW_W / 2, 160);
      ctx.textAlign = 'left';
    }
  }
  if (game.screen === 'title') drawTitle(ctx, game, time);
  if (game.screen === 'paused') drawPause(ctx);
  if (game.screen === 'end') {
    hudBar(ctx, game);
    instrumentCluster(ctx, game);
    drawEnd(ctx, game);
  }
}
