/**
 * input.js — PC(키보드) / 모바일(터치 컨트롤) 입력 분기
 *
 * 게임 루프는 steer(-1..1) / throttle(0..1) / brake(0..1) 세 값만 본다.
 * 터치가 감지되면 하단 가상 컨트롤이 자동으로 표시된다.
 */

export class Input {
  constructor(root) {
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.reverse = false;
    this.keys = new Set();
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this._steerTouch = 0;
    this._throttleTouch = 0;
    this._brakeTouch = 0;

    this._bindKeyboard();
    this._bindTouch(root);
    this._applyMode();

    // 첫 터치가 들어오면 모바일 UI로 전환
    window.addEventListener(
      'touchstart',
      () => {
        if (!this.touchMode) {
          this.touchMode = true;
          this._applyMode();
        }
      },
      { passive: true, once: true }
    );
  }

  _applyMode() {
    document.body.classList.toggle('touch', this.touchMode);
    document.body.classList.toggle('desktop', !this.touchMode);
  }

  _bindKeyboard() {
    const map = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      Space: 'brake',
    };
    addEventListener('keydown', (e) => {
      const k = map[e.code];
      if (!k) return;
      e.preventDefault();
      this.keys.add(k);
      if (!this.touchMode) return;
      this.touchMode = false;
      this._applyMode();
    });
    addEventListener('keyup', (e) => {
      const k = map[e.code];
      if (k) this.keys.delete(k);
    });
    addEventListener('blur', () => this.keys.clear());
  }

  _bindTouch(root) {
    const hold = (el, on, off) => {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        on();
        el.classList.add('pressed');
      };
      const end = () => {
        off();
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    };
    hold(root.querySelector('#ctrl-left'), () => (this._steerTouch = -1), () => (this._steerTouch = 0));
    hold(root.querySelector('#ctrl-right'), () => (this._steerTouch = 1), () => (this._steerTouch = 0));
    hold(root.querySelector('#ctrl-gas'), () => (this._throttleTouch = 1), () => (this._throttleTouch = 0));
    hold(root.querySelector('#ctrl-brake'), () => (this._brakeTouch = 1), () => (this._brakeTouch = 0));
  }

  /** 매 업데이트 시작 시 호출 — 입력을 부드럽게 정리한다 */
  sample(dt) {
    const k = this.keys;
    const rawSteer = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + this._steerTouch;
    const target = Math.max(-1, Math.min(1, rawSteer));
    // 조향은 즉시 최대가 아니라 서서히 (아케이드 감각)
    const rate = target === 0 ? 8 : 5;
    this.steer += (target - this.steer) * Math.min(1, rate * dt);
    if (Math.abs(this.steer) < 0.01) this.steer = 0;

    this.throttle = Math.max(k.has('up') ? 1 : 0, this._throttleTouch);
    const backward = k.has('down') ? 1 : 0;
    this.brake = Math.max(k.has('brake') ? 1 : 0, this._brakeTouch, backward);
    this.reverse = backward > 0;
  }
}
