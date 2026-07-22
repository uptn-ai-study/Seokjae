/**
 * wanted.js — GTA2식 수배 레벨(별). 범죄로 heat 가 오르고,
 * 경찰 시야에서 벗어나면 서서히 식는다. Wash Point 도달 시 즉시 해제.
 */
export const MAX_STARS = 5;

export class Wanted {
  constructor(audio) {
    this.audio = audio;
    this.heat = 0; // 0..MAX_STARS (실수)
    this.cool = 0; // 추격에서 벗어난 시간
    this.busted = 0;
  }

  get level() { return Math.min(MAX_STARS, Math.floor(this.heat)); }

  add(amount) {
    const before = this.level;
    this.heat = Math.min(MAX_STARS + 0.9, this.heat + amount);
    this.cool = 0;
    if (this.level > before) this.audio?.star();
  }

  clear() {
    this.heat = 0;
    this.cool = 0;
  }

  /** chasing: 시야 안에 경찰이 있는가 */
  update(dt, chasing) {
    if (chasing) {
      this.cool = 0;
      return;
    }
    if (this.heat <= 0) return;
    this.cool += dt;
    // 6초간 따돌리면 식기 시작
    if (this.cool > 6) this.heat = Math.max(0, this.heat - dt * 0.35);
  }
}

/** 범죄 종류별 heat 증가량 */
export const CRIME = {
  carjackParked: 0.25,
  carjackOccupied: 1.0,
  pedestrianHit: 1.2,
  ramCar: 0.12,
  ramPolice: 0.6,
  destroyPolice: 1.0,
  speeding: 0.02,
};
