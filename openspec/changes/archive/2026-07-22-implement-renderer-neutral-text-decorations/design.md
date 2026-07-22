## Context

`LayoutResult` already owns positioned glyphs, line geometry, caret stops, bounds, and stable UTF-16 identity. `getSelectionRects()` proves that source ranges can be mapped into wrapped and bidi-aware visual intervals without re-running text logic. What is missing is automatic font decoration data and a public analytic result that every renderer can consume.

The archived `validate-browser-text-decoration-boundary` experiment proved a private span/segment model, solid/dotted/wavy underline, solid strikethrough, independent RGBA/current foreground, per-fragment phase, bounds-only skip ink, and a typed-array non-Three consumer. This change promotes only that renderer-neutral half. Three SDF outline and drop shadow remain an independent later change.

## Goals / Non-Goals

**Goals:**

- expose reliable automatic underline and strikethrough metrics from public font facts;
- retain the smallest scaled metric context necessary after layout;
- derive immutable analytic decoration segments from independent UTF-16 spans;
- preserve preparation, shaping, line, caret, selection, and color-glyph identity across decoration-only edits;
- cover multilingual, mixed-style, packed-package, and non-Three consumption.

**Non-Goals:**

- renderer tessellation, Three geometry/materials, SDF outline, or drop shadow;
- COLR composed-silhouette paint;
- outline-aware skip ink or eager outline access;
- CSS parsing, DOM style compatibility, system fonts, or font fetching;
- dotted or wavy strikethrough, overline, spelling semantics, animation, or interaction changes.

## Decisions

### Extend font facts with four decoration metrics

Add a small `FontDecorationMetrics` value containing underline position and thickness plus strikethrough position and thickness in font units, and expose it from immutable `FontFacts`. Read the two signed underline fields from `post` and the two signed/unsigned strikeout fields from OS/2. Reuse a tiny shared internal SFNT table-directory/bounds helper extracted from the existing COLR reader; do not add a parser dependency or expose arbitrary tables.

If an optional table is absent or declares a non-positive thickness, use documented deterministic fallbacks based on existing units-per-em and ascender/descender facts. A present but truncated table is invalid rather than silently treated as absent. These are stable default-font facts; MVAR variation-specific decoration adjustments are not part of this increment, and numeric span overrides remain available.

Alternative: require every decoration caller to provide numbers. Rejected because ordinary automatic placement would be inconvenient and every consumer would invent different fallbacks.

### Keep decoration outside `PreparedText`

Do not add decoration to `TextStyle` or schema-versioned `PreparedText`. Decoration is appearance/layout-result data: changing color, pattern, skip ink, or numeric metrics must reuse preparation and shaping.

The prepared path scales public font decoration facts alongside existing run metrics. The expert resolved path supplies the same scaled values directly. `LayoutResult` retains immutable half-open metric ranges with values in layout units; no font handle is retained.

Alternative: put decorations into preparation style ranges and recompute layout. Rejected because it invalidates reusable font-independent work for appearance-only edits.

### Export one pure derivation operation

Add one public synchronous helper, provisionally `deriveTextDecorations(layout, spans, options?)`, plus structural types. It validates all spans first, then intersects spans with visual line/caret intervals and retained metric ranges. It returns immutable analytic segments and their aggregate bounds. No public tessellator, renderer adapter, registry, factory, or class is introduced.

The public paint type reuses `RgbaColor | 'foreground'` from the font package rather than defining a second RGBA shape. Current foreground remains unresolved for the final renderer.

Alternative: append decoration geometry directly to `LayoutResult` during layout. Rejected because decoration edits would require a new result and because undecorated measurement consumers should not pay for it.

### Keep automatic metrics stable within a decoration span

Derivation chooses the first retained metric context intersecting each logical decoration span and keeps that automatic position and thickness through fallback-font changes. It still splits visual output at lines, discontiguous bidi intervals, adjacent decoration spans, clipping, and skip-ink cuts. Segments retain source and line identity. A caller that wants different automatic metrics creates adjacent spans at its styling boundary; explicit numeric thickness/offset remain constant across the span.

This matches browser-like decorating-box behavior: a fallback emoji or script font must not create a visible step inside one underline. The retained metric ranges remain necessary so a span beginning inside a styled run can select that run's effective metrics without retaining font handles.

Solid segments use only their band. Dotted underline derives dot diameter and spacing from thickness. Wavy underline derives amplitude and wavelength from thickness. These resolved numeric pattern values live on each segment so renderers do not need shared text policy.

Alternative: split automatic decoration at every fallback metric boundary. Rejected after visual integration showed a vertical step around emoji that Chrome does not produce.

### Reset phase per visual fragment, preserve it through cuts

Each line/bidi/style fragment begins at phase zero. Clipping and automatic skip-ink produce pieces whose phase advances by `piece.xStart - fragment.xStart`. This is the private experiment's simplest deterministic rule and prevents a dotted or wavy underline from restarting after a descender.

### Make skip ink explicit and bounds-only

The default is `none`. `auto` subtracts same-line positioned glyph bounds intersecting the decoration band, with a thickness-derived clearance, and preserves phase on retained pieces. Missing bounds cause no layout-owned cut, while the segment retains `skipInk: 'auto'` so a renderer that already owns outlines, SVG masks, or SDF coverage may refine the cut. The helper never resolves outlines.

Alternative: outline-aware cutting. Rejected for the first production surface because it breaks lazy outline ownership and makes non-rendering layout consumers pay font/SDF costs.

## Risks / Trade-offs

- **Font tables can be absent or malformed** → distinguish absent/non-positive values from truncated present tables, pin fallback fixtures, and use the existing `InvalidFontError` boundary.
- **Bounds-only skip ink is less faithful than outline intersections** → keep it opt-in and document the ceiling; add outline-aware behavior only after a separate fidelity case justifies eager data.
- **Metric ranges add data to every `LayoutResult`** → retain only source range plus four scaled numbers and no handles, outlines, or duplicate glyph data.
- **Variable-font metric adjustments are not modeled** → document default-instance facts and keep numeric overrides; evaluate MVAR only with concrete mismatches.
- **Analytic renderers may tessellate differently** → make geometry inputs, pattern dimensions, phase, and clipping normative while leaving backend approximation details local.

## Migration Plan

1. Add bounded font metric facts and fixtures without changing existing shaping, outline, or color behavior.
2. Extend resolved/default metrics and raw-text scaling, then update deterministic layout fixtures for retained context.
3. Add the pure derivation helper and promote the accepted private corpus into production tests.
4. Add packed ESM/browser and non-Three documentation examples, then run the full workspace and docs gates.

The change is additive at runtime. TypeScript consumers constructing expert resolved metrics must add the four required decoration values; the repository has no backward-compatibility commitment, so no legacy optional branch is retained.

## Open Questions

None. Public names may be adjusted during implementation for consistency, but the ownership, data flow, supported styles, metric policy, phase, and skip-ink semantics are fixed by the validation evidence.
