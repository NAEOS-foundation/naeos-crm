const MAX_CONTROL_PLANE_RESPONSE_BYTES = 1_048_576

export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'application/json' || Boolean(mediaType && /^application\/[a-z0-9!#$&^_.+-]+\+json$/.test(mediaType))
}

export async function readBoundedResponseBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes = MAX_CONTROL_PLANE_RESPONSE_BYTES,
): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('Control Plane response exceeded maximum size')
        throw new Error('Control Plane response exceeded the maximum size')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
