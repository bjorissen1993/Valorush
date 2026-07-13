import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {string} [distDir="dist"]
 * @returns {{ ok: boolean; assetRefs: string[]; missing: string[]; assetsOnDisk: string[]; error?: string }}
 */
export function verifyDist(distDir = "dist") {
  const indexPath = join(distDir, "index.html");
  const assetsDir = join(distDir, "assets");

  if (!existsSync(indexPath)) {
    return {
      ok: false,
      assetRefs: [],
      missing: [],
      assetsOnDisk: [],
      error: `missing ${distDir}/index.html — run npm run build first`,
    };
  }

  const indexHtml = readFileSync(indexPath, "utf8");
  const assetRefs = [
    ...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((match) => match[1].slice("/assets/".length));

  if (assetRefs.length === 0) {
    return {
      ok: false,
      assetRefs: [],
      missing: [],
      assetsOnDisk: [],
      error: "index.html does not reference any /assets/ bundles",
    };
  }

  const assetsOnDisk = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const missing = assetRefs.filter(
    (asset) => !existsSync(join(assetsDir, asset))
  );

  if (missing.length > 0) {
    return {
      ok: false,
      assetRefs,
      missing,
      assetsOnDisk,
      error: "index.html references missing bundles",
    };
  }

  return { ok: true, assetRefs, missing: [], assetsOnDisk };
}

function parseDistDirArg() {
  const flagIndex = process.argv.indexOf("--dist-dir");
  if (flagIndex === -1) return "dist";
  const value = process.argv[flagIndex + 1]?.trim();
  if (!value) {
    console.error("verify-dist: --dist-dir requires a path");
    process.exit(1);
  }
  return value;
}

function main() {
  const distDir = parseDistDirArg();
  const result = verifyDist(distDir);

  if (!result.ok) {
    console.error(`verify-dist: ${result.error}`);
    if (result.missing.length > 0) {
      console.error("verify-dist: index.html references missing bundles:");
      for (const file of result.missing) {
        console.error(`  - assets/${file}`);
      }
      console.error(
        `verify-dist: assets on disk: ${result.assetsOnDisk.join(", ") || "(assets directory missing)"}`
      );
    }
    process.exit(1);
  }

  console.log(
    `verify-dist: ok (${result.assetRefs.length} bundle(s): ${result.assetRefs.join(", ")})`
  );
}

const invokedDirectly =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  main();
}
