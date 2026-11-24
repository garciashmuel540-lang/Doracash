import { create } from "zustand";
import { persist } from "zustand/middleware";

type FeedbackSettings = {
  sound: boolean;
  haptics: boolean;
  volume: number;
};

export const useFeedbackSettings = create<FeedbackSettings>()(
  persist<FeedbackSettings>(() => ({ sound: true, haptics: true, volume: 55 }), {
    name: "doracash-feedback-v1",
    skipHydration: true,
  }),
);

type SoundPart = {
  at: number;
  length: number;
  from: number;
  to: number;
  level: number;
  noise?: boolean;
};

const cues = {
  tap: {
    vibration: 9,
    parts: [
      { at: 0, length: 0.04, from: 390, to: 200, level: 0.28 },
      { at: 0, length: 0.022, from: 1450, to: 620, level: 0.135, noise: true },
    ],
  },
  select: {
    vibration: 14,
    parts: [
      { at: 0, length: 0.046, from: 460, to: 355, level: 0.24 },
      { at: 0.021, length: 0.035, from: 640, to: 565, level: 0.14 },
    ],
  },
  navigate: {
    vibration: 13,
    parts: [
      { at: 0, length: 0.065, from: 490, to: 290, level: 0.18 },
      { at: 0, length: 0.072, from: 680, to: 1800, level: 0.18, noise: true },
    ],
  },
  open: {
    vibration: [10, 24, 9],
    parts: [
      { at: 0, length: 0.105, from: 470, to: 1510, level: 0.21, noise: true },
      { at: 0.032, length: 0.074, from: 220, to: 385, level: 0.16 },
    ],
  },
  close: {
    vibration: 10,
    parts: [
      { at: 0, length: 0.09, from: 1180, to: 440, level: 0.18, noise: true },
      { at: 0.021, length: 0.05, from: 340, to: 185, level: 0.17 },
    ],
  },
  confirm: {
    vibration: [15, 36, 19],
    parts: [
      { at: 0, length: 0.095, from: 414, to: 389, level: 0.26 },
      { at: 0.052, length: 0.118, from: 616, to: 582, level: 0.22 },
      { at: 0, length: 0.025, from: 1150, to: 680, level: 0.12, noise: true },
    ],
  },
  undo: {
    vibration: [15, 32, 11],
    parts: [
      { at: 0, length: 0.084, from: 460, to: 415, level: 0.19 },
      { at: 0.044, length: 0.08, from: 305, to: 240, level: 0.24 },
    ],
  },
  warning: {
    vibration: [22, 42, 16],
    parts: [
      { at: 0, length: 0.085, from: 290, to: 236, level: 0.23 },
      { at: 0.072, length: 0.08, from: 240, to: 178, level: 0.18 },
    ],
  },
} satisfies Record<string, { vibration: number | number[]; parts: SoundPart[] }>;

export type FeedbackCue = keyof typeof cues;

let audio: { context: AudioContext; gain: GainNode; noise: AudioBuffer } | undefined;
let lastPlayed = 0;
export let feedbackSequence = 0;

function outputLevel() {
  const { sound, volume } = useFeedbackSettings.getState();
  return sound ? (Math.min(100, Math.max(0, volume)) / 100) * 0.52 : 0;
}

useFeedbackSettings.subscribe(() => {
  if (audio) audio.gain.gain.setTargetAtTime(outputLevel(), audio.context.currentTime, 0.012);
});

function audioOutput() {
  const level = outputLevel();
  if (!level) return;
  if (!audio) {
    const Audio =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio({ latencyHint: "interactive" });
    const gain = context.createGain();
    gain.gain.value = level;
    gain.connect(context.destination);
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.12), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    audio = { context, gain, noise };
  }

  return audio;
}

export function prepareFeedbackAudio() {
  try {
    const context = audioOutput()?.context;
    if (context && context.state !== "running") void context.resume().catch(() => {});
  } catch {
    // Feedback is optional on browsers where audio output is unavailable.
  }
}

async function playSound(parts: SoundPart[]) {
  const output = audioOutput();
  if (!output) return;
  const { context, gain, noise } = output;
  const requested = performance.now();
  if (context.state !== "running") await context.resume();
  if (performance.now() - requested > 180 || document.hidden || !outputLevel()) return;

  const start = context.currentTime + 0.004;
  for (const part of parts) {
    const when = start + part.at;
    const end = when + part.length;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(part.level, when + (part.noise ? 0.009 : 0.004));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    envelope.connect(gain);

    let source: AudioScheduledSourceNode;
    if (part.noise) {
      const buffer = context.createBufferSource();
      buffer.buffer = noise;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.65;
      filter.frequency.setValueAtTime(part.from, when);
      filter.frequency.exponentialRampToValueAtTime(part.to, end);
      buffer.connect(filter).connect(envelope);
      buffer.onended = () => {
        buffer.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      source = buffer;
    } else {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(part.from, when);
      oscillator.frequency.exponentialRampToValueAtTime(part.to, end);
      oscillator.connect(envelope);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      source = oscillator;
    }
    source.start(when);
    source.stop(end);
  }
}

export function playFeedback(cue: FeedbackCue, channel?: "sound" | "haptic") {
  if (typeof window === "undefined" || document.hidden) return;
  feedbackSequence++;
  const now = performance.now();
  if (!channel && now - lastPlayed < 38 && lastPlayed !== 0) return;
  lastPlayed = now;
  const { parts, vibration } = cues[cue];
  if (channel !== "sound" && useFeedbackSettings.getState().haptics) {
    navigator.vibrate?.(vibration);
  }
  if (channel !== "haptic") void playSound(parts).catch(() => {});
}
