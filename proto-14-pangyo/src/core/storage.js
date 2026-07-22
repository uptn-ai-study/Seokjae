/**
 * storage.js — 진행도/설정을 localStorage 에 저장한다(계정 불필요).
 */
const KEY = 'pangyo-drift/v1';

export const Storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};
