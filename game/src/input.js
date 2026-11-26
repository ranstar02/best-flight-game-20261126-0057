// Skyhook Senja — keyboard + mouse input.
// Keys drive the stick and throttle; clicks drive the menus.
// The game loop reads `keys` each frame and asks `consumeClick()` for
// button hits, so a click is never double-counted.

export function makeInput(canvas) {
  const keys = {
    up: false, down: false, left: false, right: false,
    flare: false, pause: false, restart: false, mute: false,
  };
  const pressed = new Set(); // edge-triggered keys, consumed by the loop
  let click = null;          // {x, y} in canvas pixels, consumed on read
  let anyGesture = false;    // first key/mouse — unlocks audio

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'flare',
    KeyP: 'pause', KeyR: 'restart', KeyM: 'mute',
    Enter: 'restart',
  };

  function onKey(e, isDown) {
    const name = KEYMAP[e.code];
    if (!name) return;
    e.preventDefault();
    anyGesture = true;
    if (isDown && !keys[name] && (name === 'pause' || name === 'restart' || name === 'mute')) {
      pressed.add(name);
    }
    keys[name] = isDown;
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.flare = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    anyGesture = true;
    const rect = canvas.getBoundingClientRect();
    click = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });

  return {
    keys,
    consumeClick() { const c = click; click = null; return c; },
    consumePressed(name) {
      if (pressed.has(name)) { pressed.delete(name); return true; }
      return false;
    },
    get anyGesture() { return anyGesture; },
  };
}

// Hit test helper for menu buttons.
export function inRect(p, r) {
  return p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
