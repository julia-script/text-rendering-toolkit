export const COLOR_FORMATS = ['colr-v0', 'colr-v1', 'sbix', 'svg'] as const
export type ColorFormat = (typeof COLOR_FORMATS)[number]

export interface SourceEvidence {
  readonly path: string
  readonly url: string
  readonly sha256: string
}

export interface FixtureEvidence {
  readonly format: ColorFormat
  readonly path: string
  readonly sha256: string
  readonly bytes: number
  readonly tables: Readonly<Record<string, number>>
  readonly sequences: readonly string[]
}

export interface CandidateScore {
  readonly format: ColorFormat
  readonly usefulCoverage: number
  readonly scalability: number
  readonly paletteAndForeground: number
  readonly variation: number
  readonly engineAccess: number
  readonly bundleAndCacheCost: number
  readonly rendererComplexity: number
  readonly browserEsm: number
  readonly lifecycle: number
  readonly provenance: number
  readonly total: number
  readonly decision: 'reject' | 'select' | 'unvalidated'
  readonly limitations: readonly string[]
}

export interface RuntimeInventory {
  readonly wrapperVersion: string
  readonly wrapperRevision: string
  readonly harfbuzzVersion: string
  readonly harfbuzzRevision: string
  readonly wasmSha256: string
  readonly wasmBytes: number
  readonly exports: readonly string[]
  readonly buildFlags: readonly string[]
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Readonly<Record<string, unknown>>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`)
  }
  return value
}

export function validateObservation(value: unknown): Readonly<Record<string, unknown>> {
  const observation = record(value, 'observation')
  string(observation.schemaVersion, 'schemaVersion')
  string(observation.kind, 'kind')
  const environment = record(observation.environment, 'environment')
  string(environment.node, 'environment.node')
  string(environment.platform, 'environment.platform')
  if (!Array.isArray(observation.evidence) || observation.evidence.length === 0) {
    throw new TypeError('evidence must be a non-empty array')
  }
  for (const [index, item] of observation.evidence.entries()) {
    const evidence = record(item, `evidence[${index}]`)
    string(evidence.source, `evidence[${index}].source`)
    string(evidence.integrity, `evidence[${index}].integrity`)
  }
  if ('measurements' in observation) {
    const measurements = record(observation.measurements, 'measurements')
    for (const [key, measurement] of Object.entries(measurements)) {
      finite(measurement, `measurements.${key}`)
    }
  }
  return observation
}
