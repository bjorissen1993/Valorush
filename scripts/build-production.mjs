import { spawnSync } from "node:child_process";
import { cpSync, renameSync, rmSync } from "node:fs";
import { verifyDist } from "./verify-dist.mjs";

const STAGING_DIR = "dist.staging";

function run(label, command, args) {
  console.log(`build-production: ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertDist(label, distDir) {
  const result = verifyDist(distDir);
  if (result.ok) {
    console.log(
      `build-production: ${label} ok (${result.assetRefs.join(", ")})`
    );
    return;
  }

  console.error(`build-production: ${label} failed — ${result.error}`);
  if (result.missing.length > 0) {
    for (const file of result.missing) {
      console.error(`  - missing assets/${file}`);
    }
    console.error(
      `  assets on disk: ${result.assetsOnDisk.join(", ") || "(none)"}`
    );
  }
  process.exit(1);
}

console.log("build-production: clearing dist, dist.staging, dist-server");
for (const dir of ["dist", STAGING_DIR, "dist-server"]) {
  rmSync(dir, { recursive: true, force: true });
}

run("vite build (staging)", "npx", ["vite", "build", "--outDir", STAGING_DIR]);
assertDist("staging verify", STAGING_DIR);

console.log("build-production: promoting dist.staging -> dist");
rmSync("dist", { recursive: true, force: true });
try {
  renameSync(STAGING_DIR, "dist");
} catch (error) {
  const code = /** @type {NodeJS.ErrnoException} */ (error).code;
  if (code !== "EPERM" && code !== "EXDEV" && code !== "EEXIST") {
    throw error;
  }
  cpSync(STAGING_DIR, "dist", { recursive: true });
  rmSync(STAGING_DIR, { recursive: true, force: true });
}

assertDist("final verify", "dist");
run("bundle server", "node", ["scripts/bundle-server.mjs"]);

console.log("build-production: complete");
