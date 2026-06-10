// 화이트보드 마커 손그림 렌더링 유틸 + 그리기 함수들
import type { Ant, Obstacle, Ripple } from './colony'

type Ctx = CanvasRenderingContext2D

const INK = '#3a3730'
const SAND = '#f3ead4'
const SAND_LINE = 'rgba(150,128,86,0.16)'

// 안정적인 손떨림을 위한 시드 난수
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 살짝 떨리는 직선 (마커 느낌)
function roughLine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: () => number,
  amp = 1.1,
) {
  const mx = (x1 + x2) / 2 + (rng() - 0.5) * amp * 2.4
  const my = (y1 + y2) / 2 + (rng() - 0.5) * amp * 2.4
  ctx.beginPath()
  ctx.moveTo(x1 + (rng() - 0.5) * amp, y1 + (rng() - 0.5) * amp)
  ctx.quadraticCurveTo(mx, my, x2 + (rng() - 0.5) * amp, y2 + (rng() - 0.5) * amp)
  ctx.stroke()
}

// 떨리는 닫힌 타원/원
function roughEllipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: () => number,
  amp = 1.1,
) {
  const steps = 11
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const ang = (i / steps) * Math.PI * 2
    const rr = 1 + (rng() - 0.5) * 0.05
    const x = cx + Math.cos(ang) * rx * rr + (rng() - 0.5) * amp
    const y = cy + Math.sin(ang) * ry * rr + (rng() - 0.5) * amp
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function roughRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  rng: () => number,
  amp = 1.4,
) {
  roughLine(ctx, x, y, x + w, y, rng, amp)
  roughLine(ctx, x + w, y, x + w, y + h, rng, amp)
  roughLine(ctx, x + w, y + h, x, y + h, rng, amp)
  roughLine(ctx, x, y + h, x, y, rng, amp)
}

// ── 정적 무대(샌드박스) — 오프스크린에 한 번만 ──
export function buildScene(ctx: Ctx, side: number, obstacles: Obstacle[]) {
  const rng = mulberry32(20260610)
  ctx.clearRect(0, 0, side, side)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const pad = 8
  // 모래 바탕
  ctx.save()
  ctx.beginPath()
  roughRect(ctx, pad, pad, side - pad * 2, side - pad * 2, rng, 0.6)
  ctx.fillStyle = SAND
  ctx.fill()
  ctx.clip()

  // 갈퀴질한 잔잔한 물결 (Zen)
  ctx.strokeStyle = SAND_LINE
  ctx.lineWidth = 1.4
  const gap = side / 16
  for (let yy = pad + gap; yy < side - pad; yy += gap) {
    ctx.beginPath()
    for (let xx = pad; xx <= side - pad; xx += 10) {
      const wy = yy + Math.sin(xx / 26 + yy / 40) * 3.2
      if (xx === pad) ctx.moveTo(xx, wy)
      else ctx.lineTo(xx, wy)
    }
    ctx.stroke()
  }

  // 오브제 둘레로 동심원 물결
  for (const o of obstacles) {
    ctx.strokeStyle = 'rgba(150,128,86,0.13)'
    for (let k = 1; k <= 2; k++) {
      roughEllipse(ctx, o.x, o.y, o.r + 8 * k + 4, o.r + 8 * k + 4, mulberry32(o.seed + k), 1.2)
      ctx.stroke()
    }
  }

  // 모래 알갱이 점묘
  const grains = Math.floor((side * side) / 900)
  for (let i = 0; i < grains; i++) {
    const gx = pad + rng() * (side - pad * 2)
    const gy = pad + rng() * (side - pad * 2)
    const a = 0.05 + rng() * 0.12
    ctx.fillStyle = `rgba(120,98,60,${a.toFixed(3)})`
    const r = rng() < 0.15 ? 1.4 : 0.8
    ctx.beginPath()
    ctx.arc(gx, gy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 샌드박스 마커 테두리 (이중선)
  ctx.strokeStyle = INK
  ctx.lineWidth = 3.2
  roughRect(ctx, pad, pad, side - pad * 2, side - pad * 2, mulberry32(7), 1.6)
  ctx.lineWidth = 1.4
  ctx.strokeStyle = 'rgba(58,55,48,0.5)'
  roughRect(ctx, pad + 4, pad + 4, side - pad * 2 - 8, side - pad * 2 - 8, mulberry32(99), 1.2)

  // 오브제들
  for (const o of obstacles) drawObstacle(ctx, o)
}

function drawObstacle(ctx: Ctx, o: Obstacle) {
  const rng = mulberry32(o.seed)
  ctx.save()
  ctx.translate(o.x, o.y)
  ctx.rotate(o.rot)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2.4
  ctx.strokeStyle = INK
  const r = o.r

  // 바닥 그림자
  ctx.save()
  ctx.fillStyle = 'rgba(80,62,30,0.10)'
  ctx.beginPath()
  ctx.ellipse(0, r * 0.72, r * 0.95, r * 0.34, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (o.type === 'ball') {
    roughEllipse(ctx, 0, 0, r, r, rng, 1.1)
    ctx.fillStyle = tint(o.color, 0.78)
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = 1.8
    ctx.strokeStyle = INK
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 0.42, r, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2)
    ctx.stroke()
    // 색 조각
    ctx.fillStyle = o.color
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 6)
    ctx.closePath()
    ctx.globalAlpha = 0.5
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (o.type === 'marble') {
    roughEllipse(ctx, 0, 0, r, r, rng, 1)
    ctx.fillStyle = tint(o.color, 0.7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.32, -r * 0.34, r * 0.26, r * 0.18, -0.6, 0, Math.PI * 2)
    ctx.fill()
  } else if (o.type === 'block') {
    const s = r * 1.2
    // 윗면 + 옆면 살짝
    ctx.fillStyle = tint(o.color, 0.8)
    roughRect(ctx, -s / 2, -s / 2, s, s, rng, 1.3)
    ctx.fill()
    ctx.stroke()
    // 주사위 점
    ctx.fillStyle = INK
    const pips = [
      [-s * 0.22, -s * 0.22],
      [s * 0.22, s * 0.22],
      [0, 0],
    ]
    for (const p of pips) {
      ctx.beginPath()
      ctx.arc(p[0], p[1], s * 0.07, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (o.type === 'leaf') {
    ctx.fillStyle = tint('#5aa86a', 0.7)
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.quadraticCurveTo(r * 0.95, -r * 0.1, 0, r)
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#3f7a4c'
    ctx.stroke()
    // 잎맥
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.86)
    ctx.lineTo(0, r * 0.86)
    ctx.stroke()
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue
      const yy = i * r * 0.28
      ctx.beginPath()
      ctx.moveTo(0, yy)
      ctx.quadraticCurveTo(r * 0.3 * Math.sign(i), yy - r * 0.05, r * 0.5 * Math.sign(i), yy - r * 0.18)
      ctx.stroke()
    }
  } else if (o.type === 'pebble') {
    ctx.fillStyle = '#cfc6b6'
    roughEllipse(ctx, 0, 0, r, r * 0.82, rng, 1.6)
    ctx.fill()
    ctx.strokeStyle = '#7d7568'
    ctx.stroke()
    ctx.lineWidth = 1.3
    ctx.strokeStyle = 'rgba(80,74,64,0.5)'
    roughLine(ctx, -r * 0.3, -r * 0.2, r * 0.1, -r * 0.36, rng, 0.8)
    roughLine(ctx, -r * 0.1, r * 0.1, r * 0.35, 0, rng, 0.8)
  } else {
    // pinwheel 바람개비
    const colors = ['#e0584f', '#4a82c4', '#5aa86a', '#eebb45']
    for (let i = 0; i < 4; i++) {
      ctx.save()
      ctx.rotate((i / 4) * Math.PI * 2)
      ctx.fillStyle = colors[i % colors.length]
      ctx.globalAlpha = 0.78
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(r, -r * 0.18)
      ctx.lineTo(r * 0.55, r * 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.restore()
    }
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// 색을 흰색 쪽으로 섞어 파스텔화 (k=0 흰색, 1 원색)
function tint(hex: string, k: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const mix = (v: number) => Math.round(255 + (v - 255) * k)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

// ── 개미 한 마리 ──
export function drawAnt(ctx: Ctx, a: Ant, t: number) {
  const s = a.size
  ctx.save()
  ctx.translate(a.x, a.y)

  // 바닥 그림자
  ctx.fillStyle = 'rgba(70,55,30,0.10)'
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 2.2, s * 1.2, a.angle, 0, Math.PI * 2)
  ctx.fill()

  ctx.rotate(a.angle)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = a.body
  ctx.fillStyle = a.body

  // 다리 6개 (top-down, 앞뒤로 휘젓기)
  ctx.lineWidth = Math.max(1, s * 0.22)
  const rootX = [s * 0.7, s * 0.05, -s * 0.7]
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const ph = a.legPhase + i * 2.094 + (side > 0 ? Math.PI : 0)
      const sweep = Math.sin(ph) * s * 0.55
      const rx = rootX[i]
      const ry = side * s * 0.55
      const kneeX = rx + sweep * 0.5 + side * 0 // 무릎
      const kneeY = side * s * 1.25
      const footX = rx + sweep
      const footY = side * s * 1.95
      ctx.beginPath()
      ctx.moveTo(rx, ry)
      ctx.quadraticCurveTo(kneeX, kneeY, footX, footY)
      ctx.stroke()
    }
  }

  // 더듬이
  ctx.lineWidth = Math.max(0.8, s * 0.16)
  for (const side of [-1, 1]) {
    const wig = Math.sin(t * 3 + side + a.seed) * s * 0.18
    ctx.beginPath()
    ctx.moveTo(s * 1.5, side * s * 0.18)
    ctx.quadraticCurveTo(s * 2.2, side * s * 0.4, s * 2.7 + wig * 0.3, side * s * 0.7 + wig)
    ctx.stroke()
  }

  // 몸통 3마디
  const rng = mulberry32(a.seed)
  ctx.lineWidth = Math.max(1, s * 0.2)
  // 배 (gaster)
  roughEllipse(ctx, -s * 1.05, 0, s * 1.05, s * 0.82, rng, 0.5)
  ctx.fill()
  // 가슴 (thorax)
  roughEllipse(ctx, s * 0.35, 0, s * 0.58, s * 0.5, rng, 0.4)
  ctx.fill()
  // 머리
  roughEllipse(ctx, s * 1.45, 0, s * 0.6, s * 0.55, rng, 0.4)
  ctx.fill()
  // 허리 연결 마커선
  ctx.beginPath()
  ctx.moveTo(-s * 0.1, 0)
  ctx.lineTo(s * 0.78, 0)
  ctx.stroke()

  ctx.restore()
}

export function drawRipple(ctx: Ctx, r: Ripple) {
  ctx.save()
  ctx.globalAlpha = Math.max(0, r.life) * 0.5
  ctx.strokeStyle = r.hue
  ctx.lineWidth = 2
  const rng = mulberry32(Math.floor(r.x + r.y))
  roughEllipse(ctx, r.x, r.y, r.r, r.r, rng, 1.4)
  ctx.stroke()
  ctx.restore()
}
