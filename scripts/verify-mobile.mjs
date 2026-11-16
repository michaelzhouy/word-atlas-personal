import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = (
  process.env.APP_URL || "http://localhost:5188/word-atlas-personal/"
).replace(/\/?$/, "/");
const out = path.resolve("output/mobile-review/after");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: existsSync(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  )
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined,
  headless: true,
});
const checks = [];
const errors = [];
const measurements = [];
const now = Date.now();
const card = {
  due: now - 86400000,
  s: 2.3,
  d: 2.1,
  el: 0,
  sd: 0,
  ls: 1,
  reps: 1,
  lapses: 0,
  st: 1,
  last: now - 86400000,
  seen: now - 86400000,
};
const fixture = {
  settings: {
    onboarded: true,
    autoplay: false,
    sfx: false,
    splash: false,
    theme: "light",
    dailyNew: 10,
  },
  progress: {
    version: 2,
    datasetId: "word-atlas-open",
    cards: { thursday: card, bedroom: card, "post-office": card },
    bookmarks: ["bedroom", "thursday"],
    days: {},
    typing: [],
    session: null,
    mistakes: [],
    familiar: [],
    notebooks: [
      {
        id: "design-reading",
        name: "旅行与日常阅读",
        wordIds: [
          "library",
          "journey",
          "adventure",
          "language",
          "culture",
          "coffee",
          "book",
          "travel",
          "station",
          "ticket",
          "airport",
          "learn",
          "practice",
          "memory",
          "thursday",
          "bedroom",
        ],
        created: now,
        updated: now,
      },
    ],
    activeNotebookId: "design-reading",
  },
};
const check = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
const contextFor = async (
  width = 390,
  height = 844,
  theme = "light",
  data = fixture,
) => {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 1000,
    hasTouch: true,
    reducedMotion: "reduce",
    colorScheme: theme,
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ data, theme }) => {
      localStorage.setItem(
        "shici:settings",
        JSON.stringify({ ...data.settings, theme }),
      );
      localStorage.setItem(
        "shici:v2:word-atlas-open",
        JSON.stringify(data.progress),
      );
    },
    { data, theme },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
};
const open = async (page, route, ready) => {
  await page.goto(base + route);
  await page.locator(ready).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const assertFit = async (page, width, label) => {
  const result = await page.evaluate(() => ({
    inner: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.equal(result.inner, width, `${label}: layout viewport`);
  assert.equal(result.scroll, width, `${label}: horizontal overflow`);
};
const assertTargets = async (page, scope) => {
  const small = await page
    .locator(`${scope} button, ${scope} summary`)
    .evaluateAll((els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 && r.height > 0 && (r.height < 43.9 || r.width < 43.9)
          );
        })
        .map((e) => ({
          name: e.getAttribute("aria-label") || e.textContent.trim(),
          width: e.getBoundingClientRect().width,
          height: e.getBoundingClientRect().height,
        })),
    );
  assert.deepEqual(small, [], `${scope}: small touch targets`);
};
const shot = (page, name) =>
  page.screenshot({
    path: path.join(out, `${name}.png`),
    animations: "disabled",
  });

try {
  for (const [width, height, theme] of [
    [320, 568, "light"],
    [390, 844, "light"],
    [430, 932, "light"],
    [844, 390, "light"],
    [1440, 1000, "light"],
    [390, 844, "dark"],
  ]) {
    const { context, page } = await contextFor(width, height, theme);
    const suffix = `${width}-${theme}`;
    await open(page, "#/", ".journey");
    await assertFit(page, width, "today");
    await assertTargets(page, ".today");
    const primary = await page
      .locator(".journey-actions .btn-primary")
      .boundingBox();
    if (width <= 430)
      assert.ok(
        primary.y + primary.height < height - 64,
        "start learning is visible above navigation",
      );
    measurements.push({ size: suffix, primary });
    await shot(page, `today-${suffix}`);

    await open(page, "#/notebooks", ".notebook-shelf");
    await assertFit(page, width, "shelf");
    await assertTargets(page, ".notebooks");
    await shot(page, `notebooks-${suffix}`);
    await page
      .getByRole("button", { name: "打开词本 旅行与日常阅读", exact: true })
      .click();
    await page.locator(".notebook-detail").waitFor();
    await assertFit(page, width, "notebook detail");
    await assertTargets(page, ".notebooks");
    if (width === 390) {
      const first = await page.locator(".notebook-word").first().boundingBox();
      assert.ok(first.y < 700, "word list starts in the first phone screen");
      measurements.push({ size: suffix, firstWord: first });
    }
    await shot(page, `notebook-${suffix}`);
    await page.getByLabel("搜索本词本", { exact: true }).fill("journey");
    assert.equal(await page.locator(".notebook-word").count(), 1);
    await page.locator(".notebook-word").click();
    await page.locator(".entry .headword").waitFor();
    await assertFit(page, width, "word sheet from notebook");
    await assertTargets(page, ".sheet");
    const close = await page
      .getByRole("button", { name: "关闭", exact: true })
      .boundingBox();
    assert.ok(
      close.x >= 0 &&
        close.x + close.width <= width &&
        close.y >= 0 &&
        close.y + close.height <= height,
      "close button stays fully visible",
    );
    await page.locator(".entry-more > summary").click();
    const expandedClose = await page
      .getByRole("button", { name: "关闭", exact: true })
      .boundingBox();
    await page.locator(".sheet-content").evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    const fixedClose = await page
      .getByRole("button", { name: "关闭", exact: true })
      .boundingBox();
    assert.equal(
      fixedClose.y,
      expandedClose.y,
      "close toolbar does not scroll away",
    );
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    assert.ok(
      await page
        .locator(".notebook-word")
        .evaluate((e) => e === document.activeElement),
      "focus returns to the word that opened the sheet",
    );
    await page.getByRole("button", { name: "全部词本", exact: false }).click();
    await page
      .getByRole("button", { name: "打开词本 旅行与日常阅读", exact: true })
      .waitFor();

    // Opening a sheet from the atlas must not inherit an overflowing layout viewport.
    await open(page, "#/atlas?w=library", ".entry .headword");
    await assertFit(page, width, "word sheet from atlas");
    assert.equal(
      await page.locator(".word-plural").count(),
      0,
      "English has no empty German placeholders",
    );
    await shot(page, `word-${suffix}`);
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "关闭", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "下一个", exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
      "dialog traps keyboard focus",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("shici:v2:word-atlas-open")),
    );
    for (const field of [
      "cards",
      "days",
      "bookmarks",
      "notebooks",
      "familiar",
      "session",
    ])
      assert.deepEqual(
        saved[field],
        fixture.progress[field],
        `browsing preserves ${field}`,
      );
    await context.close();
    check(
      `${suffix}: learning entry, wordbook search/back, touch targets, word sheet, focus and unchanged records`,
    );
  }

  // Isolated German data exercises the real production EntryView without shipping a fake wordbook.
  const { context, page } = await contextFor(320, 720);
  let noun = "Bibliothek";
  let plural = "Bibliotheken";
  await context.route(`${base}atlas/index.json`, async (route) => {
    const data = await (await route.fetch()).json();
    data.language = "de";
    const word = data.words.find((w) => w[0] === "library");
    word[1] = noun;
    await route.fulfill({ json: data });
  });
  await context.route("**/atlas/entries/*.json", async (route) => {
    const entries = await (await route.fetch()).json();
    const entry = entries.find((e) => e.id === "library");
    if (entry)
      Object.assign(entry, {
        w: noun,
        uk: "",
        us: "",
        grammar: { article: "die", plural },
        senses: [{ pos: "n.", zh: "图书馆", en: "" }],
        ex: [],
        col: [],
        fam: [],
        syn: [],
        ant: [],
        tip: "",
      });
    await route.fulfill({ json: entries });
  });
  await open(page, "#/atlas?w=library", ".word-plural");
  assert.equal(await page.locator(".word-identity").getAttribute("lang"), "de");
  assert.equal(await page.locator(".word-article").textContent(), "die ");
  await assertFit(page, 320, "German noun");
  await shot(page, "german-noun-320");
  noun = "Geschwindigkeitsbegrenzung";
  plural = "Geschwindigkeitsbegrenzungen";
  await page.reload();
  await page.locator(".word-plural").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await assertFit(page, 320, "long German noun");
  await shot(page, "german-long-320");
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await assertFit(page, 320, "German at 200% text");
  const contentFits = await page
    .locator(".sheet-content")
    .evaluate((e) => e.scrollWidth <= e.clientWidth);
  assert.equal(
    contentFits,
    true,
    "enlarged German card has no clipped horizontal content",
  );
  await shot(page, "german-long-200-percent");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await context.close();
  check(
    "German article and plural, long compounds and 200% text render without empty fields or horizontal clipping",
  );

  const empty = structuredClone(fixture);
  empty.progress.notebooks[0].wordIds = [];
  empty.progress.notebooks[0].name =
    "为下次旅行和每天阅读准备的个人词汇学习笔记本";
  const last = await contextFor(320, 720, "light", empty);
  await open(last.page, "#/notebooks?book=design-reading", ".notebook-detail");
  await assertFit(last.page, 320, "empty notebook with long title");
  await last.page.locator(".notebook-manage > summary").click();
  await last.page.getByLabel("词本名称", { exact: true }).waitFor();
  await assertTargets(last.page, ".notebooks");
  await shot(last.page, "empty-notebook-long-title");
  await last.page
    .getByRole("button", { name: "新建词本", exact: true })
    .click();
  await last.page.getByLabel("词本名称", { exact: true }).fill("手机阅读");
  await last.page
    .getByLabel("粘贴单词（可稍后添加）")
    .fill("library\njourney\nnot-a-word-xyz");
  await last.page.getByText("匹配到 2 个词", { exact: true }).waitFor();
  await last.page.locator(".match-unmatched > summary").click();
  await assertFit(last.page, 320, "new notebook form");
  await assertTargets(last.page, ".notebooks");
  await shot(last.page, "new-notebook-320");
  await last.context.close();
  check(
    "empty wordbook, long name, mobile creation form and unknown-word recovery remain usable",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        base,
        checks,
        measurements,
        errors,
        at: new Date().toISOString(),
        device: "Chromium mobile viewport emulation, not physical devices",
      },
      null,
      2,
    ),
  );
  console.log(
    `Verified ${checks.length} responsive groups; screenshots: ${out}`,
  );
} finally {
  await browser.close();
}
