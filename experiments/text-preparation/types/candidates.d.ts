declare module 'bidi-js' {
  export interface BidiParagraph {
    readonly start: number
    readonly end: number
    readonly level: 0 | 1
  }

  export interface EmbeddingLevels {
    readonly levels: Uint8Array
    readonly paragraphs: readonly BidiParagraph[]
  }

  export interface Bidi {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): EmbeddingLevels
    getBidiCharTypeName(character: string): string
  }

  export default function bidiFactory(): Bidi
}

declare module 'unicode-script' {
  export function unicodeScriptCode(character: string | number): string | undefined
  export function unicodeScriptExtensionCodes(character: string): Set<string>
}
