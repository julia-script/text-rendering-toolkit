## Context

`@webgpu-text/font` already supplies synchronous coverage queries, explicit-run
HarfBuzz shaping, metrics, variations, and outlines. `@webgpu-text/layout`
already validates fully resolved shaped runs and returns reusable
`LayoutResult`. The missing layer is the policy that turns raw styled Unicode
text plus caller-owned fonts into those resolved runs.

That policy is not a small wrapper. It must preserve JavaScript UTF-16 identity
while deriving paragraph bidi levels, directional and script segments, common
and inherited character behavior, grapheme-safe font fallback, style splits,
HarfBuzz options, and font-unit scaling. The preserved Troika source used
`bidi-js` plus a network-oriented Unicode font resolver, but the new project has
explicitly rejected URL fetching and system/global fallback. The current font
API also requires an explicit ISO 15924 script, so relying on an untested
"automatic" HarfBuzz mode would hide an important contract decision.

The target user experience remains renderer-neutral:

```ts
const prepared = prepareText('Hello مرحبا', options)
const layout = layoutPreparedText(prepared, fonts)
const text = new Text({ layout, fonts })
```

This change determines whether that split is honest and useful; it does not add
those names to a production package yet.

## Goals / Non-Goals

**Goals:**

- Prove or reject a serializable font-independent preparation result that can be
  cached and reused with an explicit font registry.
- Establish deterministic bidi/script/style itemization and grapheme-safe
  ordered fallback behavior over public `FontHandle` operations.
- Demonstrate that the font-aware stage can shape, scale, assemble a valid
  `ResolvedLayoutInput`, and reuse the existing resolved layout core unchanged.
- Select the smallest defensible itemization implementation and record its
  Unicode version, ESM/TypeScript fit, size, license, provenance, and update
  burden.
- Leave a normative fixture corpus and a precise recommendation for the next
  production change.

**Non-Goals:**

- Shipping `prepareText`, `layoutPreparedText`, or another new production
  export in this change.
- Fetching font bytes, consulting CSS/system fonts, downloading Unicode
  fallback fonts, or owning `FontHandle` lifetime.
- Complete Unicode line breaking, dictionary breaking, hyphenation, or
  reshaping around a chosen soft line break.
- Bidi caret affinity, editable paragraph state, incremental document updates,
  workers, caching services, SDFs, atlases, Three.js, or batching.
- Color-font rendering, emoji fallback policy, or WOFF/WOFF2 decoding.

## Decisions

### Validate in an isolated private harness

Create a small strict-TypeScript ESM validation harness under
`experiments/text-preparation` (or the equivalent existing private experiment
area). It may depend on candidate itemization code and public workspace packages,
but publishable packages remain unchanged. Accepted fixtures live under
`test-fixtures/preparation` so the later production implementation can consume
the evidence without depending on the experiment.

Putting candidate code directly in `packages/layout` would make an evaluation
look like a supported API. A standalone fifth public package is also rejected:
text preparation is layout policy, not an independently justified product.

### Exercise a two-stage candidate contract

The font-independent candidate receives raw text, one default style, optional
half-open UTF-16 style ranges, and the existing layout policy. It produces a
deeply readonly, JSON-serializable `PreparedText` containing normalized policy
and segments with source range, paragraph/bidi level, direction, ISO 15924
script, style identity, language, ordered font keys, features, variations, and
font size. It contains no font handle, metrics, glyph, outline, promise, cache,
or renderer object.

The font-aware candidate receives that value plus
`ReadonlyMap<string, FontHandle>`, selects fonts, shapes/scales segments, creates
`ResolvedLayoutInput`, and calls `layoutResolvedText()`. Both operations remain
synchronous because all I/O and font loading happened before their boundary.

The validation must compare this split with a one-call implementation. The split
is accepted only if the prepared value is stable, meaningfully reusable, and
does not force font-dependent choices into the first stage. Otherwise the report
must recommend the simpler single production operation.

### Keep fallback explicit, ordered, and grapheme-safe

Each effective style supplies an ordered non-empty list of stable font keys.
Selection chooses the first registered font that covers the complete editable
grapheme cluster. Formatting controls and hard breaks are not independently
shaped; common/inherited characters and whitespace follow documented adjacent
run rules rather than triggering arbitrary font changes. A missing registry key
or cluster with no supporting font fails with its UTF-16 range and attempted
font keys.

This intentionally rejects Troika's remote Unicode resolver, browser font
discovery, and per-code-unit fallback. It also prevents a combining sequence or
supplementary-plane scalar from being split across fonts.

### Treat HarfBuzz as the shaping authority

Preparation decides only segmentation, font choice, and shape options. Each
resolved segment is shaped once through public `FontHandle.shape()` with
explicit direction, ISO script, language, features, and variations. Metrics,
advances, offsets, and optional bounds are scaled by `fontSize /
font.facts.unitsPerEm`; `fontUnitScale` preserves the outline-to-layout mapping
already required by `LayoutResult`.

The harness must not reproduce GSUB, GPOS, joining, reordering, kerning, or mark
placement. It may coalesce adjacent segments only when every effective shaping
property and selected font matches.

### Compare itemization candidates against one corpus

`bidi-js` is the baseline bidi candidate because the reference implementation
used it and the existing policy fixtures already encode accepted resolved
levels. Script itemization will compare at most three bounded approaches: a
maintained ESM Unicode-data implementation, a reproducibly generated pinned
Unicode table, and any genuinely sufficient public HarfBuzz property-guessing
surface. Candidates are judged on correctness for the committed corpus,
Common/Inherited adoption, UTF-16 ranges, deterministic output, browser/Node
ESM behavior, TypeScript cost, compressed/install size, license, update process,
and absence of network/runtime globals.

The report selects one combination or records that none is ready. It must not
grow a project-owned Unicode algorithm merely to avoid a small justified
dependency.

### Keep evidence layers separate

The fixture document records:

- raw input and normalized style/layout policy;
- expected font-independent segments;
- expected font selections and resolved shaped runs for pinned public fonts;
- expected `LayoutResult` or normalized semantic assertions; and
- evidence source, integrity, classification, and rationale.

Synthetic cases define policy. Pinned public fonts prove the `FontHandle` seam.
Normalized Troika observations may explain preserved or changed behavior but are
never required at runtime and do not override safer grapheme/Unicode boundaries.
Canonical JSON rejects non-finite numbers, negative zero, invalid UTF-16/style
boundaries, missing classification, and unrecorded fixture revisions.

### Set explicit production gates

The following production change is recommended only if the harness proves all
required cases in Node and a browser-like ESM build, the two-stage boundary is
accepted or rejected explicitly, the selected candidate has compatible license
and bounded size, and the resulting `ResolvedLayoutInput` passes the current
layout suite without contract changes. Failure on a required itemization case is
a recorded blocker, not permission to silently narrow "Unicode text" to a few
hard-coded scripts.

## Risks / Trade-offs

- **Script property data adds bundle and update cost** → Compare bounded
  candidates and pin an explicit Unicode version; prefer maintained data over a
  hand-written script list.
- **A serializable preparation stage may do too little to justify itself** →
  measure its output and repeated-use behavior against a one-call path and reject
  the split if it merely renames the input.
- **Cluster-wide coverage can reject fonts that rely on mark fallback behavior**
  → include combining, variation-selector, and joiner cases and document the
  exact ignorable/control policy before production.
- **Bidi levels can interact with style and font boundaries** → derive bidi from
  the whole paragraph first, then intersect with script/style/font segments while
  preserving original levels and ranges.
- **Pinned-font observations can drift with engine upgrades** → keep synthetic
  itemization policy independent and require explicit fixture/version updates.
- **The spike can expand into a full Unicode engine** → cap candidates and cases,
  stop at a decision, and leave production implementation to the next change.

## Migration Plan

There is no production migration. The validation harness and fixtures are added,
the selected contract is documented, and publishable package exports remain
unchanged. If the boundary is rejected, remove the private candidate code while
retaining the report and failing cases as design evidence.

## Open Questions

- Does the font-independent result perform enough real analysis to merit a
  public `PreparedText` value, or should production expose one synchronous
  font-aware operation?
- Which pinned Unicode/script implementation satisfies the corpus with the
  smallest support and bundle burden?
- What exact Common, Inherited, whitespace, joiner, variation-selector, and
  missing-glyph rules should become normative?
- Which style fields belong in the first production surface, and which can wait
  without preventing ordinary multilingual text?
