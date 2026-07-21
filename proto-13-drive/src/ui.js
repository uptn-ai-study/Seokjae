/**
 * ui.js — 팀 UI 공통 규약(UI-COMMON.md) 기반 오버레이 컨트롤
 *   Primary #5F46FF · 카드 radius 16 + Level1 그림자 · 바텀시트 radius 24 슬라이드업
 *   hover 대신 :active 만 사용
 */

export class UI {
  constructor(root) {
    this.root = root;
    this.el = {
      speed: root.querySelector('#hud-speed'),
      road: root.querySelector('#hud-road'),
      routeCard: root.querySelector('#route-card'),
      routeDist: root.querySelector('#route-dist'),
      routeTime: root.querySelector('#route-time'),
      routeState: root.querySelector('#route-state'),
      toast: root.querySelector('#toast'),
      sheetOverlay: root.querySelector('#sheet-overlay'),
      sheet: root.querySelector('#sheet'),
      sheetBody: root.querySelector('#sheet-body'),
      sheetTitle: root.querySelector('#sheet-title'),
      destBtn: root.querySelector('#btn-dest'),
      odo: root.querySelector('#hud-odo'),
      loading: root.querySelector('#loading'),
    };
    this._toastTimer = 0;

    root.querySelector('#sheet-close').addEventListener('click', () => this.closeSheet());
    this.el.sheetOverlay.addEventListener('click', (e) => {
      if (e.target === this.el.sheetOverlay) this.closeSheet();
    });
  }

  hideLoading() {
    this.el.loading.style.display = 'none';
  }

  setSpeed(kmh, offroad) {
    this.el.speed.textContent = Math.round(kmh);
    this.el.speed.classList.toggle('warn', offroad);
  }

  setRoad(name) {
    const v = name || '이름 없는 도로';
    if (this.el.road.textContent !== v) this.el.road.textContent = v;
  }

  setOdo(meters) {
    this.el.odo.textContent = meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(2)}km`;
  }

  setDestMode(on) {
    this.el.destBtn.classList.toggle('active', on);
    this.root.classList.toggle('picking', on);
  }

  showRoute(info) {
    if (!info) {
      this.el.routeCard.classList.remove('show');
      return;
    }
    this.el.routeCard.classList.add('show');
    this.el.routeDist.textContent = info.remain < 1000 ? `${Math.round(info.remain)}m` : `${(info.remain / 1000).toFixed(1)}km`;
    const min = Math.max(1, Math.round(info.time / 60));
    this.el.routeTime.textContent = `약 ${min}분`;
    this.el.routeState.textContent = info.offRoute ? '경로 이탈 · 자유 주행 중' : '추천 경로 안내 중';
    this.el.routeState.classList.toggle('off', !!info.offRoute);
  }

  toast(msg, ms = 2200) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  openSheet(title, html) {
    this.el.sheetTitle.textContent = title;
    this.el.sheetBody.innerHTML = html;
    this.el.sheetOverlay.style.display = 'flex';
    requestAnimationFrame(() => this.el.sheet.classList.add('open'));
  }

  closeSheet() {
    this.el.sheet.classList.remove('open');
    setTimeout(() => (this.el.sheetOverlay.style.display = 'none'), 260);
  }

  openHelp(touch) {
    const pc = `
      <div class="key-grid">
        <div class="key-row"><span class="kbd">W</span><span class="kbd">↑</span><span class="key-desc">가속</span></div>
        <div class="key-row"><span class="kbd">A</span><span class="kbd">←</span><span class="key-desc">좌회전</span></div>
        <div class="key-row"><span class="kbd">D</span><span class="kbd">→</span><span class="key-desc">우회전</span></div>
        <div class="key-row"><span class="kbd">S</span><span class="kbd">↓</span><span class="key-desc">감속 / 후진</span></div>
        <div class="key-row"><span class="kbd wide">Space</span><span class="key-desc">브레이크</span></div>
        <div class="key-row"><span class="kbd">+</span><span class="kbd">-</span><span class="key-desc">줌 인 / 아웃</span></div>
      </div>`;
    const mobile = `
      <div class="key-grid">
        <div class="key-row"><span class="kbd wide">◀ ▶</span><span class="key-desc">좌우 조향</span></div>
        <div class="key-row"><span class="kbd wide">GO</span><span class="key-desc">가속</span></div>
        <div class="key-row"><span class="kbd wide">STOP</span><span class="key-desc">브레이크 (정지 후 계속 누르면 후진)</span></div>
      </div>`;
    this.openSheet(
      '조작법',
      `${touch ? mobile : pc}
       <div class="sheet-note">
         <b>목적지 지정</b> — 우측 하단 📍 버튼을 켠 뒤 지도를 ${touch ? '탭' : '클릭'}하면 추천 경로가 표시됩니다.
         경로는 안내일 뿐, 무시하고 자유롭게 달려도 됩니다. 이탈하면 자동으로 다시 계산합니다.
       </div>
       <div class="sheet-note">
         <b>최고 250km/h</b> — 빠를수록 회전반경이 커집니다. 대로에선 마음껏 밟고,
         골목에 들어가기 전엔 감속하세요. 줌은 9단계로 도심 전경부터 차량 클로즈업까지 볼 수 있습니다.
       </div>
       <button class="btn-primary" id="sheet-ok">알겠어요</button>`
    );
    this.el.sheetBody.querySelector('#sheet-ok').addEventListener('click', () => this.closeSheet());
  }
}
