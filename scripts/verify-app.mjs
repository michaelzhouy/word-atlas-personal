import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = (
  process.env.APP_URL || "http://localhost:5188/word-atlas-personal/"
).replace(/\/?$/, "/");
const out = path.resolve("output/verification");
await mkdir(out, { recursive: true });
const chrome =
  process.env.CHROME_PATH ||
  (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const profile = await mkdtemp(path.join(os.tmpdir(), "shici-browser-"));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: true,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  colorScheme: "light",
});
const browser = context.browser();
const errors = [];
const checks = [];
const check = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
let page = await context.newPage();
context.on("page", (p) =>
  p.on("pageerror", (error) => errors.push(error.message)),
);
page.on("pageerror", (error) => errors.push(error.message));
await context.addInitScript(() => {
  // Observe real playback without replacing media methods or network responses.
  const OriginalAudio = window.Audio;
  window.__played = [];
  window.Audio = class extends OriginalAudio {
    constructor(...args) {
      super(...args);
      this.addEventListener("playing", () =>
        window.__played.push(this.currentSrc),
      );
    }
  };
  if (location.protocol.startsWith("http"))
    void caches.open("unrelated-app-sentinel");
});

const progress = () =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("shici:v2:"),
    );
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
const waitSave = (index, pending) =>
  page.waitForFunction(
    ({ index, pending }) => {
      const key = Object.keys(localStorage).find((key) =>
        key.startsWith("shici:v2:"),
      );
      const s = key && JSON.parse(localStorage.getItem(key)).session;
      return s && s.index === index && !!s.pending === pending;
    },
    { index, pending },
  );
const screenshot = (name) =>
  page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });

try {
  await page.clock.install();
  await page.goto(base);
  await page.getByRole("dialog", { name: "欢迎", exact: true }).waitFor();
  await screenshot("onboarding-mobile");
  await page.getByRole("button", { name: "出发" }).click();
  await page.getByRole("button", { name: "开始今天的旅程" }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.ok(
    await page.evaluate(async () =>
      (await caches.keys()).includes("unrelated-app-sentinel"),
    ),
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await screenshot("today-mobile");
  check("first visit, 10-word default, mobile layout, scoped offline shell");

  const index = await page.evaluate(
    async (base) => (await fetch(`${base}atlas/index.json`)).json(),
    base,
  );
  const words = new Map(index.words.map((row) => [row[0], row[1]]));
  await page.getByRole("button", { name: "开始今天的旅程" }).click();
  await waitSave(0, false);
  const firstSession = (await progress()).session;
  assert.equal(firstSession.newIds.length, 10);
  await page.locator(".intro .speak").first().click();
  await page.waitForFunction(() =>
    window.__played.some((url) => url.includes("/atlas/audio/")),
  );
  check("word pronunciation plays a real recording");
  await screenshot("learning-mobile");

  let wrong = false;
  let resumed = false;
  let rounds = 0;
  while (rounds++ < 45) {
    const p = await progress();
    const s = p.session;
    if (s.finished) break;
    const step = s.steps[s.index];
    if (step.kind === "intro") {
      await page.getByRole("button", { name: "认识了" }).click();
      await waitSave(s.index + 1, false);
      continue;
    }
    if (!s.pending) {
      const fail = !wrong;
      if (step.kind === "spell") {
        await page
          .locator(".spell-input")
          .fill(words.get(step.id) + (fail ? "x" : ""));
        await page.locator('.spell button[type="submit"]').click();
      } else {
        const id = fail ? step.options.find((id) => id !== step.id) : step.id;
        await page.locator(`button[data-option="${id}"]`).click();
      }
      if (fail) wrong = true;
      await waitSave(s.index, true);
    }
    if (!resumed) {
      const before = await progress();
      await page.reload();
      await page.locator(".feedback").waitFor();
      assert.deepEqual((await progress()).cards, before.cards);
      assert.equal((await progress()).session.pending.correct, false);
      resumed = true;
      check("reload resumes pending answer without grading twice");
    }
    await page.locator(".feedback button").click();
    await page.waitForFunction((previous) => {
      const key = Object.keys(localStorage).find((key) =>
        key.startsWith("shici:v2:"),
      );
      return JSON.parse(localStorage.getItem(key)).session.index > previous;
    }, s.index);
  }
  const learned = await progress();
  assert.ok(learned.session.finished);
  assert.equal(Object.keys(learned.cards).length, 10);
  assert.equal(
    Object.values(learned.days).reduce((n, d) => n + d.r, 0),
    10,
  );
  assert.equal(
    Object.values(learned.days).reduce((n, d) => n + d.c, 0),
    9,
  );
  assert.equal(learned.mistakes.length, 1);
  check("10 new words complete; wrong word retries preserve honest accuracy");
  await page.getByRole("button", { name: "完成", exact: true }).click();

  await page.goto(`${base}#/me`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const backupPath = path.join(out, "test-backup.json");
  await (await download).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  assert.equal(Object.keys(backup.progress.cards).length, 10);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空记录", exact: true }).click();
  assert.equal(Object.keys((await progress()).cards).length, 0);
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await page.getByText("已恢复 10 个词的记忆", { exact: true }).waitFor();
  assert.deepEqual((await progress()).cards, backup.progress.cards);
  for (const [text, message] of [
    ["{broken", "文件不是有效的 JSON。"],
    [
      JSON.stringify({
        ...backup,
        progress: { ...backup.progress, datasetId: "de-personal-v1" },
      }),
      "备份来自另一个词库，请先切换到对应词库。",
    ],
  ]) {
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from(text),
      });
    await page.getByText(message, { exact: true }).waitFor();
    assert.equal(Object.keys((await progress()).cards).length, 10);
  }
  await screenshot("me-mobile");
  check("backup export/restore, invalid file and different-dataset protection");

  await page.goto(`${base}#/practice`);
  await page.getByRole("button", { name: "开始一轮", exact: true }).click();
  for (let i = 0; i < 10; i++) {
    const text = await page.locator(".typing-text").innerText();
    await page.locator(".typing-input").fill(text);
    await page.waitForFunction(
      (previous) =>
        !document.querySelector(".typing-text") ||
        document.querySelector(".typing-text").textContent !== previous,
      text,
    );
  }
  await page.getByText("本轮完成", { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const key = Object.keys(localStorage).find((key) =>
      key.startsWith("shici:v2:"),
    );
    return JSON.parse(localStorage.getItem(key)).typing.length === 1;
  });
  assert.deepEqual((await progress()).cards, backup.progress.cards);
  check(
    "10-item spelling practice saves results without changing review schedule",
  );

  const lastDue = Math.max(
    ...Object.values((await progress()).cards).map((card) => card.due),
  );
  await page.clock.setFixedTime(new Date(lastDue + 60000));
  await page.goto(`${base}#/`);
  await page.reload();
  const reviewOnly = page.getByRole("button", { name: "只复习", exact: true });
  if (await reviewOnly.isVisible()) await reviewOnly.click();
  else
    await page
      .getByRole("button", { name: "开始今天的旅程", exact: true })
      .click();
  await waitSave(0, false);
  assert.equal((await progress()).session.reviewIds.length, 10);
  assert.equal((await progress()).session.newIds.length, 0);
  check("due words enter a review-only session after time passes");

  const old = page;
  page = await context.newPage();
  await page.goto(`${base}#/me`);
  await page.getByRole("heading", { name: "学习备份", exact: true }).waitFor();
  await old.close();
  assert.equal(Object.keys((await progress()).cards).length, 10);
  check("closing and reopening the app preserves learning progress");

  const id = firstSession.newIds[0];
  const audio = `${base}atlas/audio/uk/${id}.mp3`;
  // Fetch through the controlling service worker, including the byte range used by mobile audio.
  const audioResult = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=0-99" } });
    return {
      status: response.status,
      length: (await response.arrayBuffer()).byteLength,
      range: response.headers.get("Content-Range"),
    };
  }, audio);
  assert.equal(audioResult.status, 206);
  assert.equal(audioResult.length, 100);
  await page.goto(`${base}#/atlas?w=${encodeURIComponent(id)}`);
  await page.locator(".sheet .headword").waitFor();
  const cdp = await context.newCDPSession(page);
  const installation = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(installation.installabilityErrors, []);
  check("manifest, icons and browser installation checks");

  await context.setOffline(true);
  await page.reload();
  await page.locator(".sheet .headword").waitFor();
  assert.equal(
    await page.locator(".sheet .headword").innerText(),
    words.get(id),
  );
  const offlineAudio = await page.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=-32" } });
    return {
      status: response.status,
      length: (await response.arrayBuffer()).byteLength,
    };
  }, audio);
  assert.deepEqual(offlineAudio, { status: 206, length: 32 });
  const invalidRange = await page.evaluate(
    async (url) =>
      (await fetch(url, { headers: { Range: "bytes=99999999-" } })).status,
    audio,
  );
  assert.equal(invalidRange, 416);
  check(
    "offline reload restores cached word and supports cached audio byte ranges",
  );
  await context.setOffline(false);

  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await desktop.goto(base);
  await desktop.getByRole("button", { name: "出发" }).click();
  await desktop.getByRole("button", { name: "开始今天的旅程" }).waitFor();
  assert.equal(
    await desktop.evaluate(() => document.documentElement.scrollWidth),
    1440,
  );
  await desktop.screenshot({
    path: path.join(out, "today-desktop.png"),
    fullPage: true,
  });
  await desktop.close();
  check("desktop layout");
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "report.json"),
    JSON.stringify(
      {
        url: base,
        checkedAt: new Date().toISOString(),
        checks,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(`All ${checks.length} browser checks passed.`);
} catch (error) {
  await screenshot("failure").catch(() => {});
  await writeFile(
    path.join(out, "failure.json"),
    JSON.stringify({ error: error.stack, checks, pageErrors: errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
  await rm(profile, { recursive: true, force: true });
}
