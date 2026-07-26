# Text Rendering Toolkit

Text Rendering Toolkit is a strict TypeScript, ESM-only package family for turning font bytes and
Unicode text into renderer-ready data:

- [`@text-rendering-toolkit/font`](packages/font) parses caller-owned font bytes, shapes text, and
  returns numeric glyph outlines.
- [`@text-rendering-toolkit/layout`](packages/layout) prepares multilingual text and produces
  positioned glyphs, lines, carets, selections, bounds, and decorations.
- [`@text-rendering-toolkit/sdf`](packages/sdf) converts numeric outlines into deterministic
  one-channel signed-distance-field bitmaps without a browser or GPU.
- [`@text-rendering-toolkit/three-webgpu`](packages/three) renders completed layouts with Three.js
  `WebGPURenderer`.

Each package is independently useful. The runtime dependency direction is:

```text
font → layout ─┐
               ├→ three-webgpu → three
sdf ───────────┘
```

The SDF package also accepts font outlines structurally without importing the font package at
runtime.

## Install

Choose only the boundaries your application needs:

```sh
pnpm add @text-rendering-toolkit/font
pnpm add @text-rendering-toolkit/layout
pnpm add @text-rendering-toolkit/sdf
pnpm add @text-rendering-toolkit/three-webgpu three
```

The first public package family is versioned together at `0.1.x`. Its APIs are tested through
packed, isolated consumers, but remain pre-1.0 and may change between minor releases.

See the [documentation source](apps/docs) and each package README for API examples and ownership
rules. Architecture, validation evidence, and project direction live in
[ARCHITECTURE.md](ARCHITECTURE.md), [docs/validation](docs/validation), and
[ROADMAP.md](ROADMAP.md).

## Development

```sh
pnpm install
pnpm check
pnpm release:candidate
```

## License

[MIT](LICENSE) © 2026 Julia Ortiz
