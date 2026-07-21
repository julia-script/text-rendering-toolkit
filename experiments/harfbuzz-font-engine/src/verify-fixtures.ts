import assert from "node:assert/strict";
import {access} from "node:fs/promises";
import {resolve} from "node:path";
import {fixtureRoot, fixtureSha256, loadManifest} from "./node-fixtures.js";

const manifest = await loadManifest();
assert.equal(manifest.schemaVersion, 1);
assert.ok(manifest.fonts.length >= 8);

for (const fixture of manifest.fonts) {
  assert.ok(fixture.source, `${fixture.file} has a source`);
  assert.ok(fixture.sourcePath || fixture.derivedFrom, `${fixture.file} has provenance`);
  assert.ok(fixture.covers.length > 0, `${fixture.file} has declared coverage`);
  assert.equal(await fixtureSha256(fixture), fixture.sha256, `${fixture.file} SHA-256`);
}
await access(resolve(fixtureRoot, "licenses/google-fonts-OFL.txt"));
await access(resolve(fixtureRoot, "licenses/source-sans-LICENSE.md"));
console.log(`Verified ${manifest.fonts.length} pinned font fixtures and both license files.`);
