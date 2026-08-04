import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

import { loadPreferences, savePreferences } from '#/features/recipes/local-store'
import type { LocalPreferences } from '#/features/recipes/types'

interface PrivacyContextValue extends LocalPreferences {
  error: string | null
  isReady: boolean
  setAirgap: (airgap: boolean) => void
  setMode: (mode: LocalPreferences['mode']) => void
}

const DEFAULT_PREFERENCES: LocalPreferences = { airgap: false, mode: 'local' }
const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPreferences()
      .then((stored) => {
        if (stored) setPreferences(stored)
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Local preferences could not load.')
      })
      .finally(() => setIsReady(true))
  }, [])

  function update(next: LocalPreferences) {
    setPreferences(next)
    setError(null)
    if (next.mode === 'local') {
      savePreferences(next).catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Local preferences could not save.')
      })
    }
  }

  return (
    <PrivacyContext.Provider
      value={{
        ...preferences,
        error,
        isReady,
        setAirgap: (airgap) => update({ ...preferences, airgap }),
        setMode: (mode) => update({ ...preferences, mode }),
      }}
    >
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) throw new Error('usePrivacy must be used inside PrivacyProvider.')
  return context
}
