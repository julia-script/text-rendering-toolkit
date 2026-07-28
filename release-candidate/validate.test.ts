import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { arch, platform, tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'

type CheckStatus = 'passed' | 'failed'
type PackageId = 'font' | 'layout' | 'linebreak' | 'sdf' | 'three'

interface TechnicalCheck {
  readonly name: string
  readonly status: CheckStatus
  readonly message?: string
}

interface PublicationGate {
  readonly id: string
  readonly status: 'blocked'
  readonly reason: string
}

interface PackageManifest {
  readonly name: string
  readonly version: string
  readonly private?: boolean
  readonly description?: unknown
  readonly exports?: Readonly<Record<string, unknown>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly repository?: unknown
  readonly homepage?: unknown
  readonly license?: unknown
  readonly bugs?: unknown
  readonly keywords?: unknown
  readonly publishConfig?: unknown
}

interface PackageEvidence {
  readonly id: PackageId
  readonly name: string
  readonly version: string
  readonly archive: string
  readonly sha256: string
  readonly compressedBytes: number
  readonly unpackedBytes: number
  readonly files: readonly string[]
}

interface PackedPackage {
  readonly archive: string
  readonly evidence: PackageEvidence
  readonly manifest: PackageManifest
}

interface CandidateReport {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly source: {
    readonly commit: string
    readonly dirty: boolean
  }
  readonly environment: {
    readonly node: string
    readonly pnpm: string
    readonly platform: string
    readonly arch: string
  }
  technicalStatus: CheckStatus
  readonly publicationStatus: 'blocked'
  packageVersion: string | null
  packages: readonly PackageEvidence[]
  readonly technicalChecks: TechnicalCheck[]
  readonly publicationGates: readonly PublicationGate[]
}

interface PackOutput {
  readonly name: string
  readonly version: string
  readonly filename: string
  readonly files: readonly { readonly path: string }[]
}

const validationRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(validationRoot, '..')
const candidateRoot = resolve(workspaceRoot, '.release-candidate')
const archiveRoot = resolve(candidateRoot, 'packages')
const packageIds: readonly PackageId[] = ['font', 'layout', 'linebreak', 'sdf', 'three']
const packageNames: Readonly<Record<PackageId, string>> = {
  font: '@text-rendering-toolkit/font',
  layout: '@text-rendering-toolkit/layout',
  linebreak: '@text-rendering-toolkit/linebreak',
  sdf: '@text-rendering-toolkit/sdf',
  three: '@text-rendering-toolkit/three-webgpu',
}
const fontFixtures = resolve(workspaceRoot, 'test-fixtures/fonts/harfbuzz-validation')
const colorFontFixtures = resolve(workspaceRoot, 'test-fixtures/fonts/color-glyph-validation')
const expectedFiles: Readonly<Record<PackageId, readonly string[]>> = {
  font: [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/internal/vendor/harfbuzz.wasm',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
  ],
  layout: ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'],
  linebreak: ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'],
  sdf: [
    'dist/index.js',
    'dist/index.d.ts',
    'README.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'LICENSE.webgl-sdf-generator.txt',
  ],
  three: ['dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE'],
}

function command(executable: string, args: readonly string[], cwd = workspaceRoot): string {
  return execFileSync(executable, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const output = ['stdout', 'stderr']
      .filter((key) => key in error)
      .map((key) => String((error as Record<string, unknown>)[key]).trim())
      .filter(Boolean)
      .join('\n')
    if (output) return output
  }
  return error instanceof Error ? error.message : String(error)
}

function check<T>(checks: TechnicalCheck[], name: string, action: () => T): T {
  try {
    const result = action()
    checks.push({ name, status: 'passed' })
    return result
  } catch (error) {
    checks.push({ name, status: 'failed', message: errorMessage(error) })
    throw error
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function directoryBytes(path: string): number {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) return total + directoryBytes(child)
    return total + (entry.isFile() ? lstatSync(child).size : 0)
  }, 0)
}

function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

function packPackage(id: PackageId, unpackRoot: string): PackedPackage {
  const packageRoot = resolve(workspaceRoot, 'packages', id)
  const output = JSON.parse(
    command('pnpm', ['pack', '--pack-destination', archiveRoot, '--json'], packageRoot),
  ) as PackOutput
  const archive = resolve(output.filename)
  assert(existsSync(archive), `Packing ${id} did not create ${archive}`)

  const unpacked = resolve(unpackRoot, id)
  mkdirSync(unpacked)
  command('tar', ['-xzf', archive, '-C', unpacked])
  const packageDirectory = resolve(unpacked, 'package')
  const manifest = JSON.parse(
    readFileSync(resolve(packageDirectory, 'package.json'), 'utf8'),
  ) as PackageManifest
  const files = output.files.map(({ path }) => path).sort()
  const archiveBytes = readFileSync(archive)

  return {
    archive,
    manifest,
    evidence: {
      id,
      name: output.name,
      version: output.version,
      archive: relative(candidateRoot, archive),
      sha256: createHash('sha256').update(archiveBytes).digest('hex'),
      compressedBytes: archiveBytes.byteLength,
      unpackedBytes: directoryBytes(packageDirectory),
      files,
    },
  }
}

function rootExport(manifest: PackageManifest): {
  readonly import: string
  readonly types: string
} {
  const value = manifest.exports?.['.']
  assert(value && typeof value === 'object', `${manifest.name} has no root export`)
  assert(
    'import' in value && typeof value.import === 'string',
    `${manifest.name} has no ESM export`,
  )
  assert('types' in value && typeof value.types === 'string', `${manifest.name} has no type export`)
  return { import: value.import, types: value.types }
}

function auditPackages(packages: readonly PackedPackage[]): void {
  const versions = new Set(packages.map(({ manifest }) => manifest.version))
  assert(versions.size === 1, 'Package versions are not aligned')

  for (const packed of packages) {
    const { evidence, manifest } = packed
    assert(evidence.name === packageNames[evidence.id], `${evidence.id} has an unexpected name`)
    assert(
      manifest.name === evidence.name,
      `${evidence.name} pack metadata does not match its manifest`,
    )
    assert(
      manifest.version === evidence.version,
      `${evidence.name} pack metadata does not match its version`,
    )
    assert(manifest.private !== true, `${evidence.name} is still private`)
    assert(
      typeof manifest.description === 'string' && manifest.description.length > 0,
      `${evidence.name} has no description`,
    )
    assert(manifest.license === 'MIT', `${evidence.name} does not declare MIT`)
    assert(
      manifest.homepage === 'https://github.com/julia-script/text-rendering-toolkit#readme',
      `${evidence.name} has an unexpected homepage`,
    )
    assert(
      manifest.repository !== null &&
        typeof manifest.repository === 'object' &&
        'type' in manifest.repository &&
        manifest.repository.type === 'git' &&
        'url' in manifest.repository &&
        manifest.repository.url ===
          'git+https://github.com/julia-script/text-rendering-toolkit.git' &&
        'directory' in manifest.repository &&
        manifest.repository.directory === `packages/${evidence.id}`,
      `${evidence.name} has unexpected repository metadata`,
    )
    assert(
      manifest.bugs !== null &&
        typeof manifest.bugs === 'object' &&
        'url' in manifest.bugs &&
        manifest.bugs.url === 'https://github.com/julia-script/text-rendering-toolkit/issues',
      `${evidence.name} has an unexpected issue tracker`,
    )
    assert(
      Array.isArray(manifest.keywords) && manifest.keywords.length > 0,
      `${evidence.name} has no search keywords`,
    )
    assert(
      manifest.publishConfig !== null &&
        typeof manifest.publishConfig === 'object' &&
        'access' in manifest.publishConfig &&
        manifest.publishConfig.access === 'public' &&
        'provenance' in manifest.publishConfig &&
        manifest.publishConfig.provenance === true,
      `${evidence.name} does not request public npm access and provenance`,
    )

    const exported = rootExport(manifest)
    for (const target of [exported.import, exported.types]) {
      assert(target.startsWith('./'), `${evidence.name} export ${target} is not package-relative`)
      assert(evidence.files.includes(target.slice(2)), `${evidence.name} does not ship ${target}`)
    }
    for (const file of expectedFiles[evidence.id]) {
      assert(evidence.files.includes(file), `${evidence.name} does not ship ${file}`)
    }
    assert(
      !evidence.files.some((file) => /^(?:src|test|tests)\//u.test(file)),
      `${evidence.name} ships workspace source or tests`,
    )

    for (const table of [
      manifest.dependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ]) {
      for (const value of Object.values(table ?? {})) {
        assert(!value.startsWith('workspace:'), `${evidence.name} contains a workspace protocol`)
      }
    }
  }
}

function installConsumer(packages: readonly PackedPackage[], consumer: string): void {
  const realConsumer = realpathSync(consumer)
  const realWorkspace = realpathSync(workspaceRoot)
  const dependencies = Object.fromEntries(
    packages.map(({ archive, manifest }) => [manifest.name, `file:${archive}`]),
  )
  writeFileSync(
    resolve(consumer, 'package.json'),
    `${JSON.stringify(
      {
        name: 'text-rendering-toolkit-release-candidate-consumer',
        private: true,
        type: 'module',
        dependencies: { ...dependencies, three: '0.185.1' },
        devDependencies: { '@types/node': '26.1.1', '@types/three': '0.185.1' },
      },
      null,
      2,
    )}\n`,
  )
  cpSync(resolve(validationRoot, 'consumer.ts'), resolve(consumer, 'main.ts'))
  for (const font of ['NotoSans-wdth-wght.ttf', 'NotoSansArabic-wdth-wght.ttf']) {
    cpSync(resolve(fontFixtures, font), resolve(consumer, font))
  }
  cpSync(
    resolve(colorFontFixtures, 'noto-validation-colr-v0.ttf'),
    resolve(consumer, 'noto-validation-colr-v0.ttf'),
  )
  writeFileSync(
    resolve(consumer, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ['ES2023', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ['node'],
        },
        include: ['main.ts'],
      },
      null,
      2,
    )}\n`,
  )

  command('npm', ['install', '--ignore-scripts'], consumer)
  for (const { manifest } of packages) {
    const installed = realpathSync(resolve(consumer, 'node_modules', manifest.name))
    assert(
      isInside(realConsumer, installed),
      `${manifest.name} resolved outside the isolated consumer`,
    )
    assert(!isInside(realWorkspace, installed), `${manifest.name} resolved from the workspace`)
  }
  const wasm = realpathSync(
    resolve(
      consumer,
      'node_modules/@text-rendering-toolkit/font/dist/internal/vendor/harfbuzz.wasm',
    ),
  )
  assert(isInside(realConsumer, wasm), 'HarfBuzz WASM resolved outside the isolated consumer')
}

function publicationGates(): readonly PublicationGate[] {
  return [
    {
      id: 'first-publication-bootstrap',
      status: 'blocked',
      reason:
        'The package names do not exist on npm yet, so an authenticated owner must bootstrap the coordinated 0.1.0 package family before trusted publishing can take over.',
    },
    {
      id: 'trusted-publisher-activation',
      status: 'blocked',
      reason:
        'npm trusted publishers and first-publication access must be configured and verified for all four canonical packages.',
    },
  ]
}

test('validates the complete local release candidate', () => {
  rmSync(candidateRoot, { recursive: true, force: true })
  mkdirSync(archiveRoot, { recursive: true })
  const unpackRoot = mkdtempSync(resolve(tmpdir(), 'text-rendering-toolkit-release-audit-'))
  const consumer = mkdtempSync(resolve(tmpdir(), 'text-rendering-toolkit-release-consumer-'))
  const manifestPaths = packageIds.map((id) =>
    resolve(workspaceRoot, 'packages', id, 'package.json'),
  )
  const manifestsBefore = manifestPaths.map((path) => readFileSync(path, 'utf8'))
  const technicalChecks: TechnicalCheck[] = []
  const report: CandidateReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      commit: command('git', ['rev-parse', 'HEAD']),
      dirty: command('git', ['status', '--porcelain']).length > 0,
    },
    environment: {
      node: process.version,
      pnpm: command('pnpm', ['--version']),
      platform: platform(),
      arch: arch(),
    },
    technicalStatus: 'failed',
    publicationStatus: 'blocked',
    packageVersion: null,
    packages: [],
    technicalChecks,
    publicationGates: publicationGates(),
  }
  let failure: unknown

  try {
    check(technicalChecks, 'workspace-build-output', () => {
      for (const id of packageIds) {
        assert(
          existsSync(resolve(workspaceRoot, 'packages', id, 'dist/index.js')),
          `${id} is not built`,
        )
      }
    })
    const packages = check(technicalChecks, 'package-assembly', () =>
      packageIds.map((id) => packPackage(id, unpackRoot)),
    )
    report.packages = packages.map(({ evidence }) => evidence)
    report.packageVersion = packages[0]?.manifest.version ?? null
    check(technicalChecks, 'packed-package-audit', () => auditPackages(packages))
    check(technicalChecks, 'isolated-consumer-install', () => installConsumer(packages, consumer))
    check(technicalChecks, 'consumer-typecheck', () => {
      command(resolve(workspaceRoot, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], consumer)
    })
    check(technicalChecks, 'consumer-runtime', () => {
      command(process.execPath, ['--experimental-strip-types', 'main.ts'], consumer)
    })
  } catch (error) {
    failure = error
  } finally {
    try {
      check(technicalChecks, 'source-manifests-unchanged', () => {
        manifestPaths.forEach((path, index) => {
          assert(
            readFileSync(path, 'utf8') === manifestsBefore[index],
            `${path} changed during validation`,
          )
        })
      })
    } catch (error) {
      failure ??= error
    }
    report.technicalStatus = failure === undefined ? 'passed' : 'failed'
    writeFileSync(resolve(candidateRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    rmSync(unpackRoot, { recursive: true, force: true })
    rmSync(consumer, { recursive: true, force: true })
  }

  if (failure !== undefined) throw failure
}, 180_000)
