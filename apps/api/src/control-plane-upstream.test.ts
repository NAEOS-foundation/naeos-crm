import { describe, expect, it } from 'vitest'
import { isJsonContentType, readBoundedResponseBody } from './control-plane-upstream'

describe('Control Plane upstream response hardening', () => {
  it('accepts JSON media types including structured +json', () => {
    expect(isJsonContentType('application/json')).toBe(true)
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true)
    expect(isJsonContentType('application/problem+json')).toBe(true)
    expect(isJsonContentType('text/html')).toBe(false)
    expect(isJsonContentType(null)).toBe(false)
  })

  it('reads streamed response within byte cap', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'))
        controller.enqueue(new TextEncoder().encode('true}'))
        controller.close()
      },
    })
    await expect(readBoundedResponseBody(body, 16)).resolves.toBe('{"ok":true}')
  })

  it('rejects when the byte cap is exceeded before completing the stream', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(8))
      },
      cancel() {
        cancelled = true
      },
    })
    await expect(readBoundedResponseBody(body, 10)).rejects.toThrow(/maximum size/)
    expect(cancelled).toBe(true)
  })

  it('rejects invalid UTF-8', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0xff, 0xfe]))
        controller.close()
      },
    })
    await expect(readBoundedResponseBody(body, 8)).rejects.toThrow()
  })
})
