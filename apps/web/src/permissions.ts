import type { Actor } from './api'

const PERMISSIONS: Record<string, string[]> = {
  admin: [
    'user:read',
    'user:write',
    'user:delete',
    'company:read',
    'company:write',
    'company:delete',
    'contact:read',
    'contact:write',
    'contact:delete',
    'lead:read',
    'lead:write',
    'lead:delete',
    'activity:read',
    'activity:write',
    'activity:delete',
    'task:read',
    'task:write',
    'task:delete',
    'audit:read',
    'dashboard:read',
  ],
  manager: [
    'user:read',
    'company:read',
    'company:write',
    'contact:read',
    'contact:write',
    'contact:delete',
    'lead:read',
    'lead:write',
    'lead:delete',
    'activity:read',
    'activity:write',
    'activity:delete',
    'task:read',
    'task:write',
    'task:delete',
    'audit:read',
    'dashboard:read',
  ],
  member: [
    'company:read',
    'contact:read',
    'contact:write',
    'lead:read',
    'activity:read',
    'activity:write',
    'task:read',
    'task:write',
    'dashboard:read',
  ],
}

export function can(actor: Actor | null, resource: string, action: string): boolean {
  if (!actor) return false
  const permission = `${resource}:${action}`
  return actor.roles.some((role) => (PERMISSIONS[role.toLowerCase()] ?? []).includes(permission))
}

export function isMemberOnly(actor: Actor | null): boolean {
  if (!actor) return false
  return !actor.roles.some((role) => role.toLowerCase() === 'admin' || role.toLowerCase() === 'manager')
}