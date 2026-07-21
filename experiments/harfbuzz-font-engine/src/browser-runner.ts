import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {extname, resolve} from "node:path";
import puppeteer from "puppeteer";
import {shapeCases} from "./cases.js";
import {experimentRoot, fixtureRoot, loadManifest, observationRoot} from "./node-fixtures.js";
import type {Observation} from "./observation.js";

const contentTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      response.setHeader("content-type", contentTypes[".html"] ?? "text/html");
      response.end("<!doctype html><title>HarfBuzz worker validation</title>");
      return;
    }
    if (url.pathname === "/favicon.ico") {
      response.statusCode = 204;
      response.end();
      return;
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/(dist|fixtures)\//, "");
    const root = url.pathname.startsWith("/dist/") ? resolve(experimentRoot, "dist") : fixtureRoot;
    const file = resolve(root, relative);
    if (!file.startsWith(root)) throw new Error("Invalid path");
    response.setHeader("content-type", contentTypes[extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  })().catch((error: unknown) => {
    response.statusCode = 404;
    response.end(error instanceof Error ? error.message : String(error));
  });
});

await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Browser test server did not bind");
const origin = `http://127.0.0.1:${address.port}`;

const manifest = await loadManifest();
const fixtureIds = new Set(shapeCases.map(({fixtureId}) => fixtureId));
fixtureIds.add("source-sans-cff");
fixtureIds.add("noto-sans-variable-woff");
fixtureIds.add("noto-sans-variable-woff2");
const fonts = manifest.fonts
  .filter(({id}) => fixtureIds.has(id))
  .map(({id, file, format, sha256}) => ({
    id,
    format,
    sha256,
    url: `${origin}/fixtures/${encodeURIComponent(file)}`,
  }));

const browser = await puppeteer.launch({headless: true});
try {
  const page = await browser.newPage();
  page.on("console", (message) => console.log(`browser: ${message.text()}`));
  page.on("pageerror", (error) => console.error(`browser page error: ${String(error)}`));
  page.on("requestfailed", (request) =>
    console.error(`browser request failed: ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );
  await page.goto(origin);
  const workerResult = await page.evaluate(
    ({fontsForWorker, casesForWorker}) =>
      new Promise<Record<string, unknown>>((resolveWorker, rejectWorker) => {
        const worker = new Worker("/dist/browser-worker.js", {type: "module"});
        const timeout = setTimeout(() => {
          worker.terminate();
          rejectWorker(new Error("Browser worker timed out after 15 seconds"));
        }, 15_000);
        worker.onmessage = ({data}: MessageEvent<Record<string, unknown>>) => {
          if (data["ready"] === true) {
            worker.postMessage({fonts: fontsForWorker, cases: casesForWorker});
            return;
          }
          clearTimeout(timeout);
          worker.terminate();
          if (data["error"]) rejectWorker(new Error(String(data["error"])));
          else resolveWorker(data);
        };
        worker.onerror = ({message}) => {
          clearTimeout(timeout);
          rejectWorker(new Error(message));
        };
      }),
    {fontsForWorker: fonts, casesForWorker: shapeCases},
  );

  const result = workerResult["result"] as {
    formatMatrix: Record<string, {supported: boolean}>;
    shaping: Record<string, unknown>;
  };
  assert.equal(result.formatMatrix["ttf"]?.supported, true);
  assert.equal(result.formatMatrix["otf"]?.supported, true);
  assert.equal(result.formatMatrix["woff"]?.supported, false);
  assert.equal(result.formatMatrix["woff2"]?.supported, false);
  assert.deepEqual(Object.keys(result.shaping).sort(), shapeCases.map(({id}) => id).sort());
  const expected = JSON.parse(
    await readFile(resolve(fixtureRoot, "expected-shaping.json"), "utf8"),
  ) as Record<string, unknown>;
  assert.deepEqual(result.shaping, expected);

  const observation: Observation<typeof result> = {
    recordedAt: new Date().toISOString(),
    environment: {
      runtime: String((workerResult["environment"] as Record<string, unknown>)["runtime"]),
      platform: process.platform,
      architecture: process.arch,
      harfbuzzjs: "1.4.0",
      harfbuzzRevision: "HarfBuzz 14.2.1",
    },
    fixtures: manifest.fonts.map(({file, format, sha256}) => ({file, format, sha256})),
    input: {cases: shapeCases, fonts},
    result,
    measurements: workerResult["measurements"] as Record<string, number>,
  };
  await mkdir(observationRoot, {recursive: true});
  await writeFile(
    resolve(observationRoot, "browser-worker.json"),
    `${JSON.stringify(observation, null, 2)}\n`,
  );
  console.log("Browser module-worker validation passed.");
} finally {
  await browser.close();
  await new Promise<void>((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}
