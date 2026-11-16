import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = (
  process.env.APP_URL || "http://localhost:5188/word-atlas-personal/"
).replace(/\/?$/, "/");
const out = path.resolve("output/verification/personal");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(path.join(os.tmpdir(), "shici-personal-"));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: existsSync(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  )
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined,
  headless: true,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const check = (s) => {
  checks.push(s);
  console.log(`PASS ${s}`);
};
const saved = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("shici:v2:word-atlas-open")),
  );
const waitSaved = (predicate, arg) =>
  page.waitForFunction(
    ({ source, arg }) => {
      const p = JSON.parse(localStorage.getItem("shici:v2:word-atlas-open"));
      try {
        return (
          p && new Function("p", "arg", `return (${source})(p, arg)`)(p, arg)
        );
      } catch {
        return false;
      }
    },
    { source: predicate.toString(), arg },
  );
const shot = async (name) => {
  const modal = (await page.locator(".sheet-root").count()) > 0;
  await page.waitForFunction(() => !document.querySelector(".toast"));
  if (modal)
    await page.locator(".sheet").evaluate((el) => {
      el.scrollTop = 0;
    });
  else await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({
    path: path.join(out, `${name}.png`),
    fullPage: !modal,
    animations: "disabled",
  });
};
const showWord = async (id) => {
  await page.goto(`${base}#/atlas?w=${encodeURIComponent(id)}`);
  await page.locator(".sheet .entry .headword").waitFor();
};
const showBook = async (id) => {
  await page.goto(`${base}#/notebooks?book=${id}`);
  await page.locator(".notebook-detail").waitFor();
};

try {
  await page.goto(base);
  await page.getByRole("dialog", { name: "欢迎", exact: true }).waitFor();
  await page.getByRole("button", { name: "出发", exact: true }).click();
  const index = await page.evaluate(
    async (base) => (await fetch(`${base}atlas/index.json`)).json(),
    base,
  );
  const lookup = new Map(index.words.map((r) => [r[1].toLowerCase(), r]));
  const library = lookup.get("library");
  const journey = lookup.get("journey");
  const phrase = index.words.find((r) => r[1].includes(" "));
  const extras = index.words
    .filter((r) => ![library[0], journey[0], phrase[0]].includes(r[0]))
    .slice(0, 3);
  const ids = [library[0], journey[0], phrase[0]];
  const wordMap = new Map(index.words.map((r) => [r[0], r[1]]));

  await page.goto(`${base}#/notebooks`);
  await page.getByRole("button", { name: "新建词本", exact: true }).click();
  await page.getByLabel("词本名称", { exact: true }).fill("旅行与阅读");
  await page
    .getByLabel("粘贴单词（可稍后添加）")
    .fill(
      `${library[1]}\n${journey[1]}，${phrase[1]}\nlibrary;not-a-real-word-xyz`,
    );
  await page.getByText("匹配到 3 个词", { exact: true }).waitFor();
  await page.getByText("已去重 1 项", { exact: false }).waitFor();
  await page.locator(".match-unmatched summary").click();
  await page.getByText("not-a-real-word-xyz", { exact: true }).waitFor();
  await page.getByRole("button", { name: "创建词本", exact: true }).click();
  await waitSaved((p) => p.notebooks.length === 1);
  const bookId = (await saved()).notebooks[0].id;
  assert.deepEqual((await saved()).notebooks[0].wordIds, ids);
  await page
    .getByRole("button", { name: "用这个词本学新词", exact: false })
    .click();
  await waitSaved((p, id) => p.activeNotebookId === id, bookId);
  check(
    "create wordbook, exact phrase matching, duplicates, unknown-word feedback and source selection",
  );

  await showWord(extras[0][0]);
  await page
    .locator(".sheet")
    .getByRole("button", { name: "收藏", exact: true })
    .click();
  await page.getByRole("button", { name: "收进词本", exact: true }).click();
  await page.getByRole("button", { name: "收进这个词本", exact: true }).click();
  await waitSaved((p, id) => p.notebooks[0].wordIds.includes(id), extras[0][0]);
  await showWord(extras[1][0]);
  await page
    .locator(".sheet")
    .getByRole("button", { name: "收藏", exact: true })
    .click();
  const image = await page.locator(".sheet .entry-art .illo").boundingBox();
  assert.ok(image.height <= 150);
  assert.equal(await page.locator(".entry-more").getAttribute("open"), null);
  await page.locator(".entry-more > summary").click();
  assert.notEqual(await page.locator(".entry-more").getAttribute("open"), null);
  await page.locator(".entry-more > summary").click();
  await shot("compact-word-mobile");
  await showBook(bookId);
  await page.locator(".notebook-manage > summary").click();
  await page.getByRole("button", { name: "从收藏加入", exact: true }).click();
  await waitSaved((p) => p.notebooks[0].wordIds.length === 5);
  assert.equal(new Set((await saved()).notebooks[0].wordIds).size, 5);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.locator(".notebook-manage > summary").click();
  await shot("wordbook-mobile");
  check(
    "add from word detail and favorites; compact mobile card keeps expandable content",
  );

  await page.goto(`${base}#/`);
  await page
    .getByRole("button", { name: "开始今天的旅程", exact: false })
    .click();
  await page.locator(".intro .headword").waitFor();
  await waitSaved((p) => p.session?.newIds.length === 5);
  const initial = (await saved()).session;
  assert.deepEqual(initial.newIds, [...ids, extras[0][0], extras[1][0]]);
  await page.getByRole("button", { name: "暂停并返回", exact: true }).click();
  await page.goto(`${base}#/notebooks`);
  await page.getByRole("button", { name: "改用完整图鉴", exact: true }).click();
  await waitSaved((p) => p.activeNotebookId === null);
  assert.deepEqual((await saved()).session, initial);
  await page.reload();
  assert.deepEqual((await saved()).session, initial);
  await page.getByRole("button", { name: "继续这一轮", exact: false }).click();
  await page.locator(".intro .headword").waitFor();
  await page.getByRole("button", { name: "已熟悉，跳过", exact: true }).click();
  await waitSaved((p, id) => p.familiar.includes(id), initial.newIds[0]);
  assert.equal(
    await page.locator(".intro .headword").textContent(),
    wordMap.get(initial.newIds[1]),
  );
  await page.getByRole("button", { name: "已熟悉，跳过", exact: true }).click();
  await waitSaved((p) => p.familiar.length === 2);
  assert.equal(
    await page.locator(".intro .headword").textContent(),
    wordMap.get(initial.newIds[2]),
  );
  await shot("learning-mobile");
  check(
    "unfinished session survives source change and reload; consecutive skips advance correctly",
  );

  let rounds = 0;
  while (rounds++ < 30) {
    const s = (await saved()).session;
    if (s.finished) break;
    const step = s.steps[s.index];
    if (step.kind === "intro") {
      await page.getByRole("button", { name: "认识了", exact: false }).click();
      await waitSaved((p, i) => p.session.index > i, s.index);
    } else {
      if (!s.pending) {
        if (step.kind === "spell") {
          await page.locator(".spell-input").fill(wordMap.get(step.id));
          await page.locator('.spell button[type="submit"]').click();
        } else await page.locator(`button[data-option="${step.id}"]`).click();
        await waitSaved((p) => !!p.session.pending);
      }
      await page.locator(".feedback button").click();
      await waitSaved((p, i) => p.session.index > i, s.index);
    }
  }
  let p = await saved();
  assert.ok(p.session.finished);
  assert.equal(Object.keys(p.cards).length, 3);
  assert.equal(
    Object.values(p.days).reduce((n, d) => n + d.n, 0),
    3,
  );
  assert.equal(
    Object.values(p.days).reduce((n, d) => n + d.r, 0),
    3,
  );
  assert.deepEqual(
    Object.keys(p.session.graded).sort(),
    p.session.newIds.slice().sort(),
  );
  assert.equal(await page.locator(".summary-words li").count(), 3);
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await showBook(bookId);
  await page
    .getByRole("button", { name: "用这个词本学新词", exact: false })
    .click();
  await page.goto(`${base}#/`);
  await page
    .getByRole("button", { name: "去词本看看", exact: false })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "再认识 5 个新词", exact: false })
      .count(),
    0,
  );
  check(
    "skipped words do not inflate accuracy, daily counts or stars; exhausted book has no unrelated fallback",
  );

  await page.goto(`${base}#/atlas`);
  await page.getByRole("button", { name: "已熟悉", exact: true }).click();
  await page.getByText("2 个结果", { exact: true }).waitFor();
  await showWord(ids[0]);
  await page.getByRole("button", { name: "恢复新词学习", exact: true }).click();
  await waitSaved((p) => p.familiar.length === 1);
  await showBook(bookId);
  await page.getByRole("button", { name: "恢复学习", exact: true }).click();
  await waitSaved((p) => p.familiar.length === 0);
  await page.goto(`${base}#/`);
  await page
    .getByRole("button", { name: "开始今天的旅程", exact: false })
    .click();
  await page.locator(".intro .headword").waitFor();
  await waitSaved((p) => p.session.newIds.length === 2);
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "已熟悉，跳过", exact: true })
      .click();
    await waitSaved((p, n) => p.familiar.length === n, i + 1);
  }
  await page.getByText("本轮未答题", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "分享成绩卡", exact: false })
      .count(),
    0,
  );
  assert.equal(Object.keys((await saved()).cards).length, 3);
  await shot("all-familiar-mobile");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  check(
    "familiar words are discoverable and restorable; all-skipped round has no misleading score",
  );

  await page.goto(`${base}#/me`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const backupPath = path.join(out, "personal-backup.json");
  await (await download).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  assert.equal(backup.progress.notebooks.length, 1);
  assert.equal(backup.progress.familiar.length, 2);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "清空记录", exact: true }).click();
  await waitSaved((p) => Object.keys(p.cards).length === 0);
  p = await saved();
  assert.deepEqual(p.notebooks, backup.progress.notebooks);
  assert.deepEqual(p.bookmarks, backup.progress.bookmarks);
  assert.deepEqual(p.familiar, backup.progress.familiar);
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await waitSaved((p) => Object.keys(p.cards).length === 3);
  p = await saved();
  assert.deepEqual(p.notebooks, backup.progress.notebooks);
  assert.deepEqual(p.familiar, backup.progress.familiar);
  await showBook(bookId);
  await page.locator(".notebook-manage > summary").click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "删除词本 旅行与阅读", exact: true })
    .click();
  await waitSaved(
    (p) => p.notebooks.length === 0 && p.activeNotebookId === null,
  );
  assert.deepEqual((await saved()).cards, backup.progress.cards);
  check(
    "backup round-trip includes books and familiar marks; reset and book deletion preserve promised data",
  );

  // Use an actual old-format backup to verify migration, in this isolated profile only.
  const legacy = structuredClone(backup);
  delete legacy.progress.notebooks;
  delete legacy.progress.activeNotebookId;
  delete legacy.progress.familiar;
  const legacyPath = path.join(out, "legacy-backup.json");
  await writeFile(legacyPath, JSON.stringify(legacy));
  await page.goto(`${base}#/me`);
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles(legacyPath);
  await waitSaved((p) => p.notebooks?.length === 0 && p.familiar?.length === 0);
  assert.deepEqual((await saved()).cards, backup.progress.cards);
  assert.deepEqual((await saved()).days, backup.progress.days);
  check("old version 2 backup imports without losing cards or daily history");

  // Restore the new backup for desktop and offline checks.
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await waitSaved((p) => p.notebooks.length === 1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await showBook(bookId);
  await shot("wordbook-desktop");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    1440,
  );
  await page.getByRole("button", { name: "切换到深色", exact: true }).click();
  await shot("wordbook-dark-desktop");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.locator(".notebook-detail h2").waitFor();
  assert.equal(
    await page.locator(".notebook-detail h2").textContent(),
    "旅行与阅读",
  );
  assert.deepEqual((await saved()).notebooks, backup.progress.notebooks);
  await context.setOffline(false);
  assert.deepEqual(errors, []);
  check(
    "desktop, dark mode and offline reload retain personal books with no page errors",
  );
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      { base, checks, errors, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(`Verified ${checks.length} personal learning flows at ${base}`);
} catch (error) {
  await shot("failure").catch(() => {});
  throw error;
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
