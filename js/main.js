// 启动与本地档案
import { App } from './ui.js';

const KEY = 'backcity.save.v1';

function blankData() {
  return {
    v: 1,
    active: 0,
    slots: [null, null, null],
    settings: { large: false, lowMotion: false },
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankData();
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !Array.isArray(data.slots) || data.slots.length !== 3) return blankData();
    if (!data.settings) data.settings = { large: false, lowMotion: false };
    if (typeof data.active !== 'number' || data.active < 0 || data.active > 2) data.active = 0;
    return data;
  } catch (err) {
    return blankData();
  }
}

const store = {
  data: loadData(),
  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      // 存储空间不足时保留内存中的档案，不打断游戏
    }
  },
};

const app = new App(store);
app.init();

// 便于排查：控制台可查看当前状态
window.__backcity = app;
