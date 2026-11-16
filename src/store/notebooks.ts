import type { Atlas } from "../atlas/types";
import { normalize } from "../lib/text";
import type { Notebook, Progress } from "./store";

/** Match headwords exactly; never split a phrase or invent a missing entry. */
export function matchWords(text: string, atlas: Atlas) {
  const lookup = new Map(atlas.words.map((w) => [normalize(w.word), w.id]));
  const tokens = text
    .split(/[\r\n,，;；、\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const wordIds: string[] = [];
  const unmatched: string[] = [];
  let duplicates = 0;
  for (const token of tokens) {
    const key = normalize(token);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const id = lookup.get(key);
    if (id) wordIds.push(id);
    else unmatched.push(token);
  }
  return { wordIds, unmatched, duplicates };
}

export function activeNotebook(p: Progress) {
  return p.notebooks.find((b) => b.id === p.activeNotebookId);
}

export function makeNotebook(name: string, wordIds: string[] = []): Notebook {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 60),
    wordIds: [...new Set(wordIds)],
    created: now,
    updated: now,
  };
}

export function addWords(
  p: Progress,
  notebookId: string,
  wordIds: string[],
): Progress {
  return {
    ...p,
    notebooks: p.notebooks.map((b) =>
      b.id === notebookId
        ? {
            ...b,
            wordIds: [...new Set([...b.wordIds, ...wordIds])],
            updated: Date.now(),
          }
        : b,
    ),
  };
}

export function removeNotebook(p: Progress, notebookId: string): Progress {
  return {
    ...p,
    notebooks: p.notebooks.filter((b) => b.id !== notebookId),
    activeNotebookId:
      p.activeNotebookId === notebookId ? null : p.activeNotebookId,
  };
}

/** A familiar mark must never suppress a real scheduled review or change answer stats. */
export function setFamiliar(
  p: Progress,
  id: string,
  familiar: boolean,
): Progress {
  if (!familiar) return { ...p, familiar: p.familiar.filter((x) => x !== id) };
  if (p.cards[id]) return p;
  let next = { ...p, familiar: [...new Set([...p.familiar, id])] };
  const s = p.session;
  if (s && !s.finished && s.newIds.includes(id) && !(id in s.graded)) {
    // Keep completed work; remove only uncompleted steps for this word.
    const steps = s.steps.filter((step, i) => i < s.index || step.id !== id);
    next = {
      ...next,
      session: {
        ...s,
        steps,
        newIds: s.newIds.filter((x) => x !== id),
        skippedIds: [...new Set([...(s.skippedIds ?? []), id])],
        pending: steps[s.index] === s.steps[s.index] ? s.pending : undefined,
        finished: s.index >= steps.length ? Date.now() : undefined,
      },
    };
  }
  return next;
}
