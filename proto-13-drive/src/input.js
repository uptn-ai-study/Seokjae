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

    this._blockBrowserGestures();
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

  /**
   * 모바일에서 게임 조작을 방해하는 브라우저 기본 동작을 차단한다.
   * CSS(touch-action / user-select)로 대부분 막히지만, iOS Safari 는
   * user-scalable=no 를 무시하므로 제스처 이벤트를 직접 막아야 한다.
   */
  _blockBrowserGestures() {
    const stop = (e) => e.preventDefault();
    const opt = { passive: false };

    // 롱프레스 컨텍스트 메뉴 / 드래그 선택
    document.addEventListener('contextmenu', stop);
    document.addEventListener('selectstart', stop);
    document.addEventListener('dragstart', stop);

    // iOS Safari 핀치 줌 (gesture* 는 iOS 전용 이벤트)
    document.addEventListener('gesturestart', stop, opt);
    document.addEventListener('gesturechange', stop, opt);
    document.addEventListener('gestureend', stop, opt);

    // 두 손가락 이상은 곧 핀치 — 확대/축소 방지
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, opt);

    // 더블탭 줌. touch-action 으로 대부분 막히지만 구형 iOS 대비 안전망.
    // 조작 버튼 위에서는 preventDefault 가 합성 click 을 없애버리므로 제외한다.
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320 && !e.target.closest('button, .ctrl')) e.preventDefault();
      lastTouchEnd = now;
    }, opt);
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
    const releases = [];
    const hold = (el, on, off) => {
      if (!el) return;
      const end = () => {
        off();
        el.classList.remove('pressed');
      };
      releases.push(end);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // 손가락이 버튼 밖으로 미끄러져도 pointerup 을 이 요소에서 받도록
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
        on();
        el.classList.add('pressed');
      });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    };
    hold(root.querySelector('#ctrl-left'), () => (this._steerTouch = -1), () => (this._steerTouch = 0));
    hold(root.querySelector('#ctrl-right'), () => (this._steerTouch = 1), () => (this._steerTouch = 0));
    hold(root.querySelector('#ctrl-gas'), () => (this._throttleTouch = 1), () => (this._throttleTouch = 0));
    hold(root.querySelector('#ctrl-brake'), () => (this._brakeTouch = 1), () => (this._brakeTouch = 0));

    // 안전망 — 어떤 이유로든 버튼이 눌린 채 남으면(가속 고착) 치명적이므로
    // 포인터가 어디서 떨어지든, 창을 벗어나든 전부 해제한다.
    const releaseAll = () => releases.forEach((r) => r());
    addEventListener('pointerup', releaseAll);
    addEventListener('pointercancel', releaseAll);
    addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll();
    });
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
