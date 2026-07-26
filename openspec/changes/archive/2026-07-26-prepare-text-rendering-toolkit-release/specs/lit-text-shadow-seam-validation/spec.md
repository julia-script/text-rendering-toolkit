## REMOVED Requirements

### Requirement: Isolate the lit rendering proof
**Reason**: The private proof is superseded by the production Three.js adapter.

**Migration**: Use public adapter material and rendering tests.

### Requirement: Respond to scene lighting through public node APIs
**Reason**: The selected lit material is implemented in the public adapter.

**Migration**: Use public adapter rendering tests.

### Requirement: Cast glyph-shaped shadows
**Reason**: The selected shadow behavior is implemented in the public adapter.

**Migration**: Use public adapter material and paint tests.

### Requirement: Receive shadows on visible glyph coverage
**Reason**: The selected shadow behavior is implemented in the public adapter.

**Migration**: Use public adapter material and paint tests.

### Requirement: Capture reproducible actual-WebGPU evidence
**Reason**: Hardware-specific experiment evidence is no longer a release dependency.

**Migration**: Use retained deterministic package and packed-consumer evidence.
