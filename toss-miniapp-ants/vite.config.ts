import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 토스 샌드박스(ait dev) / Vercel 웹 배포 공통으로 사용하는 Vite 설정.
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    strictPort: false,
    // 실기기 샌드박스 테스트 시 --host 로 켜거나 true 로 변경
    host: false,
  },
})
