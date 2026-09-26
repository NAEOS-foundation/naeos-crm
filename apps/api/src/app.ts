import express from 'express'
import cors from 'cors'
import { router } from './routes'
import { publicRouter } from './public-intake'
import { authMiddleware, errorHandler, requestIdMiddleware } from './middleware'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(requestIdMiddleware)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(publicRouter)
  app.use(authMiddleware)
  app.use(router)

  app.use(errorHandler)

  return app
}