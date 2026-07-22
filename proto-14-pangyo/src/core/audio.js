/**
 * audio.js — Web Audio API 로 전부 합성한다(외부 음원 없음 = 라이선스 안전).
 * 모바일 자동재생 정책 때문에 첫 사용자 입력 후 resume() 한다.
 */
const SCALES = {
  office: [0, 3, 5, 7, 10],
  commercial: [0, 2, 4, 7, 9],
  residential: [0, 2, 3, 7, 8],
  suburb: [0, 2, 5, 7, 9],
  highway: [0, 3, 5, 6, 10],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    this.ready = false;
    this._theme = 'commercial';
    this._beat = 0;
    this._nextNote = 0;
  }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.6;
      this.sfxBus.connect(this.master);

      this._buildEngine();
      this.ready = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.value = on ? 0.16 : 0;
  }

  setTheme(theme) {
    if (SCALES[theme]) this._theme = theme;
  }

  _buildEngine() {
    const c = this.ctx;
    this.engOsc = c.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 60;
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 700;
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter).connect(this.engGain).connect(this.sfxBus);
    this.engOsc.start();
  }

  /** speed01: 0~1, load: 가속 중이면 1 */
  engine(speed01, on) {
    if (!this.ready) return;
    const g = this.engGain.gain;
    const t = this.ctx.currentTime;
    g.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.08);
    this.engOsc.frequency.setTargetAtTime(55 + speed01 * 190, t, 0.06);
    this.engFilter.frequency.setTargetAtTime(500 + speed01 * 2200, t, 0.1);
  }

  _blip(freq, dur, type = 'square', vol = 0.25, slide = 0) {
    if (!this.ready || !this.enabled) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(this.sfxBus);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  _noise(dur, vol, cutoff) {
    if (!this.ready || !this.enabled) return;
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  crash(power = 1) { this._noise(0.22 + power * 0.2, Math.min(0.5, 0.18 + power * 0.25), 900 + power * 900); }
  explode() { this._noise(0.9, 0.5, 500); this._blip(90, 0.5, 'sawtooth', 0.3, -60); }
  horn() { this._blip(370, 0.22, 'square', 0.18); this._blip(280, 0.22, 'square', 0.14); }
  enter() { this._blip(520, 0.09, 'square', 0.16, 180); }
  exit() { this._blip(400, 0.09, 'square', 0.14, -140); }
  pickup() { this._blip(660, 0.08, 'square', 0.2); setTimeout(() => this._blip(990, 0.12, 'square', 0.2), 70); }
  success() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'triangle', 0.22), i * 90)); }
  fail() { [400, 330, 240].forEach((f, i) => setTimeout(() => this._blip(f, 0.2, 'sawtooth', 0.18), i * 110)); }
  star() { this._blip(880, 0.1, 'square', 0.22); setTimeout(() => this._blip(1170, 0.14, 'square', 0.2), 80); }
  siren(t) {
    if (!this.ready || !this.enabled) return;
    if (t - this._lastSiren < 0.55) return;
    this._lastSiren = t;
    this._blip(760, 0.24, 'square', 0.1);
    setTimeout(() => this._blip(560, 0.24, 'square', 0.1), 260);
  }

  /** 구역 테마에 맞춘 간단한 아르페지오 BGM */
  tickMusic(dt, intensity = 0) {
    if (!this.ready || !this.enabled || !this.musicOn) return;
    this._nextNote -= dt;
    if (this._nextNote > 0) return;
    const tempo = 0.28 - intensity * 0.06;
    this._nextNote = tempo;
    const scale = SCALES[this._theme];
    const root = 55; // A1
    const step = this._beat++ % 8;
    const deg = scale[(step * 2 + (step % 3)) % scale.length];
    const oct = step % 4 === 0 ? 0 : step % 2 === 0 ? 12 : 24;
    const f = root * Math.pow(2, (deg + oct) / 12);
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = step % 4 === 0 ? 'triangle' : 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + tempo * 0.9);
    o.connect(g).connect(this.musicBus);
    o.start();
    o.stop(c.currentTime + tempo);
    if (step % 4 === 0) this._noise(0.06, 0.12, 240); // 킥
  }
}
