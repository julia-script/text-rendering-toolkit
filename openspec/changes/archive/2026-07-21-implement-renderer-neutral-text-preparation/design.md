## Context

The production layout package currently begins at `ResolvedLayoutInput`: callers
must already know bidi levels and scripts, select fonts, shape runs, scale font
units, and cover every non-break source offset. The private
`experiments/text-preparation` workspace proved that these responsibilities can
be composed from public font/layout APIs in two honest stages across fifteen
canonical multilingual, boundary, fallback, and failure cases.

The first stage is font-independent and reusable. The second stage necessarily
depends on caller-owned `FontHandle` values because fallback coverage, shaping,
metrics, and scaling are font-specific. The completed `LayoutResult` remains the
only renderer handoff; no renderer needs to understand raw text, bidi, scripts,
fonts, or shaping.

This change promotes the validated behavior into `@webgpu-text/layout`. The
package already depends on `@webgpu-text/font`, so the dependency direction does
not change. It adds two small external Unicode dependencies and a meaningful
public data model, which warrants an explicit design.

## Goals / Non-Goals

**Goals:**

- Provide synchronous `prepareText()`, `layoutPreparedText()`, and `layoutText()`
  APIs with strict readonly TypeScript contracts.
- Make `PreparedText` deeply immutable, versioned, JSON-serializable, and safe to
  validate again after transfer or storage.
- Preserve JavaScript UTF-16 source identity and grapheme-safe boundaries across
  bidi/script/style itemization and font fallback.
- Shape only through public `FontHandle` operations and return the existing
  renderer-neutral `LayoutResult`.
- Preserve caller ownership of font handles and lazy glyph outlines.
- Conform to the canonical validation corpus in Node, clean-package, and
  browser-compatible ESM paths.

**Non-Goals:**

- Fetching font bytes, accepting URLs, discovering CSS/system fonts, or owning a
  global registry/cache.
- Replacing `layoutResolvedText()` or changing its accepted fixtures and policy.
- Complete Unicode line breaking, dictionary breaking, hyphenation, or
  reshaping after a chosen soft break.
- Bidi caret affinity, incremental editing state, worker adapters, shared
  caches, color-font policy, WOFF/WOFF2 decoding, SDF/atlas work, or Three.js API
  changes.
- Eager outline extraction or a new public option framework for glyph bounds.

## Decisions

### Expose two stages and one convenience composition

The package will expose:

```ts
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

`layoutText(input, fonts)` is exactly
`layoutPreparedText(prepareText(input), fonts)`. An intermediate
`resolvePreparedText()` will remain private because it adds another public layer
without an independently useful stable contract. `layoutResolvedText()` remains
the expert API.

Alternatives considered:

- A single raw-text operation hides the useful transferable preparation seam.
- A `Text` class or stateful layout session would introduce ownership and cache
  policy before measurements justify it.
- Returning the experiment's `CompletedText` wrapper duplicates data and makes
  `LayoutResult` cease to be the canonical renderer handoff.

### Keep the prepared value minimal and self-validating

`PreparedText` will contain `schemaVersion: 1`, the original text, requested
paragraph direction, normalized default style and layout policy, and ordered
prepared segments. Each segment records its UTF-16 range, paragraph/bidi level,
direction, ISO 15924 script, style identity, ordered font keys, size, language,
features, and normalized variations.

No separate public paragraph collection is added. Per-segment paragraph levels
already preserve every shaped paragraph demonstrated by the corpus, while the
legacy top-level `ResolvedLayoutInput.paragraphLevel` is validation-only in the
current core. The internal adapter may derive that legacy value from the first
segment or requested direction, but no new behavior may depend on it. Empty
paragraph and future editing semantics can justify a richer model later.

`prepareText()` returns deeply frozen arrays/records and never mutates its input.
`layoutPreparedText()` validates the complete schema and ranges even when the
value came from parsed JSON; it does not rely on object identity or frozen state.
Unknown schema versions fail deterministically. Schema semantics, including
pinned Unicode revisions, require a schema-version change when compatibility is
not preserved.

Alternatives considered:

- Publishing bidi library objects would leak dependency-specific state and
  break serialization.
- Adding speculative paragraph objects now would duplicate segment data without
  a demonstrated consumer.

### Promote the validated Unicode implementations with explicit limits

`bidi-js@1.0.3` performs whole-text paragraph and embedding analysis before any
script, style, or font split. Its Unicode 13.0.0 behavior is a documented first
slice, not described as current Unicode. `unicode-script@1.2.0` supplies Unicode
17.0.0 Script and Script_Extensions data and ISO 15924 codes.

The packages become exact production dependencies of `@webgpu-text/layout`.
Narrow local ambient declarations cover only the APIs used by production until
upstream types exist; contributing them upstream is desirable but not a release
blocker. The package gains third-party notices for both MIT-licensed packages
and the Unicode data terms. Any dependency revision requires rerunning the
canonical corpus and reviewing the documented Unicode behavior.

Alternatives considered and rejected by validation were a project-owned
generated Unicode table and private HarfBuzz property exports.

### Apply style and script policy before explicit-font fallback

`prepareText()` uses `Intl.Segmenter('und', {granularity: 'grapheme'})` to define
editable boundaries. It rejects unpaired surrogates and style transitions inside
a grapheme. Bidi analysis precedes script adoption and style intersection.
Common and Inherited graphemes adopt a compatible nearest strong script within
the same paragraph and bidi parity, preferring the preceding run; genuinely
neutral content may remain `Zyyy`. Hard breaks are retained in source text but
are not shaped.

At layout time every effective style supplies a non-empty ordered list of stable
font keys. All named keys must exist. The first handle that covers the complete
grapheme wins; combining marks require coverage while default-ignorable controls,
joiners, and variation selectors do not independently require cmap coverage.
Adjacent selections coalesce only when the selected handle and every shaping
property match.

HarfBuzz remains the sole shaping authority. Each selected run is shaped once
with explicit direction, script, language, features, and variations. Metrics,
advances, and offsets scale exactly once by `fontSize / unitsPerEm`, and the same
value becomes `fontUnitScale`.

### Preserve lazy outlines and the renderer-neutral handoff

The production convenience path will not call `FontHandle.getOutline()` while
preparing or shaping text. Resolved glyph bounds are `null`, so
`LayoutResult.visibleBounds` may remain `null`; block/line bounds and interaction
data remain available. Renderers already use `fontKey`, `glyphId`, variations,
and `fontUnitScale` to obtain outlines only for atlas misses.

This is intentionally lazier than the validation helper's eager bounds lookup
and aligns with the project's renderer-neutral ownership decision. Consumers
that require precomputed visible glyph bounds can continue to construct
`ResolvedLayoutInput` through the expert API; a general lazy-bounds helper needs
separate evidence.

### Use one public preparation error with structured failure metadata

Invalid raw/prepared input, missing registry keys, and missing grapheme coverage
will throw a dedicated exported error carrying a stable code plus optional
`start`, `end`, and `attemptedFontKeys`. Failures are deterministic, identify
half-open UTF-16 ranges, and occur without fetching, fallback discovery, handle
disposal, mutation, or global caching. Errors produced by the unchanged resolved
layout core remain its existing `InvalidLayoutInputError`.

## Risks / Trade-offs

- **[Unicode versions differ between bidi and script data]** → Publish the exact
  Unicode 13/17 limits, pin dependency revisions, and rerun the corpus before an
  upgrade.
- **[`Intl.Segmenter` availability varies in older runtimes]** → Keep the
  project's current modern-runtime target and fail naturally at module use;
  adding a grapheme dependency is outside this slice.
- **[Local ambient declarations can drift from dependencies]** → Declare only
  the functions and return fields used, pin exact versions, and exercise both
  type checking and runtime conformance.
- **[Serializable values may outlive their producing package version]** → Validate
  `schemaVersion` and all fields at the consuming boundary; bump the version for
  incompatible semantics.
- **[No eager glyph bounds means `visibleBounds` is unavailable]** → Document the
  lazy behavior and preserve `fontUnitScale` for renderer outline resolution;
  keep exact-bound workflows on the expert resolved API.
- **[Synchronous shaping can block for large inputs]** → Preserve serializable
  inputs and pure operations so a later ordinary ESM worker adapter can wrap
  them after profiling demonstrates a need.

## Migration Plan

1. Add production types, structured errors, Unicode adapters, and normalized
   preparation logic to `packages/layout`.
2. Add explicit-font fallback, shaping/scaling, and composition into the
   unchanged resolved layout core.
3. Port canonical cases into package tests and compare production results with
   the validation evidence without importing experiment source.
4. Add dependencies, declarations, notices, public exports, and README examples;
   validate a packed package consumer and browser-compatible ESM import.
5. Update architecture and roadmap status after all workspace and OpenSpec checks
   pass. Rollback is removal of the additive exports/dependencies; existing
   resolved-layout consumers remain unaffected throughout.

## Open Questions

None block implementation. Upstream TypeScript declarations and richer public
paragraph metadata remain follow-ups only if real consumers require them.
