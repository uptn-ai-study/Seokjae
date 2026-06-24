# 🗺️ 지도와 함께하는 OK캐쉬백

사용자 현재 위치를 중심으로 OK캐쉬백 제휴사 POI를 지도에 표시하고, 진행 중인 이벤트를 풍선 마커로 안내하는 서비스 프로토타입입니다.

## 파일 구조

```
proto-10-okcashbag-map/
├── index.html          # 사용자 지도 화면
├── admin.html          # 운영 관리 화면
├── data/
│   ├── partners.json   # 제휴사 마스터 데이터
│   └── events.json     # 추가 혜택 이벤트 데이터
└── README.md
```

## 카카오맵 API 키 발급 방법

1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속 → 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
3. 앱 이름 입력 후 생성
4. **앱 키** 탭 → **JavaScript 키** 복사
5. `index.html` 상단 스크립트 태그의 `YOUR_KAKAO_APP_KEY` 부분을 복사한 키로 교체

```html
<!-- 변경 전 -->
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KAKAO_APP_KEY&libraries=services"></script>

<!-- 변경 후 -->
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=발급받은키입력&libraries=services"></script>
```

6. 카카오 개발자 콘솔 → **플랫폼** → **Web** → 사이트 도메인 등록 (Vercel URL 또는 `http://localhost`)

> API 키 없이도 **미리보기 모드(Mock Mode)** 로 UI 확인 가능합니다.

## 운영 관리 (admin.html)

- 제휴사/이벤트 추가·편집·삭제 가능
- **JSON 저장** 버튼으로 수정된 데이터를 로컬에 다운로드
- 다운로드된 파일을 `data/` 폴더에 덮어쓴 뒤 재배포

## Vercel 배포

1. `uptn-ai-study/본인이름` 레포에 push
2. Vercel → Add New Project → 같은 레포 import
3. Root Directory: `proto-10-okcashbag-map`
4. Deploy

---

| 폴더명 | 서비스 이름 | Vercel URL | 상태 |
|---|---|---|---|
| proto-10-okcashbag-map | 지도와 함께하는 OK캐쉬백 | https://ocbmaptest.vercel.app | ✅ 완성 |
