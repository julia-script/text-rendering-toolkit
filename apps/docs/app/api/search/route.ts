import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

/**
 * Search index built from the same loader that renders the pages.
 *
 * Because the index comes from `source`, the generated API reference under
 * `content/docs/api` is searchable alongside the handwritten guides without any
 * extra wiring — both reach the loader through `content/docs`.
 *
 * Uses Fumadocs' built-in Orama index rather than a hosted service, so search
 * needs no API key, no network call, and no third-party account.
 */
export const { GET } = createFromSource(source)
