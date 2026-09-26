import 'dotenv/config'
import { createApp } from './app'
import { bootstrapAuthUser } from './production-auth'

const port = Number(process.env.PORT ?? 3000)

bootstrapAuthUser()
  .then(() => {
    createApp().listen(port, () => {
      console.log(`NAEOS CRM API listening on http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('[startup] authentication bootstrap failed', error)
    process.exit(1)
  })
