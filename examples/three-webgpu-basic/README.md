# Three WebGPU basic example

This source is intentionally bundler-neutral TypeScript. Serve it with any
ESM-aware development server that handles TypeScript and place a normalized TTF
at `/fonts/NotoSans-Regular.ttf`.

The application—not the libraries—fetches the bytes, creates and disposes the
font handle, renderer, canvas, scene, and camera. It also creates one
`TextResources` shared by two independent text meshes, disposes both meshes,
then disposes their shared monochrome glyph cache and atlas.

The example type-checks and builds with the workspace:

```sh
pnpm --dir examples/three-webgpu-basic typecheck
pnpm --dir examples/three-webgpu-basic build
```
