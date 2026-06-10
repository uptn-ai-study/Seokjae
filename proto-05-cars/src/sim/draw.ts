// ============================================================================
// 렌더링 — 80년대 SEGA "Out Run" 룩 (석양빛 하늘 + 줄무늬 태양 +
// 우측 바다 / 좌측 야자수 해안도로 + 빨간 오픈카 뒷모습)
// ============================================================================
import {
  CAMERA_DEPTH, CAMERA_HEIGHT, DRAW_DIST, PLAYER_Z, ROAD_W, RUMBLE_LEN, SEG,
  project, type Bubble, type Game, type ObstacleKind, type Scenery, type Segment,
} from './game'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 색 팔레트 ───────────────────────────────────────────────────────────────────
const C = {
  roadA: '#5d5e6c',
  roadB: '#565764',
  rumbleA: '#e23b4e',
  rumbleB: '#f4f1ec',
  laneA: '#f4f1ec',
  landA: '#3aa14a',
  landB2: '#329040',
  seaA: '#2f93d6',
  seaB: '#2784cb',
  sand: '#e8d29a',
}

function poly(
  ctx: CanvasRenderingContext2D, color: string,
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

// ── 배경: 석양 하늘 + 줄무늬 태양 + 먼 수평선 ─────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h / 2

  // 하늘 그라데이션 (위 보라 → 분홍 → 수평선 골드)
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#2a1a5e')
  sky.addColorStop(0.45, '#7b3aa0')
  sky.addColorStop(0.74, '#ff7a6b')
  sky.addColorStop(1, '#ffd36b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)

  // 줄무늬 태양 (신스웨이브 시그니처)
  const cx = w * 0.5
  const sunR = Math.min(w, h) * 0.2
  const cy = horizon - sunR * 0.18
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2)
  ctx.clip()
  const sun = ctx.createLinearGradient(0, cy - sunR, 0, cy + sunR)
  sun.addColorStop(0, '#fff1a8')
  sun.addColorStop(0.5, '#ffcf4d')
  sun.addColorStop(1, '#ff5e8a')
  ctx.fillStyle = sun
  ctx.fillRect(cx - sunR, cy - sunR, sunR * 2, sunR * 2)
  // 하단 절반 가로 줄무늬(점점 두껍게)
  ctx.fillStyle = sky as unknown as string
  for (let k = 0; k < 7; k++) {
    const yy = cy + (k * k) * (sunR / 46)
    const th = 2 + k * 1.4
    ctx.fillStyle = '#7b3aa0'
    ctx.globalAlpha = 0.9
    ctx.fillRect(cx - sunR, yy, sunR * 2, th)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // 먼 바다 수평선 띠(우측이 살짝 더 밝게 반짝)
  const seaBand = ctx.createLinearGradient(0, horizon - 6, 0, horizon + 10)
  seaBand.addColorStop(0, 'rgba(255,210,120,0.55)')
  seaBand.addColorStop(1, 'rgba(40,130,200,0.0)')
  ctx.fillStyle = seaBand
  ctx.fillRect(0, horizon - 6, w, 16)

  // 좌측 먼 산 실루엣 (육지)
  ctx.fillStyle = 'rgba(60,40,90,0.45)'
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  const baseY = horizon
  for (let x = 0; x <= w * 0.5; x += w * 0.08) {
    const hh = (Math.sin(x * 0.01 + 1.3) * 0.5 + 0.5) * h * 0.12
    ctx.lineTo(x, baseY - hh)
  }
  ctx.lineTo(w * 0.5, horizon)
  ctx.closePath()
  ctx.fill()

  // 수평선 아래 폴백 지면(틈 방지): 좌 육지 / 우 바다
  ctx.fillStyle = C.landA
  ctx.fillRect(0, horizon, w * 0.5, h - horizon)
  ctx.fillStyle = C.seaA
  ctx.fillRect(w * 0.5, horizon, w * 0.5, h - horizon)

  void t
}

// ── 도로 한 스트립 (육지/바다/갓길/아스팔트/차선) ────────────────────────────
function drawSegment(ctx: CanvasRenderingContext2D, s: Segment, w: number) {
  const { p1, p2 } = s
  const grp = Math.floor(s.index / RUMBLE_LEN) % 2 === 0

  const land = grp ? C.landA : C.landB2
  const sea = grp ? C.seaA : C.seaB
  const road = grp ? C.roadA : C.roadB
  const rumble = grp ? C.rumbleA : C.rumbleB

  const y1 = p1.scrY, y2 = p2.scrY
  const x1 = p1.scrX, x2 = p2.scrX
  const w1 = p1.scrW, w2 = p2.scrW

  // 좌측 육지: 화면 왼쪽 ~ 도로 왼쪽 가장자리
  poly(ctx, land, 0, y1, x1 - w1, y1, x2 - w2, y2, 0, y2)
  // 우측 바다: 도로 오른쪽 가장자리 ~ 화면 오른쪽
  poly(ctx, sea, x1 + w1, y1, w, y1, w, y2, x2 + w2, y2)

  // 도로 옆 모래톱(도로 바로 바깥쪽 얇게)
  const sb1 = w1 * 0.22, sb2 = w2 * 0.22
  poly(ctx, C.sand, x1 - w1 - sb1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - sb2, y2)
  poly(ctx, C.sand, x1 + w1, y1, x1 + w1 + sb1, y1, x2 + w2 + sb2, y2, x2 + w2, y2)

  // 갓길 줄무늬(빨강/흰색)
  const r1 = w1 * 0.13, r2 = w2 * 0.13
  poly(ctx, rumble, x1 - w1, y1, x1 - w1 + r1, y1, x2 - w2 + r2, y2, x2 - w2, y2)
  poly(ctx, rumble, x1 + w1 - r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 - r2, y2)

  // 아스팔트
  poly(ctx, road, x1 - w1 + r1, y1, x1 + w1 - r1, y1, x2 + w2 - r2, y2, x2 - w2 + r2, y2)

  // 중앙 차선(밝은 그룹에만 → 점선 효과)
  if (grp) {
    const l1 = w1 * 0.04, l2 = w2 * 0.04
    poly(ctx, C.laneA, x1 - l1, y1, x1 + l1, y1, x2 + l2, y2, x2 - l2, y2)
  }
}

// ── 장애물(생명체/바위) ─────────────────────────────────────────────────────
function drawObstacle(
  ctx: CanvasRenderingContext2D, kind: ObstacleKind,
  cx: number, baseY: number, roadW: number,
) {
  const sz = roadW * 0.34
  if (sz < 3 || sz > 800) return
  ctx.save()
  ctx.translate(cx, baseY)
  // 바닥 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.5, sz * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  drawCreature(ctx, kind, sz)
  ctx.restore()
}

// 개체 모양만 그린다(발끝이 원점, 그림자 없음) — 도로 위와 비눗방울 안에서 공용
function drawCreature(ctx: CanvasRenderingContext2D, kind: ObstacleKind, sz: number) {
  ctx.save()
  if (kind === 'duck') {
    const b = sz * 0.5
    // 몸통
    ctx.fillStyle = '#f7d038'
    ctx.beginPath()
    ctx.ellipse(0, -b * 0.55, b * 0.62, b * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    // 머리
    ctx.beginPath()
    ctx.arc(b * 0.45, -b * 1.05, b * 0.34, 0, Math.PI * 2)
    ctx.fill()
    // 부리
    ctx.fillStyle = '#f0892b'
    ctx.beginPath()
    ctx.moveTo(b * 0.72, -b * 1.05)
    ctx.lineTo(b * 1.15, -b * 0.96)
    ctx.lineTo(b * 0.72, -b * 0.86)
    ctx.closePath()
    ctx.fill()
    // 눈
    ctx.fillStyle = '#2a2433'
    ctx.beginPath()
    ctx.arc(b * 0.5, -b * 1.12, b * 0.06, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'deer') {
    const b = sz * 0.62
    ctx.strokeStyle = '#7a4a28'
    ctx.fillStyle = '#a9683a'
    // 다리
    ctx.lineWidth = Math.max(1, b * 0.1)
    ctx.beginPath()
    ctx.moveTo(-b * 0.3, 0); ctx.lineTo(-b * 0.3, -b * 0.5)
    ctx.moveTo(b * 0.3, 0); ctx.lineTo(b * 0.3, -b * 0.5)
    ctx.stroke()
    // 몸통
    ctx.beginPath()
    ctx.ellipse(0, -b * 0.7, b * 0.5, b * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
    // 목/머리
    ctx.beginPath()
    ctx.ellipse(b * 0.42, -b * 1.12, b * 0.2, b * 0.26, -0.5, 0, Math.PI * 2)
    ctx.fill()
    // 귀
    ctx.beginPath()
    ctx.moveTo(b * 0.5, -b * 1.35)
    ctx.lineTo(b * 0.62, -b * 1.6)
    ctx.lineTo(b * 0.66, -b * 1.32)
    ctx.closePath()
    ctx.fill()
  } else {
    // 바위
    const b = sz * 0.48
    ctx.fillStyle = '#8a8f99'
    ctx.beginPath()
    ctx.moveTo(-b, 0)
    ctx.lineTo(-b * 0.7, -b * 0.8)
    ctx.lineTo(-b * 0.1, -b * 1.05)
    ctx.lineTo(b * 0.6, -b * 0.85)
    ctx.lineTo(b, -b * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.moveTo(-b * 0.1, -b * 1.05)
    ctx.lineTo(b * 0.6, -b * 0.85)
    ctx.lineTo(b * 0.2, -b * 0.55)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// ── 풍경 ─────────────────────────────────────────────────────────────────────
function drawScenery(
  ctx: CanvasRenderingContext2D, sc: Scenery,
  cx: number, baseY: number, roadW: number,
) {
  const sz = roadW
  if (sz < 2 || sz > 4000) return
  ctx.save()
  ctx.translate(cx, baseY)

  if (sc.kind === 'cherry') {
    // 벚꽃나무 — 갈색 줄기 + 분홍 벚꽃 덩어리
    const hgt = sz * 0.8
    ctx.strokeStyle = '#6e4a32'
    ctx.lineWidth = Math.max(1.5, sz * 0.09)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-sz * 0.02, -hgt * 0.62)
    ctx.stroke()
    // 잔가지
    ctx.lineWidth = Math.max(1, sz * 0.05)
    ctx.beginPath()
    ctx.moveTo(-sz * 0.02, -hgt * 0.5)
    ctx.lineTo(-sz * 0.28, -hgt * 0.78)
    ctx.moveTo(-sz * 0.02, -hgt * 0.55)
    ctx.lineTo(sz * 0.26, -hgt * 0.82)
    ctx.stroke()
    // 벚꽃 수관(분홍 덩어리들)
    const blossom = ['#ffd1e8', '#ffb3d9', '#ff9ecb']
    const puffs: [number, number, number][] = [
      [-sz * 0.26, -hgt * 0.9, 0.3],
      [sz * 0.24, -hgt * 0.92, 0.3],
      [-sz * 0.02, -hgt * 1.05, 0.4],
      [-sz * 0.3, -hgt * 1.05, 0.26],
      [sz * 0.3, -hgt * 1.04, 0.26],
      [0, -hgt * 0.8, 0.34],
    ]
    for (let i = 0; i < puffs.length; i++) {
      const [bx, by, br] = puffs[i]
      ctx.fillStyle = blossom[i % blossom.length]
      ctx.beginPath()
      ctx.arc(bx, by, sz * br, 0, Math.PI * 2)
      ctx.fill()
    }
    // 떨어지는 꽃잎 한두 점
    ctx.fillStyle = '#ffc2dd'
    ctx.beginPath()
    ctx.arc(sz * 0.1, -hgt * 0.55, sz * 0.04, 0, Math.PI * 2)
    ctx.arc(-sz * 0.16, -hgt * 0.4, sz * 0.035, 0, Math.PI * 2)
    ctx.fill()
  } else if (sc.kind === 'lighthouse') {
    const hgt = sz * 1.4
    ctx.fillStyle = '#f4f1ec'
    ctx.beginPath()
    ctx.moveTo(-sz * 0.16, 0)
    ctx.lineTo(-sz * 0.1, -hgt)
    ctx.lineTo(sz * 0.1, -hgt)
    ctx.lineTo(sz * 0.16, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e23b4e'
    ctx.fillRect(-sz * 0.13, -hgt * 0.66, sz * 0.26, hgt * 0.16)
    ctx.fillRect(-sz * 0.11, -hgt * 0.33, sz * 0.22, hgt * 0.13)
    ctx.fillStyle = '#ffd36b'
    ctx.fillRect(-sz * 0.1, -hgt, sz * 0.2, hgt * 0.12)
  } else if (sc.kind === 'cliff') {
    const hgt = sz * 0.7
    ctx.fillStyle = '#5a4633'
    ctx.beginPath()
    ctx.moveTo(-sz * 0.5, 0)
    ctx.lineTo(-sz * 0.3, -hgt)
    ctx.lineTo(sz * 0.1, -hgt * 0.8)
    ctx.lineTo(sz * 0.5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#3aa14a'
    ctx.beginPath()
    ctx.ellipse(-sz * 0.1, -hgt, sz * 0.4, sz * 0.16, 0, Math.PI, 0)
    ctx.fill()
  } else if (sc.kind === 'sail') {
    const hgt = sz * 0.5
    ctx.fillStyle = '#f4f1ec'
    ctx.beginPath()
    ctx.moveTo(0, -hgt)
    ctx.lineTo(0, 0)
    ctx.lineTo(sz * 0.28, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e23b4e'
    ctx.beginPath()
    ctx.moveTo(0, -hgt)
    ctx.lineTo(0, -hgt * 0.4)
    ctx.lineTo(-sz * 0.22, -hgt * 0.4)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#3a3340'
    ctx.fillRect(-sz * 0.26, -0.02 * sz, sz * 0.55, sz * 0.07)
  } else if (sc.kind === 'buoy') {
    ctx.fillStyle = '#e23b4e'
    ctx.beginPath()
    ctx.arc(0, -sz * 0.12, sz * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f4f1ec'
    ctx.fillRect(-sz * 0.13, -sz * 0.14, sz * 0.26, sz * 0.05)
  }
  ctx.restore()
}

// ── 빨간 오픈카 뒷모습 + 두 사람 ─────────────────────────────────────────────
function drawCar(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, t: number) {
  const cw = Math.min(w * 0.30, 360)
  const ch = cw * 0.62
  const bob = Math.sin(t * 0.012) * cw * 0.012 + (g.speed > 0 ? Math.sin(t * 0.05) * cw * 0.006 : 0)
  const cx = w * 0.5 + g.steer * w * 0.012 + g.lean * cw * 0.02
  const cy = h * 0.88 + bob
  const tilt = g.lean * 0.05

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(tilt)

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.ellipse(0, ch * 0.16, cw * 0.56, ch * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()

  // 뒷바퀴
  ctx.fillStyle = '#15151a'
  rr(ctx, -cw * 0.52, -ch * 0.1, cw * 0.16, ch * 0.34, 4)
  rr(ctx, cw * 0.36, -ch * 0.1, cw * 0.16, ch * 0.34, 4)

  // 차체 하단(범퍼/디퓨저)
  ctx.fillStyle = '#b81f2d'
  rr(ctx, -cw * 0.5, -ch * 0.18, cw, ch * 0.4, 10)

  // 차체 메인(빨강)
  const body = ctx.createLinearGradient(0, -ch * 0.7, 0, 0)
  body.addColorStop(0, '#ff5a5f')
  body.addColorStop(0.5, '#e8242f')
  body.addColorStop(1, '#b81f2d')
  ctx.fillStyle = body
  rr(ctx, -cw * 0.46, -ch * 0.62, cw * 0.92, ch * 0.62, 14)

  // 오픈탑 콕핏(안쪽 어둡게)
  ctx.fillStyle = '#3a2226'
  rr(ctx, -cw * 0.34, -ch * 0.6, cw * 0.68, ch * 0.34, 10)

  // 좌석 두 개
  ctx.fillStyle = '#2a1a1e'
  rr(ctx, -cw * 0.3, -ch * 0.62, cw * 0.26, ch * 0.3, 6)
  rr(ctx, cw * 0.04, -ch * 0.62, cw * 0.26, ch * 0.3, 6)

  // 운전자(좌) — 머리 + 흩날리는 머리카락
  drawHead(ctx, -cw * 0.17, -ch * 0.7, cw * 0.12, '#caa15a', '#7a4a28', t, -1)
  // 연인(우) — 긴 머리
  drawHead(ctx, cw * 0.17, -ch * 0.7, cw * 0.12, '#e8c89a', '#3a2a20', t, 1)

  // 트렁크 라인 + 브레이크등
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  rr(ctx, -cw * 0.44, -ch * 0.24, cw * 0.88, ch * 0.03, 2)
  const brake = g.steer !== 0 || g.shake > 0
  ctx.fillStyle = brake ? '#ff3b3b' : '#9a2630'
  ctx.shadowColor = brake ? 'rgba(255,60,60,0.8)' : 'transparent'
  ctx.shadowBlur = brake ? 14 : 0
  rr(ctx, -cw * 0.46, -ch * 0.14, cw * 0.16, ch * 0.1, 3)
  rr(ctx, cw * 0.3, -ch * 0.14, cw * 0.16, ch * 0.1, 3)
  ctx.shadowBlur = 0

  // 번호판
  ctx.fillStyle = '#ffd36b'
  rr(ctx, -cw * 0.12, -ch * 0.13, cw * 0.24, ch * 0.1, 3)

  ctx.restore()
}

function drawHead(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  skin: string, hair: string, t: number, dir: number,
) {
  ctx.save()
  ctx.translate(x, y)
  // 흩날리는 머리카락
  ctx.fillStyle = hair
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.2)
  const flow = Math.sin(t * 0.02 + (dir > 0 ? 1 : 0)) * r * 0.4
  ctx.quadraticCurveTo(-dir * r * 1.6, -r * 0.9 + flow, -dir * r * 2.4, r * 0.2 + flow)
  ctx.quadraticCurveTo(-dir * r * 1.4, -r * 0.2, 0, r * 0.5)
  ctx.closePath()
  ctx.fill()
  // 머리
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // 머리 윗부분 머리카락
  ctx.fillStyle = hair
  ctx.beginPath()
  ctx.arc(0, -r * 0.2, r * 0.95, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 둥근 사각형
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
  ctx.fill()
}

// ── 비눗방울 구조 연출 ───────────────────────────────────────────────────────
function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, w: number, h: number) {
  const px = b.x * w
  const py = b.y * h
  const r = b.r * Math.min(w, h)
  const fade = Math.min(1, b.life / b.maxLife + 0.15)
  ctx.save()
  ctx.globalAlpha = fade
  // 안에 든 생명체 — 도로 위와 동일한 그림(발끝이 방울 중앙 아래쪽)
  ctx.save()
  ctx.translate(px, py + r * 0.5)
  drawCreature(ctx, b.kind, r * 1.15)
  ctx.restore()
  // 비누막
  const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r)
  g.addColorStop(0, 'rgba(255,255,255,0.05)')
  g.addColorStop(0.7, 'rgba(180,230,255,0.10)')
  g.addColorStop(0.92, 'rgba(255,200,240,0.5)')
  g.addColorStop(1, 'rgba(160,220,255,0.65)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.fill()
  // 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(px - r * 0.35, py - r * 0.4, r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── 전체 장면 렌더 ───────────────────────────────────────────────────────────
export function renderScene(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number, t: number) {
  ctx.save()
  if (g.shake > 0) {
    const s = g.shake * 7
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }

  drawBackground(ctx, w, h, t)

  const base = Math.floor(g.position / SEG)
  const basePercent = (g.position % SEG) / SEG
  const playerSegI = Math.floor((g.position + PLAYER_Z) / SEG)
  const pseg = g.segmentAt(playerSegI)
  const pPercent = ((g.position + PLAYER_Z) % SEG) / SEG
  const playerY = lerp(pseg.p1.worldY, pseg.p2.worldY, pPercent)
  const camY = playerY + CAMERA_HEIGHT

  let x = 0
  let dx = -(g.segmentAt(base).curve * basePercent)
  let maxY = h
  const drawn: Segment[] = []

  // 1) 도로 패스 (가까운→먼)
  for (let n = 0; n < DRAW_DIST; n++) {
    const s = g.segmentAt(base + n)
    project(s.p1, g.playerX * ROAD_W - x, camY, g.position, CAMERA_DEPTH, w, h, ROAD_W)
    project(s.p2, g.playerX * ROAD_W - x - dx, camY, g.position, CAMERA_DEPTH, w, h, ROAD_W)
    x += dx
    dx += s.curve

    if (s.p1.camZ <= CAMERA_DEPTH || s.p2.scrY >= maxY || s.p2.scrY >= s.p1.scrY) continue
    drawSegment(ctx, s, w)
    maxY = s.p2.scrY
    drawn.push(s)
  }

  // 2) 스프라이트 패스 (먼→가까운)
  for (let k = drawn.length - 1; k >= 0; k--) {
    const s = drawn[k]
    const sx = s.p1.scrX
    const sw = s.p1.scrW
    for (const sc of s.scenery) {
      drawScenery(ctx, sc, sx + sc.offset * sw, s.p1.scrY, sw)
    }
    for (const o of s.obstacles) {
      if (o.rescued) continue
      drawObstacle(ctx, o.kind, sx + o.offset * sw, s.p1.scrY, sw)
    }
  }

  // 3) 차 + 비눗방울
  drawCar(ctx, w, h, g, t)
  for (const b of g.bubbles) drawBubble(ctx, b, w, h)

  ctx.restore()
}
