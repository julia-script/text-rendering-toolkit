export interface FixtureIdentity {
  readonly file: string;
  readonly sha256: string;
  readonly format: "ttf" | "otf" | "woff" | "woff2";
}

export interface EnvironmentIdentity {
  readonly runtime: string;
  readonly platform: string;
  readonly architecture: string;
  readonly harfbuzzjs: string;
  readonly harfbuzzRevision: string;
}

export interface Observation<T> {
  readonly recordedAt: string;
  readonly environment: EnvironmentIdentity;
  readonly fixtures: readonly FixtureIdentity[];
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: T;
  readonly measurements: Readonly<Record<string, number | string | null>>;
}
