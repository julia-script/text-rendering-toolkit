import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { type FontFacts, loadFont, type ShapedRun, type ShapeInput } from '@webgpu-text/font'
import {
  canonicalFixtureJson,
  layoutResolvedText,
  type ResolvedShapedRun,
} from '@webgpu-text/layout'
import { afterAll, describe, expect, test } from 'vitest'

interface IntegrationRun {
  readonly start: number
  readonly end: number
  readonly fontKey: string
  readonly fontFile: string
  readonly input: ShapeInput
  readonly resolved: ResolvedShapedRun
}

interface IntegrationPlan {
  readonly id: string
  readonly text: string
  readonly runs: readonly IntegrationRun[]
}

interface IntegrationDocument {
  readonly schemaVersion: 1
  readonly source: string
  readonly fontManifest: { readonly file: string; readonly sha256: string }
  readonly plans: readonly IntegrationPlan[]
}

const root = new URL('../../../', import.meta.url)
const integrationUrl = new URL('test-fixtures/layout/font-integration.json', root)
const policyUrl = new URL('test-fixtures/layout/policy-fixtures.json', root)
const fontRoot = new URL('test-fixtures/fonts/harfbuzz-validation/', root)
const handles = new Map<string, Awaited<ReturnType<typeof loadFont>>>()

async function integrationDocument(): Promise<IntegrationDocument> {
  return JSON.parse(await readFile(integrationUrl, 'utf8')) as IntegrationDocument
}

async function font(file: string): Promise<Awaited<ReturnType<typeof loadFont>>> {
  let handle = handles.get(file)
  if (!handle) {
    handle = await loadFont(new Uint8Array(await readFile(new URL(file, fontRoot))))
    handles.set(file, handle)
  }
  return handle
}

function translate(run: IntegrationRun, facts: FontFacts, shaped: ShapedRun): ResolvedShapedRun {
  return {
    start: run.start,
    end: run.end,
    direction: shaped.direction,
    bidiLevel: shaped.direction === 'rtl' ? 1 : 0,
    script: shaped.script,
    language: shaped.language,
    styleKey: 'default',
    fontKey: run.fontKey,
    fontSize: facts.unitsPerEm,
    fontUnitScale: 1,
    metrics: {
      ascender: facts.ascender,
      descender: facts.descender,
      lineGap: facts.lineGap,
    },
    variations: shaped.variations,
    glyphs: shaped.glyphs.map((glyph) => ({
      glyphId: glyph.glyphId,
      start: run.start + glyph.clusterStart,
      end: run.start + glyph.clusterEnd,
      xAdvance: glyph.xAdvance,
      yAdvance: glyph.yAdvance,
      xOffset: glyph.xOffset,
      yOffset: glyph.yOffset,
      flags: glyph.flags,
      bounds: null,
    })),
  }
}

afterAll(() => {
  for (const handle of handles.values()) handle.dispose()
})

describe('public font integration evidence', () => {
  test('pins the font manifest used by the run plans', async () => {
    const document = await integrationDocument()
    const manifest = await readFile(new URL('fixtures.json', fontRoot))
    expect(document.schemaVersion).toBe(1)
    expect(document.source).toBe('@webgpu-text/font public entry point')
    expect(createHash('sha256').update(manifest).digest('hex')).toBe(document.fontManifest.sha256)
  })

  test('translates every explicit run through public FontHandle.shape', async () => {
    const document = await integrationDocument()
    expect(document.plans.map((plan) => plan.id)).toEqual([
      'latin-ligature',
      'combining-mark',
      'arabic-rtl',
      'devanagari',
      'khmer',
      'supplementary-plane',
      'fallback-font',
      'variable-axis',
      'mixed-direction',
    ])

    for (const plan of document.plans) {
      for (const run of plan.runs) {
        expect(run.input.text).toBe(plan.text.slice(run.start, run.end))
        const handle = await font(run.fontFile)
        const shaped = handle.shape(run.input)
        expect(translate(run, handle.facts, shaped), `${plan.id}:${run.start}`).toEqual(
          run.resolved,
        )
        for (const glyph of shaped.glyphs) {
          expect(Number.isFinite(glyph.xAdvance)).toBe(true)
          expect(Number.isFinite(glyph.xOffset)).toBe(true)
          expect(glyph.clusterStart).toBeGreaterThanOrEqual(0)
          expect(glyph.clusterEnd).toBeLessThanOrEqual(run.input.text.length)
        }
      }
    }
  })

  test('lays out every public-font run plan without font internals', async () => {
    const document = await integrationDocument()
    for (const plan of document.plans) {
      const runs: ResolvedShapedRun[] = []
      for (const run of plan.runs) {
        const handle = await font(run.fontFile)
        runs.push(translate(run, handle.facts, handle.shape(run.input)))
      }
      const defaultMetrics = runs[0]?.metrics
      if (!defaultMetrics) throw new Error(`Plan has no runs: ${plan.id}`)
      const result = layoutResolvedText({
        text: plan.text,
        paragraphLevel: runs[0]?.direction === 'rtl' ? 1 : 0,
        defaultMetrics,
        maxWidth: null,
        whiteSpace: 'normal',
        overflowWrap: 'normal',
        textAlign: 'left',
        textIndent: 0,
        letterSpacing: 0,
        lineHeight: 'normal',
        anchorX: 0,
        anchorY: 0,
        runs,
      })
      expect(result.sourceLengthUtf16, plan.id).toBe(plan.text.length)
      expect(result.glyphs.length, plan.id).toBeGreaterThan(0)
      expect(result.visibleBounds, plan.id).toBeNull()
      expect(result.fontKeys, plan.id).toEqual([...new Set(runs.map((run) => run.fontKey))])
      expect(
        result.glyphs.every((glyph) => glyph.fontUnitScale === 1),
        plan.id,
      ).toBe(true)
    }
  })

  test('does not couple synthetic policy evidence to real-font observations', async () => {
    const before = canonicalFixtureJson(JSON.parse(await readFile(policyUrl, 'utf8')))
    const document = await integrationDocument()
    const changedObservation = structuredClone(document) as IntegrationDocument
    const firstRun = changedObservation.plans[0]?.runs[0]
    if (!firstRun) throw new Error('Missing integration observation')
    ;(firstRun.resolved as { glyphs: Array<{ glyphId: number }> }).glyphs[0].glyphId += 1
    expect(canonicalFixtureJson(JSON.parse(await readFile(policyUrl, 'utf8')))).toBe(before)
  })
})
