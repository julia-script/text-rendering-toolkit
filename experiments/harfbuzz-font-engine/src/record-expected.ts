import {writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {shapeCases} from "./cases.js";
import {FontHandle} from "./font-engine.js";
import {fixtureById, fixtureRoot, loadManifest, readFixture} from "./node-fixtures.js";

const manifest = await loadManifest();
const results: Record<string, unknown> = {};
for (const shapeCase of shapeCases) {
  const fixture = fixtureById(manifest, shapeCase.fixtureId);
  const handle = await FontHandle.fromBytes(await readFixture(fixture));
  results[shapeCase.id] = handle.shape(shapeCase.input);
}
await writeFile(
  resolve(fixtureRoot, "expected-shaping.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);
console.log("Updated exact shaping expectations.");
