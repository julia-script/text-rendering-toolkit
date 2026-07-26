## MODIFIED Requirements

### Requirement: Workspace-hosted documentation application
The repository SHALL provide a TypeScript-first Next.js and Fumadocs application under `apps/docs` that participates in the pnpm workspace and the repository's build, type-check, formatting, and linting workflows.

#### Scenario: Build documentation from the repository
- **WHEN** a developer installs the workspace dependencies and runs the documented repository build command
- **THEN** the documentation application builds from tracked repository inputs
- **AND** its generated Next.js and Fumadocs output is not offered for source-control commit

#### Scenario: Develop documentation locally
- **WHEN** a developer runs the documented docs development command
- **THEN** the documentation application starts with the four local `@text-rendering-toolkit` packages available through their workspace contracts

### Requirement: Application-owned font acquisition
Interactive examples MUST acquire font bytes in the documentation application and pass those bytes into the public font APIs; the examples MUST NOT add URL fetching or network ownership to a runtime package.

#### Scenario: Load a demonstration font
- **WHEN** an example initializes successfully in a browser
- **THEN** the application fetches a tracked demonstration font asset
- **AND** passes its bytes to `@text-rendering-toolkit/font`

#### Scenario: Font acquisition fails
- **WHEN** the browser cannot fetch or initialize a demonstration font
- **THEN** the affected example presents an actionable error state without preventing the surrounding documentation page from rendering

#### Scenario: Distribute demonstration fonts
- **WHEN** demonstration font binaries are included in the documentation application
- **THEN** their applicable license and attribution files are included alongside the assets

### Requirement: Three.js WebGPU text example
The documentation application SHALL provide a browser-only Three.js example that renders text through `@text-rendering-toolkit/three-webgpu`, detects WebGPU availability, and isolates GPU-specific behavior from the documentation page and renderer-neutral examples.

#### Scenario: Render text with WebGPU
- **WHEN** a reader opens the Three.js example in a compatible browser
- **THEN** the example lays out raw text through the public renderer-neutral API
- **AND** displays that prepared result through the public Three.js WebGPU integration

#### Scenario: Report unsupported WebGPU
- **WHEN** a reader opens the Three.js example in a browser without WebGPU support
- **THEN** the page remains usable
- **AND** the example shows a clear unsupported-browser state instead of throwing an uncaught error

#### Scenario: Dispose a mounted example
- **WHEN** the Three.js example unmounts or is remounted during development
- **THEN** it releases its text, font, renderer, observer, animation, and event-listener resources without retaining duplicate browser work
