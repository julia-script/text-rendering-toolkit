# Repository Foundation Specification

## Purpose

Define the greenfield repository foundation while retaining the original Troika checkout as untracked local reference material.

## Requirements

### Requirement: Preserve the original checkout
The workspace MUST retain the complete original Troika checkout, including its Git metadata and history, under the root-level `old/` directory.

#### Scenario: Inspect the preserved repository
- **WHEN** a developer runs Git inspection commands inside `old/`
- **THEN** Git resolves the original repository and its pre-reset history

### Requirement: Establish an independent root repository
The workspace root SHALL be a newly initialized Git repository whose history and tracked files are independent of the preserved checkout.

#### Scenario: Resolve the root repository
- **WHEN** a developer runs Git inspection commands from the workspace root
- **THEN** Git resolves the new root repository rather than the repository inside `old/`

### Requirement: Exclude local reference material
The root repository MUST ignore `/old/` and MUST NOT require any file under `/old/` to build, test, document, or operate the future package.

#### Scenario: Check repository status
- **WHEN** the preserved checkout exists under `old/`
- **THEN** root Git status does not list its contents as trackable changes

#### Scenario: Remove the local reference
- **WHEN** `old/` is absent on another clone of the new repository
- **THEN** all committed project artifacts remain internally valid

### Requirement: Provide a fresh specification workspace
The root repository SHALL contain a newly initialized OpenSpec workspace for planning changes to the greenfield project.

#### Scenario: Inspect OpenSpec from the root
- **WHEN** a developer invokes OpenSpec in the new repository
- **THEN** OpenSpec resolves the root workspace and its changes independently of `old/`
