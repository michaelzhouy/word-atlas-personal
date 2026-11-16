import assert from "node:assert/strict";
import { test } from "node:test";
import type { Atlas, WordRef } from "../atlas/types";
import { addWords, matchWords, removeNotebook, setFamiliar } from "./notebooks";
import { buildSession, nextNew, sessionStats, todayPlan } from "./session";
import { Rating, review } from "./srs";
import {
  dayKey,
  defaultSettings,
  emptyProgress,
  sanitizeProgress,
  type Notebook,
  type Progress,
} from "./store";

const words: WordRef[] = [
  "apple",
  "library",
  "look forward to",
  "journey",
  "can’t",
].map((word, i) => ({
  id: `w${i}`,
  word,
  zh: `释义${i}`,
  ipa: "",
  cefr: i % 3,
  topic: 0,
  media: 0,
  order: i,
}));
const atlas: Atlas = {
  id: "test",
  name: "test",
  kind: "open",
  words,
  count: words.length,
  examples: 0,
  illustrated: 0,
  topics: [],
  cefr: ["A1", "A2", "B1"],
  byId: new Map(words.map((w) => [w.id, w])),
  entry: async () => {
    throw new Error("not needed");
  },
  peek: () => undefined,
  img: () => null,
  audio: () => null,
};
const book: Notebook = {
  id: "book",
  name: "Reading",
  wordIds: ["w2", "w1", "w0"],
  created: 1,
  updated: 1,
};
const custom = (): Progress => ({
  ...emptyProgress(atlas.id),
  notebooks: [book],
  activeNotebookId: book.id,
});

test("pasted words preserve phrases, normalize punctuation and report duplicates and unknowns", () => {
  const hit = matchWords(
    "LIBRARY, library；look   forward to\ncan't\tmissing-word、apple",
    atlas,
  );
  assert.deepEqual(hit.wordIds, ["w1", "w2", "w4", "w0"]);
  assert.deepEqual(hit.unmatched, ["missing-word"]);
  assert.equal(hit.duplicates, 1);
  assert.deepEqual(matchWords("apple library", atlas).unmatched, [
    "apple library",
  ]);
});

test("legacy version 2 records retain cards, stats, favorites and unfinished sessions", () => {
  const card = review(undefined, Rating.Good, Date.now());
  const session = buildSession(atlas, emptyProgress(atlas.id), defaultSettings);
  const p = sanitizeProgress(
    {
      version: 2,
      cards: { w0: card },
      days: { [dayKey()]: { n: 1, r: 1, c: 1, t: 30 } },
      bookmarks: ["w0"],
      session,
    },
    atlas.id,
  );
  assert.deepEqual(p.cards.w0, card);
  assert.equal(p.days[dayKey()].n, 1);
  assert.deepEqual(p.bookmarks, ["w0"]);
  assert.deepEqual(p.session, session);
  assert.deepEqual(p.notebooks, []);
  assert.equal(p.activeNotebookId, null);
  assert.deepEqual(p.familiar, []);
});

test("wordbook metadata is validated and familiar marks cannot override review cards", () => {
  const card = review(undefined, Rating.Good, Date.now());
  const p = sanitizeProgress(
    {
      version: 2,
      cards: { w0: card },
      notebooks: [
        book,
        { ...book, name: "duplicate" },
        { id: "bad", name: " " },
        {
          ...book,
          id: "second",
          wordIds: ["w1", "w1", null, "w2"],
          created: -1,
        },
      ],
      activeNotebookId: "missing",
      familiar: ["w0", "w1", "w1", 9],
    },
    atlas.id,
  );
  assert.equal(p.notebooks.length, 2);
  assert.deepEqual(p.notebooks[1].wordIds, ["w1", "w2"]);
  assert.equal(p.notebooks[1].created, 0);
  assert.equal(p.activeNotebookId, null);
  assert.deepEqual(p.familiar, ["w1"]);
});

test("custom new words follow book order, respect daily goal, exclude familiar and never fall back", () => {
  let p = custom();
  p = setFamiliar(p, "w1", true);
  p.cards.w0 = review(undefined, Rating.Good, Date.now());
  assert.deepEqual(
    nextNew(atlas, p, { ...defaultSettings, startLevel: 5 }, 10),
    ["w2"],
  );
  p.days[dayKey()] = { n: 10, r: 10, c: 9, t: 40 };
  assert.deepEqual(todayPlan(atlas, p, defaultSettings).fresh, []);
  p = setFamiliar(p, "w2", true);
  assert.deepEqual(nextNew(atlas, p, defaultSettings, 5), []);
});

test("existing reviews stay global; book additions and deletions preserve cards and current session", () => {
  const p = custom();
  p.cards.w3 = review(undefined, Rating.Good, Date.now() - 86400000 * 30);
  p.session = buildSession(atlas, p, defaultSettings);
  assert.deepEqual(p.session.reviewIds, ["w3"]);
  const added = addWords(p, book.id, ["w1", "w3", "w3"]);
  assert.deepEqual(added.notebooks[0].wordIds, ["w2", "w1", "w0", "w3"]);
  assert.equal(added.session, p.session);
  const removed = removeNotebook(added, book.id);
  assert.equal(removed.activeNotebookId, null);
  assert.equal(removed.session, p.session);
  assert.equal(removed.session?.source?.name, "Reading");
  assert.equal(removed.cards, p.cards);
});

test("skipping consecutive current introductions keeps the next step and honest statistics", () => {
  let p = custom();
  p.session = buildSession(atlas, p, defaultSettings);
  const days = p.days;
  for (const id of book.wordIds) {
    assert.equal(p.session!.steps[p.session!.index].id, id);
    p = setFamiliar(p, id, true);
  }
  assert.ok(p.session?.finished);
  assert.deepEqual(p.session?.newIds, []);
  assert.deepEqual(p.session?.steps, []);
  assert.deepEqual(p.session?.skippedIds, book.wordIds);
  assert.equal(sessionStats(p.session!).total, 0);
  assert.deepEqual(p.cards, {});
  assert.equal(p.days, days);
  assert.deepEqual(nextNew(atlas, p, defaultSettings, 10), []);
  p = setFamiliar(p, "w1", false);
  assert.deepEqual(nextNew(atlas, p, defaultSettings, 10), ["w1"]);
});

test("skipping a future new word preserves completed steps, current pending feedback and graded work", () => {
  const p = custom();
  p.session = buildSession(atlas, p, defaultSettings);
  p.session.index = 3;
  const currentId = p.session.steps[3].id;
  p.cards[currentId] = review(undefined, Rating.Good, Date.now());
  p.session.graded[currentId] = Rating.Good;
  p.session.pending = { correct: true, value: currentId };
  const futureId = book.wordIds.find((id) => id !== currentId)!;
  const next = setFamiliar(p, futureId, true);
  assert.deepEqual(
    next.session?.steps.slice(0, 3),
    p.session.steps.slice(0, 3),
  );
  assert.equal(next.session?.steps[3].id, currentId);
  assert.equal(next.session?.pending, p.session.pending);
  assert.equal(next.session?.graded, p.session.graded);
  assert.equal(next.cards, p.cards);
  assert.equal(setFamiliar(next, currentId, true), next);
});
