import 'dotenv/config'
import { createApp } from './app'
import { bootstrapAuthUser } from './production-auth'

const port = Number(process.env.PORT ?? 3000)

bootstrapAuthUser()
  .then(() => {
    createApp().listen(port, () => {
      console.log(JSON.stringify({ event: 'server_started', service: 'naeos-crm-api', port, environment: process.env.NODE_ENV ?? 'development' }))
    })
  })
  .catch((error) => {
    console.error(JSON.stringify({ event: 'startup_failed', service: 'naeos-crm-api', error: error instanceof Error ? error.message : String(error) }))
    process.exit(1)
  })
