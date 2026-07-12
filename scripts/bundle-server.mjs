import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist-server", { recursive: true });

await esbuild.build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "dist-server/index.cjs",
  format: "cjs",
  logLevel: "info",
  banner: {
    js: 'const __import_meta_url = require("url").pathToFileURL(__filename).href;',
  },
  define: {
    "import.meta.url": "__import_meta_url",
  },
});

console.log("Bundled lobby server → dist-server/index.cjs");
