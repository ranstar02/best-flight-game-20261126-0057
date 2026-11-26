// Skyhook Senja — synthesized sound, no audio files.
// WebAudio oscillators + filtered noise: engine drone that follows the
// throttle, wind, ring chime, touchdown thud, crash. Everything is built
// in code; nothing is fetched.

export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: two detuned saws through a lowpass — a prop drone.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 93;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp);
      engineOsc2.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looping noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSrc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; return muted; },
    // Called every frame while flying.
    update(throttle, speed, flying) {
      if (!ctx || muted || !started) return;
      const t = ctx.currentTime;
      const eng = flying ? 0.05 + throttle * 0.075 : 0;
      engineGain.gain.setTargetAtTime(eng, t, 0.08);
      engineOsc.frequency.setTargetAtTime(58 + throttle * 66, t, 0.08);
      const wind = flying ? Math.min(0.12, speed * 0.0016) : 0;
      windGain.gain.setTargetAtTime(wind, t, 0.15);
      windFilter.frequency.setTargetAtTime(320 + speed * 14, t, 0.15);
    },
    ring(combo) {
      const base = 660 + Math.min(combo, 6) * 55;
      tone(base, 0.35, 'sine', 0.22);
      tone(base * 1.5, 0.4, 'sine', 0.18, 0.07);
      tone(base * 2, 0.3, 'triangle', 0.1, 0.14);
    },
    thud() {
      tone(70, 0.22, 'sine', 0.5);
      tone(48, 0.3, 'triangle', 0.3, 0.02);
    },
    crash() {
      if (!ctx || muted) return;
      const t0 = ctx.currentTime;
      const len = ctx.sampleRate * 0.7;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      src.connect(lp); lp.connect(g); g.connect(ctx.destination);
      src.start(t0);
      tone(55, 0.6, 'sawtooth', 0.25);
    },
    click() { tone(880, 0.07, 'square', 0.08); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.16, i * 0.12));
    },
  };
}
