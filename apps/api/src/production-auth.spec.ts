import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './production-auth'

describe('production password authentication', () => {
  it('hashes and verifies passwords with a salted memory-hard hash', () => {
    const password = 'a-strong-production-passphrase'
    const hash = hashPassword(password)
    expect(hash).toMatch(/^scrypt\$N=131072,r=8,p=1\$/)
    expect(verifyPassword(password, hash)).toBe(true)
    expect(verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('rejects passwords below the production minimum length', () => {
    expect(() => hashPassword('short')).toThrow()
  })
})
