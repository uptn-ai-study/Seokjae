# Pangyo Drift — 탑뷰 오픈월드 아케이드

판교역 반경 5km를 **모티프**로 한 GTA2 스타일 탑뷰(top-down) 오픈월드 액션 게임.
PC(키보드)와 모바일(터치)에서 모두 동작하며, **빌드 도구 없이** 브라우저에서 바로 실행됩니다.

> 실제 상표·기업명·저작물은 일절 사용하지 않습니다. 모든 지명·건물명은 패러디성 가상 명칭이며,
> 폭력 표현은 아케이드·만화적 수준(차량 액션 중심, 총격전 없음)으로 순화했습니다.

## 실행

```bash
npm run dev
```

`http://localhost:5174` 접속. (정적 파일이므로 아무 정적 서버로도 실행됩니다.)

## 조작

| | PC | 모바일 |
|---|---|---|
| 이동 / 운전 | `W A S D` 또는 방향키 | 좌측 가상 조이스틱 |
| 탑승 / 하차 | `Space` (또는 `E`) | 탑승·하차 버튼 |
| 달리기 · 부스트 | `Shift` | 부스트 버튼 |
| 드리프트(핸드브레이크) · 경적 | `F` | 드리프트 버튼 |
| 지도 / 일시정지 | `M` / `Esc` | 우상단 아이콘 |

키보드·터치는 `InputState { moveX, moveY, actionA, actionB, boost }` 하나로 추상화되어
게임 로직은 입력 장치를 구분하지 않습니다.

## 게임 구성

- **도보 ↔ 차량** — 세단·스포츠카·SUV·버스·트럭·오토바이·스쿠터. 차종별 최고속도/가속/핸들링/내구도.
- **아케이드 주행** — 속도 비례 조향 + 그립 감쇠. 핸드브레이크로 그립을 낮춰 드리프트(스키드 마크).
- **수배(Wanted) 시스템** — 차량 탈취·보행자 사고·경찰 추돌로 별이 오르고, 순찰차 → 다수 순찰차 → 특수 차량으로 대응이 강해집니다.
  900px 밖으로 5초 이상 따돌리면 추격이 끊기고 수배가 식으며, **Wash Point**(파란 원)에 들어가면 즉시 해제됩니다.
- **NPC 시뮬레이션** — 일반 차량은 도로 그래프를 따라 우측통행하고, 보행자는 인도를 배회하다 차를 피해 도망칩니다.
  카메라 주변만 활성 시뮬레이션하고 멀어지면 폐기합니다.
- **미션 4종** — 판교 한 바퀴 / 심야 배달 / 리버사이드 랠리 / 야간 탈주극.
- **낮·밤 사이클**, 구역별 BGM(Web Audio 합성), 진행도 자동 저장(localStorage), PWA 설치.

## 데이터 주도 설계

지형과 미션은 코드가 아니라 **JSON**에 있습니다. 데이터만 바꾸면 도시가 바뀝니다.

```
assets/data/
├─ city.pangyo.json      # 지면 타일맵 + 건물 + 소품 + 도로 그래프 + 스폰 + 구역 + Wash Point
├─ vehicles.json         # 차종 파라미터
└─ missions/
   ├─ index.json         # 로드할 미션 파일 목록
   └─ *.json             # 미션 정의(트리거·목표·보상·실패 조건)
```

### 도시 다시 만들기

```bash
npm run gen
```

`tools/gen-city.js` 의 파라미터(맵 크기, 도로 간격, 강 위치, 구역 bounds, 테마별 밀도)를 고치고
다시 실행하면 새 도시가 나옵니다. 게임 코드는 손대지 않습니다.

- 512 × 512 타일 / 1타일 = 32px = 20m → 약 10km × 10km (판교역 기준 반경 5km)
- 구역: Station Core · Techno Valley · Baekhyeon · Sampyeong · Unjung Hills · Seohyeon Connector
- 탄천 모티프의 하천이 도시를 가로지르고 **대로만 다리로** 건널 수 있습니다(도로 그래프도 자동 반영).

### 미션 추가

`assets/data/missions/` 에 JSON 을 넣고 `index.json` 에 파일명만 추가하면 끝입니다.

```jsonc
{
  "id": "my-mission",
  "name": "새 미션",
  "trigger": { "type": "location", "pos": [252, 246], "radius": 3 },  // 타일 좌표
  "objectives": [
    { "type": "getInVehicle", "vehicleTypes": ["scooter", "moto"] },
    { "type": "reach", "pos": [144, 144], "radius": 4, "timeLimit": 100 },
    { "type": "collect", "points": [[288, 312], [264, 372]], "radius": 4 },
    { "type": "survive", "duration": 35, "minStars": 2, "grantStars": 2 },
    { "type": "evade", "untilStars": 0 }
  ],
  "reward": { "score": 500, "cash": 1000 },
  "fail": { "onTimeout": true, "onVehicleDestroyed": true, "onBusted": true }
}
```

좌표는 타일 단위로 대충 찍어도 됩니다 — 기본값 `snap: "road"` 로 가장 가까운 도로 노드에 붙습니다.
(`snap: "none"` 으로 정확한 위치 지정 가능)

## 구조

```
src/
├─ main.js               # 부트스트랩 + 게임 씬(업데이트/렌더/이벤트)
├─ core/                 # loop(고정 타임스텝) · camera(look-ahead) · input · audio · storage
├─ map/                  # mapLoader(JSON→충돌격자) · tileRenderer(컬링/청크) · roadGraph(A*)
├─ entities/             # player · vehicle · traffic · police
├─ systems/              # collision · wanted · mission
└─ ui/                   # hud(DOM) · minimap(1타일=1px 베이크)
```

- 게임 루프는 60Hz 고정 타임스텝 + 가변 렌더(accumulator)로, 프레임이 흔들려도 물리는 일정합니다.
- 렌더는 뷰포트 컬링 + 건물/소품 청크 색인으로 화면 밖을 건너뜁니다. `devicePixelRatio` 는 2로 상한.
- 오디오는 전부 Web Audio 합성이라 음원 파일이 없습니다(라이선스 이슈 없음).

## 기술 선택 메모

프롬프트 초안은 TypeScript + Vite + PixiJS 였지만, 이 레포의 다른 프로토와 동일하게
**빌드 없는 Vanilla JS + Canvas 2D**로 구현했습니다.

- Vercel 정적 배포에서 빌드 설정/경로 함정 없이 그대로 뜬다(레포 내 다른 프로토와 동일한 배포 경로).
- 이 규모(화면당 스프라이트 수백 개)에서는 Canvas 2D 로도 60fps 가 넉넉하다 — 실측 로직 0.6ms/프레임.
- 대신 프롬프트의 핵심 요구(데이터 주도 맵, 입력 추상화, 모듈 경계, 고정 타임스텝)는 그대로 지켰습니다.

## 배포

Vercel: 프레임워크 **Other**, Root Directory `proto-14-pangyo`, 빌드 명령 없음.
