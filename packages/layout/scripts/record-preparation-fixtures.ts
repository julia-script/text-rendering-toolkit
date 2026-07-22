import { readFile, writeFile } from 'node:fs/promises'
import { prepareText } from '../dist/index.js'

interface FixtureDocument {
  lineBreakRevision: string
  readonly fixtures: Array<{
    readonly input: Parameters<typeof prepareText>[0]
    expected: Record<string, unknown> & {
      readonly error?: { readonly code?: string }
      readonly preparedSegments?: unknown
    }
  }>
}

const fixtureUrl = new URL('../../../test-fixtures/preparation/fixtures.json', import.meta.url)
const document = JSON.parse(await readFile(fixtureUrl, 'utf8')) as FixtureDocument
document.lineBreakRevision = 'linebreak@1.1.0 / Unicode 13.0.0'

for (const fixture of document.fixtures) {
  if (fixture.expected.error?.code === 'invalid-input') continue
  const preparedBreakOpportunities = prepareText(fixture.input).breakOpportunities
  const { preparedSegments, ...rest } = fixture.expected
  fixture.expected = preparedSegments
    ? { preparedSegments, preparedBreakOpportunities, ...rest }
    : { preparedBreakOpportunities, ...rest }
}

await writeFile(fixtureUrl, `${JSON.stringify(document, null, 2)}\n`)
