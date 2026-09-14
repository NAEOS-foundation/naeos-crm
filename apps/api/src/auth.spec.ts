import { describe, expect, it } from 'vitest'

import { ApiAuthGuard } from './auth'
import { DefaultAuthorizationService } from '@naeos-crm/auth'

describe('ApiAuthGuard', () => {
  it('rejects requests without an authenticated actor', () => {
    const guard = new ApiAuthGuard(new DefaultAuthorizationService())

    const result = guard.authorize({}, 'company', 'read')

    expect(result.allowed).toBe(false)
  })

  it('allows company read for any authenticated actor', () => {
    const guard = new ApiAuthGuard(new DefaultAuthorizationService())

    const result = guard.authorize(
      {
        actor: {
          id: 'user-1',
          email: 'member@example.com',
          roles: ['member'],
        },
      },
      'company',
      'read',
    )

    expect(result.allowed).toBe(true)
  })

  it('allows company write only for admin and manager roles', () => {
    const guard = new ApiAuthGuard(new DefaultAuthorizationService())

    expect(
      guard.authorize(
        {
          actor: {
            id: 'user-1',
            email: 'manager@example.com',
            roles: ['manager'],
          },
        },
        'company',
        'write',
      ).allowed,
    ).toBe(true)

    expect(
      guard.authorize(
        {
          actor: {
            id: 'user-2',
            email: 'member@example.com',
            roles: ['member'],
          },
        },
        'company',
        'write',
      ).allowed,
    ).toBe(false)
  })
})
