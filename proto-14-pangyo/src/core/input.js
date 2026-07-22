/**
 * input.js — 키보드와 터치를 하나의 InputState 로 통일한다.
 *
 *   InputState { moveX, moveY, actionA, actionB, boost }
 *     moveX/moveY : -1..1 (화면 기준, 위쪽이 -1)
 *     actionA     : 탑승/하차 (Space / A버튼)  — edge(눌린 순간)로도 제공
 *     actionB     : 액션/경적 (F / B버튼)
 *     boost       : 달리기·부스트 (Shift / 부스트버튼)
 *
 * 게임 로직은 키보드/터치를 구분하지 않는다.
 */

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'a', KeyE: 'a',
  KeyF: 'b', ShiftLeft: 'boost', ShiftRight: 'boost',
};

export class Input {
  constructor(root) {
    this.moveX = 0;
    this.moveY = 0;
    this.actionA = false;
    this.actionB = false;
    this.boost = false;
    /** 이번 프레임에 새로 눌렸는가 */
    this.pressedA = false;
    this.pressedB = false;
    this.touchMode = matchMedia('(pointer: coarse)').matches;

    this._keys = new Set();
    this._prevA = false;
    this._prevB = false;
    this._stick = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
    this._btn = { a: false, b: false, boost: false };

    this._blockGestures();
    this._bindKeyboard();
    this._bindTouch(root);
    this._applyMode();
    addEventListener('touchstart', () => this._setTouch(true), { passive: true, once: true });
  }

  _setTouch(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    this._applyMode();
  }

  _applyMode() {
    document.body.classList.toggle('touch', this.touchMode);
    document.body.classList.toggle('desktop', !this.touchMode);
  }

  /** 모바일 브라우저 기본 제스처(롱프레스 선택·핀치·더블탭 줌) 차단 */
  _blockGestures() {
    const stop = (e) => e.preventDefault();
    const opt = { passive: false };
    document.addEventListener('contextmenu', stop);
    document.addEventListener('selectstart', stop);
    document.addEventListener('dragstart', stop);
    document.addEventListener('gesturestart', stop, opt);
    document.addEventListener('gesturechange', stop, opt);
    document.addEventListener('gestureend', stop, opt);
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, opt);
    let last = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - last < 320 && !e.target.closest('button, .ctrl, .pad')) e.preventDefault();
      last = now;
    }, opt);
  }

  _bindKeyboard() {
    addEventListener('keydown', (e) => {
      const k = KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      this._keys.add(k);
      this._setTouch(false);
    });
    addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k) this._keys.delete(k);
    });
    addEventListener('blur', () => this._keys.clear());
  }

  _bindTouch(root) {
    // 좌측 가상 조이스틱
    const pad = root.querySelector('#pad');
    const knob = root.querySelector('#pad-knob');
    const R = 52;
    const move = (e) => {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, R);
      dx = (dx / len) * cl;
      dy = (dy / len) * cl;
      this._stick.x = dx / R;
      this._stick.y = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      this._stick.active = true;
      this._stick.id = e.pointerId;
      move(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (this._stick.active && e.pointerId === this._stick.id) move(e);
    });
    const release = () => {
      this._stick.active = false;
      this._stick.x = this._stick.y = 0;
      knob.style.transform = 'translate(0,0)';
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);

    // 우측 액션 버튼
    const hold = (sel, key) => {
      const el = root.querySelector(sel);
      if (!el) return;
      const off = () => {
        this._btn[key] = false;
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch {}
        this._btn[key] = true;
        el.classList.add('pressed');
      });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
      this._releases = this._releases || [];
      this._releases.push(off);
    };
    hold('#ctrl-a', 'a');
    hold('#ctrl-b', 'b');
    hold('#ctrl-boost', 'boost');

    // 안전망 — 버튼이 눌린 채 고착되면 치명적이므로 전부 해제
    const releaseAll = () => {
      release();
      (this._releases || []).forEach((r) => r());
    };
    addEventListener('pointerup', releaseAll);
    addEventListener('pointercancel', releaseAll);
    addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
  }

  /** 매 프레임 시작 시 호출 */
  sample() {
    const k = this._keys;
    const kx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    const ky = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    this.moveX = Math.max(-1, Math.min(1, kx + this._stick.x));
    this.moveY = Math.max(-1, Math.min(1, ky + this._stick.y));
    this.actionA = k.has('a') || this._btn.a;
    this.actionB = k.has('b') || this._btn.b;
    this.boost = k.has('boost') || this._btn.boost;
    this.pressedA = this.actionA && !this._prevA;
    this.pressedB = this.actionB && !this._prevB;
    this._prevA = this.actionA;
    this._prevB = this.actionB;
  }
}
