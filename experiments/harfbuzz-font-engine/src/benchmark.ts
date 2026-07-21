import assert from "node:assert/strict";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {performance} from "node:perf_hooks";
import {gzipSync} from "node:zlib";
import {fixtureById, loadManifest, observationRoot, readFixture} from "./node-fixtures.js";
import type {Observation} from "./observation.js";

const importStarted = performance.now();
const {FontHandle} = await import("./font-engine.js");
const moduleStartupMs = performance.now() - importStarted;
const manifest = await loadManifest();
const fixture = fixtureById(manifest, "noto-sans-variable-ttf");
const bytes = await readFixture(fixture);

const firstLoadStarted = performance.now();
const firstHandle = await FontHandle.fromBytes(bytes.slice(0));
const firstLoadMs = performance.now() - firstLoadStarted;
const firstShapeStarted = performance.now();
firstHandle.shape({text: "office", direction: "ltr", script: "Latn", language: "en"});
const firstShapeMs = performance.now() - firstShapeStarted;

const shapeInput = {text: "office", direction: "ltr", script: "Latn", language: "en"} as const;
for (let index = 0; index < 100; index += 1) firstHandle.shape(shapeInput);
globalThis.gc?.();
const beforeWarmShapes = process.memoryUsage();
const warmShapeStarted = performance.now();
const warmShapeSamples: Array<{iteration: number; rss: number; heapUsed: number; external: number}> = [];
for (let index = 0; index < 5_000; index += 1) {
  firstHandle.shape(shapeInput);
  if ((index + 1) % 500 === 0) {
    globalThis.gc?.();
    const sample = process.memoryUsage();
    warmShapeSamples.push({
      iteration: index + 1,
      rss: sample.rss,
      heapUsed: sample.heapUsed,
      external: sample.external,
    });
  }
}
const warmShapeMs = performance.now() - warmShapeStarted;
globalThis.gc?.();
const afterWarmShapes = process.memoryUsage();

globalThis.gc?.();
const before = process.memoryUsage();
const cycleStarted = performance.now();
for (let index = 0; index < 50; index += 1) {
  const handle = await FontHandle.fromBytes(bytes.slice(0));
  handle.shape(shapeInput);
  if (index % 5 === 0) {
    globalThis.gc?.();
    await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
  }
}
globalThis.gc?.();
await new Promise<void>((resolveTurn) => setImmediate(resolveTurn));
const after = process.memoryUsage();
const repeatedLoadAndShapeMs = performance.now() - cycleStarted;

const packageRoot = resolve(import.meta.dirname, "../node_modules/harfbuzzjs/dist");
const [wasm, wrapper, loader] = await Promise.all([
  stat(resolve(packageRoot, "harfbuzz.wasm")),
  stat(resolve(packageRoot, "index.mjs")),
  stat(resolve(packageRoot, "harfbuzz.js")),
]);
const browserWorker = await stat(resolve(import.meta.dirname, "browser-worker.js"));
const gzipBytes = await Promise.all(
  ["harfbuzz.wasm", "index.mjs", "harfbuzz.js"].map(async (file) =>
    gzipSync(await readFile(resolve(packageRoot, file)), {level: 9}).byteLength,
  ),
);
const result = {
  lifecycle: "GC-only FinalizationRegistry; harfbuzzjs@1.4.0 exposes no explicit destroy/dispose",
  fontByteOwnership: "Blob copies the supplied ArrayBuffer into WASM-owned memory",
  shapingBuffer: "one cleared Buffer reused per FontHandle",
  cycles: 50,
  warmShapeIterations: 5_000,
  artifactBytes: {
    wasm: wasm.size,
    wrapper: wrapper.size,
    loader: loader.size,
    browserWorker: browserWorker.size,
    total: wasm.size + wrapper.size + loader.size,
  },
  artifactGzipBytes: {
    wasm: gzipBytes[0] ?? 0,
    wrapper: gzipBytes[1] ?? 0,
    loader: gzipBytes[2] ?? 0,
    total: gzipBytes.reduce((sum, size) => sum + size, 0),
  },
  memoryDeltaBytes: {
    rss: after.rss - before.rss,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
    arrayBuffers: after.arrayBuffers - before.arrayBuffers,
  },
  warmShapeMemoryDeltaBytes: {
    rss: afterWarmShapes.rss - beforeWarmShapes.rss,
    heapUsed: afterWarmShapes.heapUsed - beforeWarmShapes.heapUsed,
    external: afterWarmShapes.external - beforeWarmShapes.external,
    arrayBuffers: afterWarmShapes.arrayBuffers - beforeWarmShapes.arrayBuffers,
  },
  warmShapeSamples,
};
assert.ok(result.memoryDeltaBytes.rss < 128 * 1024 * 1024);
assert.ok(result.warmShapeMemoryDeltaBytes.rss < 32 * 1024 * 1024);
assert.equal(
  warmShapeSamples.every((sample, index) => index === 0 || sample.rss > (warmShapeSamples[index - 1]?.rss ?? 0)),
  false,
  "sampled RSS must not grow strictly at every interval",
);

const observation: Observation<typeof result> = {
  recordedAt: new Date().toISOString(),
  environment: {
    runtime: `Node ${process.version}`,
    platform: process.platform,
    architecture: process.arch,
    harfbuzzjs: "1.4.0",
    harfbuzzRevision: "HarfBuzz 14.2.1",
  },
  fixtures: [{file: fixture.file, format: fixture.format, sha256: fixture.sha256}],
  input: {cycles: 50, text: "office"},
  result,
  measurements: {
    moduleStartupMs,
    firstLoadMs,
    firstShapeMs,
    warmShapeMs,
    warmShapeMicrosecondsEach: (warmShapeMs * 1_000) / 5_000,
    repeatedLoadAndShapeMs,
  },
};
await mkdir(observationRoot, {recursive: true});
await writeFile(
  resolve(observationRoot, "startup-and-memory.json"),
  `${JSON.stringify(observation, null, 2)}\n`,
);
console.log("Startup, artifact-size, and lifecycle measurements recorded.");
