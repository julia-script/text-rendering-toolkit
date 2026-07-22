## Context

The repository contains four ESM-only TypeScript packages: `@webgpu-text/font`, `@webgpu-text/layout`, `@webgpu-text/sdf`, and `@webgpu-text/three`. Each package has some form of isolated pack coverage, and the Three.js package pack test installs all four archives together, but those checks are distributed across package tests and still borrow selected dependencies from the workspace. There is no single candidate identity, artifact inventory, cross-package audit, or release procedure.

The manifests intentionally remain at `0.0.0` and `private: true`. The `@webgpu-text` names are candidate names rather than proof of npm ownership, and the new project's own license has not been selected. Third-party licenses and attribution are known, but they cannot choose the project's license. A release validation must therefore distinguish technical evidence from owner-controlled publication gates.

## Goals / Non-Goals

**Goals:**

- Produce all four package tarballs through one repeatable root command.
- Prove that the tarballs form a self-contained package family in an isolated consumer outside the workspace.
- Audit the contents and published manifests that consumers would actually receive.
- Preserve hashes, sizes, environment details, check results, and unresolved publication gates in machine-readable evidence.
- Document a short manual path from a validated candidate to a future npm release.

**Non-Goals:**

- Publishing, reserving an npm scope, authenticating to a registry, or creating tags and GitHub releases.
- Choosing the project license, final package names, initial public version, or provenance policy on the owner's behalf.
- Adding Changesets, semantic-release, a custom release service, or automated version management.
- Repeating visual rendering, lighting, or performance validation already owned by other capabilities.
- Making release-candidate validation part of the normal fast `pnpm check` path.

## Decisions

### Use one explicit root validation command

The root package will expose a command that first builds the workspace and then runs a TypeScript validation suite with the repository's existing Vitest toolchain. The suite will pack the packages in dependency order, audit the results, construct an isolated consumer, run its checks, and emit the report.

This is preferred to a new release framework because the current need is one deterministic preflight, not automated versioning or publication. Separate package pack tests remain useful local tests; the root command is the authoritative cross-package release-candidate boundary.

### Validate the manifests as they exist

The validator will use `pnpm pack` against the real package directories and will not temporarily rewrite versions, names, privacy flags, dependency ranges, or files. It will verify that every package uses the same source version and that packed internal dependencies no longer contain `workspace:` protocols.

Using real manifests makes the evidence honest. A synthetic `0.1.0-rc.0` rewrite would prove an artifact the repository cannot reproduce directly and could hide a packaging mistake. Placeholder versions and privacy flags are recorded as publication gates rather than treated as technical pack failures.

### Exercise one truly isolated package-family consumer

The validation suite will create the consumer outside the repository, install all four tarballs plus normal registry dependencies, and must not symlink or resolve runtime code, declarations, or assets from the workspace. The consumer contract will cover ESM imports and TypeScript declarations across all packages, load a supplied font byte fixture through the packed WASM runtime, prepare multilingual raw text through the renderer-neutral API, generate an SDF through the public CPU API, and import or construct the public Three.js integration without requiring a GPU.

This complements rather than replaces browser WebGPU rendering evidence. A headless release preflight should catch broken exports, dependency declarations, assets, and handoffs without depending on scarce WebGPU CI hardware.

### Audit what is shipped, not only what is present in source

The validator will inspect the packed manifests and archive inventories. It will require public ESM and declaration targets, the HarfBuzz WASM asset, package-specific README and attribution/license material, and the absence of workspace-only protocols and unintended source/test files. It will record compressed archive sizes, unpacked file sizes, and SHA-256 hashes without imposing speculative size budgets.

The allowlist is package-specific: for example, the font package owns HarfBuzz attribution, the layout package owns its runtime dependency notices, and the SDF package owns the adapted generator license. The Three.js package must ship its consumer documentation, while Three.js itself remains a peer dependency.

### Separate technical checks from publication gates

The report will contain two independent sections:

- technical checks, which must all pass for the command to succeed;
- publication gates, which name unresolved owner or external decisions and may remain blocked without failing the technical candidate.

Initial publication gates include final package names and scope ownership, the project's own license and copyright notice, a non-placeholder public version, canonical repository/homepage metadata, npm credentials/access settings, and provenance policy. The command must never publish and must leave source manifests unchanged.

This is preferred to either silently assuming values or making all validation fail indefinitely. The result can truthfully say “technically validated, not approved for publication.”

### Keep generated evidence local and reproducible

Tarballs and a JSON report will be written beneath an ignored `.release-candidate/` directory. The isolated consumer and unpacked audit directories will use the system temporary directory outside the repository and will be deleted after the run. The report will identify the source commit and dirty state, package versions, Node/pnpm/platform environment, archive hashes and sizes, technical results, and publication gates. Generated timestamps may describe the run but will not be used as the candidate identity; source identity plus archive hashes provide that identity.

`RELEASING.md` will explain how to run and interpret the check and list the later manual publication sequence. The generated artifacts themselves will not be committed.

## Risks / Trade-offs

- **[A clean install may require registry or package-store access]** → Keep the command outside the default fast test suite, report the environment, and fail with an actionable install error rather than falling back to workspace symlinks.
- **[A Node consumer cannot prove WebGPU rendering]** → Treat the existing browser rendering specifications as the rendering proof and limit this change to distributable package boundaries.
- **[Archive allowlists can become stale as public files evolve]** → Express requirements by package responsibility and keep the audit focused on public outputs and prohibited workspace/source leakage.
- **[A technically valid candidate may look publishable while owner gates remain unresolved]** → Give publication gates first-class status in both JSON output and human documentation; never collapse them into warnings hidden in logs.
- **[Current `0.0.0` dependency ranges may behave differently from a real release version]** → Verify protocol rewriting now, require one aligned manifest version, and rerun the same validator after the owner selects the public version.

## Migration Plan

1. Add the ignored output directory and the root release-candidate command.
2. Implement tarball assembly, archive/manifest audits, and machine-readable reporting.
3. Add the isolated consumer contract and prove that it cannot borrow workspace packages or assets.
4. Document results, publication gates, and the later manual release sequence.
5. Run the full repository checks and the release-candidate command. Rollback consists only of removing the command, validation suite, documentation, and ignored output entry; no external state is changed.

## Open Questions

- Are the project and npm scope ultimately named `webgpu-text` / `@webgpu-text`, or are these temporary identifiers?
- Which license will cover the new project's original code?
- What initial public version and coordinated versioning policy should the package family use?
- Which canonical repository URL and npm provenance policy should be recorded when publication is authorized?
