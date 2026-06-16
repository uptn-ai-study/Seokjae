# proto-08-stocks · 모의투자 플레이

KOSPI 100 종목을 **실시간 시세** 기반으로 사고팔며 수익률을 겨루는 가상 모의투자 놀이.
세션이 시작되면 시드머니 **10억 원**이 지급되고, 주가 변동에 따라 평가손익·수익률이 실시간으로 갱신됩니다.

> ⚠️ 실제 돈이 오가지 않는 **가상 투자**입니다. 투자 권유·수익 보장이 아닙니다.

## 주요 기능
- 시드머니 10억으로 시작 (브라우저 localStorage에 세션 저장 · 새로고침해도 유지)
- KOSPI 대형주 100선 실시간 시세 조회 (약 7초 주기 폴링)
- 매수/매도 바텀시트 (10/25/50/최대 비율 퀵 주문, 평균 매입단가 자동 계산)
- 보유 포트폴리오 평가손익·수익률, 종목별 손익
- 섹터 필터 · 종목명/코드 검색
- 최초 진입 시 면책 고지 모달 + 하단 상시 면책 배너
- 아이폰 SE2(375×667) 등 소형 화면 대응

## 실시간 시세 구조
브라우저에서 네이버 금융을 직접 호출하면 CORS로 차단되므로 **서버를 경유**합니다.

- 프로덕션: **`api/quotes.js`** (Vercel Serverless Function)이 네이버 금융 시세를 프록시
- 로컬 dev: `vite.config.ts`의 dev 미들웨어가 동일 로직(`shared/naver.ts`)으로 처리
- 두 경로 모두 `/api/quotes?codes=005930,000660,...` 형태로 호출

> ⚠️ **함수는 반드시 `.js`(순수 CommonJS)로 작성한다.** `api/quotes.ts`로 두면 Vercel
> 함수 빌더가 프로젝트 `tsconfig.json`(Vite 번들러 모드용 `noEmit`/`allowImportingTsExtensions`)을
> 참조해 함수가 깨지고, 핸들러가 로드 단계에서 죽어 `FUNCTION_INVOCATION_FAILED`가 발생한다.
> `.js`는 TS 컴파일을 거치지 않아 이 영향이 전혀 없다. (동일 로직의 TS 버전 `shared/naver.ts`는
> vite dev 미들웨어 전용이며, 함수는 외부 import 없이 자체 완결로 둔다.)

## 로컬 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드
```

## Vercel 배포 메모
- **Root Directory**를 `proto-08-stocks`로 지정하면 내부 `api/` 폴더가 자동으로 Serverless Function으로 인식됩니다.
- 별도 환경변수/API 키 불필요 (공개 시세 엔드포인트 사용).
- 네이버 비공식 엔드포인트라 응답 형식이 바뀌면 `api/quotes.js`(및 dev용 `shared/naver.ts`)를 수정하면 됩니다.

## 기술 스택
Vue 3 · TypeScript · Vite · Vercel Functions · 팀 UI 공통 규약(UI-COMMON.md)
