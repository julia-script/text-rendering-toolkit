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
  }

  export default function bidiFactory(): Bidi
}

declare module 'unicode-script' {
  export function unicodeScriptCode(character: string | number): string | undefined
  export function unicodeScriptExtensionCodes(character: string): Set<string>
}

declare module 'linebreak' {
  export interface LineBreak {
    readonly position: number
    readonly required: boolean
  }

  export default class LineBreaker {
    constructor(text: string)
    nextBreak(): LineBreak | null
  }
}
