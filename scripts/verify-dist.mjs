import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const distDir = "dist";
const indexPath = join(distDir, "index.html");
const assetsDir = join(distDir, "assets");

if (!existsSync(indexPath)) {
  console.error("verify-dist: missing dist/index.html — run npm run build first.");
  process.exit(1);
}

const indexHtml = readFileSync(indexPath, "utf8");
const assetRefs = [
  ...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
].map((match) => match[1].slice("/assets/".length));

if (assetRefs.length === 0) {
  console.error("verify-dist: index.html does not reference any /assets/ bundles.");
  process.exit(1);
}

const missing = assetRefs.filter(
  (asset) => !existsSync(join(assetsDir, asset))
);

if (missing.length > 0) {
  const onDisk = existsSync(assetsDir)
    ? readdirSync(assetsDir).join(", ")
    : "(assets directory missing)";
  console.error("verify-dist: index.html references missing bundles:");
  for (const file of missing) console.error(`  - assets/${file}`);
  console.error(`verify-dist: assets on disk: ${onDisk}`);
  process.exit(1);
}

console.log(
  `verify-dist: ok (${assetRefs.length} bundle(s): ${assetRefs.join(", ")})`
);
