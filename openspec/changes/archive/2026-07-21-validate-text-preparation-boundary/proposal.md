## Why

The renderer-neutral pipeline is complete, but ordinary callers must still
manually determine bidi/script runs, choose fallback fonts, shape and scale each
run, and assemble `ResolvedLayoutInput`. Before adding a convenient raw-text API,
the project needs executable evidence for the Unicode itemization boundary and
for whether font-independent preparation is genuinely reusable.

## What Changes

- Define and exercise a candidate two-stage text-preparation contract: a pure,
  reusable analysis of raw text and style policy followed by font-aware fallback,
  shaping, scaling, and resolved layout using caller-owned `FontHandle` values.
- Build a deterministic validation corpus covering Latin, Arabic, Indic, Khmer,
  mixed bidi text, common/inherited characters, combining sequences, surrogate
  pairs, grapheme-safe fallback, style boundaries, font variations, missing
  coverage, empty text, and repeated execution.
- Evaluate the smallest viable Unicode bidi/script itemization approach against
  the existing HarfBuzz, resolved-layout, and attributed Troika evidence,
  including ESM/TypeScript fit, package size, provenance, and maintenance cost.
- Prove that font selection uses only an explicit ordered caller registry, never
  fetches bytes or discovers system/browser fonts, and returns stable font keys
  suitable for any renderer.
- Record the accepted public contract, fixture schema, supported first slice,
  deliberate deferrals, and implementation recommendation for the following
  production change.
- Keep this change validation-only: it adds no production layout export, worker,
  renderer integration, network helper, or batching implementation.

## Capabilities

### New Capabilities

- `text-preparation-validation`: Executable evidence and contract decisions for
  renderer-neutral raw-text analysis, explicit-font fallback, shaping, scaling,
  and handoff to the existing resolved layout core.

### Modified Capabilities

None.

## Impact

- Validation code and fixtures: a private text-preparation experiment or
  equivalent isolated harness using existing committed fonts and layout oracles.
- Documentation: architecture, roadmap, and a focused validation report will
  distinguish proven preparation behavior from the later production API.
- Dependencies: candidate itemization code remains isolated from publishable
  packages during the comparison; any recommended production dependency must be
  explicitly measured and attributed.
- Public/runtime behavior: unchanged in this validation change; font-byte
  acquisition, font lifetime, `LayoutResult`, SDF, and Three ownership boundaries
  remain intact.
