// Downloads the licensed brand fonts (Fontshare, ITF FFL) into src/app/fonts/.
// The .woff2 files are git-ignored because the licence forbids redistribution.
// Idempotent: files already present are skipped. Exits non-zero with guidance on failure.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, copyFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontsDir = join(root, "src", "app", "fonts");

const FONTS = [
  { slug: "tanker", archiveDir: "Tanker_Complete", file: "Tanker-Regular.woff2" },
  { slug: "nippo", archiveDir: "Nippo_Complete", file: "Nippo-Variable.woff2" },
];

function fail(message) {
  console.error(`\nfonts:fetch failed: ${message}`);
  console.error(
    "Fix: check your network and that `unzip` is installed, then run `pnpm fonts:fetch`.\n" +
      "Manual alternative: download Tanker and Nippo from https://www.fontshare.com and copy\n" +
      "Fonts/WEB/fonts/Tanker-Regular.woff2 and Nippo-Variable.woff2 into src/app/fonts/.",
  );
  process.exit(1);
}

const isPresent = (file) => existsSync(file) && statSync(file).size > 0;
const missing = FONTS.filter((font) => !isPresent(join(fontsDir, font.file)));

if (missing.length === 0) {
  console.log("fonts:fetch: all fonts present, nothing to do.");
  process.exit(0);
}

try {
  execFileSync("unzip", ["-v"], { stdio: "ignore" });
} catch {
  fail("the `unzip` command is not available.");
}

await mkdir(fontsDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "goyniela-fonts-"));

try {
  for (const font of missing) {
    const url = `https://api.fontshare.com/v2/fonts/download/${font.slug}`;
    console.log(`fonts:fetch: downloading ${font.slug}...`);
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    } catch (error) {
      fail(`could not reach ${url} (${error instanceof Error ? error.message : error}).`);
    }
    if (!response.ok) fail(`${url} answered HTTP ${response.status}.`);

    const zipPath = join(work, `${font.slug}.zip`);
    writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

    const entry = `${font.archiveDir}/Fonts/WEB/fonts/${font.file}`;
    try {
      execFileSync("unzip", ["-o", "-q", zipPath, entry, "-d", work], { stdio: "pipe" });
    } catch {
      fail(`${font.file} was not found in the ${font.slug} archive (layout may have changed).`);
    }
    const extracted = join(work, entry);
    if (!isPresent(extracted)) fail(`${font.file} extracted empty.`);
    copyFileSync(extracted, join(fontsDir, font.file));
    console.log(`fonts:fetch: installed ${font.file}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
