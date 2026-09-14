export class HttpError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export const notFound = (code: string, message: string) => new HttpError(404, code, message)

export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message)

export const invalidReference = (message: string) => new HttpError(400, 'INVALID_REFERENCE', message)

export const forbidden = (message: string) => new HttpError(403, 'FORBIDDEN', message)