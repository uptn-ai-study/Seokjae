import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fetchQuotes } from './shared/naver'

// 로컬 dev에서는 Vercel serverless가 안 도므로, /api/quotes 를
// 동일 로직(fetchQuotes)으로 처리하는 미들웨어를 끼워 프로덕션과 동작을 맞춘다.
function devQuotesApi(): Plugin {
  return {
    name: 'dev-quotes-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/quotes', async (req, res) => {
        try {
          const url = new URL(req.url ?? '', 'http://localhost')
          const codes = (url.searchParams.get('codes') ?? '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
          if (codes.length === 0) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'codes 파라미터가 필요합니다.' }))
            return
          }
          const quotes = await fetchQuotes(codes)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ quotes, fetchedAt: new Date().toISOString() }))
        } catch (e: any) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: '시세 조회 실패', detail: String(e?.message ?? e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), devQuotesApi()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
