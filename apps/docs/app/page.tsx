import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-20">
      <p className="font-mono text-sm text-fd-muted-foreground">@webgpu-text</p>
      <h1 className="text-5xl font-semibold tracking-tight">Text from bytes to WebGPU.</h1>
      <p className="max-w-2xl text-lg text-fd-muted-foreground">
        Shape multilingual text, lay it out without a renderer, generate CPU SDFs, and hand the
        result to Three.js only when you need a GPU.
      </p>
      <Link
        className="w-fit rounded-full bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        href="/docs"
      >
        Read the documentation
      </Link>
    </main>
  )
}
