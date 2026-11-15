import { duck } from "./sound";
import { speechLocale, type LearningLanguage } from "./language";

let current: HTMLAudioElement | null = null;
let token = 0;
let language: LearningLanguage = "en";
let settlePlayback: (() => void) | null = null;

export function setAudioLanguage(next: LearningLanguage) {
  stopAudio();
  language = next;
}

export function stopAudio() {
  token++;
  current?.pause();
  settlePlayback?.();
  settlePlayback = null;
  current = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Play a recording, falling back to the device voice. Resolves when playback ends. */
export async function play(
  url: string | null | undefined,
  text: string,
  accent: "uk" | "us" = "uk",
  rate = 1,
) {
  duck(true);
  try {
    return await speak(url, text, accent, rate);
  } finally {
    duck(false);
  }
}

async function speak(
  url: string | null | undefined,
  text: string,
  accent: "uk" | "us",
  rate: number,
) {
  stopAudio();
  const mine = ++token;
  if (url) {
    const a = new Audio(url);
    a.playbackRate = rate;
    current = a;
    const ended = new Promise<"ended" | "error">((resolve) => {
      settlePlayback = () => resolve("ended");
      a.onended = a.onpause = () => resolve("ended");
      a.onerror = () => resolve("error");
    });
    try {
      await a.play();
      const result = await ended;
      if (mine !== token) return "stopped" as const;
      if (result !== "error") return "recorded" as const;
    } catch {
      if (mine !== token) return "stopped" as const;
    } finally {
      if (current === a) {
        current = null;
        settlePlayback = null;
      }
      a.onended = a.onpause = a.onerror = null;
    }
  }
  if (!("speechSynthesis" in window)) return "unsupported" as const;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLocale(language, accent);
  u.rate = rate * 0.95;
  const voices = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace("_", "-") === u.lang);
  const best =
    voices.find((v) => /premium|enhanced|natural|google/i.test(v.name)) ||
    voices[0];
  if (best) u.voice = best;
  await new Promise<void>((r) => {
    settlePlayback = r;
    u.onend = () => r();
    u.onerror = () => r();
    speechSynthesis.speak(u);
  });
  if (mine !== token) return "stopped" as const;
  settlePlayback = null;
  return "device" as const;
}
