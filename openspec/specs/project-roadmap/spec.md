# Project Roadmap Specification

## Purpose

Define the documentation required to explain the transition from Troika's existing text system to an independently consumable, WebGPU-focused package family.

## Requirements

### Requirement: Explain the architectural transition
The root `ROADMAP.md` MUST explain both the relevant current Troika text architecture and the proposed standalone WebGPU architecture.

#### Scenario: Understand the transition without reading source first
- **WHEN** a contributor reads the roadmap
- **THEN** they can identify the existing processing and rendering boundaries, the proposed future boundaries, and the major changes between them

### Requirement: Map reusable source areas
The roadmap MUST identify relevant source areas from `troika-three-text` and state whether each is a candidate to port, adapt, replace, or exclude.

#### Scenario: Plan a future implementation increment
- **WHEN** a contributor selects a subsystem for a later porting change
- **THEN** the roadmap provides its intended disposition and rationale

### Requirement: Visualize important structures and flows
The roadmap SHALL include valid Mermaid diagrams for the current architecture, future architecture, atlas lifecycle, and cross-context synchronization flow.

#### Scenario: Render roadmap diagrams
- **WHEN** the Mermaid blocks are processed by a compatible renderer
- **THEN** each diagram parses successfully and depicts its named structure or flow

### Requirement: Define project direction and boundaries
The roadmap MUST define staged delivery horizons, explicit non-goals, API direction, and open architectural questions for the future package family.

#### Scenario: Evaluate a proposed porting task
- **WHEN** a future task is compared with the roadmap
- **THEN** its horizon, scope alignment, and dependence on unresolved decisions can be determined

### Requirement: Define independently consumable package boundaries
The project documentation MUST define independently publishable font, text-layout, SDF, and Three WebGPU renderer packages, including their responsibilities, inputs, outputs, dependencies, excluded concerns, and source-migration treatment.

#### Scenario: Select only a lower-level capability
- **WHEN** a consumer needs font parsing, text layout, or SDF generation without Three.js rendering
- **THEN** the architecture identifies a package that can be consumed without importing the renderer or its unrelated dependencies

#### Scenario: Review a dependency
- **WHEN** a package dependency is proposed
- **THEN** the documented dependency graph and architectural rules determine whether its direction is allowed

### Requirement: Explain current module responsibilities
The companion architecture document MUST explain what each relevant preserved `troika-three-text` module actually owns, including responsibilities that currently cross the proposed package boundaries.

#### Scenario: Migrate an old source module
- **WHEN** a contributor prepares to port a preserved module
- **THEN** they can identify which responsibilities move to each target package and which renderer-specific behavior is removed

### Requirement: Keep the port outside this change
This change MUST describe the future multi-package port without requiring any runtime port implementation.

#### Scenario: Complete the repository reset change
- **WHEN** the repository foundation and roadmap requirements are satisfied
- **THEN** this change is complete even though no WebGPU text runtime exists yet
