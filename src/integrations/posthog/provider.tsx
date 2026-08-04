import { PostHogProvider as BasePostHogProvider } from '@posthog/react'
import posthog from 'posthog-js'
import { type ReactNode, useEffect, useRef } from 'react'
import { canUseRemoteServices } from '#/features/privacy/policy'
import { usePrivacy } from '#/features/privacy/privacy-provider'

interface PostHogProviderProps {
  children: ReactNode
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
  const { airgap, isReady, mode } = usePrivacy()
  const isInitialized = useRef(false)

  useEffect(() => {
    if (!isReady || !import.meta.env.VITE_POSTHOG_KEY) return

    const isAllowed = canUseRemoteServices({ airgap, mode })
    if (!isInitialized.current && isAllowed) {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        autocapture: false,
        person_profiles: 'identified_only',
        capture_pageview: false,
        disable_session_recording: true,
        defaults: '2025-11-30',
      })
      isInitialized.current = true
    }

    if (!isInitialized.current) return
    if (isAllowed) posthog.opt_in_capturing()
    else posthog.opt_out_capturing()
  }, [airgap, isReady, mode])

  return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>
}
