## Why

`@webgpu-text/layout` can lay out already shaped runs, but ordinary consumers
must still perform bidi/script itemization, font fallback, shaping, and scaling
themselves. The completed validation established a deterministic two-stage
boundary, so the next step is to promote that evidence into a production API
without coupling text logic to fetching, workers, Three.js, or another renderer.

## What Changes

- Add `prepareText()` for immutable, serializable, font-independent grapheme,
  bidi, script, style, and layout-policy analysis.
- Add `layoutPreparedText()` for explicit grapheme-safe fallback and HarfBuzz
  shaping over a caller-owned registry of public `FontHandle` values, returning
  the existing renderer-neutral `LayoutResult`.
- Add `layoutText()` as the equivalent one-call convenience composition while
  retaining `layoutResolvedText()` as the unchanged expert API.
- Promote the validated `bidi-js@1.0.3` and `unicode-script@1.2.0` choices into
  production layout dependencies with pinned Unicode/provenance documentation
  and narrow local TypeScript declarations where upstream declarations are
  unavailable.
- Port the canonical preparation corpus into production package conformance,
  ownership, clean-install, and browser-compatible ESM tests.
- Keep font-byte acquisition, global caches, workers, full Unicode line
  breaking and break-sensitive reshaping, bidi caret affinity, color-font
  policy, SDF/atlas work, and renderer behavior outside this change.

## Capabilities

### New Capabilities

- `text-preparation-core`: Defines the reusable raw-text preparation contract,
  explicit-font resolution and shaping, one-call composition, deterministic
  failures, ownership rules, dependency limits, and renderer-neutral output.

### Modified Capabilities

None. The existing resolved-run layout contract and behavior remain unchanged.

## Impact

- **Package/API:** `packages/layout` gains new public types, errors, preparation
  and composition functions, tests, and documentation.
- **Dependencies:** `@webgpu-text/layout` adds runtime dependencies on
  `bidi-js@1.0.3` and `unicode-script@1.2.0`; `@webgpu-text/font` remains its
  only project-package dependency.
- **Contracts:** callers continue to acquire and own font bytes/handles; no API
  accepts URLs or performs fetching, discovery, disposal, or global caching.
- **Consumers:** any renderer may reuse the returned `LayoutResult`; the Three
  package requires no raw-text logic or API change.
- **Compatibility:** `layoutResolvedText()` and existing fixture behavior are
  preserved, so this is additive within the greenfield pre-release package.
