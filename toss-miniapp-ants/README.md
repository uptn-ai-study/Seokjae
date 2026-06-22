# 개미 관찰소 — 토스 미니앱

`proto-04-ants`(Vercel 웹뷰 프로토타입)를 **토스 미니앱(Apps in Toss)** 으로 마이그레이션한 버전입니다.
원본 프로젝트는 그대로 두고, 플랫폼만 토스 미니앱으로 옮겼습니다.

> 손으로 그린 화이트보드 샌드박스 위에서 개미들이 자유롭게 돌아다닙니다.
> 화면을 톡 건드리면 개미들이 반응하고, "여기까지 볼래요"로 지켜본 시간을 기록합니다.

| 항목 | 값 |
|---|---|
| 폴더명 | `toss-miniapp-ants` |
| 서비스 이름 | 개미 관찰소 |
| 원본 | `proto-04-ants` (변경 없음) |
| 기술스택 | Vue 3 + TypeScript + Vite + `@apps-in-toss/web-framework` |
| Vercel URL | (배포 후 기입) |
| 상태 | 🔄 진행중 |

---

## 원본 대비 무엇이 바뀌었나

마이그레이션은 **플랫폼 연동 레이어만** 추가했고, 시뮬레이션 로직(`src/sim/*`)과 UI는 동일합니다.

| 구분 | 변경 내용 |
|---|---|
| SDK | `@apps-in-toss/web-framework` 의존성 추가 |
| 설정 | `granite.config.ts` 신규 (appName · brand · web 빌드 커맨드) |
| 진입 | `src/toss.ts` — 미니앱 WebView ready 신호 (일반 웹에선 no-op), `main.ts`에서 호출 |
| 빌드 | `npm run dev`/`build` → `ait` CLI (토스 샌드박스 / `.ait` 패키징) · 웹 배포는 `dev:web`/`build:web` |
| Safe Area | `index.html` viewport-fit=cover + `style.css` 상·하·좌·우 `env(safe-area-inset-*)` |

> 일반 브라우저·Vercel Preview에서도 그대로 동작합니다. (`toss.ts`가 SDK 미연동 환경을 조용히 통과)

---

## ⚠️ 출시 전 반드시 교체할 콘솔 의존 값

`granite.config.ts`의 아래 값은 **앱인토스 콘솔 등록값과 한 글자까지 동일**해야 합니다.
(반려 사례 1·2 — 이름/아이콘 불일치가 가장 흔한 반려 사유)

- [ ] `appName` — 콘솔 appName
- [ ] `brand.displayName` — 콘솔 앱 이름 (한글 권장, 현재 `개미 관찰소`)
- [ ] `brand.primaryColor` — 콘솔 브랜드 컬러 (현재 `#e0584f`)
- [ ] `brand.icon` — 콘솔 업로드 아이콘 URL (600×600 정사각형, 배경 필수) ← **현재 placeholder**

---

## 로컬 실행

```bash
cd toss-miniapp-ants
npm install

# 토스 샌드박스로 실행 (SDK 설치 후)
npm run dev

# 일반 웹으로 빠르게 확인 (SDK 불필요)
npm run dev:web
```

> 실기기 샌드박스 테스트 시 `granite.config.ts`의 `web.host`를 접근 가능한 IP로 바꾸고
> `vite.config.ts`의 `server.host`를 켜세요. (Android: `chrome://inspect`, iOS: Safari 개발자 도구)

---

## 배포 — 두 갈래

토스 미니앱은 **WebView가 가리키는 HTTPS 주소(Vercel)** 와 **스토어에 올리는 `.ait` 번들**, 둘을 모두 씁니다.

### 1) Vercel (WebView가 로드할 HTTPS 웹)
- Add New Project → 이 레포 import → **Root Directory = `toss-miniapp-ants`**
- Build Command는 `vercel.json`에 `npm run build:web`로 지정됨 (vite 웹 빌드 → `dist`)
- CORS 허용 필요 시: `https://<appName>.apps.tossmini.com`, `https://<appName>.private-apps.tossmini.com`

### 2) `.ait` 번들 (스토어 제출용)
```bash
npm run build      # = ait build → .ait 생성
```
- 번들 100MB 이하 확인 → 콘솔 "앱 출시" 메뉴에서 `.ait` 업로드 → QR 테스트

---

## 출시 체크리스트 (플레이북 기준)

1. [ ] 콘솔 앱 등록 (appName·이름·아이콘·컬러) → 승인 (영업일 1~2일)
2. [ ] `granite.config.ts` 콘솔 값과 일치시키기 (위 ⚠️ 항목)
3. [ ] `npm install` → `npm run dev` 샌드박스 정상 노출
4. [ ] 실기기 테스트 (로그인 상태·워크스페이스 멤버·만 19세 이상)
5. [ ] `npm run build` → `.ait` 생성·100MB 이하 확인
6. [ ] 콘솔 업로드 → QR 테스트 1회 이상
7. [ ] 검토 요청 → 출시
