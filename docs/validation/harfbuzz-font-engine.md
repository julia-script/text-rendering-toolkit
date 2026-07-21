# HarfBuzz font-engine validation

> Status: complete validation spike  
> Date: 2026-07-20  
> Scope: private experiment only; this is not the production `font` package

## Verdict

Use HarfBuzzjs as the production font engine behind the project-owned
`FontHandle` contract. The published `harfbuzzjs@1.4.0` surface is sufficient
for shaping and font facts; until its newer APIs are released, supplement it
with a narrow TypeScript bridge for direct outlines and deterministic disposal.

The pinned published wrapper is sufficient for:

- strict-ESM Node and browser module-worker initialization;
- TTF and CFF-flavored OTF faces;
- explicit direction, script, language, feature, and variation shaping;
- UTF-16 cluster values, glyph IDs, advances, offsets, coverage, metrics, and
  variation-axis facts; and
- a persistent font plus one cleared/reused shaping buffer.

Three integration details need explicit handling:

1. It exposes `glyphToPath()` and `glyphToJson()`, but no public direct drawing
   callback. `glyphToJson()` calls `glyphToPath()` internally, constructs SVG
   text, then parses that text back into numbers. The proposed numeric-outline
   contract therefore needs a narrow wrapper change. HarfBuzz's C API and the
   packaged WASM already contain the necessary drawing functions, and current
   HarfBuzzjs `main` exposes them directly.
2. It does not directly accept the tested WOFF or WOFF2 containers as usable
   faces. Both produce an empty character map and are rejected by the adapter.
3. Its public classes rely on `FinalizationRegistry` and expose no deterministic
   `destroy()` or `dispose()` operation. The C destroy functions are already in
   the WASM export set, so this is also wrapper-layer work rather than a native
   engine limitation.

The outline and disposal gaps are small wrapper issues. WOFF/WOFF2 is different:
the tiny WASM build lacks the optional FreeType loader, so compressed fonts need
pre-decoding or a different build. None of these findings justify forking
HarfBuzz C, returning to Typr, or adding a second general-purpose font parser.

## Reproduce

From `experiments/harfbuzz-font-engine/` on a clean checkout:

```sh
npm install
npm run validate
```

Individual commands are also available:

```sh
npm run typecheck
npm run verify:fixtures
npm run test:node
npm run benchmark
npm run test:browser
```

`npm run update:expected` intentionally rewrites the exact shaping baseline and
must only be used when the pinned engine or fixtures are deliberately updated.

## Tested environment and inputs

The recorded run used Node 24.2.0 on macOS arm64 and Headless Chrome 150.0.0.0.
The runtime dependencies are pinned exactly:

| Component | Version |
|---|---:|
| `harfbuzzjs` | 1.4.0 |
| embedded HarfBuzz | 14.2.1 |
| TypeScript | 6.0.2 |
| esbuild | 0.28.1 |
| Puppeteer | 25.3.0 |

The fixture manifest records upstream repository revisions, OFL license files,
derivations, and SHA-256 hashes. The eight committed font files cover variable
TrueType, CFF/OpenType, Latin, Arabic, Devanagari, Khmer, combining marks, a
supplementary-plane character, and equivalent TTF/WOFF/WOFF2 containers.

## Shaping and source mapping

Exact observations are committed for:

- Latin ligatures and kerning;
- a combining sequence;
- Arabic joining and marks in an RTL run;
- explicitly separated Latin/LTR and Arabic/RTL runs from a mixed-direction
  integration boundary;
- Devanagari and Khmer reordering/positioning; and
- a supplementary-plane character represented by two UTF-16 code units.

The adapter calls the wrapper's UTF-16 input API and exposes `clusterStart` and
`clusterEnd` as JavaScript string offsets. It sorts the unique logical cluster
starts to derive source ranges, independently of glyph output order, so RTL
glyphs can remain visually descending while their source slices remain valid.
Tests reject offsets that split surrogate pairs. Node and browser-worker results
match the same exact snapshot.

A HarfBuzz cluster is not automatically a caret position. Ligatures, combining
sequences, reordering, and script-specific caret rules may allow fewer or more
interior caret stops than cluster edges imply. The future layout package must
combine cluster ranges with paragraph bidi state, grapheme boundaries,
ligature-caret information where available, and its editor-facing caret policy.

## Font facts and variation behavior

The provisional handle serializes units per em, horizontal extents, coverage
count, and axis ranges without exposing Emscripten or HarfBuzz pointers. The
variable Noto Sans fixture reports:

- units per em: 1000;
- ascender: 1069;
- descender: -293;
- axes: `wght` 100–900 and `wdth` 62.5–100.

Applying `wght=400` and `wght=900` changes the shaped numeric results, confirming
that variation coordinates belong to the operational font instance and to any
future outline-cache key.

## Format policy

| Input | Published wrapper result | v1 policy |
|---|---|---|
| TTF / TrueType outlines | Directly supported | Accept |
| OTF / CFF outlines | Directly supported | Accept |
| WOFF | Face object exists, but tested coverage is empty | Reject with a typed unsupported-format error |
| WOFF2 | Face object exists, but tested coverage is empty | Reject with a typed unsupported-format error |

The first production slice should accept normalized TTF/OTF bytes only. It must
detect WOFF and WOFF2 signatures before constructing a face and fail clearly;
it must not mistake a default-looking `upem` value for a usable font.

Bundled or injected WOFF decoders remain a separate, measured follow-up. That
work should compare decoder API, browser/Node behavior, compressed size,
licensing, and whether one decoder can normalize both formats. It should not be
silently folded into the font package before those costs are known.

A registry/package audit supports that boundary:

| Candidate | Published footprint/API observation | Decision |
|---|---|---|
| `fonteditor-core@2.6.3` | 507,219 B packed / 1,616,836 B unpacked; full parser/writer; 727,190 B WOFF2 WASM; WOFF requires injected inflate | Too broad and duplicates parsing |
| `wawoff2@2.0.1` | 517,646 B packed / 1,278,140 B unpacked; CommonJS Node-oriented async decoder; 322,684 B decompression binding | Not a browser/ESM-wide boundary |
| `woff2@1.0.0` | 35,374,025 B unpacked native Node addon | Not browser-capable; reject |

These are package footprints, not final minified bundle measurements. They are
enough to show that accepting compressed containers is not a free convenience;
a later decoder spike can evaluate narrower browser-first builds.

## Numeric outline decision

The intended public contract remains lazy numeric outline data: command opcodes,
typed coordinates, deterministic bounds, and a cache key containing font
identity, variation coordinates, and glyph ID. SVG path strings remain excluded
from the cross-package boundary.

The experiment intentionally throws `DirectOutlineUnavailableError` from the
candidate `getOutline()` operation. A separate diagnostic proves that both TTF
and CFF outlines can be reached and cached through `glyphToJson()`, but its name
and tests make clear that this is an SVG round-trip and cannot satisfy the
contract.

The bounded next step is to consume a HarfBuzzjs release that exposes direct
drawing callbacks or upstream the smallest possible typed callback bridge. The
current upstream source already contains a direct drawing API, but it is not in
the published 1.4.0 distribution validated here. Do not fork the WASM build or
add OpenType.js merely to work around this wrapper-surface gap.

## Size, startup, and memory observations

One local run recorded the following values. They are observations for the
listed machine, not performance guarantees:

| Measurement | Result |
|---|---:|
| HarfBuzz WASM | 390,365 B raw / 160,397 B gzip |
| JS wrapper plus loader | 84,401 B raw / 18,702 B gzip |
| Published runtime total | 474,766 B raw / 179,099 B gzip |
| Bundled experiment worker JS | 82,749 B raw, excluding WASM |
| dynamic module initialization | 5.75 ms |
| first 2 MB variable-font load | 2.35 ms |
| first short-run shape | 3.56 ms |
| 5,000 warm shapes | 56.82 ms, about 11.36 μs each |
| 50 load-and-shape cycles | 41.60 ms |

`Blob` copies the input font bytes into WASM-owned memory. A `FontHandle` keeps
one `Blob`, `Face`, `Font`, and `Buffer`; each call clears and reuses that buffer.
Across the sampled 5,000-shape run, external memory stayed flat and RSS reached
a plateau instead of growing at every interval. Fifty repeated font loads had a
larger RSS/external-memory delta, consistent with GC/finalizer-managed lifetime;
the machine-readable file preserves the raw samples.

## Cleanup contract

- **Browser worker:** worker termination is the deterministic whole-engine
  cleanup boundary and should be the default ownership model for layout/font
  services.
- **Browser main thread:** unmodified 1.4.0 handles are GC-managed. The narrow
  wrapper bridge can provide idempotent deterministic disposal by invoking the
  already-exported C destroy functions and unregistering the finalizer.
- **Node:** the same wrapper bridge can dispose in-process handles. Worker-thread
  or process lifetime remains the simplest whole-engine teardown boundary.

The production API should expose idempotent handle disposal and document worker
termination separately as whole-engine teardown.

## Confirmed and revised contracts

| Contract | Decision |
|---|---|
| `FontHandle` | Confirm opaque Promise-created handle; expose facts, coverage, shaping, and lazy outline access; add explicit unsupported-format errors; do not expose WASM pointers. |
| `ShapedRun` | Confirm explicit run inputs and serializable glyph IDs, UTF-16 cluster ranges, advances, offsets, and flags. Keep bidi segmentation and caret policy in `text-layout`. |
| `GlyphOutline` | Confirm lazy typed numeric output and variation-aware caching as the target contract, but gate production implementation on a direct-callback wrapper release/bridge. Never use `glyphToJson()` as the implementation. |

## Evidence and limitations

Machine-readable results live in `experiments/harfbuzz-font-engine/observations/`:

- `node-shaping.json` — exact Node shaping inputs and outputs;
- `browser-worker.json` — browser module-worker results and format matrix; and
- `startup-and-memory.json` — artifact, timing, ownership, and sampled memory
  observations; and
- `decoder-candidates.json` — package/API size observations for three possible
  normalization boundaries.

This spike does not validate paragraph bidi, fallback, wrapping, carets, SDFs,
rendering, color fonts, collections, advanced table inspection, or decoder
choices. Those remain outside the font-engine boundary validated here.
