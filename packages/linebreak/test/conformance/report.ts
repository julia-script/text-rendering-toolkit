/**
 * Runs the conformance corpus against an analysis function and reports the pass
 * rate with per-case and per-rule attribution.
 *
 * The report is the project's line-breaking evidence: an aggregate count alone is
 * not enough to decide whether a failure is a rule this package excludes or a bug
 * it must fix, so every failure carries its code points and the rules the corpus
 * cited for the positions that disagreed.
 */

import type { ConformanceCase } from './corpus.ts'
import { loadConformanceCases } from './corpus.ts'

/** Produces break opportunities as UTF-16 offsets, terminal boundary included. */
export type AnalyzeFn = (text: string) => readonly number[]

export interface CaseFailure {
  readonly case: ConformanceCase
  readonly actual: readonly number[]
  /** Offsets the implementation reported that the corpus does not expect. */
  readonly spurious: readonly number[]
  /** Offsets the corpus expects that the implementation did not report. */
  readonly missing: readonly number[]
}

export interface ConformanceReport {
  readonly total: number
  readonly passed: number
  readonly failed: number
  /** Pass rate as a fraction in [0, 1]. */
  readonly rate: number
  readonly failures: readonly CaseFailure[]
  /** Failure counts keyed by the rules the corpus cited, most frequent first. */
  readonly ruleCounts: ReadonlyArray<readonly [string, number]>
}

export function runConformance(analyze: AnalyzeFn): ConformanceReport {
  const cases = loadConformanceCases()
  const failures: CaseFailure[] = []

  for (const conformanceCase of cases) {
    const actual = [...analyze(conformanceCase.text)].sort((a, b) => a - b)
    const expected = conformanceCase.expected

    const actualSet = new Set(actual)
    const expectedSet = new Set(expected)
    const spurious = actual.filter((offset) => !expectedSet.has(offset))
    const missing = expected.filter((offset) => !actualSet.has(offset))

    if (spurious.length > 0 || missing.length > 0) {
      failures.push({ case: conformanceCase, actual, spurious, missing })
    }
  }

  const ruleCounts = new Map<string, number>()
  for (const failure of failures) {
    for (const rule of new Set(failure.case.rules)) {
      ruleCounts.set(rule, (ruleCounts.get(rule) ?? 0) + 1)
    }
  }

  return {
    total: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    rate: (cases.length - failures.length) / cases.length,
    failures,
    ruleCounts: [...ruleCounts.entries()].sort((a, b) => b[1] - a[1]),
  }
}

/** Renders one failure as a diagnostic line naming its code points and rules. */
export function formatFailure(failure: CaseFailure): string {
  const codePoints = failure.case.codePoints
    .map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ')

  const parts = [`corpus line ${failure.case.line}: ${codePoints}`]
  if (failure.missing.length > 0) parts.push(`missing breaks at [${failure.missing.join(', ')}]`)
  if (failure.spurious.length > 0) parts.push(`spurious breaks at [${failure.spurious.join(', ')}]`)
  parts.push(`rules ${failure.case.rules.join(', ')}`)

  return parts.join(' | ')
}

/** Renders a whole-report summary suitable for a validation record. */
export function formatReport(report: ConformanceReport, sampleSize = 20): string {
  const percent = (report.rate * 100).toFixed(3)
  const lines = [`Conformance: ${report.passed}/${report.total} (${percent}%)`]

  if (report.failed > 0) {
    lines.push('', `Failing rules (case counts):`)
    for (const [rule, count] of report.ruleCounts.slice(0, 15)) {
      lines.push(`  LB${rule}: ${count}`)
    }
    lines.push('', `First ${Math.min(sampleSize, report.failed)} failures:`)
    for (const failure of report.failures.slice(0, sampleSize)) {
      lines.push(`  ${formatFailure(failure)}`)
    }
  }
  return lines.join('\n')
}
