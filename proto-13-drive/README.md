# 서울 드라이브 — 오픈월드 미니 자동차 주행 시뮬레이터

실제 서울 도심(시청·종로·을지로 일대) OpenStreetMap 도로 데이터를 기반으로 한
**탑뷰 자유주행 샌드박스**. 승패 목표 없이 도로를 따라 자유롭게 탐험하는 것 자체가 재미.

Vanilla JS + Canvas 2D · 빌드 도구 없음 · **완전 오프라인 구동**(로컬 `graph.json`만 사용)

---

## 빠른 시작

```bash
cd proto-13-drive

# (선택) 도로 데이터 다시 받기 — assets/graph.json 은 이미 포함되어 있음
npm run data          # = fetch-osm.js → build-graph.js

# 로컬 서버로 실행 (ES 모듈 + fetch 때문에 file:// 로는 열리지 않음)
npm run dev           # → http://localhost:5173
```

> `npx serve`, `python -m http.server`, VS Code Live Server 무엇이든 정적 서버면 됩니다.

---

## 조작법

| | PC | 모바일 |
|---|---|---|
| 가속 | `W` / `↑` | 우측 하단 **GO** |
| 감속·후진 | `S` / `↓` | **STOP** (정지 후 계속 누르면 후진) |
| 조향 | `A` `D` / `←` `→` | 좌측 하단 **◀ ▶** |
| 브레이크 | `Space` | **STOP** |
| 줌 | `+` `-` | 우측 `＋` `－` |
| 조작법 | `H` | `?` |
| 랜덤 목적지 | `R` | 🎲 |
| 목적지 지정 | 📍 켜고 지도 클릭 | 📍 켜고 지도 탭 |

터치 입력이 감지되면 하단 가상 컨트롤이 자동으로 나타나고, 키보드를 누르면 다시 PC 모드로 돌아갑니다.

---

## 데이터 파이프라인

```
Overpass ──▶ data/seoul-roads.geojson ──▶ assets/graph.json  (노드 8.4k / 엣지 3.3k, 450KB)
         └─▶ data/seoul-areas.geojson ──▶ assets/areas.json  (폴리곤 3.5k, 403KB)
```

`npm run data` 하나로 네 스크립트가 순서대로 실행됩니다. 결과물은 레포에 포함되어 있어
받아둔 상태 그대로 오프라인 구동됩니다.

### 1) 도로 추출 — `scripts/fetch-osm.js`

`data/overpass-query.txt` 의 쿼리를 그대로 POST 합니다.

```
[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]
     ["area"!~"yes"]
     (around:2000,37.5665,126.9780);
);
out body geom;
```

`highway`, `name`, `oneway`, `lanes`, `maxspeed`, `junction` 태그를 보존해 GeoJSON LineString으로 저장합니다.
다른 지역으로 바꾸려면 쿼리의 `around:` 좌표와 `build-graph.js` 의 `CENTER` 를 같이 수정하세요.

### 2) 도로 전처리 — `scripts/build-graph.js`

- 위경도 → 중심 기준 로컬 평면(미터) 투영 (equirectangular 근사)
- OSM node id + 3m 그리드 스냅으로 **교차점 병합**
- way를 교차점 기준으로 잘라 **노드-엣지 그래프** 생성 (중간 형상점을 남겨 곡선 유지)
- `oneway=yes/-1`, `junction=roundabout` 방향 반영
- 4m 미만 자투리 제거 + **최대 연결요소만** 남겨 고립 구간 제거

출력 `assets/graph.json`

```jsonc
{
  "meta": { "center": {...}, "bounds": {...}, "roadClasses": { "primary": { "w": 14, "speed": 70, "rank": 2 } } },
  "nodes": [[x, y], ...],                       // 미터, 중심 기준
  "edges": [{ "a": 0, "b": 12, "c": "primary", "len": 83.2,
              "lanes": 4, "sp": 70, "ow": 1, "n": "세종대로", "g": [3, 4] }]
}
```

### 3) 건물·공원 추출/전처리 — `scripts/fetch-areas.js` → `scripts/build-areas.js`

`data/overpass-query-areas.txt` 로 건물·공원·물·광장 폴리곤 14,414개를 받아온 뒤,

- 면적 계산 후 220㎡ 미만 무명 건물 제거 (이름 있는 건물은 크기와 무관하게 보존)
- **Douglas-Peucker 1.6m 단순화** + 좌표 0.1m 반올림 → 4.27MB 원본이 **403KB** 로
- 종류 분류: `0` 일반건물 `1` 주요건물 `2` 녹지 `3` 물 `4` 광장
  주요건물 = 2,200㎡ 이상이거나, 이름이 있으면서 랜드마크 태그(`historic`, `tourism`,
  `building=civic|palace|train_station…`)를 가진 것 → **지도에 이름 라벨 표시**

결과: 건물 2,533 · 주요건물 505 · 녹지 466 · 물 6 · 광장 20

> `assets/areas.json` 이 없어도 게임은 정상 동작합니다(건물 없이 렌더).

---

## 코드 구조

```
data/overpass-query.txt        도로 Overpass 쿼리
data/overpass-query-areas.txt  건물/공원/물 Overpass 쿼리
scripts/fetch-osm.js           Overpass → 도로 GeoJSON
scripts/build-graph.js         GeoJSON → graph.json
scripts/fetch-areas.js         Overpass → 면 피처 GeoJSON
scripts/build-areas.js         GeoJSON → areas.json (단순화·분류)
assets/graph.json              게임이 로드하는 도로 그래프
assets/areas.json              건물/공원/물/광장 폴리곤
src/
  main.js         부트스트랩 · 고정 타임스텝(1/60) 게임 루프 · 루트 상태 관리
  geo.js          투영/각도/선분 기하 유틸
  graph.js        graph.json 로드, 인접 리스트, 100m 격자 공간 인덱스, 최근접 도로 탐색
  pathfinding.js  A* (비용 = 거리/제한속도), 폴리라인 거리(오프루트 판정)
  camera.js       월드↔화면 변환, 부드러운 팔로우, 줌 9단계(1.2~19 px/m)
  areas.js        건물/공원 폴리곤 로드 + 200m 격자 인덱스
  player.js       아케이드 반물리(최고 250km/h) + 유연한 도로 스냅
  traffic.js      AI 트래픽 (IDM 차간 유지, 교차로 양보, 컬링/재활용)
  render.js       레이어 렌더링(면 → 도로 → 라벨 → 루트 → 차량) + 미니맵
  ui.js           팀 UI 규약 기반 오버레이 (HUD/루트 카드/바텀시트/토스트)
index.html        레이아웃 + CSS (UI-COMMON.md 토큰)
```

### 설계 메모

- **도로 스냅은 레일이 아니다.** 도로 폭 안에서는 완전 자유, 연석을 넘으면 접지력이 떨어지고
  도로 쪽으로 부드럽게 되밀립니다. 덕분에 교차로에서 조향 입력대로 원하는 길에 들어갑니다.
- **속도와 회전반경의 트레이드오프.** 최고속 250km/h, 0→100 약 3.4초, 250→0 풀브레이크 3.2초.
  조향은 각속도가 아니라 **횡가속 상한(14m/s²)** 으로 제한해서 빠를수록 회전반경이 커집니다
  (54km/h ≈ 16m, 144km/h ≈ 114m, 250km/h ≈ 343m). 코너 앞에선 반드시 감속해야 합니다.
  조향 입력이 없을 때만 아주 약한 차선 정렬 보조가 들어가 직선 고속 주행이 가능합니다
  — 입력이 들어오면 즉시 해제되므로 레일처럼 느껴지지 않습니다.
- **줌 9단계.** 1.2px/m(도심 전경) ~ 19px/m(차량 클로즈업). 줌아웃 시엔 플레이어 헤일로와
  건물 면적 필터가, 줌인 시엔 차선 파선·바퀴·건물 이름 라벨이 켜집니다.
- **AI 트래픽은 레일 주행.** 엣지 위 진행거리 `s` + 차로 오프셋으로 표현하고,
  앞차와의 간격은 IDM(Intelligent Driver Model) 근사, 교차로는 선착순 점유로 양보합니다.
  플레이어도 전방 원뿔 안에 들어오면 앞차로 취급되어 AI가 감속합니다.
- **컬링.** 700m 밖 차량은 업데이트를 멈추고, 950m 밖은 플레이어 전방에 재배치해
  주변 교통량을 일정하게 유지합니다. 도로는 격자 인덱스로 뷰포트 컬링합니다.
- **경로는 강제하지 않는다.** 45m 이상 벗어나면 이탈을 알리고 조용히 재계산할 뿐,
  주행을 막지 않습니다. 목적지 28m 이내 진입 시 도착 처리.

측정(1280×800 · 활성 차량 ~150대): 프레임 렌더 **최대 2.8ms**(최소 줌) / 1.0ms(최대 줌),
트래픽 업데이트 0.38ms → 60fps 대비 충분한 여유.

---

## 팀 규약

- UI: `team-rules/UI-COMMON.md` — Primary `#5F46FF`, 카드 radius 16 + Level1 그림자,
  바텀시트 radius 24 슬라이드업, hover 미사용(`:active`만), SUIT Variable 폰트
- 배포: Vercel — Root Directory `proto-13-drive`, **Framework Preset: Other**, 빌드 명령 없음(정적)

> ⚠️ 데이터 폴더 이름이 `public` 이 아니라 `assets` 인 이유
> Vercel은 빌드 없는 프로젝트에서 `public/` 이 있으면 **그 폴더를 사이트 루트로** 서빙합니다.
> 그러면 `index.html` 과 `src/` 가 배포에서 빠져 루트가 404가 됩니다.
> 폴더명을 `assets` 로 두면 프로젝트 루트가 그대로 서빙되어 정상 동작합니다.

## 데이터 출처

© OpenStreetMap contributors — [ODbL](https://www.openstreetmap.org/copyright)
