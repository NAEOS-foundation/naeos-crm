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

  it('controls pipeline and campaign administration by role', () => {
    expect(
      guard.authorize(
        { actor: { id: 'u1', email: 'a@b.c', roles: ['member'] } },
        'pipeline',
        'write',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u2', email: 'a@b.c', roles: ['manager'] } },
        'pipeline',
        'write',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u3', email: 'a@b.c', roles: ['admin'] } },
        'pipeline',
        'write',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u4', email: 'a@b.c', roles: ['manager'] } },
        'campaign',
        'delete',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u5', email: 'a@b.c', roles: ['member'] } },
        'campaign',
        'write',
      ).allow,
    ).toBe(false)
  })

  it('grants opportunity, follow-up, and analytics access by role', () => {
    expect(
      guard.authorize(
        { actor: { id: 'u1', email: 'a@b.c', roles: ['member'] } },
        'opportunity',
        'write',
      ).allow,
    ).toBe(false)

    expect(
      guard.authorize(
        { actor: { id: 'u2', email: 'a@b.c', roles: ['admin'] } },
        'opportunity',
        'write',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u3', email: 'a@b.c', roles: ['member'] } },
        'follow-up',
        'write',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u4', email: 'a@b.c', roles: ['member'] } },
        'analytics',
        'read',
      ).allow,
    ).toBe(true)

    expect(
      guard.authorize(
        { actor: { id: 'u5', email: 'a@b.c', roles: ['member'] } },
        'pipeline',
        'delete',
      ).allow,
    ).toBe(false)
  })

  it('grants ecosystem and use-case access by role', () => {
    const ecosystemResources = ['contributor', 'partner', 'community', 'investor']
    for (const resource of ecosystemResources) {
      expect(
        guard.authorize(
          { actor: { id: 'u1', email: 'a@b.c', roles: ['member'] } },
          resource,
          'read',
        ).allow,
      ).toBe(true)
      expect(
        guard.authorize(
          { actor: { id: 'u2', email: 'a@b.c', roles: ['member'] } },
          resource,
          'write',
        ).allow,
      ).toBe(false)
      expect(
        guard.authorize(
          { actor: { id: 'u3', email: 'a@b.c', roles: ['manager'] } },
          resource,
          'write',
        ).allow,
      ).toBe(true)
      expect(
        guard.authorize(
          { actor: { id: 'u4', email: 'a@b.c', roles: ['admin'] } },
          resource,
          'delete',
        ).allow,
      ).toBe(true)
    }

    expect(
      guard.authorize(
        { actor: { id: 'u5', email: 'a@b.c', roles: ['member'] } },
        'use-case',
        'read',
      ).allow,
    ).toBe(true)
    expect(
      guard.authorize(
        { actor: { id: 'u6', email: 'a@b.c', roles: ['admin'] } },
        'use-case',
        'write',
      ).allow,
    ).toBe(true)
    expect(
      guard.authorize(
        { actor: { id: 'u7', email: 'a@b.c', roles: ['manager'] } },
        'use-case',
        'delete',
      ).allow,
    ).toBe(true)
    expect(
      guard.authorize(
        { actor: { id: 'u8', email: 'a@b.c', roles: ['member'] } },
        'use-case',
        'delete',
      ).allow,
    ).toBe(false)
  })
})