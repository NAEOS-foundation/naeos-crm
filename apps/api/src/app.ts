import express from 'express'
import cors from 'cors'
import { router } from './routes'
import { publicRouter } from './public-intake'
import { authRouter } from './auth-routes'
import { authMiddleware, errorHandler, requestIdMiddleware } from './middleware'

export function createApp() {
  const app = express()

  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? 'https://crm.naeos.dev,https://naeos.dev')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed by CORS'))
    },
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(requestIdMiddleware)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use(publicRouter)
  app.use(authRouter)
  app.use(authMiddleware)
  app.use(router)
  app.use(errorHandler)

  return app
}
