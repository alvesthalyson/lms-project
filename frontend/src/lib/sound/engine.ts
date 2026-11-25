/**
 * Sound for the Home, made in the browser with the Web Audio API: no audio files to download or license.
 * Everything is off until the reader turns it on (the speaker button). The browser only lets sound start after a
 * click or tap, so the context is created on that click, and resumed on the next one after a page reload.
 *
 * All functions are safe to call anywhere: with sound off, or in a browser without Web Audio (and in tests), they do nothing.
 */

type AudioContextClass = typeof AudioContext;

let enabled = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let ambientWanted = false;
let ambient: { stop: () => void } | null = null;
let unlockListening = false;

const MASTER_VOLUME = 0.8;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextClass; webkitAudioContext?: AudioContextClass };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The running context, or null when sound is off or unavailable. */
function context(): AudioContext | null {
  if (!enabled) return null;
  const AC = audioContextClass();
  if (!AC) return null;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    return null;
  }
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise || noise.sampleRate !== c.sampleRate) {
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A burst of filtered noise whose filter sweeps from f0 to f1: paper, wind, wood, sparkle. */
function noiseBurst(c: AudioContext, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack = 0.006): void {
  const source = c.createBufferSource();
  source.buffer = noiseBuffer(c);
  source.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  source.connect(filter).connect(gain).connect(master!);
  source.start(t, Math.random() * 1.5);
  source.stop(t + dur + 0.05);
}

/** A pitched note that fades away: bells, thuds. */
function tone(c: AudioContext, t: number, freq: number, dur: number, peak: number, endFreq = freq, type: OscillatorType = "sine"): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

// ── one-shot sounds. `after` is how many seconds from now ─────────────────────────────────────────────

/** A page being flipped or fluttering past. */
export function flutter(after = 0, volume = 1): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime + after;
  for (let k = 0; k < 3; k++) noiseBurst(c, t + k * 0.065, 0.1, "bandpass", rand(2800, 4600), 1700, 1.1, 0.11 * volume);
}

/** A book or a gust of pages rushing across the room. */
export function whoosh(after = 0, duration = 0.9, volume = 1): void {
  const c = context();
  if (!c) return;
  noiseBurst(c, c.currentTime + after, duration, "bandpass", rand(260, 420), rand(1500, 2400), 0.7, 0.17 * volume, duration * 0.4);
}

/** A wooden knock, like a book set down on a table. */
export function tock(after = 0, volume = 1): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime + after;
  tone(c, t, 230, 0.14, 0.32 * volume, 85);
  noiseBurst(c, t, 0.05, "lowpass", 1400, 400, 0.8, 0.2 * volume, 0.002);
}

/** One footstep on a wooden stair. */
export function step(after = 0, volume = 1): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime + after;
  tone(c, t, 120, 0.11, 0.26 * volume, 60);
  noiseBurst(c, t, 0.07, "lowpass", 900, 250, 0.7, 0.16 * volume, 0.002);
}

/** Going up or down the staircase. */
export function stairs(): void {
  for (let i = 0; i < 5; i++) step(i * 0.17, 0.8 + (i % 2) * 0.2);
}

/** Opening a shelf: a rustle of pages and a soft knock. */
export function openShelf(): void {
  flutter(0, 0.9);
  tock(0.18, 0.5);
}

/** The glittering bell of the recommendation appearing. */
export function chime(after = 0): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime + after;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    tone(c, t + i * 0.09, f, 1.9, 0.15 / (1 + i * 0.25));
    tone(c, t + i * 0.09, f * 2.76, 0.7, 0.035); // the inharmonic partial that makes it sound like a bell
  });
  noiseBurst(c, t + 0.05, 0.9, "highpass", 6500, 9000, 0.7, 0.03, 0.05);
}

/** A country chosen on the globe: two soft bell notes. */
export function pickCountry(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 784, 0.9, 0.18);
  tone(c, t + 0.1, 1174.7, 1.1, 0.15);
}

/** The globe opening: a short whirr. */
export function globeOpen(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.5, "bandpass", 500, 1600, 2.2, 0.09, 0.15);
  tone(c, t + 0.28, 660, 0.5, 0.1);
}

/** The flight of the recommendation: pages flutter and books whoosh when each one leaves, then the bell rings. */
export function reveal(flyers: ReadonlyArray<{ kind: "page" | "book"; delay: number }>, arrival: number): void {
  if (!context()) return;
  flyers.slice(0, 26).forEach((f, i) => {
    if (f.kind === "book") whoosh(f.delay + 0.05, 0.85, 0.7);
    else if (i % 2 === 0) flutter(f.delay + 0.05, 0.8);
  });
  chime(arrival);
}

// ── ambience: room tone and a crackling fire, looped while the Home is open ──────────────────────────────

function buildAmbient(c: AudioContext): { stop: () => void } {
  const source = c.createBufferSource();
  source.buffer = noiseBuffer(c);
  source.loop = true;
  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 320;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.045, c.currentTime + 2.5); // fades in
  source.connect(low).connect(gain).connect(master!);
  source.start();

  const crackle = window.setInterval(() => {
    const now = context();
    if (!now || Math.random() > 0.55) return;
    const t = now.currentTime;
    const pops = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pops; i++) noiseBurst(now, t + i * rand(0.02, 0.08), rand(0.015, 0.05), "highpass", rand(1500, 3500), 900, 0.8, rand(0.015, 0.06), 0.001);
  }, 380);

  return {
    stop: () => {
      window.clearInterval(crackle);
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      source.stop(t + 0.7);
    },
  };
}

function maybeStartAmbient(): void {
  if (!ambientWanted || ambient) return;
  const c = context();
  if (!c || c.state !== "running") return;
  ambient = buildAmbient(c);
}

/** After a reload the browser keeps the context asleep until the next click or tap: wake it then. */
function unlockOnNextGesture(): void {
  if (unlockListening || typeof document === "undefined") return;
  unlockListening = true;
  const wake = (): void => {
    const c = context();
    if (!c) return;
    void c.resume().then(() => {
      maybeStartAmbient();
      if (c.state === "running") {
        document.removeEventListener("pointerdown", wake);
        unlockListening = false;
      }
    });
  };
  document.addEventListener("pointerdown", wake);
}

/** Ask for the ambience (on while the Home is shown). It only sounds when sound is on. */
export function startAmbient(): void {
  ambientWanted = true;
  maybeStartAmbient();
}

export function stopAmbient(): void {
  ambientWanted = false;
  ambient?.stop();
  ambient = null;
}

/** The speaker button. Call it from the click so the browser lets the sound start. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    ambient?.stop();
    ambient = null;
    return;
  }
  context();
  maybeStartAmbient();
  unlockOnNextGesture();
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** Sound was left on in an earlier visit: enable it without touching audio yet (the browser forbids that before a click). */
export function restoreSoundEnabled(): void {
  enabled = true;
  unlockOnNextGesture();
}

/** The hourglass: a soft glass tap and a trickle of falling sand. */
export function sand(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  tone(c, t, 1320, 0.18, 0.05);
  tone(c, t + 0.01, 1980, 0.12, 0.03);
  for (let i = 0; i < 5; i++) noiseBurst(c, t + 0.1 + i * 0.07, 0.09, "highpass", 5200, 4200, 0.7, 0.03);
}

/**
 * The rose opens: a soft rustle of petals while they fly in, and one glass note as each labelled petal lands.
 * `landings` are the moments, in seconds from now, at which the petals settle.
 */
export function bloom(landings: readonly number[]): void {
  const c = context();
  if (!c) return;
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const t = c.currentTime;
  for (let i = 0; i < 6; i++) noiseBurst(c, t + 0.15 + i * 0.4, 0.5, "highpass", 3000, 1800, 0.7, 0.02);
  landings.slice(0, 12).forEach((at, i) => {
    const octave = Math.floor(i / scale.length) + 1;
    tone(c, t + at, scale[i % scale.length]! * octave, 1.1, 0.05);
  });
}

/**
 * The window opens onto the forest: a long whoosh that rises as the camera goes through the glass, a run of glass
 * notes that climb with it, a low swell, and a shimmer when the light flashes and the forest appears.
 */
export function portal(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  noiseBurst(c, t + 0.1, 2.6, "bandpass", 220, 3200, 1.1, 0.06, 1.4);
  tone(c, t + 0.2, 110, 2.8, 0.05, 220);
  scale.forEach((freq, i) => tone(c, t + 0.9 + i * 0.22, freq, 1.2, 0.04));
  noiseBurst(c, t + 2.2, 1.8, "highpass", 5000, 2200, 0.7, 0.03, 0.2);
}
