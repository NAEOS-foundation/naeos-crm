import { Router } from 'express'

export const router = Router()

router.get('/api/v1/companies', (_req, res) => {
  res.json({
    data: [],
    meta: {
      request_id: 'placeholder-request-id',
      timestamp: new Date().toISOString(),
    },
  })
})

router.get('/api/v1/contacts', (_req, res) => {
  res.json({
    data: [],
    meta: {
      request_id: 'placeholder-request-id',
      timestamp: new Date().toISOString(),
    },
  })
})

router.get('/api/v1/leads', (_req, res) => {
  res.json({
    data: [],
    meta: {
      request_id: 'placeholder-request-id',
      timestamp: new Date().toISOString(),
    },
  })
})
