## MODIFIED Requirements

### Requirement: Expose a layout-result Three text mesh
`@text-rendering-toolkit/three-webgpu` SHALL expose a `Text` scene object that accepts a completed
renderer-neutral `LayoutResult`, a caller-owned font registry keyed by the
result's font identities, and baseline appearance options without fetching font
bytes, executing text layout, deriving interaction geometry, or performing
automatic itemization or fallback selection. Construction MUST establish that
the supplied options are a non-null object before reading any option from them,
and MUST report a non-object argument with a public renderer error.

#### Scenario: Construct prepared text
- **WHEN** a caller constructs `Text` with a valid multilingual `LayoutResult` and
  structurally compatible public font handles
- **THEN** the object is a Three mesh that can be added to a scene before its
  first synchronization and neither fetches nor disposes those font handles

#### Scenario: Reject an unavailable font
- **WHEN** synchronization needs a drawable glyph whose font key is absent or
  whose lazy outline lookup fails
- **THEN** synchronization rejects with a public renderer error before committing
  partial geometry or atlas state

#### Scenario: Keep text policy outside Three
- **WHEN** the Three package constructs, synchronizes, updates, or disposes a text
  mesh
- **THEN** it does not invoke layout, shaping, selection, caret, bidi, fallback,
  or line-breaking operations

#### Scenario: Reject non-object construction options
- **WHEN** a caller constructs `Text` with `null`, `undefined`, or a primitive in
  place of an options object
- **THEN** construction throws `InvalidTextInputError` and no option is read from
  the argument

#### Scenario: Reject construction options whose property access throws
- **WHEN** a caller constructs `Text` with an options object whose property access
  throws, such as a throwing getter or a `Proxy` trap
- **THEN** construction throws `InvalidTextInputError` rather than propagating the
  caller's error, and each option is read at most once

### Requirement: Expose reusable text renderer resources
`@text-rendering-toolkit/three-webgpu` SHALL expose an explicit `TextResources` owner that can be supplied to multiple `Text` objects while keeping its cache, atlas representation, Three texture, and renderer bindings opaque. Construction MUST establish that the supplied options are a non-null object before reading any option from them, and MUST report a non-object argument with a public renderer error.

#### Scenario: Share resources across text objects
- **WHEN** a caller constructs one `TextResources` and supplies it to two or more text objects
- **THEN** those objects borrow the same glyph resources while retaining independent layout, geometry, material, appearance, synchronization, and disposal state

#### Scenario: Keep standalone construction convenient
- **WHEN** a caller constructs `Text` without supplying shared resources
- **THEN** the text creates private resources using its requested or default SDF size and owns their eventual disposal

#### Scenario: Reject ambiguous raster configuration
- **WHEN** a caller supplies both an existing `TextResources` and a text-level SDF size
- **THEN** construction rejects with a public renderer error rather than silently selecting one configuration

#### Scenario: Keep representation details private
- **WHEN** a caller uses `TextResources` through the public package API
- **THEN** the caller does not need access to SDF pixels, RGBA channel packing, atlas slots, texture dimensions, or TSL bindings
- **AND** the owner does not acquire fonts, execute layout, or dispose caller-owned font handles

#### Scenario: Reject non-object resource options
- **WHEN** a caller constructs `TextResources` with `null` or a primitive in place of an options object
- **THEN** construction throws `InvalidTextInputError` and no option is read from the argument
- **AND** omitting the argument entirely remains valid, since the options parameter defaults to an empty object
