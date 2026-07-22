## ADDED Requirements

### Requirement: Workspace-hosted documentation application
The repository SHALL provide a TypeScript-first Next.js and Fumadocs application under `apps/docs` that participates in the pnpm workspace and the repository's build, type-check, formatting, and linting workflows.

#### Scenario: Build documentation from the repository
- **WHEN** a developer installs the workspace dependencies and runs the documented repository build command
- **THEN** the documentation application builds from tracked repository inputs
- **AND** its generated Next.js and Fumadocs output is not offered for source-control commit

#### Scenario: Develop documentation locally
- **WHEN** a developer runs the documented docs development command
- **THEN** the documentation application starts with the four local `@webgpu-text` packages available through their workspace contracts

### Requirement: Structured learning content
The documentation application SHALL provide navigable authored pages covering installation and first use, the renderer-neutral text pipeline, the responsibility of each public package, and the included interactive examples.

#### Scenario: Learn the package progression
- **WHEN** a reader navigates from the documentation landing page
- **THEN** they can reach getting-started guidance, the pipeline explanation, individual package guides, and example pages through the documentation navigation

#### Scenario: Distinguish documentation responsibilities
- **WHEN** a reader follows a link to contributor architecture, roadmap, or validation evidence
- **THEN** the application points to the repository-owned source instead of maintaining a conflicting copy of that material in MDX

### Requirement: Application-owned font acquisition
Interactive examples MUST acquire font bytes in the documentation application and pass those bytes into the public font APIs; the examples MUST NOT add URL fetching or network ownership to a runtime package.

#### Scenario: Load a demonstration font
- **WHEN** an example initializes successfully in a browser
- **THEN** the application fetches a tracked demonstration font asset
- **AND** passes its bytes to `@webgpu-text/font`

#### Scenario: Font acquisition fails
- **WHEN** the browser cannot fetch or initialize a demonstration font
- **THEN** the affected example presents an actionable error state without preventing the surrounding documentation page from rendering

#### Scenario: Distribute demonstration fonts
- **WHEN** demonstration font binaries are included in the documentation application
- **THEN** their applicable license and attribution files are included alongside the assets

### Requirement: Renderer-neutral layout example
The documentation application SHALL provide an interactive multilingual layout example that uses the public raw-text preparation and layout APIs without depending on Three.js or WebGPU.

#### Scenario: Inspect multilingual layout
- **WHEN** a reader submits editable Latin and Arabic text to the layout example
- **THEN** the example prepares and lays out the text with supplied fonts
- **AND** displays understandable segment, line, and positioned-glyph information

#### Scenario: Run without WebGPU
- **WHEN** the layout example runs in a browser without WebGPU support
- **THEN** its text preparation and layout behavior remains available

### Requirement: Renderer-neutral SDF example
The documentation application SHALL provide an interactive example that obtains a glyph outline lazily, generates an SDF through the public CPU API, and displays the resulting bitmap without Three.js or WebGPU.

#### Scenario: Preview a generated glyph SDF
- **WHEN** a reader selects an available glyph in the SDF example
- **THEN** the example requests that glyph's outline, generates its SDF, and paints the bitmap into a two-dimensional canvas

#### Scenario: Keep SDF generation renderer-independent
- **WHEN** the SDF example is loaded in a browser without WebGPU support
- **THEN** SDF generation and the two-dimensional preview remain available

### Requirement: Three.js WebGPU text example
The documentation application SHALL provide a browser-only Three.js example that renders text through `@webgpu-text/three`, detects WebGPU availability, and isolates GPU-specific behavior from the documentation page and renderer-neutral examples.

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

### Requirement: Next.js browser-runtime compatibility
The documentation application MUST build and run using public package outputs, including the packaged HarfBuzz WASM asset, without importing runtime code or assets through private workspace source paths.

#### Scenario: Initialize HarfBuzz in development
- **WHEN** a developer opens the first font-and-layout example through the documented development command
- **THEN** the browser can locate and initialize the HarfBuzz WASM asset through the application's bundler output
- **AND** produce layout results through public package imports

#### Scenario: Initialize HarfBuzz from a production build
- **WHEN** a developer builds and serves the documentation application in production mode
- **THEN** the browser can locate and initialize the emitted HarfBuzz WASM asset
- **AND** the example does not depend on a workspace-only source path or development server fallback

### Requirement: Static-compatible initial architecture
The initial documentation application SHALL avoid server-only runtime behavior so that a later change can select static export without redesigning the authored pages or examples.

#### Scenario: Defer deployment selection
- **WHEN** the initial documentation application is configured
- **THEN** it does not claim or require a production hosting target
- **AND** search, versioning, live code editing, and generated API reference systems remain outside this change
