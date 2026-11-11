import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('production hardening', () => {
  it('returns a health response with security and correlation headers', async () => {
    const response = await request(createApp())
      .get('/health')
      .set('X-Request-Id', 'hardening-test-001')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.headers['x-request-id']).toBe('hardening-test-001')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['permissions-policy']).toContain('camera=()')
  })

  it('allows the exact configured Cloudflare preview origin through CORS', async () => {
    const previewOrigin = 'https://fix-m1-runtime-stabilization-naeos-crm.bayupriatno007.workers.dev'
    vi.stubEnv('CORS_ORIGINS', 'https://crm.naeos.dev,https://naeos.dev')
    vi.stubEnv('CORS_PREVIEW_ORIGINS', previewOrigin)

    const response = await request(createApp())
      .options('/api/v1/contacts')
      .set('Origin', previewOrigin)
      .set('Access-Control-Request-Method', 'GET')

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(previewOrigin)
  })

  it('replaces malformed request ids instead of reflecting them', async () => {
    const response = await request(createApp())
      .get('/health')
      .set('X-Request-Id', 'invalid request id')

    expect(response.status).toBe(200)
    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)
    expect(response.headers['x-request-id']).not.toBe('invalid request id')
  })
})
