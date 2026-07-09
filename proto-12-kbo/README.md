# KBO 데이터 뷰어

한국 프로야구(KBO) **경기 결과 · 팀 순위 · 선수 기록**을 초심자도 쉽게 볼 수 있는 반응형 웹앱.
2026 시즌 데이터를 KBO 공식 홈페이지에서 수집해 정적 JSON으로 서빙한다.

> ⚠ 데이터 저작권은 KBO(한국야구위원회)에 있으며, 본 프로젝트는 **비상업적/학습용**입니다.

## 스택 결정 (확정)

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 프론트엔드 | Vite + React + TypeScript, CSS Modules | 경량, 표준적, 반응형 구현 용이 |
| 라우팅 | React Router (hash 라우터) | 정적 호스팅에서 서버 리라이트 불필요 |
| 차트 | 자체 SVG/CSS 경량 구현 | 외부 차트 라이브러리 의존 제거 |
| 데이터 수집 | **Node.js** (fetch + cheerio) | 프론트와 단일 런타임. (개발 환경에 Python 실행이 불가하여 프롬프트의 Python 제안 대신 Node 로 확정 — 어댑터 구조는 동일) |
| 서빙 | 정적 JSON (`public/data/*`) | 백엔드 없이 시작, 추후 FastAPI 등으로 교체 가능한 경계 유지 |

## 실행

```bash
npm install
npm run dev          # http://localhost:5183
npm run build        # 프로덕션 빌드 (dist/)
npm test             # lib/stats 단위 테스트
```

## 데이터 파이프라인

```bash
npm run data:build     # 시즌 전체 수집 (지난 날짜는 data/raw 캐시 재사용)
npm run data:update    # 증분 갱신: 최근 3일 + 선수 기록만 재요청
npm run data:validate  # data/schema/*.json 스키마 + 순위 합계 검증
```

- **원본 저장 → 정규화 → 서빙** 3단계: 원본 응답은 `data/raw/`(gitignore),
  정규화 결과는 `data/normalized/`, 서빙 복사본은 `public/data/`.
- 소스는 어댑터 패턴(`scripts/sources/base.mjs`)으로 추상화되어 있어
  `--source kbo_official | csv_archive | dummy` 로 교체 가능.
- 크롤러는 요청 간 지연(400ms+), 재시도(3회, 백오프), User-Agent 명시, 쿠키 유지 포함.

### 사용 엔드포인트 (2026-07 실측 검증)

| 데이터 | 엔드포인트 | 방식 |
| --- | --- | --- |
| 날짜별 경기 목록/결과 | `/ws/Main.asmx/GetKboGameList` | POST form + Referer 필수 |
| 이닝 라인스코어 | `/ws/Schedule.asmx/GetScoreBoardScroll` | POST form (gameId 단위) |
| 박스스코어 | `/ws/Schedule.asmx/GetBoxScoreScroll` | POST form (gameId 단위) |
| 타자/투수 시즌 기록 | `/Record/Player/{Hitter,Pitcher}Basic/Basic{1,2}.aspx` | GET + `__VIEWSTATE` 포스트백 페이지네이션 |
| 팀 순위 | (크롤링 안 함) 정규시즌 경기 결과에서 직접 산출 | 합계 검증 포함 |

## 디렉터리 구조

```
kbo-viewer/
├─ tasks/                # 작업 체크리스트 (tasks.json 이 진행 추적의 단일 원천)
├─ scripts/              # 데이터 수집·정규화 (Node ESM)
│  ├─ sources/           # DataSource 어댑터 (base / kbo_official / csv_archive)
│  ├─ lib/http.mjs       # rate limit·재시도·raw 캐시·쿠키
│  ├─ normalize.mjs      # 원본 → 정규화 스키마 + 순위 산출
│  ├─ pipeline.mjs       # 공통 파이프라인
│  ├─ build_dataset.mjs  # 전량 빌드 엔트리포인트
│  ├─ update_incremental.mjs
│  └─ validate.mjs       # 스키마 검증
├─ data/
│  ├─ raw/               # 원본 캐시 (gitignore)
│  ├─ normalized/        # 정규화 JSON (games/standings/hitters/pitchers/boxscores)
│  └─ schema/            # JSON Schema
├─ public/data/          # 서빙용 복사본 (프론트가 fetch)
└─ src/
   ├─ api/               # dataClient(fetch+캐시), useData 훅
   ├─ types/kbo.ts       # 공용 타입
   ├─ lib/               # stats(파생지표+테스트), format, teams
   ├─ content/glossary.ts # 초심자용 지표 용어 사전 (단일 원천)
   ├─ components/        # common(DataTable/Tooltip/TeamBadge/states), glossary, charts
   └─ features/          # home / schedule / standings / players / game-detail
```

## 초심자 친화 기능

- 모든 주요 지표 헤더에 **? 툴팁**: 쉬운 설명 + "높을수록/낮을수록 좋아요" 방향 안내
- 표 정렬(헤더 클릭·키보드), 컬럼별 **상위 3개 값 색 강조**
- 홈 화면: 최근 경기 + 순위 요약 + 상위 3팀 승률 추이 한눈에
- 드릴다운: 경기 카드 → 이닝 라인스코어/타자·투수 박스스코어

## 반응형

- mobile-first, 브레이크포인트 320/480/768/1024px
- 표는 가로 스크롤 컨테이너 + sticky 첫 열 (320px 검증 완료)
- 터치 타겟 44px+, 본문 폰트 14px+

## 데이터 출처·라이선스

- 데이터 출처: [KBO 공식 홈페이지](https://www.koreabaseball.com). 기록 저작권 © KBO.
- 본 저장소의 코드는 학습용이며, 수집 데이터의 상업적 이용을 금합니다.
- 수집 시 robots.txt 준수, 요청 간 지연을 둡니다.

## Vercel 배포

이 프로젝트는 모노레포(`uptn-ai-study/Seokjae`)의 하위 폴더다. Vercel 대시보드에서
새 프로젝트를 만들 때 **Root Directory 를 `proto-12-kbo` 로 지정**하면 `vercel.json`
(빌드 `npm run build`, 출력 `dist`)에 따라 빌드된다. hash 라우터를 쓰므로 별도 rewrite
설정이 필요 없고, `public/data/*.json` 이 함께 정적 서빙된다.

## 갱신 자동화

`.github/workflows/update-data.yml` 이 매일 KST 새벽(00:30)에 `npm run data:update` 를
실행해 최신 JSON 을 커밋하도록 작성되어 있다.

> 모노레포에서 GitHub Actions 는 **저장소 루트의** `.github/workflows/` 만 인식한다.
> 따라서 위 파일은 현재 `proto-12-kbo/.github/` 안에 있어 **자동 실행되지 않는 dormant
> 상태**다. 활성화하려면 파일을 저장소 루트의 `.github/workflows/` 로 옮기면 된다
> (`working-directory: proto-12-kbo` 가 이미 설정되어 있다).
