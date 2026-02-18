import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('http://127.0.0.1:3000/api/health', () => {
    return HttpResponse.json({ ok: true, service: 'marineflow' })
  }),
]
