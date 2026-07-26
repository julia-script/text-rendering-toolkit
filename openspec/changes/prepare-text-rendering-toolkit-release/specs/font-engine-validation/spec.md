## REMOVED Requirements

### Requirement: Provide an isolated executable validation harness
**Reason**: The private harness is superseded by the production font package.

**Migration**: Use public font package unit, integration, and packed-consumer tests.

### Requirement: Use representative and attributable font fixtures
**Reason**: Reusable fixtures and attribution remain outside the deleted harness.

**Migration**: Use retained font fixtures, licenses, and package evidence.

### Requirement: Validate shaping at the run boundary
**Reason**: The selected shaping boundary is implemented in the public font package.

**Migration**: Use public font shaping and layout integration tests.

### Requirement: Preserve JavaScript source indexing
**Reason**: UTF-16 cluster behavior is implemented in the public font package.

**Migration**: Use public font shaping tests.

### Requirement: Validate normalized font facts
**Reason**: Normalized font facts are implemented in the public font package.

**Migration**: Use public font package tests.

### Requirement: Validate lazy numeric outline feasibility
**Reason**: Numeric outlines are implemented in the public font package.

**Migration**: Use public font outline and SDF integration tests.

### Requirement: Characterize formats, startup, and memory behavior
**Reason**: The pre-production characterization harness is no longer a release dependency.

**Migration**: Use documented public package support and lifecycle tests.

### Requirement: Produce an evidence-backed integration decision
**Reason**: The integration decision is implemented and retained in archived OpenSpec history.

**Migration**: Use production architecture, package tests, and release documentation.
