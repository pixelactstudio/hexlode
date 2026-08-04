import type { LocalPreferences } from '#/features/recipes/types'

export function canUseRemoteServices(preferences: LocalPreferences) {
  return preferences.mode === 'local' && !preferences.airgap
}

export function canPersistWorkspace(preferences: LocalPreferences) {
  return preferences.mode === 'local'
}
