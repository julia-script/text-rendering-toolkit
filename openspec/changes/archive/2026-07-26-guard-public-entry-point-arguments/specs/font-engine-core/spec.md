## MODIFIED Requirements

### Requirement: Load owned font handles from byte sources
The package SHALL asynchronously load an `ArrayBuffer` or `Uint8Array` into an opaque `FontHandle` that owns the native font objects and an exact copy of the supplied byte range. Loading MUST report a byte source it cannot copy — including a detached `ArrayBuffer` or a view onto one — as a public `InvalidFontError` rather than allowing the underlying allocation failure to escape.

#### Scenario: Load an ArrayBuffer
- **WHEN** a consumer passes valid supported font bytes in an `ArrayBuffer`
- **THEN** loading resolves to a usable handle with normalized facts

#### Scenario: Respect a Uint8Array view
- **WHEN** a consumer passes a `Uint8Array` whose view covers only part of its backing buffer
- **THEN** loading uses exactly the view's `byteOffset` and `byteLength` and ignores bytes outside that range

#### Scenario: Decouple caller byte lifetime
- **WHEN** the caller mutates or releases its source bytes after loading resolves
- **THEN** subsequent facts, shaping, coverage, and outline results from the handle remain unchanged

#### Scenario: Reject a detached byte source
- **WHEN** a consumer passes an `ArrayBuffer` that has already been detached, such as one transferred to a worker or through `structuredClone`, or a `Uint8Array` view onto such a buffer
- **THEN** loading rejects with `InvalidFontError` rather than surfacing the allocation's own `TypeError`
