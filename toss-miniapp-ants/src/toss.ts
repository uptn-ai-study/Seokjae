// 토스 미니앱(Apps in Toss) WebView 연동 헬퍼.
//
// 이 앱은 로그인·결제·공유·디바이스 권한이 필요 없는 순수 관찰형이라
// 런타임 SDK(@apps-in-toss/web-framework)를 직접 호출하지 않습니다.
// 실제 플랫폼 연동의 핵심은 빌드 타임 설정인 `granite.config.ts` 이며,
// 이 파일은 "미니앱 안에서 실행 중인지" 판별하는 가벼운 헬퍼만 제공합니다.
//
// ⚠️ 런타임 SDK 기능(예: 공유, 햅틱, 로그인)이 나중에 필요해지면 아래처럼 쓰세요.
//    @apps-in-toss/web-framework 는 RN 기반이라 일반 브라우저 번들에 정적으로
//    포함되면 안 되므로, 변수 specifier + @vite-ignore 로 번들러 정적 분석을 피하고
//    런타임에만 로드한 뒤 try/catch 로 감쌉니다.
//
//    const pkg = '@apps-in-toss/web-framework'
//    try {
//      const sdk: any = await import(/* @vite-ignore */ pkg)
//      await sdk.share({ ... })
//    } catch { /* 미니앱 외 환경 — 무시 */ }

let inTossCache: boolean | null = null

/** 현재 토스 미니앱 WebView 안에서 실행 중인지 추정 */
export function isInToss(): boolean {
  if (inTossCache !== null) return inTossCache
  if (typeof window === 'undefined') return (inTossCache = false)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  inTossCache = /toss/i.test(ua) || typeof (window as any).__APPS_IN_TOSS__ !== 'undefined'
  return inTossCache
}

/** 미니앱 진입 시 1회 호출하는 자리. 현재는 환경 판별만 수행(no-op). */
export function bootstrapToss(): void {
  if (isInToss()) {
    // 미니앱 진입 — 필요한 초기화가 생기면 여기에 추가
    document.documentElement.dataset.platform = 'toss'
  }
}
