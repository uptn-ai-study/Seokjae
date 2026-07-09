import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 정적 JSON 서빙 전략: 수집 파이프라인이 data/normalized/ 를 생성하고
// 같은 내용을 public/data/ 로 동기화한다. 프론트는 /data/*.json 을 fetch.
export default defineConfig({
  plugins: [react()],
  server: { port: 5183 },
});
