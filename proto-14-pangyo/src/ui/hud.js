/**
 * hud.js — DOM 기반 HUD. 캔버스에 그리지 않아 리사이즈·해상도에 강하다.
 */
export class Hud {
  constructor(root) {
    this.el = {
      score: root.querySelector('#hud-score'),
      cash: root.querySelector('#hud-cash'),
      stars: root.querySelector('#hud-stars'),
      speed: root.querySelector('#hud-speed'),
      speedUnit: root.querySelector('#hud-speed-unit'),
      hp: root.querySelector('#hud-hp-fill'),
      dur: root.querySelector('#hud-dur'),
      durFill: root.querySelector('#hud-dur-fill'),
      obj: root.querySelector('#hud-objective'),
      objText: root.querySelector('#hud-objective-text'),
      objTimer: root.querySelector('#hud-objective-timer'),
      district: root.querySelector('#hud-district'),
      toast: root.querySelector('#toast'),
      hint: root.querySelector('#hud-hint'),
      fps: root.querySelector('#hud-fps'),
    };
    this._district = '';
    this._toastT = 0;
  }

  toast(msg, kind = '') {
    const t = this.el.toast;
    t.textContent = msg;
    t.className = `show ${kind}`;
    this._toastT = 2.6;
  }

  banner(name) {
    if (name === this._district) return;
    this._district = name;
    const d = this.el.district;
    d.textContent = name;
    d.classList.remove('show');
    void d.offsetWidth; // 리플로우로 애니메이션 재시작
    d.classList.add('show');
  }

  update(game, dt) {
    const e = this.el;
    e.score.textContent = game.score.toLocaleString();
    e.cash.textContent = `₩${game.cash.toLocaleString()}`;

    const lv = game.wanted.level;
    if (this._stars !== lv) {
      this._stars = lv;
      e.stars.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span');
        s.textContent = '★';
        s.className = i < lv ? 'on' : '';
        e.stars.appendChild(s);
      }
      e.stars.classList.toggle('active', lv > 0);
    }

    const v = game.playerVehicle;
    // 1 타일 = metersPerTile 미터 스케일로 환산한 아케이드 km/h
    const kmh = v ? Math.round((v.speed / game.map.tileSize) * game.map.meta.metersPerTile * 3.6 * 0.22) : 0;
    e.speed.textContent = v ? kmh : '—';
    e.speedUnit.style.opacity = v ? 1 : 0.25;
    e.hp.style.width = `${(game.player.hp / game.player.maxHp) * 100}%`;
    e.dur.style.opacity = v ? 1 : 0.25;
    e.durFill.style.width = v ? `${(v.hp / v.maxHp) * 100}%` : '0%';

    const obj = game.missions.objective;
    if (obj) {
      e.obj.classList.add('show');
      e.objText.textContent = obj.text;
      e.objTimer.textContent = obj.timer !== null && obj.timer !== undefined ? `${Math.max(0, obj.timer).toFixed(1)}s` : '';
      e.objTimer.classList.toggle('urgent', obj.timer !== null && obj.timer < 10);
    } else {
      e.obj.classList.remove('show');
    }

    e.hint.textContent = game.hint || '';
    e.hint.classList.toggle('show', !!game.hint);

    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) e.toast.className = '';
    }
    if (e.fps) e.fps.textContent = `${game.loop.fps}fps`;
  }
}
