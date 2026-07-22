'use client'

import { useEffect, useState } from 'react'
import { type DemoFonts, errorMessage, loadDemoFonts } from './demo-fonts'

type DemoFontState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: DemoFonts }
  | { readonly status: 'error'; readonly message: string }

export function useDemoFonts(): DemoFontState {
  const [state, setState] = useState<DemoFontState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let owned: DemoFonts | undefined
    void loadDemoFonts(controller.signal)
      .then((fonts) => {
        owned = fonts
        if (!controller.signal.aborted) setState({ status: 'ready', value: fonts })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) })
      })
    return () => {
      controller.abort()
      owned?.dispose()
    }
  }, [])

  return state
}
