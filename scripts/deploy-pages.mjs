import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const git = (args, options = {}) =>
  execFileSync("git", args, { encoding: "utf8", ...options }).trim();
const root = git(["rev-parse", "--show-toplevel"]);
process.chdir(root);
const origin = git(["remote", "get-url", "origin"]);
if (!/github\.com[:/]michaelzhouy\/word-atlas-personal(?:\.git)?$/.test(origin))
  throw new Error(
    "This deployment command is scoped to michaelzhouy/word-atlas-personal. Update the target deliberately before using another repository.",
  );
const dist = path.join(root, "dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const sw = await readFile(path.join(dist, "sw.js"), "utf8");
if (!html.includes("拾词") || sw.includes("__PRECACHE_ASSETS__"))
  throw new Error("Run the full production build before deploying.");

const ref = "refs/heads/gh-pages";
const remote = git(["ls-remote", "--heads", "origin", ref]).split(/\s/)[0];
if (remote) git(["fetch", "--depth=1", "origin", ref]);
const dir = await mkdtemp(path.join(os.tmpdir(), "shici-deploy-"));
try {
  // A separate index publishes dist without switching branches or staging source files.
  const env = {
    ...process.env,
    GIT_INDEX_FILE: path.join(dir, "index"),
    GIT_DIR: git(["rev-parse", "--absolute-git-dir"]),
    GIT_WORK_TREE: dist,
  };
  const work = { env, cwd: dist };
  git(["read-tree", "--empty"], work);
  git(["add", "--all", "--force"], work);
  const tree = git(["write-tree"], work);
  const args = ["commit-tree", tree];
  if (remote) args.push("-p", remote);
  const source = git(["rev-parse", "--short", "HEAD"]);
  const commit = git(args, { input: `Publish Shici from ${source}\n` });
  git(["push", "origin", `${commit}:${ref}`]);
  console.log(
    `Published ${commit} to gh-pages. GitHub Pages may take a few minutes to update.`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
