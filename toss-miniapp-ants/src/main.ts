import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { bootstrapToss } from './toss'

// 토스 미니앱 WebView 환경 판별/초기화 (일반 웹에서는 no-op).
bootstrapToss()

createApp(App).mount('#app')
