## 1. Preserve and Reset the Repository

- [x] 1.1 Move the complete original checkout, including its Git metadata, into `old/`
- [x] 1.2 Initialize a fresh root Git repository on `main`
- [x] 1.3 Add root ignore rules for `old/` and generated output
- [x] 1.4 Initialize a fresh root OpenSpec workspace

## 2. Document the Porting Roadmap

- [x] 2.1 Document the relevant current architecture and source-disposition decisions in `ROADMAP.md`
- [x] 2.2 Document the proposed package structure, runtime boundaries, and API direction
- [x] 2.3 Add Mermaid diagrams for the current architecture, future architecture, atlas lifecycle, and synchronization flow
- [x] 2.4 Define delivery horizons, non-goals, and open architectural questions
- [x] 2.5 Audit the preserved module responsibilities and coupling points in `ARCHITECTURE.md`
- [x] 2.6 Define independently consumable font, text-layout, SDF, and Three WebGPU renderer package boundaries
- [x] 2.7 Document package contracts, dependency rules, consumption examples, testing boundaries, and source migration ownership
- [x] 2.8 Record lazy outline resolution and renderer-owned atlas decisions
- [x] 2.9 Document the initial Typr-derived font backend, attributed CPU SDF port, and naming recommendation

## 3. Verify the Foundation

- [x] 3.1 Verify that root Git and `old/` resolve as separate repositories and that root Git ignores `old/`
- [x] 3.2 Verify that every Mermaid diagram in `ROADMAP.md` parses successfully
- [x] 3.3 Validate the repository-reset OpenSpec change in strict mode
- [x] 3.4 Verify that every Mermaid diagram in `ARCHITECTURE.md` parses successfully
