import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const core = [
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "LICENSE.txt",
  "CONTENT_LICENSE.md",
  "FONT_LICENSE.txt",
  "atlas/index.json",
];
const assets = (await readdir(path.join(root, "assets")))
  .filter((name) => /\.(js|css|woff2?)$/.test(name))
  .sort()
  .map((name) => `assets/${name}`);
const files = [...core, ...assets];
const hash = createHash("sha256");
for (const file of [...files, "sw.js"])
  hash.update(await readFile(path.join(root, file)));
let sw = await readFile(path.join(root, "sw.js"), "utf8");
sw = sw
  .replace(
    '"__BUILD_VERSION__"',
    JSON.stringify(hash.digest("hex").slice(0, 12)),
  )
  .replace(
    '"__PRECACHE_ASSETS__"',
    JSON.stringify(files.map((file) => `./${file}`)),
  );
await writeFile(path.join(root, "sw.js"), sw);
await writeFile(path.join(root, ".nojekyll"), "");
console.log(
  `Offline shell prepared: ${files.length} files; vocabulary media cached on demand.`,
);
