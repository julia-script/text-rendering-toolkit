import { readdir, readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

interface ClassificationEntry {
  readonly caseId: string
  readonly classification: 'preserve' | 'intentional-change' | 'defer'
  readonly sourceArea: string
  readonly rationale: string
}

const root = new URL('../../../', import.meta.url)
const layoutFixtures = new URL('test-fixtures/layout/', root)

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(new URL(file, layoutFixtures), 'utf8')) as T
}

test('classifies every committed fixture exactly once', async () => {
  const policy = await json<{
    fixtures: Array<{ id: string; classification: ClassificationEntry['classification'] }>
  }>('policy-fixtures.json')
  const classification = await json<{ entries: ClassificationEntry[] }>('classification.json')
  const expectedIds = [
    ...policy.fixtures.map((fixture) => fixture.id),
    'font-integration-runs',
  ].sort()
  expect(classification.entries.map((entry) => entry.caseId).sort()).toEqual(expectedIds)
  expect(new Set(classification.entries.map((entry) => entry.caseId)).size).toBe(expectedIds.length)

  for (const entry of classification.entries) {
    expect(['preserve', 'intentional-change', 'defer']).toContain(entry.classification)
    expect(entry.sourceArea.length).toBeGreaterThan(0)
    expect(entry.rationale.length).toBeGreaterThan(0)
    const policyFixture = policy.fixtures.find((fixture) => fixture.id === entry.caseId)
    if (policyFixture) expect(policyFixture.classification).toBe(entry.classification)
  }
})

test('pins normalized Troika observations without higher-layer payloads', async () => {
  const document = await json<{
    reference: { repositoryRevision: string; sourceHashes: Record<string, string> }
    observations: Array<{ caseId: string; source: string; observation: string }>
  }>('troika-observations.json')
  expect(document.reference.repositoryRevision).toBe('bca98dddeb3602b04d5452602e7da32df2fafe06')
  expect(document.reference.sourceHashes).toEqual({
    'Typesetter.js': '358e1f9eb372cda6aba6744972d466e8c6864fa6b2e66e72da7391cd44deff32',
    'FontResolver.js': '751d0f1045733fd306d89da0ce8fcc9539175df8b1ce0720592f09468d9fb3c1',
    'selectionUtils.js': '0cc2106dcfd7e0145771ee90d04d304a8fe2a0579610edceb578a7b42427bba2',
    'TextBuilder.js': '41d013f5e136fb695c701283d2b4aa91ae3d91dfa9aa56209b679338d47ddb13',
  })
  expect(new Set(document.observations.map((item) => item.caseId)).size).toBe(
    document.observations.length,
  )
  for (const observation of document.observations) {
    expect(observation.source.length).toBeGreaterThan(0)
    expect(observation.observation.length).toBeGreaterThan(0)
  }
  expect(JSON.stringify(document)).not.toMatch(
    /"(?:atlas|canvas|chunkedBounds|glyphData|glyphPath|sdfTexture|timings|workerState)"/i,
  )
})

test('keeps normal layout source independent of reference and higher layers', async () => {
  const sourceRoot = new URL('../src/', import.meta.url)
  const files = (await readdir(sourceRoot)).filter((file) => file.endsWith('.ts'))
  const source = (
    await Promise.all(files.map((file) => readFile(new URL(file, sourceRoot), 'utf8')))
  ).join('\n')
  expect(source).not.toMatch(/(?:from|import\().*(?:old\/|experiments\/)/)
  expect(source).not.toMatch(/@webgpu-text\/(?:sdf|three)/)
  expect(source).not.toMatch(/@webgpu-text\/font\/(?:src|internal)/)
  expect(source).not.toMatch(/import\s+(?!type\b)[^'"]*['"]@webgpu-text\/font['"]/)
  expect(source).not.toMatch(
    /(?:three\/webgpu|\bwindow\.|HTMLCanvasElement|\bdocument\.(?:createElement|body|fonts|querySelector)|\bfetch\s*\()/,
  )
  expect(source).not.toMatch(
    /(?:from\s+|import\s*\()['"](?:[^'"]*\/)?(?:atlas|gpu|worker)(?:[-/][^'"]*)?['"]/i,
  )
})
