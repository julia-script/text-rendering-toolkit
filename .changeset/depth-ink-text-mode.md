---
'@text-rendering-toolkit/three-webgpu': minor
---

Add an opt-in `depthInk` construction option to `Text`. With `depthInk: true`,
fully-covered fill ink renders in a depth-writing core pass at the flat string
opacity — overlapping glyph ink blends exactly once per pixel with no darker
seam on semi-transparent text, and text ink occludes depth-tested geometry
behind it — while the antialiasing ring, outline, and shadow blend in a second
pass without depth writes, keeping their gradients. Default behavior is
unchanged. The mode is fixed at construction and unlit-only: combining it with
`lit: true` throws `InvalidTextInputError`.
