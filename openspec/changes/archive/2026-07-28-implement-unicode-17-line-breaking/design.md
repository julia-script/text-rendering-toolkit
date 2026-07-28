## Context

`packages/layout` obtains default line-break opportunities from pinned
`linebreak@1.1.0` behind the internal adapter at `src/internal/line-break.ts`. That
adapter was deliberately introduced as a replaceable seam, and this change exercises it.

The dependency is pair-table based. Its bundled runtime exposes `getPairTableBreak`
beside `getSimpleBreak`, plus per-instance `LB8a`, `LB21a`, and `LB30a` flags — carried
state for the three rules a class-by-class matrix cannot express. UAX #14 deleted its
pair-table section no later than Unicode 13.0.0 revision 45 (2020-02-17), the very
version the dependency targets, and it remains deleted in 17.0.0 revision 55
(2025-09-05). The archived `2026-07-21-integrate-unicode-line-break-opportunities`
design recorded this limitation as a data-freshness risk; a correction appended to that
document on 2026-07-28 records why regenerating tables cannot resolve it.

A rule-based Zig implementation exists in a separate local repository at
`packages/core/src/uni/LineBreak.zig`, targeting Unicode 16.0.0. Its rule structure and
carried-state design are sound and serve as reference material. It is explicitly not a
port source: its UTF-8 byte iteration, `ReverseUtf8Iterator`, and buffer-holding stream
variant reflect Zig idioms that do not transfer. It carries no conformance corpus, so
its own compliance is unmeasured.

Unicode 17.0.0 publishes 49 line-break classes. The reference implementation's enum
covers 48; `HH` (Armenian hyphen and related, 10 ranges) is the single addition. An
earlier reading of this change's inputs reported four new classes; that was an
extraction error over comment text and is corrected here.

The class inventory is not the meaningful delta. Reading the normative rules from
UAX #14 revision 55 shows the reference tracks an older *rule* set, not merely older
data. Rules absent from it entirely: LB15a and LB15b (unresolved initial and final
punctuation, defined by `\p{Pi}` and `\p{Pf}` intersected with QU), LB15c and LB15d
(`SP ÷ IS NU`, then `× IS`), LB19a (quotation marks conditioned on East Asian context
on both sides), LB20a (word-initial hyphen, which references `HH`), LB21b (`SY × HL`),
LB23a (numeric prefix and ideograph pairs), LB28a (Brahmic orthographic syllables,
referencing a literal dotted-circle class), and LB30b's second clause
(`Extended_Pictographic ∩ Cn`). LB25 has been restructured from the reference's
lookbehind form into a regular-expression form over `NU (SY | IS)*` sequences, which
the conformance corpus cites as fifteen numbered subrules.

## Goals / Non-Goals

**Goals:**

- Replace pair-table breaking with ordered rule evaluation over adjacent positions plus
  explicit carried state, matching how UAX #14 now defines the algorithm.
- Own Unicode 17.0.0 property data through a checked-in generator and committed tables.
- Establish a measured `LineBreakTest-17.0.0.txt` pass rate as project evidence.
- Keep the swap invisible to `PreparedText` structure, `LayoutResult`, and every
  downstream package.
- Decide whether a streaming driver ships from measurement rather than preference.

**Non-Goals:**

- CSS or locale `line-break`/`word-break` tailoring, dictionary segmentation for
  complex-context scripts, hyphenation, optimal paragraph-wide breaking, browser parity.
- Changing `PreparedText` schema version, the resolved expert API, or any font, SDF, or
  renderer surface.
- Porting the Zig streaming buffer design, its byte iteration, or its backward scan.
- Publishing the new package before it replaces the dependency in `layout`.

## Decisions

### Build the conformance harness before the implementation

The harness and table generator land first, with the rule engine failing against them.
This is deliberate: UTF-8-to-UTF-16 reasoning is the highest-risk part of this work and
produces off-by-one position errors that are indistinguishable from rule bugs when both
are unmeasured. A corpus that is green from the first rule commit attributes every
failure to the code under construction.

The alternative — implement, then test — was rejected because the reference
implementation's own compliance is unknown. Without independent ground truth, a failure
could belong to the reference or to the new code, and triage across 19,338 cases would
be guesswork.

### Implement the Unicode 17 rule set directly, staged by corpus attribution

An earlier version of this design staged implementation in two passes: Unicode
16-equivalent semantics first, then `HH`. That checkpoint was abandoned once the
normative rules were read. Because the reference tracks an older rule set — missing
LB15a through LB15d, LB19a, LB20a, LB21b, LB23a, LB28a, and part of LB30b, with LB25
restructured — "Unicode 16-equivalent" maps to no Unicode version and would have made
phase one an arbitrary target with most of the work deferred to phase two.

Implementation instead targets the Unicode 17 rules directly, working from the
normative rule text in UAX #14 revision 55. The reference informs *structure* — tri-state
break decisions, explicit carried state, class resolution shape — not rule content.

Staging comes from the corpus rather than from a Unicode version: the harness reports
failures grouped by the rule numbers the corpus cites, so rules are implemented and
verified in attribution order until the rate stops improving. This gives a real
checkpoint after every rule instead of one arbitrary checkpoint in the middle.

### Decide LB25 from forward-carried state

The reference scans backward past `SY`/`IS` to find a preceding `NU`. In JavaScript that
requires reverse UTF-16 iteration with surrogate handling, or string slicing that
allocates in the hot path. LB25's lookbehind is bounded, so an `inNumericRun` flag
carried forward is expected to be equivalent.

Expected, not assumed: the corpus decides. If forward state diverges on any case, the
backward scan returns as a fallback and the divergence is recorded. This is also what
makes streaming buffer trimming possible, since nothing needs to re-read analyzed text.

### Separate the rule core from its input driver

Carried state lives in an explicit state object, and the core consumes a
position-and-lookup interface rather than a concrete string. Batch analysis is one
driver; streaming, if it ships, is another over the same rules. This costs nothing in
batch mode and prevents the streaming experiment from forking the rule engine — the
outcome that would make the streaming decision expensive to reverse.

### Generate tables rather than translate them

The reference's `lookups.zig` is 243KB of generated Zig source. Translating it would
carry Unicode 16 assignments and Zig representation choices into the new package. A TS
generator reading vendored 17.0.0 UCD files, emitting typed arrays, produces correct
data for the target version and makes future version moves a URL change plus a corpus
run. The generator and its vendored inputs are committed so consumers need no network
access.

Properties are run-length encoded as parallel boundary and value arrays with binary
search lookup, which is compact for the very runny property data. Beyond the line-break
class itself, the rules require East Asian Width, general category, and
Extended_Pictographic. The rule set discovered after the first generator pass adds three
more: `Pi` and `Pf` for LB15a and LB15b, `Cn` for LB30b, and the `$EastAsian` definition
LB19a and LB30 depend on. The generator emits all of them so no rule needs a property
the tables cannot answer.

The generator fails loudly on an unknown line-break class rather than defaulting it to
XX, so a future Unicode version that adds a class cannot silently resolve it to
something wrong.

### Gate streaming on a benchmark against the same core

Streaming is a genuinely novel capability — most implementations require the full string
— and worth evaluating. But the consumer this change serves, `layout`, works on complete
strings synchronously and never needs it. So streaming is built after the batch core is
green, benchmarked against it on identical input, and shipped only if measured cost is
acceptable. Dropping it costs nothing already delivered.

## Risks / Trade-offs

- **[Forward LB25 state diverges from the backward scan]** → Unicode 17 restructured LB25
  into a regular-expression form over `NU (SY | IS)*` sequences, which is closer to
  forward-carried state than the reference's lookbehind was. The corpus decides; the
  backward scan remains available as a recorded fallback.
- **[The rule set is larger than the reference suggested]** → Ten rules and part of an
  eleventh have no counterpart in the reference. They are implemented from the normative
  text and verified individually through corpus rule attribution rather than assumed
  covered.
- **[UTF-16 offset errors around supplementary-plane text]** → Corpus cases carry astral
  code points; opportunity validation already rejects offsets inside surrogate pairs.
- **[Unicode 17 changes existing class assignments, not just `HH`]** → Tables come from
  17.0.0 data, so assignment changes appear as corpus results rather than silent
  behavior drift; the two-phase staging keeps them attributable.
- **[Break positions change for existing consumers]** → Expected and intended; the
  proposal marks it breaking, and existing layout fixtures are re-run to surface every
  changed boundary for review rather than silent acceptance.
- **[Streaming proves slow after being built]** → It is built last, over the shared
  core, and the spec permits not shipping it.
- **[The new package duplicates the npm `linebreak` name while both exist]** → The
  package has no consumers until the swap; the dependency is removed in the same change.
- **[Conformance pass rate lands below the current dependency's behavior]** → The swap
  is gated on the corpus and existing layout fixtures; if either regresses, the
  dependency stays and the evidence is recorded.

## Migration Plan

1. Vendor Unicode 17.0.0 UCD files and `LineBreakTest-17.0.0.txt`; build the generator
   and commit typed-array tables.
2. Build the conformance harness with per-case rule attribution; expect it red.
3. Implement the rule core with explicit carried state and forward LB25, working the
   corpus down in rule-attribution order.
4. Reach the target pass rate against the full 17.0.0 corpus and record a rationale for
   every case that does not pass.
5. Build the streaming driver over the same core, differential-test it against batch
   output under every input split, and benchmark. Ship or drop on measurement.
6. Swap the adapter in `layout`, re-run existing layout fixtures, review every changed
   boundary, then remove the dependency, its declaration, and its notice.
7. Update package documentation, validation records, and the roadmap.

Rollback before step 6 costs nothing, since the new package has no consumers. After step
6, rollback restores the dependency and the adapter's previous implementation;
`PreparedText` structure is unchanged throughout, so no serialized data is invalidated
in either direction.

## Open Questions

- What pass rate is acceptable for the swap? A rate below 100% needs a recorded rationale
  per failing rule, and some corpus cases may depend on tailoring this change excludes.
- Should the package expose its property lookups publicly? Grapheme and word breaking in
  the reference share the same tables, and a future change may want them — but exporting
  them now would commit to a surface this change has no consumer for.
- Does `bidi-js` at Unicode 13 become the next inconsistency once line breaking reaches
  17, and is that worth a follow-up?
