import { Router } from 'express'
import { prisma } from './prisma-ports'

export const outboxObservabilityRouter = Router()

outboxObservabilityRouter.get('/api/v1/outbox/status', async (req, res, next) => {
  if (!req.actor) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    return
  }

  if (!req.actor.roles.map((role) => role.toUpperCase()).includes('ADMIN')) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } })
    return
  }

  try {
    const [grouped, processing, staleProcessing] = await Promise.all([
      prisma.outboxEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      prisma.outboxEvent.count({
        where: {
          status: 'PROCESSING',
          lockedAt: { lt: new Date(Date.now() - Number(process.env.OUTBOX_LEASE_MS ?? 60_000)) },
        },
      }),
    ])

    const counts = { PENDING: 0, PROCESSING: 0, SUCCEEDED: 0, FAILED: 0 }
    for (const row of grouped) counts[row.status] = row._count._all

    res.json({
      data: {
        counts,
        processing,
        staleProcessing,
        retryBacklog: counts.PENDING,
      },
    })
  } catch (error) {
    next(error)
  }
})
