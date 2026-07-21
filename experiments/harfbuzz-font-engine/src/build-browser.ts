import {copyFile, mkdir} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const experimentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(experimentRoot, "src");
const outputRoot = resolve(experimentRoot, "dist");

await mkdir(outputRoot, {recursive: true});
await build({
  entryPoints: [resolve(sourceRoot, "browser-worker.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["module"],
  outfile: resolve(outputRoot, "browser-worker.js"),
});
await copyFile(
  resolve(experimentRoot, "node_modules/harfbuzzjs/dist/harfbuzz.wasm"),
  resolve(outputRoot, "harfbuzz.wasm"),
);
