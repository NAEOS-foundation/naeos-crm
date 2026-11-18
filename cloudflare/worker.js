export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const upstream = new URL(url.pathname + url.search, env.API_ORIGIN)
      return fetch(new Request(upstream, request))
    }

    return env.ASSETS.fetch(request)
  },
}
