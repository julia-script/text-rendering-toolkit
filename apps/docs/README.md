# WebGPU Text documentation

This private workspace is the reader-facing Fumadocs application and a browser integration consumer
for the four public packages.

## Commands

Run from the repository root:

```sh
pnpm docs:dev
pnpm docs:build
```

`docs:dev` builds the four package dependencies before starting Next.js at
`http://localhost:3000`. After `docs:build`, serve the production result with:

```sh
pnpm --filter @webgpu-text/docs start
```

The docs application keeps TypeScript 5.9 as a local build dependency because Next.js 16.2 does
not yet accept the repository's TypeScript 7 toolchain in its build worker.

## Browser behavior

- The layout and CPU SDF examples need WebAssembly, but do not need WebGPU.
- The Three.js example needs a browser with `navigator.gpu` and displays a local unsupported state
  otherwise. Append `?webgpu=off` to its URL to exercise that state in a WebGPU-capable browser.
- Examples fetch font bytes from `public/fonts`; core packages never fetch URLs.
- Each example owns and disposes the font handles and renderer resources it creates.

## HarfBuzz WASM and Turbopack

Next.js 16.2's default Turbopack build emits the font package's adjacent `harfbuzz.wasm` into
`.next/static/media`. The vendored Emscripten wrapper also contains an unreachable browser-side
dynamic import of Node's `module` builtin, so `next.config.mts` maps that builtin to an app-local
browser stub. Font-using examples are loaded with `ssr: false` so the WASM runtime initializes only
in the browser rather than during static page generation.

Both development and production builds use Turbopack; no Webpack fallback or private workspace
source import is required.

## Font assets

The Latin and Arabic demonstration fonts are the repository's Noto Sans test fixtures. Their SIL
Open Font License is copied to `public/fonts/OFL.txt` beside the binaries.

## Deliberately deferred

The application has no selected production host and does not enable `output: 'export'` yet. Its
routes avoid server-only runtime behavior so a later deployment change can choose static export.
Search, documentation versioning, generated API reference pages, live code editing, and Fumadocs
Story are intentionally outside this first documentation change.
