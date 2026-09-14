import express from 'express'
import { router } from './routes'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(express.json())
app.use(router)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`NAEOS CRM API listening on http://localhost:${port}`)
})
