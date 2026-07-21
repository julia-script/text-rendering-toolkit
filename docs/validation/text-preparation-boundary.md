# Text-preparation boundary validation

## Decision

Proceed with a production implementation in `@webgpu-text/layout` using two
synchronous operations plus one convenience composition:

```ts
const prepared = prepareText(input)
const layout = layoutPreparedText(prepared, fonts)

// Equivalent convenience path when reuse is unnecessary:
const layout = layoutText(input, fonts)
```

`prepareText()` is accepted because it performs real, font-independent work:
grapheme segmentation, paragraph bidi resolution, directional segmentation,
Unicode script resolution and Common/Inherited adoption, style intersection,
and layout-policy normalization. The result is immutable, JSON-serializable,
and reusable with structurally equivalent caller registries. It contains no font
handle, glyph, outline, renderer, promise, or owned resource.

The validation does **not** show an end-to-end speed advantage. On the recorded
mixed Latin/Arabic fixture, a serialized prepared value is 799 bytes and shaping
dominates total execution. The local observation in
`experiments/text-preparation/artifacts/cost.json` even places the two measured
paths within ordinary run-to-run noise. The production reason for the split is
semantic reuse and a clean transferable boundary, not a performance claim.

## Accepted contract

The recommended first production surface is:

```ts
interface TextStyle {
  key: string
  fontKeys: readonly string[]
  fontSize: number
  language: string
  features?: readonly string[]
  variations?: Readonly<Record<string, number>>
}

interface PrepareTextInput {
  text: string
  paragraphDirection?: 'auto' | 'ltr' | 'rtl'
  style: TextStyle
  styleRanges?: readonly { start: number; end: number; style: TextStyle }[]
  layout?: Partial<LayoutPolicy>
}

function prepareText(input: PrepareTextInput): PreparedText
function layoutPreparedText(
  prepared: PreparedText,
  fonts: ReadonlyMap<string, FontHandle>,
): LayoutResult
function layoutText(
  input: PrepareTextInput,
  fonts: ReadonlyMap<string, FontHandle>,
): LayoutResult
```

`resolvePreparedText()` was useful inside the experiment but is not recommended
as another public layer. The existing `layoutResolvedText()` remains the expert
API for consumers that already own itemization and shaping.

Both new operations are synchronous. Applications obtain bytes however they
want, call `loadFont()`, and retain ownership of every `FontHandle`. Preparation
never accepts a URL, calls `fetch`, consults CSS or system fonts, disposes a
handle, or installs a global cache.

## Normative first-slice rules

- All public source offsets and style ranges are half-open JavaScript UTF-16
  ranges. Unpaired surrogates and style transitions inside a grapheme fail.
- `bidi-js` analyzes the complete text before script, style, or font splits.
  Each segment retains the resolved embedding level; direction is its parity.
- Script values are ISO 15924 codes from Unicode Script/Script_Extensions data.
  Common and Inherited graphemes adopt the nearest strong script in the same
  paragraph and embedding parity, preferring the previous run. They never form a
  standalone mark run. A truly script-neutral value may remain `Zyyy`.
- Every effective style supplies a non-empty ordered list of stable font keys.
  Each key must exist. The first handle covering the complete editable grapheme
  wins, and adjacent clusters coalesce only when every shaping property and font
  is identical.
- Combining marks participate in coverage. Default-ignorable controls, joiners,
  and variation selectors affect itemization/shaping but do not independently
  require cmap coverage. Hard breaks are not shaped.
- Missing keys and missing coverage throw deterministic errors containing the
  UTF-16 range and attempted keys. No fallback is discovered or downloaded.
- HarfBuzz remains the sole shaping authority. Each selected segment is shaped
  once with explicit direction, script, language, features, and variations.
  Metrics, advances, offsets, and outline bounds scale by
  `fontSize / unitsPerEm`; `fontUnitScale` preserves lazy outline mapping.
- The font-aware stage calls the unchanged public `layoutResolvedText()` and
  returns its renderer-neutral `LayoutResult`.

## Candidate comparison

### Bidirectional analysis

`bidi-js@1.0.3` is accepted for the first slice. It is MIT licensed, browser and
Node compatible, supplies UTF-16 embedding levels and paragraph ranges, matches
the committed mixed-direction/control corpus, and is the implementation used by
the preserved reference. Its data implements Unicode 13.0.0, so this decision
pins that limitation explicitly rather than describing it as current Unicode.
Upgrading or replacing it requires rerunning the corpus and Unicode bidi
conformance evidence.

### Script-property approaches

| Candidate | Result | Evidence and trade-off |
|---|---|---|
| `unicode-script@1.2.0` | selected | Pure ESM, Unicode 17.0.0 Script and Script_Extensions, MIT plus Unicode data terms, deterministic ISO 15924 lookup. The npm archive reports 77,206 unpacked bytes. It has no TypeScript declarations, so production must contribute declarations upstream or keep a tiny local declaration. |
| Generate a pinned table from `@unicode/unicode-17.0.0` | rejected for now | Reproducible and current, but the source package reports 1,647,729 unpacked bytes and production would own a generator, encoding, update process, and equivalent conformance tests. No measured runtime-size win justified that ownership. |
| Public HarfBuzz property guessing | rejected | It would add no JavaScript table, but the current public `FontHandle` intentionally exposes shaping—not Unicode property lookup or `hb_buffer_guess_segment_properties()`. Building preparation on private WASM exports would violate the package boundary and still make script analysis font-aware. |

The private browser-compatible ESM entry containing both preparation stages,
`bidi-js`, and `unicode-script` is produced by `pnpm --filter
@webgpu-text/text-preparation-experiment build`. The final minified browser-targeted
ESM entry is 74,073 bytes raw and 21,650 bytes gzip on the validation checkout; the public
font/layout packages remain normal ESM dependencies rather than copied private
modules. These are observations, not a budget. Candidate dependencies remain
private until the production change makes the dependency decision explicit.

## Evidence

`test-fixtures/preparation/fixtures.json` is the versioned canonical document.
Every case records its classification, rationale, source layer, and integrity.
It covers empty text, Latin, Arabic, Devanagari, Khmer, mixed bidi, Common and
Inherited characters, combining sequences, a supplementary scalar, style and
variation ranges, hard breaks, bidi controls, joiner/variation-selector
boundaries, ordered fallback, absent keys, and missing coverage.

The private tests prove:

- repeated input produces identical frozen serializable preparation;
- source input and caller handles remain unchanged and live;
- fallback operates at grapheme boundaries and coalesces stable adjacent runs;
- public `FontHandle.shape()` produces scaled `ResolvedShapedRun` values;
- the unchanged public layout core produces glyphs, lines, bounds, carets, and
  selections repeatedly;
- the one-call and reused-prepared paths are semantically identical; and
- no production package export or dependency changes.

Reproduce with:

```sh
pnpm --filter @webgpu-text/text-preparation-experiment fixtures:record
pnpm --filter @webgpu-text/text-preparation-experiment test
pnpm --filter @webgpu-text/text-preparation-experiment benchmark
pnpm --filter @webgpu-text/text-preparation-experiment build
```

The Rolldown browser-platform bundle is the browser-compatible ESM check. The test path runs
the complete resolvable corpus in Node using only committed fonts and public
font/layout exports. Neither path uses a renderer, DOM font loading, network
access, `old/`, or private package modules.

## Deliberate limitations

The production follow-up must not silently widen this decision into complete
text editing or typography. The following remain deferred:

- complete Unicode line breaking, dictionary breaking, hyphenation, and
  reshaping around selected soft breaks;
- bidi caret affinity and editable/incremental paragraph state;
- workers, shared preparation/layout caches, and font fetching helpers;
- color-font and emoji rendering policy, even though joiner and variation
  boundaries are preserved;
- WOFF/WOFF2 decoding, SDF/atlas policy, Three.js behavior, and batching; and
- dynamically switching renderer lighting/material modes.

Multiple hard paragraphs retain per-segment paragraph levels, but the existing
resolved input also contains one legacy top-level `paragraphLevel`. It is
currently validation-only in the resolved core. A production implementation
must avoid making new behavior depend on that single value without first
representing paragraph levels explicitly.
