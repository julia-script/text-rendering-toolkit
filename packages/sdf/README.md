# `@webgpu-text/sdf`

Pure, synchronous CPU signed-distance-field generation from numeric vector
outlines. The package is strict TypeScript, ESM-only, independently installable,
and has no production dependencies or browser globals.

## Usage

```ts
import { generateSdf, SdfCommand } from '@webgpu-text/sdf'

const bitmap = generateSdf({
  outline: {
    commands: Uint8Array.from([
      SdfCommand.MOVE_TO,
      SdfCommand.LINE_TO,
      SdfCommand.LINE_TO,
      SdfCommand.CLOSE_PATH,
    ]),
    coordinates: Float32Array.from([
      -1, -1,
       1, -1,
       0,  1,
    ]),
  },
  viewBox: { left: -1.5, bottom: -1.5, right: 1.5, top: 1.5 },
  width: 32,
  height: 32,
  distance: 1,
  exponent: 9,
})
```

`bitmap.pixels` is a newly owned one-channel `Uint8Array` in row-major order.
`pixels[y * width + x]` addresses one texel, and row zero samples the bottom of
the declared view box. The bitmap also carries its width, height, view box,
maximum distance, and exponent so a renderer can decode it without hidden
configuration.

## Numeric outline contract

Commands consume coordinates as follows:

| Command | Opcode | Coordinates |
| --- | ---: | --- |
| `MOVE_TO` | 0 | `x, y` |
| `LINE_TO` | 1 | `x, y` |
| `QUADRATIC_TO` | 2 | `controlX, controlY, x, y` |
| `CUBIC_TO` | 3 | `control1X, control1Y, control2X, control2Y, x, y` |
| `CLOSE_PATH` | 4 | none |

All geometry, view-box coordinates, and `distance` use the same caller-chosen
units. Quadratic and cubic curves use the pinned deterministic subdivision
policy. Multiple contours use non-zero winding, so reversing an inner contour
creates a hole. Empty or fully degenerate geometry returns all-zero pixels.

Public `@webgpu-text/font` `GlyphOutline` objects are structurally compatible:

```ts
const outline = font.getOutline(glyphId, variations)
const bitmap = generateSdf({
  outline,
  viewBox: {
    left: outline.bounds.xMin - padding,
    bottom: outline.bounds.yMin - padding,
    right: outline.bounds.xMax + padding,
    top: outline.bounds.yMax + padding,
  },
  width: 64,
  height: 64,
  distance: padding,
  exponent: 9,
})
```

The SDF package does not import or retain the font handle and never computes an
outline eagerly.

## Encoding

Each texel is sampled at its center. The nearest signed distance is encoded as:

```text
magnitude = max(0, 1 - abs(signedDistance) / distance) ** exponent / 2
value = signedDistance < 0 ? 1 - magnitude : magnitude
byte = round(clamp(value, 0, 1) * 255)
```

Values below 128 are outside, values above 128 are inside, the mathematical
edge rounds to 128, and distances at or beyond the configured range saturate to
0 or 255.

Invalid dimensions, allocation sizes, view boxes, encoding values, typed
arrays, command sequences, coordinate counts, or non-finite coordinates throw
`InvalidSdfInputError` before raster allocation. Input arrays are never mutated
or retained.

## Deliberately excluded

SVG parsing, font acquisition, layout, workers, async scheduling, caching,
atlases, RGBA packing, canvas, WebGL, WebGPU, Three.js, MSDF, and renderer
lifecycle are outside this package. The renderer owns atlas and GPU resources;
optional worker orchestration can wrap this synchronous operation later if
profiling justifies it.

The CPU implementation is adapted from MIT-licensed
`webgl-sdf-generator@1.1.1`. See `THIRD_PARTY_NOTICES.md` and
`LICENSE.webgl-sdf-generator.txt` for exact provenance and terms.
