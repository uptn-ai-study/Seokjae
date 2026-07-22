/**
 * loop.js — 고정 타임스텝(60Hz) 로직 + 가변 렌더.
 * 프레임이 떨어져도 물리가 같은 속도로 흐르도록 accumulator 를 쓴다.
 */
export class GameLoop {
  constructor({ step = 1 / 60, maxCatchUp = 5, update, render }) {
    this.step = step;
    this.maxCatchUp = maxCatchUp;
    this.update = update;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsCount = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    // 탭 전환 등으로 크게 벌어진 시간은 버린다(물리 폭주 방지)
    if (dt > 0.25) dt = this.step;
    this.acc += dt;

    let steps = 0;
    while (this.acc >= this.step && steps < this.maxCatchUp) {
      this.update(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps === this.maxCatchUp) this.acc = 0; // 따라잡기 포기

    this.render(this.acc / this.step);

    this._fpsAcc += dt;
    this._fpsCount++;
    if (this._fpsAcc >= 0.5) {
      this.fps = Math.round(this._fpsCount / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsCount = 0;
    }
  }
}
