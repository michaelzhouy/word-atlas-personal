import { useSyncExternalStore } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let prompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const standalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
let state = {
  online: navigator.onLine,
  ready: false,
  installed: standalone(),
  canInstall: false,
};

function update(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

window.addEventListener("online", () => update({ online: true }));
window.addEventListener("offline", () => update({ online: false }));
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  prompt = event as InstallPrompt;
  update({ canInstall: true });
});
window.addEventListener("appinstalled", () => {
  prompt = null;
  update({ installed: true, canInstall: false });
});
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.ready.then(() => update({ ready: true }));
}

export function useInstall() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export async function installApp() {
  const pending = prompt;
  if (!pending) return;
  await pending.prompt();
  await pending.userChoice;
  prompt = null;
  update({ canInstall: false });
}
