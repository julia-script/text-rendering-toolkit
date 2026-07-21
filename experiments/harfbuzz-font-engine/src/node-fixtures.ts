import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import type {FixtureEntry, FixtureManifest} from "./fixtures.js";

export const experimentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = resolve(experimentRoot, "../..");
export const fixtureRoot = resolve(repositoryRoot, "test-fixtures/fonts/harfbuzz-validation");
export const observationRoot = resolve(experimentRoot, "observations");

export async function loadManifest(): Promise<FixtureManifest> {
  return JSON.parse(await readFile(resolve(fixtureRoot, "fixtures.json"), "utf8")) as FixtureManifest;
}

export async function readFixture(entry: FixtureEntry): Promise<ArrayBuffer> {
  const bytes = await readFile(resolve(fixtureRoot, entry.file));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function fixtureSha256(entry: FixtureEntry): Promise<string> {
  return createHash("sha256")
    .update(new Uint8Array(await readFixture(entry)))
    .digest("hex");
}

export function fixtureById(manifest: FixtureManifest, id: string): FixtureEntry {
  const fixture = manifest.fonts.find((entry) => entry.id === id);
  if (!fixture) throw new Error(`Unknown fixture: ${id}`);
  return fixture;
}
