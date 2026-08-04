import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canPersistWorkspace, canUseRemoteServices } from '#/features/privacy/policy'

describe('privacy policy', () => {
  it('blocks persistence in private sessions and remote services in airgap mode', () => {
    assert.equal(canPersistWorkspace({ mode: 'private', airgap: false }), false)
    assert.equal(canUseRemoteServices({ mode: 'local', airgap: true }), false)
    assert.equal(canUseRemoteServices({ mode: 'local', airgap: false }), true)
  })
})
