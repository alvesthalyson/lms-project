import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Just enough of Web Audio to see what the engine builds. Nodes chain like the real ones: a.connect(b).connect(c). */
class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = { value: 0 };
  type = "";
  buffer: unknown = null;
  loop = false;
  connect = vi.fn((target: unknown) => target);
  start = vi.fn();
  stop = vi.fn();
}
const made = { contexts: 0, sources: 0, oscillators: 0 };
class FakeAudioContext {
  currentTime = 10;
  sampleRate = 8000;
  state = "running";
  destination = new FakeNode();
  constructor() {
    made.contexts++;
  }
  resume = vi.fn(() => Promise.resolve());
  createGain = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createBufferSource = () => {
    made.sources++;
    return new FakeNode();
  };
  createOscillator = () => {
    made.oscillators++;
    return new FakeNode();
  };
  createBuffer = (_channels: number, length: number, rate: number) => ({ sampleRate: rate, getChannelData: () => new Float32Array(length) });
}

async function freshEngine() {
  vi.resetModules();
  return import("./engine");
}

beforeEach(() => {
  made.contexts = made.sources = made.oscillators = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sound engine", () => {
  it("does nothing, and never touches audio, while sound is off", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();

    sfx.flutter();
    sfx.chime();
    sfx.stairs();
    sfx.reveal([{ kind: "page", delay: 0 }], 2);
    sfx.startAmbient();

    expect(made).toEqual({ contexts: 0, sources: 0, oscillators: 0 });
  });

  it("does not break in a browser without Web Audio", async () => {
    const sfx = await freshEngine();
    sfx.setSoundEnabled(true);
    expect(() => {
      sfx.openShelf();
      sfx.chime();
      sfx.startAmbient();
      sfx.stopAmbient();
    }).not.toThrow();
  });

  it("turning sound on creates one context and the sounds then use it", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();
    sfx.setSoundEnabled(true);
    expect(made.contexts).toBe(1);

    sfx.flutter(); // three paper bursts
    expect(made.sources).toBe(3);
    sfx.tock(); // a thump and a click
    expect(made.oscillators).toBe(1);
    expect(made.sources).toBe(4);
    sfx.chime(); // four bells with an overtone each
    expect(made.oscillators).toBe(1 + 8);
    expect(made.contexts).toBe(1);
  });

  it("the recommendation flight sounds the books, some pages and then the bell", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();
    sfx.setSoundEnabled(true);

    sfx.reveal(
      [
        { kind: "book", delay: 0.1 },
        { kind: "page", delay: 0.2 },
        { kind: "page", delay: 0.3 },
      ],
      2.3,
    );
    expect(made.oscillators).toBe(8); // the chime
    // 1 whoosh + 1 page flutter (3 bursts; the second page is skipped) + 1 shimmer of the bell
    expect(made.sources).toBe(1 + 3 + 1);
  });

  it("sound off silences everything again", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();
    sfx.setSoundEnabled(true);
    sfx.setSoundEnabled(false);
    const before = { ...made };
    sfx.chime();
    sfx.flutter();
    expect(made).toEqual(before);
    expect(sfx.isSoundEnabled()).toBe(false);
  });

  it("the ambience starts with sound, crackles on a timer and stops when asked", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const sfx = await freshEngine();
    sfx.setSoundEnabled(true);

    sfx.startAmbient();
    expect(made.sources).toBe(1); // the room tone
    vi.advanceTimersByTime(400);
    expect(made.sources).toBeGreaterThan(1); // a crackle

    sfx.stopAmbient();
    const after = made.sources;
    vi.advanceTimersByTime(2000);
    expect(made.sources).toBe(after);
    vi.restoreAllMocks();
  });
});

describe("hourglass sound", () => {
  it("taps the glass and trickles sand when on, and is silent when off", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();
    sfx.sand();
    expect(made.contexts).toBe(0);
    sfx.setSoundEnabled(true);
    sfx.sand();
    expect(made.oscillators).toBe(2);
    expect(made.sources).toBe(5);
  });
});

describe("rose sound", () => {
  it("plays one glass note per petal (at most twelve), silent when off", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const sfx = await freshEngine();
    sfx.bloom(8);
    expect(made.contexts).toBe(0);
    sfx.setSoundEnabled(true);
    sfx.bloom(8);
    expect(made.oscillators).toBe(8);
    sfx.bloom(30);
    expect(made.oscillators).toBe(8 + 12);
  });
});
