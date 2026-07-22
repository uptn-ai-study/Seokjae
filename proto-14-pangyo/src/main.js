/**
 * main.js — Pangyo Drift 부트스트랩 & 게임 씬.
 *
 * 판교역 반경 5km 를 모티프로 한 탑뷰 오픈월드. 지형·미션은 전부 데이터(JSON)에서 온다.
 * 실제 상표/기업명은 쓰지 않고 가상 명칭만 사용한다.
 */
import { GameLoop } from './core/loop.js';
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Storage } from './core/storage.js';
import { CityMap } from './map/mapLoader.js';
import { RoadGraph } from './map/roadGraph.js';
import { TileRenderer } from './map/tileRenderer.js';
import { Player } from './entities/player.js';
import { Vehicle } from './entities/vehicle.js';
import { Traffic } from './entities/traffic.js';
import { PoliceForce } from './entities/police.js';
import { Wanted, CRIME } from './systems/wanted.js';
import { Missions } from './systems/mission.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';

const DAY_LENGTH = 300; // 초 (하루)

class Game {
  constructor(dom) {
    this.dom = dom;
    this.canvas = dom.canvas;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.cam = new Camera();
    this.input = new Input(document);
    this.audio = new Audio();
    this.hud = new Hud(document);
    this.settings = { audio: true, music: true, vibrate: true };
    this.score = 0;
    this.cash = 0;
    this.hint = '';
    this.effects = [];
    this.time = DAY_LENGTH * 0.5; // 한낮에서 시작 (0 / DAY_LENGTH 지점이 한밤)
    this.paused = false;
    this.mapOpen = false;
    this.playerVehicle = null;
  }

  async boot(progress) {
    progress(0.05, '도시 데이터 로드 중…');
    this.map = await CityMap.load('assets/data/city.pangyo.json');
    progress(0.45, '도로 그래프 구축 중…');
    this.graph = new RoadGraph(this.map.graph, this.map.tileSize);
    this.tiles = new TileRenderer(this.map);
    progress(0.6, '차량 정보 로드 중…');
    this.specs = await (await fetch('assets/data/vehicles.json')).json();

    progress(0.72, '도시 배치 중…');
    const [px, py] = this.map.spawns.player;
    this.player = new Player(px, py);
    this.spawnPoint = [px, py];
    this.parked = this.map.spawns.vehicles.map(
      (s) => new Vehicle(s.type, this.specs[s.type], s.pos[0], s.pos[1], ((s.rot || 0) * Math.PI) / 180)
    );
    this.hideouts = (this.map.raw.hideouts || []).map((h) => ({ x: h.pos[0], y: h.pos[1], name: h.name }));

    this.wanted = new Wanted(this.audio);
    this.traffic = new Traffic(this.map, this.graph, this.specs, this.audio);
    this.police = new PoliceForce(this.map, this.graph, this.specs, this.audio);
    this.missions = new Missions(this);
    progress(0.85, '미션 로드 중…');
    await this.missions.load('assets/data/missions/index.json');

    progress(0.93, '미니맵 굽는 중…');
    this.minimap = new Minimap(this.map, this.dom.minimap);

    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.cam.snap(px, py);
    this._restore();
    this._bindUi();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 300));
    progress(1, '준비 완료');
  }

  // ── 저장/복원 ────────────────────────────────────────────────────────────
  save() {
    Storage.save({
      score: this.score,
      cash: this.cash,
      completed: [...this.missions.completed],
      settings: this.settings,
      pos: [this.player.x, this.player.y],
    });
  }

  _restore() {
    const d = Storage.load();
    if (d.settings) Object.assign(this.settings, d.settings);
    this.score = d.score || 0;
    this.cash = d.cash ?? 3000;
    if (d.completed) {
      d.completed.forEach((id) => this.missions.completed.add(id));
      this.missions.refreshMarkers();
    }
    if (d.pos) {
      this.player.x = d.pos[0];
      this.player.y = d.pos[1];
      this.cam.snap(d.pos[0], d.pos[1]);
    }
    this._applySettings();
  }

  _applySettings() {
    this.audio.setEnabled(this.settings.audio);
    this.audio.setMusic(this.settings.music);
    for (const [k, v] of Object.entries(this.settings)) {
      const el = document.querySelector(`[data-setting="${k}"]`);
      if (el) el.classList.toggle('on', v);
    }
  }

  _bindUi() {
    document.querySelectorAll('[data-setting]').forEach((el) => {
      el.addEventListener('click', () => {
        const k = el.dataset.setting;
        this.settings[k] = !this.settings[k];
        this._applySettings();
        this.save();
      });
    });
    document.querySelector('#btn-map').addEventListener('click', () => this.toggleMap());
    document.querySelector('#btn-pause').addEventListener('click', () => this.togglePause());
    document.querySelector('#btn-resume').addEventListener('click', () => this.togglePause(false));
    document.querySelector('#btn-reset').addEventListener('click', () => {
      if (!confirm('진행도와 설정을 모두 지울까요?')) return;
      Storage.clear();
      location.reload();
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMap();
      if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
    });
    // 탭이 실제로 가려질 때만 일시정지(창 포커스만 잃는 경우는 제외)
    document.addEventListener('visibilitychange', () => document.hidden && this.togglePause(true));
  }

  toggleMap(force) {
    this.mapOpen = force ?? !this.mapOpen;
    this.dom.mapOverlay.classList.toggle('show', this.mapOpen);
    if (this.mapOpen) this.drawFullMap();
  }

  togglePause(force) {
    const next = force ?? !this.paused;
    if (next === this.paused) return;
    this.paused = next;
    this.dom.pauseOverlay.classList.toggle('show', this.paused);
    if (this.paused) this.save();
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth;
    const h = innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.dpr = dpr;
    this.cam.resize(w, h, dpr);
    // 화면이 작을수록 넓게 보여준다(모바일에서 앞이 안 보이면 재미가 없다)
    this.baseZoom = Math.max(0.5, Math.min(0.95, Math.min(w, h) / 900));
    document.body.classList.toggle('portrait', h > w);
    if (this.mapOpen) this.drawFullMap();
  }

  // ── 게임 이벤트 ─────────────────────────────────────────────────────────
  toast(msg, kind) { this.hud.toast(msg, kind); }

  addScore(n, msg) {
    this.score += n;
    if (msg) this.toast(msg, 'good');
  }

  addCash(n) { this.cash = Math.max(0, this.cash + n); }

  buzz(ms) {
    if (this.settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
  }

  onCollision(rel, other) {
    this.cam.shake = Math.min(1, this.cam.shake + rel / 900);
    this.buzz(Math.min(60, rel / 12));
    if (other && other.spec.siren) this.wanted.add(CRIME.ramPolice);
    else this.wanted.add(CRIME.ramCar);
    this.addScore(Math.round(rel / 40));
  }

  onPedestrianHit() {
    this.wanted.add(CRIME.pedestrianHit);
    this.toast('보행자 사고! 수배 상승', 'bad');
    this.buzz(120);
  }

  onBusted() {
    this.toast('체포됐다! 현금 일부를 잃었다', 'bad');
    this.audio.fail();
    this.missions.onBusted();
    this.addCash(-Math.round(this.cash * 0.15));
    this.wanted.clear();
    this.police.clear();
    this.respawn();
  }

  respawn() {
    this.exitVehicle(true);
    this.player.x = this.spawnPoint[0];
    this.player.y = this.spawnPoint[1];
    this.player.vx = this.player.vy = 0;
    this.player.hp = this.player.maxHp;
    this.player.invuln = 2.5;
    this.cam.snap(this.player.x, this.player.y);
    this.save();
  }

  vehicleList() {
    const out = [];
    for (const c of this.traffic.cars) out.push(c.v);
    for (const u of this.police.units) out.push(u.v);
    for (const p of this.nearParked || []) out.push(p);
    if (this.playerVehicle) out.push(this.playerVehicle);
    return out;
  }

  get waypoint() {
    return this.missions.waypoint;
  }

  // ── 탑승 / 하차 ─────────────────────────────────────────────────────────
  nearestVehicle(maxDist = 52) {
    let best = null;
    let bd = maxDist * maxDist;
    const test = (v) => {
      if (v.wrecked) return;
      const d = (v.x - this.player.x) ** 2 + (v.y - this.player.y) ** 2;
      if (d < bd) { bd = d; best = v; }
    };
    for (const v of this.nearParked || []) test(v);
    for (const c of this.traffic.cars) test(c.v);
    for (const u of this.police.units) test(u.v);
    return best;
  }

  enterVehicle(v) {
    // NPC 차를 빼앗으면 범죄
    const idx = this.traffic.cars.findIndex((c) => c.v === v);
    if (idx >= 0) {
      this.traffic.cars.splice(idx, 1);
      this.wanted.add(CRIME.carjackOccupied);
      this.toast(`${v.spec.name} 탈취!`, 'bad');
      this.traffic.peds.push({
        x: v.x + 20, y: v.y, vx: 0, vy: 0, mass: 0.25, dir: Math.random() * 6,
        phase: 0, color: '#e2574c', panic: 2.4, think: 0.4,
      });
    } else {
      const pi = this.police.units.findIndex((u) => u.v === v);
      if (pi >= 0) {
        this.police.units.splice(pi, 1);
        this.wanted.add(CRIME.carjackOccupied + 0.6);
        this.toast('순찰차 탈취! 수배 급상승', 'bad');
      } else {
        this.wanted.add(CRIME.carjackParked);
        this.toast(`${v.spec.name} 탑승`, '');
      }
    }
    v.driver = 'player';
    this.playerVehicle = v;
    this.player.vehicle = v;
    this.audio.enter();
    this.buzz(30);
  }

  exitVehicle(force = false) {
    const v = this.playerVehicle;
    if (!v) return;
    if (!force && v.speed > 220) {
      this.toast('너무 빠르다 — 속도를 줄이자', 'bad');
      return;
    }
    // 옆으로 내린다. 막혀 있으면 다른 방향을 시도
    const offs = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
    let placed = false;
    for (const o of offs) {
      const a = v.angle + o;
      const x = v.x + Math.cos(a) * (v.wid / 2 + 14);
      const y = v.y + Math.sin(a) * (v.wid / 2 + 14);
      if (this.map.solidAtPx(x, y) === 0) {
        this.player.x = x;
        this.player.y = y;
        placed = true;
        break;
      }
    }
    if (!placed) {
      this.player.x = v.x;
      this.player.y = v.y;
    }
    this.player.vx = this.player.vy = 0;
    this.player.vehicle = null;
    v.driver = null;
    v.ctrl.throttle = 0;
    v.ctrl.steer = 0;
    // 주차 목록에 없던 차(NPC/경찰 출신)는 주차 차량으로 편입
    if (!this.parked.includes(v)) this.parked.push(v);
    this.playerVehicle = null;
    if (!force) this.audio.exit();
  }

  // ── 업데이트 ────────────────────────────────────────────────────────────
  update(dt) {
    if (this.paused || this.mapOpen) return;
    this.input.sample();
    this.time = (this.time + dt) % DAY_LENGTH;

    // 카메라 주변 주차 차량만 활성화
    const R = 1100;
    this.nearParked = this.parked.filter(
      (v) => v !== this.playerVehicle && Math.abs(v.x - this.cam.x) < R && Math.abs(v.y - this.cam.y) < R
    );

    const pv = this.playerVehicle;
    if (pv) {
      pv.ctrl.steer = this.input.moveX;
      pv.ctrl.throttle = -this.input.moveY;
      pv.ctrl.handbrake = this.input.actionB;
      pv.ctrl.boost = this.input.boost;
      pv.update(dt, this.map, this.audio);
      if (pv.speed > pv.spec.maxSpeed * 0.92) this.wanted.heat > 0 && this.wanted.add(CRIME.speeding * dt);
      if (pv.wrecked && pv.exploded) {
        this.blast(pv.x, pv.y);
        this.player.hurt(45);
        this.exitVehicle(true);
      }
      this.audio.engine(Math.min(1, pv.speed / pv.spec.maxSpeed), true);
    } else {
      this.audio.engine(0, false);
    }

    this.player.update(dt, this.input, this.map);

    for (const v of this.nearParked) v.update(dt, this.map, this.audio);
    this.traffic.update(dt, this.cam, this.player, this);
    this.police.update(dt, this, this.cam);
    this.wanted.update(dt, this.police.chasing);
    this.missions.update(dt);

    // 폭발한 차 정리 + 주변 피해
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const v = this.parked[i];
      if (v.exploded) {
        this.blast(v.x, v.y);
        this.parked.splice(i, 1);
      }
    }

    // Wash Point — 수배 해제
    if (this.wanted.heat > 0) {
      for (const h of this.hideouts) {
        if (Math.hypot(h.x - this.player.x, h.y - this.player.y) < 95) {
          this.wanted.clear();
          this.police.clear();
          this.toast('Wash Point — 수배 해제!', 'good');
          this.audio.success();
          break;
        }
      }
    }

    // 상호작용
    const near = this.playerVehicle ? null : this.nearestVehicle();
    this.hint = this.playerVehicle
      ? ''
      : near
        ? `${this.input.touchMode ? 'Ⓐ' : 'SPACE'} — ${near.spec.name} 탑승`
        : '';
    if (this.input.pressedA) {
      if (this.playerVehicle) this.exitVehicle();
      else if (near) this.enterVehicle(near);
    }
    if (this.input.pressedB && !this.playerVehicle) this.audio.horn();

    // 구역 배너 + BGM 테마
    const d = this.map.districtAtPx(this.player.x, this.player.y);
    if (d.id !== this.district?.id) {
      this.district = d;
      this.hud.banner(d.name);
      this.audio.setTheme(d.theme);
    }
    this.audio.tickMusic(dt, Math.min(1, this.wanted.level / 4));

    // 카메라
    const target = this.playerVehicle || this.player;
    const spd = Math.hypot(target.vx, target.vy);
    this.cam.targetZoom = this.baseZoom * (this.playerVehicle ? 1 - Math.min(0.18, spd / 3400) : 1.12);
    this.cam.follow(target, dt, { lead: this.playerVehicle ? 0.45 : 0.2, stiff: 6 });

    // 이펙트
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.t > e.life) this.effects.splice(i, 1);
    }

    if (this.player.hp <= 0) {
      this.toast('의식을 잃었다… 병원에서 눈을 떴다', 'bad');
      this.addCash(-Math.round(this.cash * 0.1));
      this.wanted.clear();
      this.police.clear();
      this.respawn();
    }

    this._saveT = (this._saveT || 0) + dt;
    if (this._saveT > 12) { this._saveT = 0; this.save(); }
  }

  blast(x, y) {
    this.effects.push({ x, y, t: 0, life: 0.9 });
    this.cam.shake = 1;
    this.buzz(200);
    // 주변 피해
    for (const v of this.vehicleList()) {
      if (Math.hypot(v.x - x, v.y - y) < 90) v.damage(35, this.audio);
    }
    if (Math.hypot(this.player.x - x, this.player.y - y) < 90) this.player.hurt(30);
    for (const p of this.traffic.peds) {
      if (Math.hypot(p.x - x, p.y - y) < 110) { p.panic = 3; p.dir = Math.atan2(p.y - y, p.x - x); }
    }
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, this.cam.viewW, this.cam.viewH);

    ctx.save();
    this.cam.apply(ctx);

    const night = this.nightFactor();
    this.tiles.night = night;
    this.tiles.draw(ctx, this.cam);

    // 스키드 마크
    if (this.playerVehicle) this.playerVehicle.drawSkid(ctx);
    for (const c of this.traffic.cars) c.v.drawSkid(ctx);

    this.drawMarkers(ctx, t);

    // 주차 차량
    const b = this.cam.bounds(80);
    for (const v of this.nearParked || []) {
      if (v.x < b.x0 || v.x > b.x1 || v.y < b.y0 || v.y > b.y1) continue;
      v.draw(ctx, t);
    }
    this.traffic.drawPeds(ctx, this.cam);
    this.traffic.drawCars(ctx, this.cam, t);
    this.police.draw(ctx, this.cam, t);
    if (this.playerVehicle) {
      // 내 차 표시 — 교통량이 많아도 한눈에 구분되게
      const pv = this.playerVehicle;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,63,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pv.x, pv.y, pv.len * 0.62, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pv.x, pv.y, pv.len * 0.62, Math.PI - 0.9, Math.PI + 0.9);
      ctx.stroke();
      ctx.restore();
      pv.draw(ctx, t);
    }
    this.player.draw(ctx);
    this.drawEffects(ctx);

    // 밤 오버레이
    if (night > 0.02) {
      ctx.fillStyle = `rgba(10,14,38,${night * 0.5})`;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      // 헤드라이트
      const target = this.playerVehicle;
      if (target) {
        const g = ctx.createRadialGradient(target.x, target.y, 10, target.x, target.y, 220);
        g.addColorStop(0, `rgba(255,240,200,${0.18 * night})`);
        g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g;
        ctx.fillRect(target.x - 220, target.y - 220, 440, 440);
      }
    }
    ctx.restore();

    this.drawWaypointArrow(ctx);
    this.minimap.draw(this);
    this.hud.update(this, 1 / 60);
  }

  nightFactor() {
    // 0=낮, 1=밤 (해질녘/새벽은 부드럽게)
    const p = this.time / DAY_LENGTH;
    const n = Math.cos(p * Math.PI * 2) * 0.5 + 0.5; // 0.5 지점에서 최대
    return Math.max(0, Math.min(1, (n - 0.35) / 0.5));
  }

  drawMarkers(ctx, t) {
    const pulse = 0.6 + Math.sin(t * 3) * 0.25;
    // 미션 트리거
    for (const m of this.missions.markers) zone(ctx, m.x, m.y, Math.min(m.r, 52), '255,210,63', pulse, '!');
    // 수집 지점
    for (const s of this.missions.collectSpots) zone(ctx, s.x, s.y, 46, '61,220,132', pulse);
    // 현재 목표
    const wp = this.waypoint;
    if (wp) zone(ctx, wp.x, wp.y, 54, '61,220,132', pulse);
    // Wash Point
    for (const h of this.hideouts) zone(ctx, h.x, h.y, 46, '79,195,247', 0.8, 'WASH');
  }

  drawEffects(ctx) {
    for (const e of this.effects) {
      const p = e.t / e.life;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      const r = 20 + p * 90;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.4, '#ff8b3d');
      g.addColorStop(1, 'rgba(60,40,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 화면 밖 목표를 가리키는 화살표 */
  drawWaypointArrow(ctx) {
    const wp = this.waypoint || this.missions.markers[0];
    if (!wp) return;
    const cam = this.cam;
    const sx = cam.viewW / 2 + (wp.x - cam.x) * cam.zoom;
    const sy = cam.viewH / 2 + (wp.y - cam.y) * cam.zoom;
    const pad = 64;
    if (sx > pad && sx < cam.viewW - pad && sy > pad && sy < cam.viewH - pad) return;
    const a = Math.atan2(wp.y - cam.y, wp.x - cam.x);
    const rx = cam.viewW / 2 - pad;
    const ry = cam.viewH / 2 - pad;
    const s = Math.min(rx / Math.abs(Math.cos(a) || 1e-4), ry / Math.abs(Math.sin(a) || 1e-4));
    const x = cam.viewW / 2 + Math.cos(a) * s;
    const y = cam.viewH / 2 + Math.sin(a) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = this.waypoint ? '#3ddc84' : '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, 9);
    ctx.lineTo(-10, -9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFullMap() {
    const cv = this.dom.fullMap;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, w, h);
    this.minimap.drawFull(ctx, w, h, this);
  }
}

/** 바닥에 깔리는 목표 표시 — 도로가 가려지지 않도록 반투명 + 링 */
function zone(ctx, x, y, r, rgb, pulse, label) {
  ctx.save();
  ctx.fillStyle = `rgba(${rgb},0.18)`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${0.5 + pulse * 0.5})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.72 + pulse * 0.28), 0, 7);
  ctx.stroke();
  if (label) {
    ctx.fillStyle = `rgba(${rgb},0.95)`;
    ctx.font = `bold ${label.length > 2 ? 13 : 24}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

// ── 부트 ────────────────────────────────────────────────────────────────────
const dom = {
  canvas: document.querySelector('#game'),
  minimap: document.querySelector('#minimap'),
  fullMap: document.querySelector('#fullmap'),
  mapOverlay: document.querySelector('#map-overlay'),
  pauseOverlay: document.querySelector('#pause-overlay'),
};

const bar = document.querySelector('#load-bar');
const label = document.querySelector('#load-label');
const boot = document.querySelector('#boot');
const startBtn = document.querySelector('#btn-start');

const game = new Game(dom);
window.__game = game; // 디버그용

game
  .boot((p, msg) => {
    bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) label.textContent = msg;
  })
  .then(() => {
    startBtn.classList.add('show');
    startBtn.addEventListener('click', () => {
      game.audio.resume();
      boot.classList.add('hidden');
      game.loop.start();
      game.hud.banner(game.map.districtAtPx(game.player.x, game.player.y).name);
    });
  })
  .catch((err) => {
    console.error(err);
    label.textContent = `로드 실패: ${err.message}`;
  });

// PWA
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
