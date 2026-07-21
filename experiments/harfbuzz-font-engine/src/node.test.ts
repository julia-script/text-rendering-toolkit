import assert from "node:assert/strict";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import test from "node:test";
import {shapeCases} from "./cases.js";
import {DirectOutlineUnavailableError, FontHandle} from "./font-engine.js";
import {fixtureById, fixtureRoot, loadManifest, observationRoot, readFixture} from "./node-fixtures.js";
import type {Observation} from "./observation.js";

const manifest = await loadManifest();

async function openFixture(id: string): Promise<FontHandle> {
  const fixture = fixtureById(manifest, id);
  return FontHandle.fromBytes(await readFixture(fixture));
}

test("shapes all script cases deterministically with UTF-16 cluster ranges", async () => {
  const results: Record<string, unknown> = {};
  for (const shapeCase of shapeCases) {
    const handle = await openFixture(shapeCase.fixtureId);
    const first = handle.shape(shapeCase.input);
    const second = handle.shape(shapeCase.input);
    assert.deepEqual(second, first, `${shapeCase.id} is deterministic with a reused buffer`);
    assert.ok(first.glyphs.length > 0, `${shapeCase.id} emits glyphs`);
    for (const glyph of first.glyphs) {
      assert.ok(glyph.clusterStart >= 0);
      assert.ok(glyph.clusterEnd > glyph.clusterStart);
      assert.ok(glyph.clusterEnd <= shapeCase.input.text.length);
      assert.ok(
        !(
          glyph.clusterStart > 0 &&
          glyph.clusterStart < shapeCase.input.text.length &&
          /[\uDC00-\uDFFF]/.test(shapeCase.input.text[glyph.clusterStart] ?? "") &&
          /[\uD800-\uDBFF]/.test(shapeCase.input.text[glyph.clusterStart - 1] ?? "")
        ),
        `${shapeCase.id} cluster does not split a surrogate pair`,
      );
      assert.equal(
        glyph.sourceText,
        shapeCase.input.text.slice(glyph.clusterStart, glyph.clusterEnd),
      );
    }
    results[shapeCase.id] = first;
  }

  const supplementary = results["supplementary-plane"] as ReturnType<FontHandle["shape"]>;
  assert.equal(supplementary.textLengthUtf16, 2);
  assert.equal(supplementary.glyphs[0]?.clusterStart, 0);
  assert.equal(supplementary.glyphs[0]?.clusterEnd, 2);

  const arabic = results["arabic-rtl"] as ReturnType<FontHandle["shape"]>;
  const arabicClusters = arabic.glyphs.map((glyph) => glyph.clusterStart);
  assert.deepEqual(arabicClusters, [...arabicClusters].sort((a, b) => b - a));
  const expected = JSON.parse(
    await readFile(resolve(fixtureRoot, "expected-shaping.json"), "utf8"),
  ) as Record<string, unknown>;
  assert.deepEqual(results, expected);

  await mkdir(observationRoot, {recursive: true});
  const observation: Observation<typeof results> = {
    recordedAt: new Date().toISOString(),
    environment: {
      runtime: `Node ${process.version}`,
      platform: process.platform,
      architecture: process.arch,
      harfbuzzjs: "1.4.0",
      harfbuzzRevision: "HarfBuzz 14.2.1",
    },
    fixtures: manifest.fonts.map(({file, format, sha256}) => ({file, format, sha256})),
    input: {cases: shapeCases.map(({id, fixtureId, input}) => ({id, fixtureId, input}))},
    result: results,
    measurements: {},
  };
  await writeFile(
    `${observationRoot}/node-shaping.json`,
    `${JSON.stringify(observation, null, 2)}\n`,
  );
});

test("extracts font facts and variable-instance metrics", async () => {
  const handle = await openFixture("noto-sans-variable-ttf");
  assert.deepEqual(handle.facts.axes, {
    wght: {min: 100, default: 400, max: 900},
    wdth: {min: 62.5, default: 100, max: 100},
  });
  assert.equal(handle.facts.upem, 1000);
  assert.equal(handle.facts.ascender, 1069);
  assert.equal(handle.facts.descender, -293);
  assert.ok(handle.supports("A".codePointAt(0) ?? 0));

  const regular = handle.shape({
    text: "Variable",
    direction: "ltr",
    script: "Latn",
    language: "en",
    variations: {wght: 400},
  });
  const bold = handle.shape({
    text: "Variable",
    direction: "ltr",
    script: "Latn",
    language: "en",
    variations: {wght: 900},
  });
  assert.notDeepEqual(bold.glyphs, regular.glyphs);
});

test("accepts TTF and CFF/OTF but rejects raw WOFF containers", async () => {
  for (const id of ["noto-sans-variable-ttf", "source-sans-cff"] as const) {
    const handle = await openFixture(id);
    assert.equal(handle.facts.upem, 1000);
  }
  for (const id of ["noto-sans-variable-woff", "noto-sans-variable-woff2"] as const) {
    await assert.rejects(() => openFixture(id), /usable SFNT face/);
  }
});

test("rejects the wrapper's SVG outline round-trip for TTF and CFF", async () => {
  for (const fixtureId of ["noto-sans-variable-ttf", "source-sans-cff"] as const) {
    const handle = await openFixture(fixtureId);
    const glyphId = handle.shape({
      text: "A",
      direction: "ltr",
      script: "Latn",
      language: "en",
    }).glyphs[0]?.glyphId;
    assert.notEqual(glyphId, undefined);
    assert.throws(() => handle.getOutline(glyphId ?? 0), DirectOutlineUnavailableError);

    const diagnostic = handle.getDiagnosticOutlineViaSvgRoundTrip(glyphId ?? 0);
    assert.ok(diagnostic.length > 0);
    assert.equal(handle.getDiagnosticOutlineViaSvgRoundTrip(glyphId ?? 0), diagnostic);
  }
});

test("records bounded retained heap across repeated shaping", async () => {
  const bytes = await readFixture(fixtureById(manifest, "noto-sans-variable-ttf"));
  const before = process.memoryUsage().heapUsed;
  for (let index = 0; index < 100; index += 1) {
    const handle = await FontHandle.fromBytes(bytes.slice(0));
    handle.shape({text: "office", direction: "ltr", script: "Latn", language: "en"});
  }
  const retainedHeapBytes = process.memoryUsage().heapUsed - before;
  assert.ok(retainedHeapBytes < 64 * 1024 * 1024, `retained ${retainedHeapBytes} bytes`);
});
