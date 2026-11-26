// Skyhook Senja — sky rings: placement, pass detection and combo.
// A ring is a glowing hoop floating over the sea. Fly through its centre
// (within the ring radius) to score; clipping the edge still counts, but
// missing one breaks the combo.

export const RING_RADIUS = 46; // metres
export const RING_PASS_RADIUS = 40;

export function makeRings(defs) {
  return defs.map((d, i) => ({
    index: i,
    number: i + 1,
    x: d.x,
    alt: d.alt,
    passed: false,
    flash: 0, // 0..1 glow timer after a pass
  }));
}

// Returns the ring just passed, or null. `plane` needs x / alt.
export function checkRings(rings, plane) {
  for (const ring of rings) {
    if (ring.passed) continue;
    const dx = plane.x - ring.x;
    const dy = plane.alt - ring.alt;
    if (Math.abs(dx) < 26 && Math.abs(dy) < RING_PASS_RADIUS) {
      ring.passed = true;
      ring.flash = 1;
      return ring;
    }
  }
  return null;
}

// The next ring the pilot should aim for (first unpassed).
export function nextRing(rings) {
  for (const ring of rings) if (!ring.passed) return ring;
  return null;
}

export function ringsLeft(rings) {
  let n = 0;
  for (const r of rings) if (!r.passed) n++;
  return n;
}

export function tickRings(rings, dt) {
  for (const r of rings) r.flash = Math.max(0, r.flash - dt * 1.4);
}
