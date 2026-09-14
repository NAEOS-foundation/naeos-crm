import express from 'express'
import cors from 'cors'
import { router } from './routes'
import { authMiddleware, errorHandler, requestIdMiddleware } from './middleware'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(requestIdMiddleware)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(authMiddleware)
  app.use(router)

  app.use(errorHandler)

  return app
}