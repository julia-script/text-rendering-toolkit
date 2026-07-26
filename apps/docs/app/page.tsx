import Link from 'next/link'
import { LandingGlyph } from '@/components/landing-glyph'

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="wordmark" href="/" aria-label="Text Rendering Toolkit home">
          <span className="wordmark-mark" aria-hidden="true">
            W
          </span>
          <span>Text Rendering Toolkit</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/docs/concepts/pipeline">Pipeline</Link>
          <Link href="/docs/examples/layout">Examples</Link>
          <Link className="nav-cta" href="/docs">
            Documentation <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span>Renderer-neutral text system</span>
              <span>01 — 04</span>
            </p>
            <h1>
              Text, from
              <br />
              <span>bytes</span> to pixels.
            </h1>
            <p className="hero-lede">
              Shape multilingual text, lay it out, generate signed-distance fields, and render with
              WebGPU—without tying the pipeline to one frontend.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/docs/getting-started">
                Get started <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary" href="/docs/examples/layout">
                Open the inspector
              </Link>
            </div>
          </div>

          <LandingGlyph />
        </section>

        <section className="pipeline-section" aria-labelledby="pipeline-title">
          <div className="section-heading">
            <p className="eyebrow">Four small packages / one explicit pipeline</p>
            <h2 id="pipeline-title">Use only the boundary you need.</h2>
          </div>
          <div className="package-grid">
            <article>
              <p className="package-number">01</p>
              <h3>Font</h3>
              <p>Parse caller-owned bytes, shape runs, inspect coverage, and request outlines.</p>
              <code>@text-rendering-toolkit/font</code>
            </article>
            <article>
              <p className="package-number">02</p>
              <h3>Layout</h3>
              <p>Turn raw multilingual text into lines, positioned glyphs, carets, and bounds.</p>
              <code>@text-rendering-toolkit/layout</code>
            </article>
            <article>
              <p className="package-number">03</p>
              <h3>SDF</h3>
              <p>Generate renderer-ready signed-distance fields on the CPU, only when needed.</p>
              <code>@text-rendering-toolkit/sdf</code>
            </article>
            <article>
              <p className="package-number">04</p>
              <h3>Three</h3>
              <p>Hand the result to a supplied Three.js WebGPU mesh—or keep your own renderer.</p>
              <code>@text-rendering-toolkit/three-webgpu</code>
            </article>
          </div>
        </section>

        <section className="handoff-section" aria-labelledby="handoff-title">
          <div className="handoff-copy">
            <p className="eyebrow">The handoff stays ordinary</p>
            <h2 id="handoff-title">Layout data in. Any renderer out.</h2>
            <p>
              The core result is plain, inspectable data: glyph positions, line geometry, carets,
              selection ranges, and bounds. Cache it, test it, move it between systems, or render it
              wherever you choose.
            </p>
            <Link href="/docs/concepts/pipeline">
              Understand the pipeline <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div
            className="handoff-diagram"
            aria-label="Pipeline from Unicode text to any renderer"
            role="img"
          >
            <div>
              <span>INPUT</span>
              <strong>Unicode + font bytes</strong>
            </div>
            <div>
              <span>CORE</span>
              <strong>LayoutResult</strong>
            </div>
            <div>
              <span>OUTPUT</span>
              <strong>Any renderer</strong>
            </div>
          </div>
        </section>

        <section className="closing">
          <p className="eyebrow">Start at the layer you own</p>
          <h2>Bring your bytes. Keep your renderer.</h2>
          <Link className="button button-primary" href="/docs/getting-started">
            Read the documentation <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Text Rendering Toolkit</span>
        <span>Font bytes → positioned glyphs → pixels</span>
      </footer>
    </div>
  )
}
