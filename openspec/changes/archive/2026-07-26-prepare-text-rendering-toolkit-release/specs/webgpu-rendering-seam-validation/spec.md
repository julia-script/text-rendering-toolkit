## REMOVED Requirements

### Requirement: Provide an isolated WebGPU rendering experiment
**Reason**: The private experiment is superseded by production package and packed-consumer tests.

**Migration**: Use `@text-rendering-toolkit/three-webgpu` tests and release-candidate validation.

### Requirement: Validate an actual WebGPU backend
**Reason**: Hardware-specific experiment evidence is no longer a release dependency.

**Migration**: Validate the public adapter through retained deterministic and packed-consumer tests.

### Requirement: Render deterministic instanced RGBA-atlas SDF fixtures
**Reason**: The promoted production implementation owns this behavior.

**Migration**: Use the public Three.js adapter's atlas, rendering, and integration tests.

### Requirement: Express baseline text appearance through TSL
**Reason**: The promoted production implementation owns this behavior.

**Migration**: Use the public Three.js adapter's rendering tests.

### Requirement: Propagate post-render resource updates
**Reason**: The promoted production implementation owns this behavior.

**Migration**: Use the public Three.js adapter's resource and text synchronization tests.

### Requirement: Produce reproducible semantic visual evidence
**Reason**: Experiment-only browser artifacts and reports are being retired.

**Migration**: Use retained deterministic package and packed-consumer evidence.

### Requirement: Validate renderer resource ownership
**Reason**: The promoted production implementation owns this behavior.

**Migration**: Use the public Three.js adapter's lifecycle tests.

### Requirement: Record an evidence-backed renderer decision
**Reason**: The renderer decision is implemented and retained in archived OpenSpec history.

**Migration**: Use the production architecture, package tests, and release documentation.
