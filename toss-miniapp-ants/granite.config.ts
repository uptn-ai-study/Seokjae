import { defineConfig } from '@apps-in-toss/web-framework/config'

/**
 * 토스 미니앱(Apps in Toss) 설정.
 *
 * ⚠️ 아래 4개 값은 앱인토스 콘솔 등록값과 "한 글자까지" 동일해야 합니다.
 *    (반려 사례 1·2 참고 — 이름/아이콘 불일치가 가장 흔한 반려 사유)
 *    콘솔 등록 후 실제 값으로 교체하세요.
 *
 *   - appName            : 콘솔 appName (영문 식별자)
 *   - brand.displayName  : 콘솔 앱 이름 (한글 권장)
 *   - brand.primaryColor : 콘솔 브랜드 컬러
 *   - brand.icon         : 콘솔 업로드 아이콘 URL (600x600, 배경 있음)
 */
export default defineConfig({
  // TODO(console): 콘솔 등록 appName 으로 교체
  appName: 'ant-watch',
  brand: {
    // TODO(console): 콘솔 등록 앱 이름과 정확히 일치시킬 것
    displayName: '개미 관찰소',
    // 기존 프로토타입 액센트 컬러 그대로 사용
    primaryColor: '#e0584f',
    // TODO(console): 콘솔에 업로드한 아이콘 이미지 URL로 교체 (600x600 정사각형, 배경 필수)
    icon: 'https://static.toss.im/appsintoss/ant-watch/icon.png',
    bridgeColorMode: 'basic',
  },
  web: {
    // 샌드박스(ait dev)가 띄우는 로컬 웹 서버 설정.
    // 실기기 테스트 시 host 를 접근 가능한 IP(예: 192.168.x.x)로 바꾸세요.
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  // 이 앱은 로그인/결제/디바이스 권한이 필요 없는 순수 관찰형 미니앱입니다.
  permissions: [],
})
