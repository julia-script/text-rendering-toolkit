## REMOVED Requirements

### Requirement: Isolate text-preparation validation
**Reason**: The private harness is superseded by the production layout package.

**Migration**: Use public text-preparation and packed-consumer tests.

### Requirement: Evaluate a reusable font-independent boundary
**Reason**: The selected prepared-text boundary is implemented.

**Migration**: Use public preparation types and tests.

### Requirement: Validate Unicode itemization policy
**Reason**: The selected itemization policy is implemented.

**Migration**: Use public preparation fixtures and tests.

### Requirement: Validate explicit-font fallback and shaping
**Reason**: The selected fallback and shaping composition is implemented.

**Migration**: Use public preparation and font integration tests.

### Requirement: Compose with the resolved layout core
**Reason**: The selected composition is implemented.

**Migration**: Use public layout composition tests.

### Requirement: Select and record the production direction
**Reason**: The production direction is implemented and retained in archived OpenSpec history.

**Migration**: Use production architecture, package tests, and release documentation.
