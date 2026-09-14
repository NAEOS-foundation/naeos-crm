import { describe, expect, it } from 'vitest'

import { ApiAuthGuard } from './auth'
import { DefaultAuthorizationService } from '@naeos-crm/auth'

describe('ApiAuthGuard', () => {
  const guard = new ApiAuthGuard(new DefaultAuthorizationService())

  it('rejects requests without an authenticated actor', () => {
    const result = guard.authorize({}, 'company', 'read')
    expect(result.allow).toBe(false)
  })

  it('allows company read for any authenticated actor', () => {
    const result = guard.authorize(
      { actor: { id: 'user-1', email: 'member@example.com', roles: ['member'] } },
      'company',
      'read',
    )
    expect(result.allow).toBe(true)
  })

  it('allows company write only for admin and manager roles', () => {
    expect(
      guard.authorize(
        { actor: { id: 'user-1', email: 'manager@example.com', roles: ['manager'] } },
        'company',
        'write',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'user-2', email: 'member@example.com', roles: ['member'] } },
        'company',
        'write',
      ).allow,
    ).toBe(false)
  })

  it('grants delete only to administrators', () => {
    expect(
      guard.authorize(
        { actor: { id: 'u1', email: 'a@b.c', roles: ['member'] } },
        'company',
        'delete',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u2', email: 'a@b.c', roles: ['manager'] } },
        'company',
        'delete',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u3', email: 'a@b.c', roles: ['admin'] } },
        'company',
        'delete',
      ).allow,
    ).toBe(true)
  })

  it('controls user administration and audit visibility by role', () => {
    expect(
      guard.authorize(
        { actor: { id: 'u1', email: 'a@b.c', roles: ['member'] } },
        'user',
        'read',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u2', email: 'a@b.c', roles: ['manager'] } },
        'user',
        'read',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u3', email: 'a@b.c', roles: ['admin'] } },
        'user',
        'write',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u4', email: 'a@b.c', roles: ['admin'] } },
        'audit',
        'read',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u5', email: 'a@b.c', roles: ['member'] } },
        'audit',
        'read',
      ).allow,
    ).toBe(false)
  })
})