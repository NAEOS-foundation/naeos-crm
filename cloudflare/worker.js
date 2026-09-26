import { DurableObject } from 'cloudflare:workers'

export class NAEOSCRMContainer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)

    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.container.start({
        env: {
          NODE_ENV: 'production',
          PORT: '3000',
          DATABASE_URL: env.DATABASE_URL,
        },
        entrypoint: ['node', 'apps/api/dist/main.js'],
        enableInternet: true,
      })
    })
  }

  async fetch(request) {
    return this.ctx.container.getTcpPort(3000).fetch(request)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const id = env.NAEOS_CRM.idFromName('production')
      return env.NAEOS_CRM.get(id).fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
