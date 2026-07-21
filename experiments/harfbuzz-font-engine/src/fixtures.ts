export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

export interface FixtureEntry {
  readonly id: string;
  readonly file: string;
  readonly format: FontFormat;
  readonly sha256: string;
  readonly source: string;
  readonly sourcePath?: string;
  readonly derivedFrom?: string;
  readonly covers: readonly string[];
}

export interface FixtureManifest {
  readonly schemaVersion: number;
  readonly fonts: readonly FixtureEntry[];
}
