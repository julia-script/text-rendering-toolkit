# Unicode line-breaking validation

> **Superseded in part (2026-07-28).** The composition observations below were
> recorded against `linebreak@1.1.0` (Unicode 13.0.0), which has been replaced by
> the rule-based `@text-rendering-toolkit/linebreak` (Unicode 17.0.0). The
> exact-composition and reshaping behavior they characterize is unchanged, but
> conformance evidence now lives in
> [`unicode-17-line-breaking.md`](./unicode-17-line-breaking.md).

## Bounded composition observation

This is a local characterization, not a benchmark or performance guarantee. It exercises the
public `layoutText()` path with a deterministic one-layout-unit-per-grapheme `FontHandle`, a
40-unit line width, one warm-up, and nine measured executions. The recorded time is the median;
the range shows the fastest and slowest observed run.

| Input | UTF-16 length | Lines | Shape calls | Median | Range |
| --- | ---: | ---: | ---: | ---: | ---: |
| Repeated Latin sentence | 2,280 | 60 | 215 | 104.260 ms | 47.004–106.606 ms |
| Opportunity-dense CJK | 1,600 | 40 | 518 | 58.092 ms | 31.450–59.124 ms |

Environment: Node.js 24.2.0, Darwin arm64, Apple M1 Max. Shape calls include the full-segment
provisional shape and exact candidate/final fragments. Final fragments reuse call-local memoized
shapes; no cache survives the synchronous composition call.

The result supports keeping the correctness-first synchronous implementation for local use. It
does not establish a stable throughput target, a worker threshold, or a reason to add a persistent
cache. Those decisions need measurements from representative applications and real fonts.

## Regeneration

Regenerate the canonical preparation opportunities after an intentional adapter or dependency
revision, then review and run the focused corpus:

```sh
pnpm --filter @text-rendering-toolkit/layout fixtures:record
pnpm --filter @text-rendering-toolkit/layout test
pnpm --filter @text-rendering-toolkit/text-preparation-experiment build
```

Do not accept a generated diff solely because it is deterministic. Changes to Unicode revisions,
mandatory controls, grapheme filtering, or upstream excluded cases require an explicit design and
fixture review.

## Browser observation

The committed browser smoke fixture bundles production public layout exports for an ES2023 browser
target, then executes `prepareText()` and measured `layoutText()` with a structural caller-owned
font. In the Codex in-app browser on 2026-07-21, the visible result was:

```json
{"schemaVersion":2,"breakPositions":[1,2,3,4],"lineEnds":[2,4]}
```

This proves the pinned dependency and project adapter load without CommonJS interop or Node
polyfills and that representative CJK opportunities reach measured wrapping. The browser console
reported no warnings or errors. The observation is not a browser-layout oracle: dictionary
segmentation, hyphenation, locale/CSS tailoring, and complete parity remain explicitly excluded.
