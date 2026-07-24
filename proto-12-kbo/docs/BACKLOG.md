# 확장 포인트 백로그 (T-24)

다음 단계에서 검토할 항목. 현재 아키텍처(어댑터 + 정규화 스키마 + 정적 서빙)를
유지한 채 추가할 수 있도록 확장 지점을 명시한다.

## 데이터

- **세부 스플릿**: 월별/구장별/홈·원정별 기록.
  - 기록실 `ddlSituation`/`ddlSituationDetail` 셀렉트 포스트백으로 수집 가능
    (`scripts/sources/kbo_official.mjs` 의 `collectFormState` 재사용).
  - 스키마: `hitters/2026-splits.json` 형태로 분리 저장 권장.
- **비규정 선수 포함**: 기록실의 규정타석/이닝 해제 옵션 처리 또는
  팀별 필터(`ddlTeam`) 순회 수집.
- **과거 시즌 아카이브**: `csv_archive` 어댑터에 실제 CSV 투입
  (choosunsick/KBO_data 형식 → `data/archive/games-<season>.csv`).
- **세이버메트릭스**: wOBA, wRC+, FIP 등. 리그 평균/파크팩터 상수가 필요하므로
  `src/lib/stats.ts` 에 시즌 상수 테이블과 함께 추가.
- **상용 API 어댑터**: 안정성이 필요해지면 `scripts/sources/commercial_api.mjs`
  (LSports 등) 를 DataSource 인터페이스로 구현해 교체.

## 화면

- ✅ **팀 상세 페이지** (2026-07-24 완료) — `/teams/:teamId`. 상대 전적표 · 월별 스플릿 ·
  홈/원정 · 최근 10경기 · 팀 로스터(타자/투수) · 뉴스 심리 연동.
  `src/lib/teamStats.ts` 에서 **기존 games 데이터만으로** 산출(추가 크롤링 없음).
- ✅ **순위 변동 그래프** (2026-07-24 완료) — 순위 페이지에 상위 5팀 일자별 순위 추이
  (`rankHistory()`, LineChart `invertY`).
- ✅ **다크 모드** (2026-07-24 완료) — `tokens.css` 의 `prefers-color-scheme: dark` 로 토큰만
  뒤집어 전 화면 반영. 하드코딩 색은 토큰화(`--color-warn-*`, `--color-tooltip-*`,
  `--color-header-bg`, `--color-skeleton-*`).
- 선수 상세 페이지 (playerId 기반, 기록실 HitterDetail/PitcherDetail 크롤링)
  — **신규 크롤링 필요**. 현재 파이프라인 리스크를 고려해 보류 중.

## 인프라

- 증분 갱신 실패 알림 (GitHub Actions failure notification)
- 라이브 경기 상태 폴링 (경기 중 5분 간격 갱신 워크플로)
- FastAPI 등 API 서버 전환 시: `src/api/dataClient.ts` 만 교체하면 되도록
  현재 경계 유지
