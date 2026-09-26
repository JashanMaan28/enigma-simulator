/**
 * Small synthesised mechanical sounds (no audio files). Off by default; the
 * AudioContext is only created after the visitor switches sound on.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function burst(at: number, { freq, q, gain, decay }: { freq: number; q: number; gain: number; decay: number }) {
  const ac = ctx;
  if (!ac || !noise) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(filter).connect(env).connect(ac.destination);
  src.start(at);
  src.stop(at + decay + 0.02);
}

function thump(at: number, gain: number) {
  const ac = ctx;
  if (!ac) return;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(60, at + 0.06);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  osc.connect(env).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.08);
}

/** Key goes down: a dull bakelite clack, then one ratchet tick per rotor that moved. */
export function playKeyDown(rotorsMoved: number) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  thump(t, 0.22);
  burst(t, { freq: 1800, q: 1.2, gain: 0.35, decay: 0.035 });
  for (let i = 0; i < rotorsMoved; i++) {
    burst(t + 0.012 + i * 0.018, { freq: 4200, q: 4, gain: 0.25, decay: 0.012 });
  }
}

/** Key comes back up. */
export function playKeyUp() {
  const ac = audio();
  if (!ac) return;
  burst(ac.currentTime + 0.005, { freq: 2600, q: 2, gain: 0.12, decay: 0.02 });
}

/** A thumbwheel click. */
export function playDetent() {
  const ac = audio();
  if (!ac) return;
  burst(ac.currentTime + 0.003, { freq: 3400, q: 3, gain: 0.2, decay: 0.015 });
}

/** Plug seated in / pulled out of a socket. */
export function playPlug() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  thump(t, 0.12);
  burst(t, { freq: 900, q: 1, gain: 0.2, decay: 0.05 });
}
