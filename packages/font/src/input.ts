import { InvalidFontError, UnsupportedFontFormatError } from './errors.js'
import type { FontSource } from './types.js'

/** Glyph outline flavor of an accepted SFNT font. */
export type SupportedFontFormat = 'truetype' | 'cff'

/** The four-byte SFNT version tag at the head of the file. */
function signature(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes.subarray(0, 4))
}

/**
 * Copies the caller's bytes and identifies the SFNT flavor, rejecting anything
 * this package cannot load.
 *
 * The copy is the point as much as the classification: the handle keeps these
 * bytes for its whole lifetime to read COLR and CPAL lazily, so it must own
 * memory the caller cannot mutate afterwards. A `Uint8Array` view over part of a
 * larger buffer is copied exactly, never widened to the whole buffer.
 *
 * Rejections are split by cause — WOFF and WOFF2 get
 * {@link UnsupportedFontFormatError} because decoding them elsewhere makes them
 * loadable, while collections and malformed files get {@link InvalidFontError}.
 *
 * @returns The owned copy and its outline flavor.
 */
export function copyAndClassifyFont(source: FontSource): {
  readonly bytes: ArrayBuffer
  readonly format: SupportedFontFormat
} {
  // A detached buffer fails here rather than at any check we could run first:
  // detachment is observable only by attempting the read, and probing for it
  // separately would still race the copy.
  let copy: Uint8Array<ArrayBuffer>
  try {
    const view = source instanceof Uint8Array ? source : new Uint8Array(source)
    copy = new Uint8Array(view.byteLength)
    copy.set(view)
  } catch (error) {
    throw new InvalidFontError('Font bytes could not be read; the buffer may be detached', {
      cause: error,
    })
  }

  if (copy.byteLength < 12) throw new InvalidFontError()
  const marker = signature(copy)
  if (marker === 'wOFF') throw new UnsupportedFontFormatError('woff')
  if (marker === 'wOF2') throw new UnsupportedFontFormatError('woff2')
  if (marker === 'ttcf') throw new InvalidFontError('Font collections are not supported')

  const isTrueType =
    (copy[0] === 0 && copy[1] === 1 && copy[2] === 0 && copy[3] === 0) ||
    marker === 'true' ||
    marker === 'typ1'
  const format = marker === 'OTTO' ? 'cff' : isTrueType ? 'truetype' : undefined
  if (!format) throw new InvalidFontError()

  const tableCount = new DataView(copy.buffer).getUint16(4, false)
  if (tableCount === 0 || 12 + tableCount * 16 > copy.byteLength) throw new InvalidFontError()
  return { bytes: copy.buffer, format }
}
