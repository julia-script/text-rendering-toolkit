## REMOVED Requirements

### Requirement: Isolate decoration-boundary validation
**Reason**: The private experiment is superseded by production package tests.

**Migration**: Use renderer-neutral decoration and public Three.js adapter tests.

### Requirement: Define representative editor-decoration evidence
**Reason**: The accepted behavior has moved into production layout tests and fixtures.

**Migration**: Use `@text-rendering-toolkit/layout` decoration tests.

### Requirement: Compare renderer-neutral decoration contracts
**Reason**: The selected contract is now part of the public layout package.

**Migration**: Use the public decoration types and derivation tests.

### Requirement: Validate analytic line-decoration representation
**Reason**: The selected representation is now part of the public layout package.

**Migration**: Use the public decoration derivation tests.

### Requirement: Measure shared-SDF outline and shadow paint
**Reason**: The selected behavior is now part of the public Three.js adapter.

**Migration**: Use the adapter's paint, resource, and font-integration tests.

### Requirement: Prove composition through actual WebGPU
**Reason**: Hardware-specific experiment evidence is no longer a release dependency.

**Migration**: Use retained deterministic package and packed-consumer evidence.

### Requirement: Record a bounded production decision
**Reason**: The decision is implemented and retained in archived OpenSpec history.

**Migration**: Use production architecture, package tests, and release documentation.
