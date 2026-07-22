import type { ReactNode } from 'react'

interface ExampleFrameProps {
  readonly title: string
  readonly status?: string | undefined
  readonly error?: string | undefined
  readonly children?: ReactNode | undefined
}

export function ExampleFrame({ title, status, error, children }: ExampleFrameProps) {
  return (
    <section className="not-prose my-6 overflow-hidden rounded-xl border bg-fd-card text-fd-card-foreground shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <h3 className="font-medium">{title}</h3>
        {status ? <span className="text-xs text-fd-muted-foreground">{status}</span> : null}
      </header>
      <div className="p-4">
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
