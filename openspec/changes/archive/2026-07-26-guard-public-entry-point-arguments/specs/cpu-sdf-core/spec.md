## MODIFIED Requirements

### Requirement: Validate the production boundary
The package MUST reject malformed or unsafe generation input with a public `InvalidSdfInputError` before allocating or returning a partial bitmap. Rejection MUST NOT depend on the input being a well-formed object: the package MUST establish that the argument is a non-null object before reading any field from it, and MUST read each field exactly once so that a field whose access throws is reported as invalid input rather than propagating the caller's own error.

#### Scenario: Reject invalid dimensions or encoding
- **WHEN** width or height is not a positive safe integer, their product cannot be allocated safely, the view box is non-finite or inverted, or distance or exponent is not finite and greater than zero
- **THEN** generation fails with an error identifying the invalid field

#### Scenario: Reject malformed outline data
- **WHEN** a command opcode is unknown, coordinate counts do not match commands, a coordinate is non-finite, a drawing command appears before a move, or a close command has no open contour
- **THEN** generation fails deterministically without mutating the outline arrays

#### Scenario: Reject non-object input
- **WHEN** the generation input is `null`, `undefined`, or a primitive rather than an object
- **THEN** generation fails with `InvalidSdfInputError` identifying the input itself as invalid, and no field is read from the argument

#### Scenario: Reject input whose property access throws
- **WHEN** the generation input is an object whose property access throws, such as a throwing getter or a `Proxy` trap
- **THEN** generation fails with `InvalidSdfInputError` rather than propagating the caller's error, and each field is read at most once
