import * as hb from "harfbuzzjs";

export type TextDirection = "ltr" | "rtl" | "ttb" | "btt";

export interface ShapeInput {
  readonly text: string;
  readonly direction: TextDirection;
  readonly script: string;
  readonly language: string;
  readonly features?: readonly string[];
  readonly variations?: Readonly<Record<string, number>>;
}

export interface ShapedGlyph {
  readonly glyphId: number;
  readonly clusterStart: number;
  readonly clusterEnd: number;
  readonly sourceText: string;
  readonly xAdvance: number;
  readonly yAdvance: number;
  readonly xOffset: number;
  readonly yOffset: number;
  readonly flags: number;
}

export interface ShapeResult {
  readonly glyphs: readonly ShapedGlyph[];
  readonly textLengthUtf16: number;
}

export interface FontFacts {
  readonly upem: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly coverageCount: number;
  readonly axes: Readonly<Record<string, hb.AxisInfo>>;
}

export interface NumericOutlineCommand {
  readonly type: string;
  readonly values: readonly number[];
}

export class DirectOutlineUnavailableError extends Error {
  constructor() {
    super(
      "harfbuzzjs@1.4.0 does not expose direct glyph drawing callbacks; " +
        "glyphToJson() internally creates and reparses an SVG path",
    );
    this.name = "DirectOutlineUnavailableError";
  }
}

const directionValues: Record<TextDirection, hb.Direction> = {
  ltr: hb.Direction.LTR,
  rtl: hb.Direction.RTL,
  ttb: hb.Direction.TTB,
  btt: hb.Direction.BTT,
};

function featureFromString(value: string): hb.Feature {
  const feature = hb.Feature.fromString(value);
  if (!feature) throw new TypeError(`Invalid HarfBuzz feature: ${value}`);
  return feature;
}

function clusterEnds(textLength: number, clusters: readonly number[]): Map<number, number> {
  const starts = [...new Set(clusters)].sort((a, b) => a - b);
  const ends = new Map<number, number>();
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (start === undefined || start < 0 || start > textLength) {
      throw new RangeError(`Invalid UTF-16 cluster offset: ${String(start)}`);
    }
    ends.set(start, starts[index + 1] ?? textLength);
  }
  return ends;
}

export class FontHandle {
  readonly facts: FontFacts;
  readonly harfBuzzVersion = hb.versionString();

  private readonly blob: hb.Blob;
  private readonly face: hb.Face;
  private readonly font: hb.Font;
  private readonly buffer: hb.Buffer;
  private readonly diagnosticOutlineCache = new Map<number, readonly NumericOutlineCommand[]>();

  private constructor(bytes: ArrayBuffer) {
    this.blob = new hb.Blob(bytes);
    this.face = new hb.Face(this.blob, 0);
    this.font = new hb.Font(this.face);
    this.buffer = new hb.Buffer();

    const upem = this.face.upem;
    const coverageCount = this.face.collectUnicodes().length;
    if (upem <= 0 || coverageCount === 0) {
      throw new Error("HarfBuzz could not read a usable SFNT face from these bytes");
    }
    this.font.setScale(upem, upem);
    const extents = this.font.hExtents();
    this.facts = {
      upem,
      ascender: extents.ascender,
      descender: extents.descender,
      lineGap: extents.lineGap,
      coverageCount,
      axes: this.face.getAxisInfos(),
    };
  }

  static async fromBytes(bytes: ArrayBuffer): Promise<FontHandle> {
    // Retaining and initializing the WASM module is asynchronous at module load;
    // keeping construction Promise-based makes that boundary explicit to callers.
    return new FontHandle(bytes);
  }

  supports(codePoint: number): boolean {
    return this.font.nominalGlyph(codePoint) !== undefined;
  }

  shape(input: ShapeInput): ShapeResult {
    this.font.setVariations(
      Object.entries(input.variations ?? {}).map(([tag, value]) => new hb.Variation(tag, value)),
    );
    this.buffer.clearContents();
    this.buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_CHARACTERS);
    this.buffer.addText(input.text);
    this.buffer.setDirection(directionValues[input.direction]);
    this.buffer.setScript(input.script);
    this.buffer.setLanguage(input.language);
    hb.shape(this.font, this.buffer, (input.features ?? []).map(featureFromString));

    const raw = this.buffer.getGlyphInfosAndPositions();
    const ends = clusterEnds(
      input.text.length,
      raw.map((glyph) => glyph.cluster),
    );
    return {
      textLengthUtf16: input.text.length,
      glyphs: raw.map((glyph) => {
        const clusterEnd = ends.get(glyph.cluster);
        if (clusterEnd === undefined) throw new Error("Missing cluster boundary");
        return {
          glyphId: glyph.codepoint,
          clusterStart: glyph.cluster,
          clusterEnd,
          sourceText: input.text.slice(glyph.cluster, clusterEnd),
          xAdvance: glyph.xAdvance ?? 0,
          yAdvance: glyph.yAdvance ?? 0,
          xOffset: glyph.xOffset ?? 0,
          yOffset: glyph.yOffset ?? 0,
          flags: glyph.flags,
        };
      }),
    };
  }

  getOutline(_glyphId: number): never {
    throw new DirectOutlineUnavailableError();
  }

  /** Evidence only: this path violates the direct-numeric-outline requirement. */
  getDiagnosticOutlineViaSvgRoundTrip(glyphId: number): readonly NumericOutlineCommand[] {
    let outline = this.diagnosticOutlineCache.get(glyphId);
    if (!outline) {
      outline = this.font.glyphToJson(glyphId).map(({type, values}) => ({type, values}));
      this.diagnosticOutlineCache.set(glyphId, outline);
    }
    return outline;
  }
}
