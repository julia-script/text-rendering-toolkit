## Why

The raw-text path currently wraps only at whitespace or an emergency grapheme boundary, so ordinary punctuation, CJK text, emoji sequences, and other Unicode text do not receive browser-like soft-break opportunities. The existing preparation/layout split is now stable enough to add Unicode-aware opportunities without moving font measurement or rendering into `prepareText()`.

## What Changes

- Adopt pinned `linebreak@1.1.0` behind a project-owned strict-TypeScript adapter that emits validated UTF-16 optional and mandatory break opportunities while keeping the dependency out of public types.
- **BREAKING**: increment the serialized `PreparedText` schema and include immutable break opportunities; previously serialized schema-version-1 values remain explicitly incompatible rather than being guessed or silently upgraded.
- Replace whitespace-only soft wrapping in the raw-text path with measured selection from prepared Unicode opportunities while retaining the existing `whiteSpace` and `overflowWrap` policies and grapheme-safe emergency fallback.
- Reshape selected font segments at actual soft line boundaries before producing the final renderer-neutral `LayoutResult`, so contextual shaping does not incorrectly join across lines.
- Add Unicode-conformance, public-font, browser-observation, package, and regression fixtures covering punctuation, CJK, emoji/ZWJ/RI sequences, mixed bidi text, and break-sensitive scripts.
- Document the pinned Unicode 13 limit inherited from `linebreak@1.1.0` and exclude dictionary segmentation, hyphenation, locale/CSS tailoring, and a claim of complete browser parity from this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `text-preparation-core`: prepared raw text gains versioned, serializable Unicode line-break opportunities produced without fonts or layout measurement.
- `text-layout-core`: the raw-text composition selects measured Unicode opportunities, preserves existing policy controls, and reshapes break-sensitive line fragments while the resolved expert API remains renderer-neutral.

## Impact

- `packages/layout` gains the pinned `linebreak` runtime dependency, a local declaration/adapter boundary, a new `PreparedText` schema version, measured opportunity selection, and break-aware shaping orchestration.
- The public font API remains unchanged; the layout package continues to call caller-owned `FontHandle.shape()` synchronously and never fetches or disposes fonts.
- Existing resolved-layout behavior and `LayoutResult` remain the renderer-neutral handoff; direct `layoutResolvedText()` callers do not acquire the raw-text dependency policy.
- Layout fixtures, validation documents, package README, documentation examples, packed consumers, dependency metadata, and the roadmap require updates.
