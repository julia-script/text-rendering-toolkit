## 1. Candidate Command and Output Boundary

- [x] 1.1 Add the ignored `.release-candidate/` output boundary and a root `release:candidate` command that builds before invoking the existing TypeScript/Vitest toolchain.
- [x] 1.2 Define the TypeScript report model and validation runner so failed steps still produce actionable machine-readable evidence without mutating package manifests or publishing anything.

## 2. Package Assembly and Audit

- [x] 2.1 Pack all four package directories into one candidate run, capture their packed manifests and inventories, and require aligned source versions.
- [x] 2.2 Audit ESM/type export targets, internal dependency rewriting, forbidden workspace/source leakage, archive hashes, and compressed and unpacked sizes.
- [x] 2.3 Enforce package-specific shipped assets and documentation, including the HarfBuzz WASM runtime and notices, layout notices, SDF attribution/license, and Three.js consumer documentation.

## 3. Isolated Consumer Proof

- [x] 3.1 Create a temporary consumer outside the repository, install the four tarballs plus declared registry dependencies, and reject workspace symlinks or fallback resolution.
- [x] 3.2 Add a consumer TypeScript contract that imports all four public APIs, loads supplied font bytes through the packed WASM runtime, prepares multilingual raw text, generates an SDF, and exercises the Three.js integration without a GPU.
- [x] 3.3 Run both consumer type checking and runtime execution and include their results in the technical candidate status.

## 4. Evidence and Release Guidance

- [x] 4.1 Record source and environment identity, package hashes and sizes, every technical check, and explicit owner-controlled publication gates in `.release-candidate/report.json`.
- [x] 4.2 Add `RELEASING.md` explaining the validation result, unresolved naming/license/version/registry gates, and the minimal ordered path for a later authorized publication; update the roadmap with the validated boundary and remaining gates.

## 5. Verification

- [x] 5.1 Run the full repository check and the release-candidate command, inspect the generated report and tarballs, and confirm generated evidence remains ignored while tracked sources stay unchanged.
