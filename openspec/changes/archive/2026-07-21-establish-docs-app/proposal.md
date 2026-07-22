## Why

The package family now has enough working, validated behavior to need a coherent learning surface beyond package READMEs and internal validation notes. A small documentation application can explain the renderer-neutral architecture while also proving that the public browser APIs, HarfBuzz WASM asset, and WebGPU integration work in a realistic Next.js consumer.

## What Changes

- Add a pnpm-workspace documentation application built with Next.js, Fumadocs, MDX, and TypeScript.
- Establish an initial documentation structure for getting started, architectural concepts, package responsibilities, and examples.
- Add interactive examples for raw-text layout inspection, CPU SDF visualization, and Three.js WebGPU text, with clear unsupported-browser behavior.
- Make the first implementation milestone a thin font-and-layout browser slice that validates HarfBuzz WASM loading through the default Next.js build before expanding the example set.
- Integrate the application with the repository's Turbo, Biome, type-checking, and build workflows without changing the public contracts of the four runtime packages.
- Keep font acquisition in the application: examples fetch font bytes and pass them to the public package APIs.
- Keep the application compatible with a future static deployment, while deferring a specific hosting mode, search, generated API documentation, versioning, and live code editing.

## Capabilities

### New Capabilities

- `documentation-app`: Defines the workspace-hosted documentation experience, its content structure, interactive examples, browser/runtime boundaries, and repository validation requirements.

### Modified Capabilities

None. This change consumes existing package contracts without changing their specified behavior.

## Impact

- Adds a new `apps/docs` workspace and documentation-specific dependencies for Next.js, React, Fumadocs, MDX, and Tailwind CSS.
- Updates workspace, Turbo, Biome, ignore, and root-script configuration to recognize the application and its generated output.
- Adds redistributable demonstration fonts and their license notice as application assets.
- Exercises `@webgpu-text/font`, `@webgpu-text/layout`, `@webgpu-text/sdf`, and `@webgpu-text/three` from a browser application, including HarfBuzz WASM loading and WebGPU feature detection.
- Does not add network fetching responsibilities to the runtime packages, publish packages, choose a production host, or change their public APIs.
