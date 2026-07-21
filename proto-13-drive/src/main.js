/**
 * main.js — 부트스트랩 & 게임 루프
 *
 * 고정 타임스텝(1/60) 업데이트 + requestAnimationFrame 렌더.
 * 승패가 없는 오픈월드 샌드박스라 상태 머신 없이 단순 루프로 충분하다.
 */
import { loadGraph } from './graph.js';
import { loadAreas } from './areas.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { findRoute, distanceToPolyline } from './pathfinding.js';

const STEP = 1 / 60;
const OFF_ROUTE_DIST = 45; // m — 이보다 벗어나면 이탈로 판단
const ARRIVE_DIST = 28; // m

const app = document.getElementById('app');
const canvas = document.getElementById('game');

(async function boot() {
  const ui = new UI(app);
  let g;
  try {
    g = await loadGraph('./assets/graph.json');
  } catch (e) {
    document.getElementById('loading').innerHTML =
      `<div class="load-err">graph.json 을 불러오지 못했습니다.<br><span>${e.message}</span><br>
       <code>npm run data</code> 실행 후 로컬 서버로 열어주세요.</div>`;
    return;
  }

  // ---- 스폰: 지도 중심(서울시청)에서 가장 가까운 도로 ----
  const spawnHit = g.nearest(0, 0, 500) || g.nearest(g.nx[0], g.ny[0], 1000);
  const player = new Player(g, { x: spawnHit.x, y: spawnHit.y, heading: spawnHit.heading });

  const cam = new Camera();
  cam.snapTo(player);
  const input = new Input(app);
  const areas = await loadAreas('./assets/areas.json');
  const renderer = new Renderer(canvas, g, areas);
  const traffic = new Traffic(g, { count: matchMedia('(pointer: coarse)').matches ? 110 : 190 });
  traffic.spawnAll(player);

  // ---- 상태 ----
  let route = null;
  let dest = null; // {x,y,node}
  let offRoute = false;
  let recalcCooldown = 0;
  let pickMode = false;
  let arrived = false;

  // ---- 화면 크기 ----
  function resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    cam.resize(w, h, dpr);
    renderer.resize(w, h, dpr);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---- 목적지 / 경로 ----
  function setDestination(wx, wy) {
    const node = g.nearestJunction(wx, wy);
    if (node == null) {
      ui.toast('그 근처엔 도로가 없어요');
      return;
    }
    const p = g.nodeXY(node);
    dest = { x: p.x, y: p.y, node };
    arrived = false;
    if (recalcRoute()) ui.toast('추천 경로를 찾았어요');
    else ui.toast('경로를 찾지 못했어요');
  }

  function recalcRoute() {
    if (!dest) return false;
    const from = g.nearestJunction(player.x, player.y);
    const r = findRoute(g, from, dest.node);
    route = r && r.polyline.length >= 4 ? r : null;
    offRoute = false;
    recalcCooldown = 2.5;
    return !!route;
  }

  function clearRoute() {
    route = null;
    dest = null;
    offRoute = false;
    ui.showRoute(null);
  }

  function randomDestination() {
    for (let i = 0; i < 40; i++) {
      const n = g.junctions[(Math.random() * g.junctions.length) | 0];
      const p = g.nodeXY(n);
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d > 700 && d < 2500) {
        setDestination(p.x, p.y);
        return;
      }
    }
    ui.toast('적당한 목적지를 못 찾았어요');
  }

  /** 루트 남은 거리 (현재 위치에서 가장 가까운 지점 이후) */
  function routeRemain() {
    const p = route.polyline;
    let bestI = 0;
    let bestD = Infinity;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const d = (p[k] - player.x) ** 2 + (p[k + 1] - player.y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = k;
      }
    }
    let remain = 0;
    for (let k = bestI; k + 3 < p.length; k += 2) remain += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
    return remain;
  }

  // ---- 입력: 지도 클릭/탭 ----
  canvas.addEventListener('pointerdown', (e) => {
    if (!pickMode) return;
    const w = cam.toWorld(e.clientX, e.clientY);
    setDestination(w.x, w.y);
    pickMode = false;
    ui.setDestMode(false);
  });

  document.getElementById('btn-dest').addEventListener('click', () => {
    pickMode = !pickMode;
    ui.setDestMode(pickMode);
    if (pickMode) ui.toast('지도를 탭해서 목적지를 정하세요');
  });
  document.getElementById('btn-random').addEventListener('click', randomDestination);
  document.getElementById('btn-help').addEventListener('click', () => ui.openHelp(input.touchMode));
  document.getElementById('btn-zoom-in').addEventListener('click', () => cam.zoomIn());
  document.getElementById('btn-zoom-out').addEventListener('click', () => cam.zoomOut());
  document.getElementById('btn-route-cancel').addEventListener('click', () => {
    clearRoute();
    ui.toast('안내를 종료했어요');
  });

  addEventListener('keydown', (e) => {
    if (e.code === 'Equal' || e.code === 'NumpadAdd') cam.zoomIn();
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') cam.zoomOut();
    if (e.code === 'KeyH') ui.openHelp(input.touchMode);
    if (e.code === 'KeyR') randomDestination();
    if (e.code === 'Escape') ui.closeSheet();
  });

  // ---- 루프 ----
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // 탭 전환 등으로 큰 점프가 생기면 잘라낸다
    acc += dt;

    let steps = 0;
    while (acc >= STEP && steps < 5) {
      update(STEP);
      acc -= STEP;
      steps++;
    }

    cam.follow(player, dt);
    renderer.draw(cam, player, traffic, route, dest);

    ui.setSpeed(player.speedKmh, player.offroad);
    ui.setRoad(player.roadName);
    ui.setOdo(player.odo);
    if (route) {
      const remain = routeRemain();
      ui.showRoute({ remain, time: remain / (28 / 3.6), offRoute }); // 도심 평균 28km/h 가정
    }
    requestAnimationFrame(frame);
  }

  function update(dt) {
    input.sample(dt);
    player.update(dt, input);
    traffic.update(dt, player);
    traffic.resolvePlayerCollision(player);

    if (recalcCooldown > 0) recalcCooldown -= dt;

    if (route && dest) {
      // 도착 판정
      const dd = Math.hypot(player.x - dest.x, player.y - dest.y);
      if (dd < ARRIVE_DIST && !arrived) {
        arrived = true;
        ui.toast('🏁 목적지에 도착했어요!', 3200);
        clearRoute();
        return;
      }
      // 오프루트 감지 → 강제하지 않고 조용히 재계산
      const d = distanceToPolyline(route.polyline, player.x, player.y);
      const nowOff = d > OFF_ROUTE_DIST;
      if (nowOff && !offRoute) {
        offRoute = true;
        ui.toast('경로를 벗어났어요 — 자유롭게 달려도 됩니다');
      }
      if (nowOff && recalcCooldown <= 0) {
        recalcRoute();
        offRoute = false;
      }
    }
  }

  ui.hideLoading();
  ui.openHelp(input.touchMode);
  requestAnimationFrame(frame);

  // 디버그 편의
  window.__drive = { g, player, cam, traffic, input, areas, renderer, setDestination };
})();
