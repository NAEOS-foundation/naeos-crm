import 'dotenv/config'
import os from 'node:os'
import { createApp } from './app'
import { bootstrapAuthUser } from './production-auth'
import { prisma, PrismaOutboxEventPort } from './prisma-ports'
import { OutboxDispatcher } from './outbox'
import { OutboxWorker, createEvidenceReceiptOutboxHandler } from './outbox-worker'

const port = Number(process.env.PORT ?? 3000)
const workerEnabled = process.env.OUTBOX_WORKER_ENABLED !== 'false'
const workerId = process.env.OUTBOX_WORKER_ID ?? `api-${os.hostname()}-${process.pid}`

bootstrapAuthUser()
  .then(() => {
    const app = createApp()
    const server = app.listen(port, () => {
      console.log(JSON.stringify({
        event: 'server_started',
        service: 'naeos-crm-api',
        port,
        environment: process.env.NODE_ENV ?? 'development',
      }))
    })

    let worker: OutboxWorker | undefined
    if (workerEnabled) {
      const dispatcher = new OutboxDispatcher(
        new PrismaOutboxEventPort(),
        { 'evidence-receipt.created': createEvidenceReceiptOutboxHandler() },
        {
          workerId,
          leaseMs: Number(process.env.OUTBOX_LEASE_MS ?? 60_000),
          maxAttempts: Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 5),
          baseRetryMs: Number(process.env.OUTBOX_RETRY_BASE_MS ?? 1_000),
        },
      )
      worker = new OutboxWorker(dispatcher, {
        pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000),
        onResult: (result) => {
          if (result.status !== 'PENDING') {
            console.log(JSON.stringify({
              event: 'outbox_worker_result',
              workerId,
              ...result,
            }))
          }
        },
      })
      void worker.start()
      console.log(JSON.stringify({
        event: 'outbox_worker_started',
        workerId,
        pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 1_000),
      }))
    }

    let shuttingDown = false
    const shutdown = (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true
      worker?.stop()
      server.close(async () => {
        await prisma.$disconnect()
        console.log(JSON.stringify({ event: 'server_stopped', service: 'naeos-crm-api', signal }))
        process.exit(0)
      })
    }

    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  })
  .catch((error) => {
    console.error(JSON.stringify({
      event: 'startup_failed',
      service: 'naeos-crm-api',
      error: error instanceof Error ? error.message : String(error),
    }))
    process.exit(1)
  })
