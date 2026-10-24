// 界面与交互
import { DISTRICTS, RESIDENTS, AGREEMENTS, CHAPTERS } from './data.js';
import {
  Game, analyze, validateConfirm, evaluateGoals, advanceDay, rotatePorts,
} from './engine.js';
import { INTROS, eventFor, chapterResult, ending, residentBack } from './story.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class App {
  constructor(store) {
    this.store = store;
    this.game = null;
    this.selected = null;
    this.previewFace = null;
    this.tab = 'card';
    this.moveFrom = null;
    this.cursor = 0;
    this.pendingEvent = null;
    this.toastTimer = null;
    this.overlayMode = null;
  }

  init() {
    this.el = {
      start: $('#start'), game: $('#game'), board: $('#board'), tray: $('#tray'),
      panel: $('#panel'), overlay: $('#overlay'), overlayCard: $('#overlay-card'),
      toast: $('#toast'), confirm: $('#btn-confirm'), hint: $('#confirm-hint'),
      dayNum: $('#day-num'), dayTotal: $('#day-total'), badge: $('#chapter-badge'),
      hands: $('#stat-hands'), material: $('#stat-material'), power: $('#stat-power'),
      tabs: $('#tabs'), chapterBadge: $('#chapter-badge'),
    };

    this.applySettings();

    $('#btn-new').addEventListener('click', () => this.showArchives('new'));
    $('#btn-continue').addEventListener('click', () => this.continueGame());
    $('#btn-archives').addEventListener('click', () => this.showArchives('load'));

    document.querySelectorAll('.tb-actions .mini').forEach(btn => {
      btn.addEventListener('click', () => this.topAction(btn.dataset.act));
    });

    this.el.board.addEventListener('click', e => {
      const slotEl = e.target.closest('[data-slot]');
      if (!slotEl) return;
      this.onSlotClick(Number(slotEl.dataset.slot));
    });
    this.el.tray.addEventListener('click', e => {
      const cardEl = e.target.closest('[data-index]');
      if (!cardEl) return;
      this.select({ zone: 'tray', index: Number(cardEl.dataset.index) });
    });
    this.el.tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      this.tab = btn.dataset.tab;
      this.el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
      this.renderPanel();
    });
    this.el.panel.addEventListener('click', e => {
      const btn = e.target.closest('[data-do]');
      if (btn) this.panelAction(btn.dataset);
    });
    this.el.panel.addEventListener('change', e => {
      const sel = e.target.closest('select[data-role]');
      if (!sel) return;
      this.peopleChange(sel.dataset.role, sel.dataset.rid, sel.value);
    });
    this.el.confirm.addEventListener('click', () => this.confirmDay());
    document.addEventListener('keydown', e => this.onKey(e));

    this.renderStart();
  }

  applySettings() {
    const st = this.store.data.settings || {};
    document.body.classList.toggle('large-text', !!st.large);
    document.body.classList.toggle('low-motion', !!st.lowMotion);
  }

  // ---------------------------------------------------------------- 开始 / 档案
  renderStart() {
    this.game = null;
    this.el.start.classList.remove('hidden');
    this.el.game.classList.add('hidden');
    this.el.overlay.classList.add('hidden');
    const any = this.store.data.slots.some(Boolean);
    $('#btn-continue').disabled = !any;
    this.el.start.classList.remove('hidden');
  }

  continueGame() {
    let idx = this.store.data.active;
    if (!this.store.data.slots[idx]) idx = this.store.data.slots.findIndex(Boolean);
    if (idx < 0) { this.toast('还没有可继续的档案。', true); return; }
    this.store.data.active = idx;
    this.store.persist();
    const state = this.store.data.slots[idx];
    this.game = new Game(state);
    this.el.start.classList.add('hidden');
    this.el.game.classList.remove('hidden');
    this.resumeFlow();
  }

  resumeFlow() {
    const s = this.game.state;
    this.selected = null;
    this.previewFace = null;
    this.moveFrom = null;
    if (s.phase === 'night' && s.lastReport) {
      this.render();
      if (s.chapter === 1 && s.lastReport.chapterDone) this.showEnding();
      else if (s.lastReport.chapterDone) this.showChapterResult();
      else this.showNight(s.lastReport);
    } else {
      this.render();
    }
  }

  persist() {
    if (!this.game) return;
    this.store.data.slots[this.store.data.active] = this.game.state;
    this.store.persist();
  }

  showArchives(mode) {
    this.overlayMode = mode;
    this.renderArchives();
  }

  renderArchives() {
    const mode = this.overlayMode || 'load';
    const slots = this.store.data.slots;
    const rows = slots.map((st, i) => {
      if (!st) {
        return `<div class="slot-row">
          <div class="slot-info"><div class="slot-name">档案 ${i + 1} · 空位</div><div class="slot-meta">还没有铺开的城市</div></div>
          <div class="slot-actions">
            <button class="btn paper small" data-ov="new-slot" data-slot="${i}">在此开新局</button>
          </div>
        </div>`;
      }
      const ch = CHAPTERS[st.chapter] || CHAPTERS[0];
      const phase = st.phase === 'night' ? '夜间记录' : '规划中';
      const active = this.store.data.active === i;
      return `<div class="slot-row">
        <div class="slot-info">
          <div class="slot-name">档案 ${i + 1} · ${ch.title}${active ? ' · 当前' : ''}</div>
          <div class="slot-meta">第 ${st.day} 天 · ${phase} · 物资 ${st.material}</div>
        </div>
        <div class="slot-actions">
          <button class="btn paper small" data-ov="load-slot" data-slot="${i}">载入</button>
          <button class="btn paper small" data-ov="new-slot" data-slot="${i}">重开</button>
          <button class="btn paper small danger" data-ov="delete-slot" data-slot="${i}">删除</button>
        </div>
      </div>`;
    }).join('');

    this.openOverlay(`
      <p class="ov-kicker">档案抽屉</p>
      <h2 class="ov-title">三个世界档案位</h2>
      <p class="ov-sub">自动保存当前档案。删除只影响这一格，设置与其他档案保留。</p>
      ${rows}
      <div class="ov-actions">
        <button class="btn paper small" data-ov="export">导出全部档案</button>
        <button class="btn paper small" data-ov="import">导入档案</button>
        <button class="btn paper small" data-ov="close">关闭</button>
      </div>
    `);

    this.bindOverlay({
      'new-slot': b => this.newSlot(Number(b.dataset.slot)),
      'load-slot': b => this.loadSlot(Number(b.dataset.slot)),
      'delete-slot': b => this.deleteSlot(Number(b.dataset.slot)),
      export: () => this.exportSave(),
      import: () => this.importSave(),
      close: () => this.closeOverlay(),
    });
  }

  newSlot(i) {
    if (this.store.data.slots[i] && !window.confirm(`档案 ${i + 1} 已经有城市。覆盖它，重新开一局吗？`)) return;
    const game = Game.new(0, 0);
    this.store.data.slots[i] = game.state;
    this.store.data.active = i;
    this.store.persist();
    this.game = game;
    this.el.start.classList.add('hidden');
    this.el.game.classList.remove('hidden');
    this.closeOverlay();
    this.render();
    this.showIntro(0);
  }

  loadSlot(i) {
    const st = this.store.data.slots[i];
    if (!st) { this.toast('这一格是空的。', true); return; }
    this.store.data.active = i;
    this.store.persist();
    this.game = new Game(st);
    this.el.start.classList.add('hidden');
    this.el.game.classList.remove('hidden');
    this.closeOverlay();
    this.resumeFlow();
  }

  deleteSlot(i) {
    if (!this.store.data.slots[i]) return;
    if (!window.confirm(`删除档案 ${i + 1}？这个城市的章节、居民关系、成就与备份都会被清除，无法恢复。`)) return;
    this.store.data.slots[i] = null;
    if (this.store.data.active === i) this.store.data.active = Math.max(0, this.store.data.slots.findIndex(Boolean));
    this.store.persist();
    this.renderArchives();
    $('#btn-continue').disabled = !this.store.data.slots.some(Boolean);
  }

  exportSave() {
    const blob = new Blob([JSON.stringify(this.store.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '背面有座城-档案.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          if (!data || data.v !== 1 || !Array.isArray(data.slots) || data.slots.length !== 3) throw new Error('bad');
          for (const st of data.slots) {
            if (st && (typeof st.chapter !== 'number' || typeof st.day !== 'number' || !Array.isArray(st.board) || st.board.length !== 9)) throw new Error('bad');
          }
          this.store.data = data;
          if (!data.settings) data.settings = {};
          this.store.persist();
          this.applySettings();
          this.toast('档案已导入。');
          this.renderArchives();
          $('#btn-continue').disabled = !this.store.data.slots.some(Boolean);
        } catch (err) {
          this.toast('这个文件不是可用的本作档案。', true);
        }
      };
      fr.readAsText(file);
    });
    input.click();
  }

  // ---------------------------------------------------------------- 主界面渲染
  render() {
    if (!this.game) return;
    const s = this.game.state;
    const a = analyze(s);
    const v = validateConfirm(s, a);
    this.lastAnalysis = a;
    this.lastValidation = v;

    this.el.badge.textContent = CHAPTERS[s.chapter].title;
    this.el.dayNum.textContent = s.day;
    this.el.dayTotal.textContent = CHAPTERS[s.chapter].days;
    this.el.hands.textContent = `手 ${s.used} / ${s.capacity}`;
    this.el.hands.classList.toggle('warn', s.used >= s.capacity);
    this.el.material.textContent = `物资 ${s.material}`;
    this.el.material.classList.toggle('warn', s.material < 2);

    const supply = a.comps.reduce((n, c) => n + c.supply, 0);
    const demand = a.comps.reduce((n, c) => n + c.demand, 0);
    const deficit = a.comps.some(c => c.deficit > 0);
    this.el.power.textContent = `电力 ${supply} / ${demand}${deficit ? ' · 不足' : ''}`;
    this.el.power.classList.toggle('warn', deficit);

    this.renderBoard(a);
    this.renderTray();
    this.renderPanel();

    this.el.confirm.disabled = !v.ok || s.phase !== 'plan';
    this.el.confirm.textContent = s.phase !== 'plan' ? '今天已结算' : '确认这一天';
    if (!v.ok) {
      this.el.hint.textContent = v.errors[0].msg;
      this.el.hint.style.color = '#e6b9a9';
    } else if (v.warnings.length) {
      this.el.hint.textContent = v.warnings[0] + '（仍可确认）';
      this.el.hint.style.color = '#e6cfa5';
    } else {
      this.el.hint.textContent = '方案合法，可以开始这一天。';
      this.el.hint.style.color = '#b9d3bd';
    }
  }

  cardHTML(card, loc) {
    const s = this.game.state;
    const d = DISTRICTS[card.id];
    const f = d.faces[card.face];
    const ports = rotatePorts(f.ports, card.rot);
    const sel = this.selected && this.selected.zone === loc.zone && this.selected.index === loc.index;
    const badges = [];
    if (f.supply) badges.push(`<span class="badge supply">电 +${f.supply}</span>`);
    if (f.power) badges.push(`<span class="badge demand">耗 ${f.power}</span>`);
    if (f.beds) badges.push(`<span class="badge beds">床 ${f.beds}</span>`);
    const tags = [];
    if (f.warm) tags.push('暖屋');
    if (f.meal) tags.push('共食');
    if (f.clinic) tags.push('诊疗');
    if (f.post) tags.push('邮务');
    if (f.meeting) tags.push('集会');
    if (f.publicBoard) tags.push('公开');
    if (tags.length) badges.push(`<span class="badge tag">${tags.join('·')}</span>`);

    const seen = new Set();
    const tokens = [];
    for (const rid of CHAPTERS[s.chapter].residents) {
      const isHome = s.homes[rid] === card.uid;
      const isWork = s.work[rid] === card.uid;
      if (!isHome && !isWork) continue;
      if (seen.has(rid)) continue;
      seen.add(rid);
      tokens.push(`<img class="token ${isWork ? 'work' : ''}" src="assets/residents/${RESIDENTS[rid].art}.png" alt="${RESIDENTS[rid].name}" title="${RESIDENTS[rid].name}${isHome ? ' · 归处' : ''}${isWork ? ' · 工作' : ''}">`);
    }

    const attr = loc.zone === 'board' ? `data-slot="${loc.index}"` : `data-index="${loc.index}"`;
    return `<div class="card ${sel ? 'selected' : ''}" data-zone="${loc.zone}" ${attr}>
      <div class="card-art" style="--rot:${(card.rot || 0) * 90}deg;background-image:url('assets/cards/${f.art}.png')"></div>
      <i class="port n ${ports.includes('N') ? '' : 'off'}"></i>
      <i class="port e ${ports.includes('E') ? '' : 'off'}"></i>
      <i class="port s ${ports.includes('S') ? '' : 'off'}"></i>
      <i class="port w ${ports.includes('W') ? '' : 'off'}"></i>
      <div class="badges">${badges.join('')}</div>
      <div class="tokens">${tokens.join('')}</div>
      <div class="card-name">${d.name} · ${f.name}</div>
    </div>`;
  }

  renderBoard(a) {
    let html = '';
    for (let i = 0; i < 9; i++) {
      const card = this.game.state.board[i];
      if (card) html += this.cardHTML(card, { zone: 'board', index: i });
      else {
        const target = this.moveFrom ? ' target' : '';
        html += `<div class="slot${target}" data-slot="${i}">空位</div>`;
      }
    }
    this.el.board.innerHTML = html;
  }

  renderTray() {
    const tray = this.game.state.tray;
    if (!tray.length) {
      this.el.tray.innerHTML = '<span class="tray-empty">托盘是空的</span>';
      return;
    }
    this.el.tray.innerHTML = tray.map((card, i) => this.cardHTML(card, { zone: 'tray', index: i })).join('');
  }

  select(loc) {
    if (!this.game) return;
    if (this.selected && this.selected.zone === loc.zone && this.selected.index === loc.index) {
      if (this.moveFrom) return;
      this.selected = null;
      this.previewFace = null;
      this.render();
      return;
    }
    this.selected = loc;
    const card = this.game.locate(loc);
    this.previewFace = card ? card.face : null;
    this.tab = 'card';
    this.el.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'card'));
    this.render();
  }

  deselect() {
    this.selected = null;
    this.previewFace = null;
    this.moveFrom = null;
    this.render();
  }

  onSlotClick(slot) {
    if (!this.game || this.game.state.phase !== 'plan') return;
    const card = this.game.state.board[slot];
    if (this.moveFrom) {
      const from = this.moveFrom;
      this.moveFrom = null;
      const res = this.game.move(from, slot);
      if (!res.ok) { this.toast(res.msg, true); this.render(); return; }
      this.afterAction(res);
      this.selected = { zone: 'board', index: slot };
      this.previewFace = null;
      this.render();
      return;
    }
    if (this.selected && !card) {
      const res = this.game.move(this.selected, slot);
      if (!res.ok) { this.toast(res.msg, true); return; }
      this.afterAction(res);
      this.selected = { zone: 'board', index: slot };
      this.previewFace = null;
      this.render();
      return;
    }
    if (this.selected && this.selected.zone === 'tray') {
      const res = this.game.move(this.selected, slot);
      if (!res.ok) { this.toast(res.msg, true); return; }
      this.afterAction(res);
      this.selected = { zone: 'board', index: slot };
      this.previewFace = null;
      this.render();
      return;
    }
    if (card) {
      this.select({ zone: 'board', index: slot });
    } else if (this.selected) {
      this.deselect();
    }
  }

  afterAction(res) {
    if (res && res.achievements && res.achievements.length) {
      this.toast('成就：' + res.achievements.map(x => x.name).join('、'));
    }
    if (res && res.msg) this.toast(res.msg);
    this.persist();
  }

  // ---------------------------------------------------------------- 右侧面板
  renderPanel() {
    if (!this.game) return;
    if (this.tab === 'card') this.renderCardPanel();
    else if (this.tab === 'people') this.renderPeoplePanel();
    else this.renderTodayPanel();
  }

  renderCardPanel() {
    const s = this.game.state;
    const card = this.selected ? this.game.locate(this.selected) : null;
    if (!card) {
      const ch = CHAPTERS[s.chapter];
      this.el.panel.innerHTML = `
        <p class="p-title">${ch.title}</p>
        <p class="p-sub">${ch.subtitle}</p>
        <p class="p-text">${INTROS[s.chapter].lines.join('<br>')}</p>
        <p class="p-note">点一张街区卡查看两面。正面与背面不能同时展开；翻面、旋转、换位、收放各耗 1 手。</p>
        <div class="p-note">键盘：方向键选格 · Enter 选择 · R 旋转 · F 翻面 · Ctrl+Z 撤销</div>`;
      return;
    }
    const d = DISTRICTS[card.id];
    const pf = this.previewFace == null ? card.face : this.previewFace;
    const f = d.faces[pf];
    const pfPorts = rotatePorts(f.ports, card.rot);
    const cur = this.game.state;
    const boardCs = this.lastAnalysis.byUid[card.uid];
    const worker = boardCs && boardCs.staff ? RESIDENTS[boardCs.staff].name : null;
    const disabled = cur.disabled.includes(card.uid);
    const residentsHere = CHAPTERS[cur.chapter].residents.filter(rid => cur.homes[rid] === card.uid);
    const otherFace = 1 - pf;

    const stats = [];
    if (f.supply) stats.push(`<span class="p-stat good">供电 +${f.supply}</span>`);
    if (f.power) stats.push(`<span class="p-stat bad">耗电 ${f.power}</span>`);
    if (f.beds) stats.push(`<span class="p-stat good">床位 ${f.beds}</span>`);
    stats.push(`<span class="p-stat">路口 ${DIRCN(pfPorts)}</span>`);
    if (f.meal) stats.push('<span class="p-stat">公共厨房</span>');
    if (f.clinic) stats.push('<span class="p-stat">诊室</span>');
    if (f.warm) stats.push('<span class="p-stat">暖屋</span>');
    if (f.post) stats.push('<span class="p-stat">邮务台</span>');
    if (f.staff) stats.push(`<span class="p-stat ${worker ? 'good' : 'bad'}">值守 ${worker || '未安排：' + f.staff.who.map(r => RESIDENTS[r].name).join(' / ')}</span>`);

    let actions = `
      <div class="face-switch">
        <button data-do="preview" data-face="0" class="${pf === 0 ? 'active' : ''}">正面</button>
        <button data-do="preview" data-face="1" class="${pf === 1 ? 'active' : ''}">背面</button>
      </div>
      <div class="p-actions">
        <button class="btn paper strong" data-do="flip" ${this.game.canAct() ? '' : 'disabled'}>翻到${pf === card.face ? (card.face === 0 ? '背面' : '正面') : '这一面'}（1 手）</button>
        <div class="act-row">
          <button class="btn paper" data-do="rotate" ${this.game.canAct() ? '' : 'disabled'}>旋转 90°（1 手）</button>
          <button class="btn paper" data-do="move" ${this.game.canAct() ? '' : 'disabled'}>${this.selected.zone === 'tray' ? '放置到…' : '换位 / 移动…'}（1 手）</button>
        </div>`;
    if (this.selected.zone === 'board') {
      actions += `<button class="btn paper" data-do="pickup" ${this.game.canAct() ? '' : 'disabled'}>收到托盘（1 手）</button>`;
    }
    if (f.power) {
      actions += `<button class="btn paper" data-do="service">${disabled ? '恢复本日服务' : '本日停用服务'}</button>`;
    }
    if (f.staff) {
      const eligible = f.staff.who.filter(rid => CHAPTERS[cur.chapter].residents.includes(rid));
      if (boardCs && boardCs.staff) {
        actions += `<button class="btn paper" data-do="unwork">取消 ${RESIDENTS[boardCs.staff].name} 的值守</button>`;
      } else {
        for (const rid of eligible) {
          actions += `<button class="btn paper" data-do="work" data-rid="${rid}">安排 ${RESIDENTS[rid].name} 值守</button>`;
        }
      }
    }
    if (card.id === 'S04' && card.face === 0 && !cur.shopUsed) {
      actions += `<button class="btn paper" data-do="shop" ${this.game.canAct() ? '' : 'disabled'}>用 2 物资换入报栏（1 手）</button>`;
    }
    if (card.id === 'S05' && card.face === 0 && cur.enabledAgreements.includes('A02') && !cur.a02Used && !cur.tempBedUid) {
      actions += `<button class="btn paper" data-do="a02" ${this.game.canAct() ? '' : 'disabled'}>借住一晚：临时 +1 床（1 手）</button>`;
    }
    actions += '</div>';

    const notes = [];
    if (this.selected.zone === 'tray') notes.push('这张卡还在托盘里。翻面与旋转可以先调整，放进卡位后才进入城市。');
    if (residentsHere.length) notes.push(`归处在这里：${residentsHere.map(r => RESIDENTS[r].name).join('、')}（${residentsHere.length} / ${this.lastAnalysis.beds[card.uid] || 0} 床）。`);
    if (card.face !== pf) notes.push(`正在预览${pf === 0 ? '正' : '背'}面。预览不改变世界，翻面才计 1 手。`);
    if (disabled) notes.push('这一面的耗电服务本日已停用。');

    this.el.panel.innerHTML = `
      <p class="p-title">${d.name}</p>
      <p class="p-sub">${f.name} · ${d.id} · ${pf === 0 ? '正面' : '背面'}${card.rot ? ` · ${card.rot * 90}°` : ''}</p>
      <div class="p-art"><img src="assets/cards/${f.art}.png" alt="${esc(f.name)}"></div>
      <div class="p-stats">${stats.join('')}</div>
      <p class="p-text">${esc(f.text)}</p>
      ${actions}
      ${notes.length ? `<div class="p-note">${notes.map(esc).join('<br>')}</div>` : ''}
      <div class="p-note">居民值守与归处不耗手数；迁居耗 1 手。翻面后若床位消失，确认前必须替住户选好新归处。</div>
    `;
  }

  renderPeoplePanel() {
    const s = this.game.state;
    const a = this.lastAnalysis;
    const ch = CHAPTERS[s.chapter];
    const rows = ch.residents.map(rid => {
      const r = RESIDENTS[rid];
      const homeOpts = a.cards.filter(cs => (cs.face.beds || 0) > 0).map(cs => {
        const dd = DISTRICTS[cs.card.id];
        const cap = a.beds[cs.card.uid] || 0;
        return `<option value="${cs.card.uid}" ${s.homes[rid] === cs.card.uid ? 'selected' : ''}>${dd.name}·${cs.face.name}（${a.homeCount[cs.card.uid] || 0}/${cap}）</option>`;
      }).join('');
      const workOpts = [`<option value="">不安排工作</option>`].concat(
        a.cards.filter(cs => cs.face.staff && cs.face.staff.who.includes(rid)).map(cs => {
          const dd = DISTRICTS[cs.card.id];
          return `<option value="${cs.card.uid}" ${s.work[rid] === cs.card.uid ? 'selected' : ''}>${dd.name}·${cs.face.name}</option>`;
        })
      ).join('');
      const fatigue = s.fatigue[rid] || 0;
      const fat = fatigue >= 2
        ? `<span class="fatigue warn">已连续两日 · 需休息</span>`
        : `<span class="fatigue">连续工作 ${fatigue} / 2</span>`;
      const temp = s.tempDays[rid] ? `<span class="fatigue warn">临时住处 ${s.tempDays[rid]} 日</span>` : '';
      return `<div class="person">
        <img src="assets/residents/${r.art}.png" alt="${r.name}">
        <div class="person-body">
          <div class="person-head"><span class="person-name">${r.name}</span><span class="person-role">${r.role}</span>${fat}${temp}</div>
          <div class="person-quote">“${r.quote}”</div>
          <label>归处（迁居 1 手）
            <select data-role="home" data-rid="${rid}">${homeOpts || '<option value="">没有可用床位</option>'}</select>
          </label>
          <label>本日工作
            <select data-role="work" data-rid="${rid}">${workOpts}</select>
          </label>
        </div>
      </div>`;
    }).join('');
    this.el.panel.innerHTML = `<p class="p-title">名册</p><p class="p-sub">${ch.residents.length} 名居民 · 归处是硬条件</p>${rows}
      <div class="p-note">连续工作两日后必须休息一日。安排工作不耗手数；迁居耗 1 手。</div>`;
  }

  peopleChange(role, rid, value) {
    if (!this.game) return;
    let res;
    if (role === 'home') res = this.game.setHome(rid, value);
    else res = this.game.setWork(rid, value || null);
    if (!res.ok) { this.toast(res.msg, true); this.render(); return; }
    this.afterAction(res);
    this.render();
  }

  renderTodayPanel() {
    const s = this.game.state;
    const a = this.lastAnalysis;
    const v = this.lastValidation;
    const ch = CHAPTERS[s.chapter];
    const evals = evaluateGoals(s, a);

    const goals = ch.goals.map(g => {
      const e = evals.find(x => x.id === g.id) || { ok: false };
      return `<div class="goal ${e.ok ? 'ok' : ''}"><span class="mark">${e.ok ? '✓' : ''}</span><span class="goal-label">${g.label}<span class="goal-hint">${g.hint}</span></span></div>`;
    }).join('');

    const comps = a.comps.map(c => {
      if (!c.slots.length) return '';
      const names = c.slots.map(i => a.bySlot[i]).filter(Boolean).map(cs => DISTRICTS[cs.card.id].name).join('、');
      const tail = c.deficit > 0 ? `<b style="color:#8a3a2c">缺 ${c.deficit}</b>` : '平衡';
      return `<div class="kv"><span>${names}</span><span>${c.supply} / ${c.demand} · ${tail}</span></div>`;
    }).join('');

    const meal = a.meal.kitchen
      ? (a.meal.active ? `${a.meal.participants.length} 人可走到（≤ ${a.mealLimit} 段），耗物资 ${a.mealCost}` : '未运转：需要通电与组织者')
      : '没有公共厨房';
    const clinic = a.clinic.card
      ? (a.clinic.active ? `${a.clinic.patients.length} 人可达（≤ 3 段）` : '未运转：需要通电与阿梨值守')
      : '没有诊室';
    const post = a.post.card ? (a.post.active ? '邮务台有人值守' : '邮务台未安排值守') : '没有邮务台';

    const totalBeds = Object.values(a.beds).reduce((n, x) => n + x, 0);
    const lived = ch.residents.filter(rid => a.byUid[s.homes[rid]]).length;

    const errors = v.errors.map(e => `<div class="err">${e.msg}</div>`).join('');
    const warns = v.warnings.map(w => `<div class="warnbox">${w}</div>`).join('');

    const promises = s.promises.length ? `<ul class="tiny-list">${s.promises.map(p => {
      const st = p.status === 'done' ? '已兑现' : p.status === 'failed' ? '未赶上' : `第 ${p.dueDay} 天前`;
      return `<li>${RESIDENTS[p.rid].name}的${p.what} · ${st}</li>`;
    }).join('')}</ul>` : '<div class="p-note">今天还没有接下的私人承诺。</div>';

    const ach = Object.keys(s.achievements);
    const achHtml = ach.length ? `<p class="p-note">已解锁成就 ${ach.length} 项：${ach.map(id => ({ a01: '翻过来看看', a02: '这条路通了', a03: '一桌热饭', a04: '借住之后', a06: '一点也没剩', a09: '寄到了', a12: '先问一句', a15: '背面也住着人' }[id] || id)).join('、')}</p>` : '';

    this.el.panel.innerHTML = `
      <p class="p-title">本日安排</p>
      <p class="p-sub">第 ${s.day} 天 · 手数 ${s.used}/${s.capacity} · 物资 ${s.material}</p>
      ${errors}${warns}
      <div class="sec-title">公开目标</div>
      ${goals}
      <div class="sec-title">电力分区</div>
      ${comps || '<div class="p-note">桌上还没有街区。</div>'}
      <div class="sec-title">服务</div>
      <div class="kv"><span>共食</span><span>${meal}</span></div>
      <div class="kv"><span>诊疗</span><span>${clinic}</span></div>
      <div class="kv"><span>邮亭</span><span>${post}</span></div>
      <div class="kv"><span>暖屋</span><span>${a.warm.length} 人</span></div>
      <div class="kv"><span>床位</span><span>${lived} / ${totalBeds} 张</span></div>
      <div class="sec-title">私人承诺</div>
      ${promises}
      ${achHtml}
      <div class="p-note">确认后才会扣除物资、推进日期；规划中可无限撤销。</div>
    `;
  }

  DIRCN(ports) {
    const map = { N: '北', E: '东', S: '南', W: '西' };
    return ports.split('').map(p => map[p]).join(' / ') || '无';
  }

  // ---------------------------------------------------------------- 面板操作
  panelAction(data) {
    if (!this.game) return;
    const doAct = data.do;
    if (doAct === 'preview') {
      this.previewFace = Number(data.face);
      this.render();
      return;
    }
    if (doAct === 'work') {
      const res = this.game.setWork(data.rid, this.selectedCardUid());
      if (!res.ok) this.toast(res.msg, true);
      else this.toast(`${RESIDENTS[data.rid].name}开始值守。`);
      this.persist(); this.render();
      return;
    }
    if (doAct === 'unwork') {
      const cs = this.lastAnalysis.byUid[this.selectedCardUid()];
      if (cs && cs.staff) {
        this.game.setWork(cs.staff, null);
        this.toast(`${RESIDENTS[cs.staff].name}今天不再值守。`);
        this.persist(); this.render();
      }
      return;
    }
    if (doAct === 'service') {
      const res = this.game.toggleService(this.selectedCardUid());
      if (!res.ok) this.toast(res.msg, true);
      this.persist(); this.render();
      return;
    }
    if (doAct === 'move') {
      if (!this.game.canAct()) { this.toast('今天的手数已经用完。', true); return; }
      this.moveFrom = this.selected;
      this.toast('选择一张目标卡位。再点当前卡可以取消。');
      this.render();
      this.el.board.classList.add('choosing');
      return;
    }
    const loc = this.selected;
    let res;
    if (doAct === 'flip') res = this.game.flip(loc);
    else if (doAct === 'rotate') res = this.game.rotate(loc);
    else if (doAct === 'pickup') res = this.game.pickup(loc.index);
    else if (doAct === 'shop') res = this.game.shopExchange(this.selectedCardUid());
    else if (doAct === 'a02') res = this.game.useA02(this.selectedCardUid());
    if (!res) return;
    if (!res.ok) { this.toast(res.msg, true); return; }
    this.afterAction(res);
    this.previewFace = null;
    this.render();
  }

  selectedCardUid() {
    const c = this.selected ? this.game.locate(this.selected) : null;
    return c ? c.uid : null;
  }

  // ---------------------------------------------------------------- 顶部操作
  topAction(act) {
    if (!this.game) return;
    if (act === 'undo' || act === 'redo') {
      const res = this.game[act]();
      if (!res.ok) { this.toast(res.msg, true); return; }
      this.selected = null; this.previewFace = null; this.moveFrom = null;
      this.persist(); this.render();
      return;
    }
    if (act === 'agreements') { this.showAgreements(); return; }
    if (act === 'archives') { this.overlayMode = 'load'; this.renderArchives(); return; }
    if (act === 'help') { this.showHelp(); return; }
  }

  showAgreements() {
    const s = this.game.state;
    const owned = s.ownedAgreements;
    if (!owned.length) {
      this.openOverlay(`
        <p class="ov-kicker">桌边签字槽</p>
        <h2 class="ov-title">约定还没有到手</h2>
        <p class="ov-sub">第一章只使用街区与居民。</p>
        <p class="ov-story">第二章会固定获得两张约定卡：A01「先吃上饭」与 A02「借住一晚」。约定会改变明写的规则，也带来可见代价。</p>
        <div class="ov-actions"><button class="btn paper small" data-ov="close">关闭</button></div>
      `);
      this.bindOverlay({ close: () => this.closeOverlay() });
      return;
    }
    const rows = owned.map(id => {
      const ag = AGREEMENTS[id];
      const on = s.enabledAgreements.includes(id);
      return `<div class="slot-row">
        <div class="slot-info">
          <div class="slot-name">${ag.name} · ${on ? '已启用' : '未启用'}</div>
          <div class="slot-meta">${esc(ag.effect)}　代价：${esc(ag.cost)}</div>
        </div>
        <div class="slot-actions">
          <button class="btn paper small" data-ov="agreement" data-id="${id}">${on ? '撤回' : '启用'}（1 手）</button>
        </div>
      </div>`;
    }).join('');
    const p = s.promises.length ? s.promises.map(x => `<li>${RESIDENTS[x.rid].name}的${x.what} · ${x.status === 'done' ? '已兑现' : x.status === 'failed' ? '未赶上' : `第 ${x.dueDay} 天前`}</li>`).join('') : '<li>还没有私人承诺。</li>';
    this.openOverlay(`
      <p class="ov-kicker">桌边签字槽</p>
      <h2 class="ov-title">约定</h2>
      <p class="ov-sub">同一时刻至多启用 2 张；启用与替换各计 1 手，每日最多换 1 张。</p>
      ${rows}
      <p class="ov-sec">原始文本</p>
      <p class="ov-story">${owned.map(id => `<b>${AGREEMENTS[id].name}</b>：${esc(AGREEMENTS[id].effect)} 代价：${esc(AGREEMENTS[id].cost)}<br>${esc(AGREEMENTS[id].hint)}`).join('<br><br>')}</p>
      <p class="ov-sec">私人承诺</p>
      <ul class="ov-list">${p}</ul>
      <div class="ov-actions"><button class="btn paper small" data-ov="close">关闭</button></div>
    `);
    this.bindOverlay({
      close: () => this.closeOverlay(),
      agreement: b => {
        const res = this.game.toggleAgreement(b.dataset.id);
        if (!res.ok) { this.toast(res.msg, true); return; }
        this.persist();
        this.render();
        this.showAgreements();
      },
    });
  }

  showHelp() {
    this.openOverlay(`
      <p class="ov-kicker">操作说明</p>
      <h2 class="ov-title">怎么摆这座城</h2>
      <p class="ov-sub">横屏 · 点击与键盘完全等价</p>
      <ul class="ov-list">
        <li>点卡片查看两面；预览不耗手数，翻面才计 1 手。</li>
        <li>点卡后再点空格：放置或移动。点“换位 / 移动…”后再点任意格：交换两张卡。</li>
        <li>旋转、翻面、换位、收放、迁居、换约定各耗 1 手；每日默认 4 手，可无限撤销。</li>
        <li>相邻卡的两条相对边都开路才算连通；电力不跨断路分配。</li>
        <li>确认一天前，所有居民必须有归处；供电不足或物资不够时不能开始。</li>
        <li>连续工作两日后必须休息；确认后进入夜间记录。</li>
      </ul>
      <p class="ov-sec">键盘</p>
      <p class="ov-story">方向键选格 · Enter 选择 / 落位 · R 旋转 · F 翻面 · Ctrl+Z 撤销 · Ctrl+Y 重做 · Esc 取消选择</p>
      <p class="ov-sec">显示</p>
      <div class="ov-choices">
        <button class="ov-choice" data-ov="toggle-large">${this.store.data.settings.large ? '关闭' : '开启'}大字号</button>
        <button class="ov-choice" data-ov="toggle-motion">${this.store.data.settings.lowMotion ? '关闭' : '开启'}低动态</button>
      </div>
      <div class="ov-actions"><button class="btn paper small" data-ov="close">关闭</button></div>
    `);
    this.bindOverlay({
      close: () => this.closeOverlay(),
      'toggle-large': () => {
        this.store.data.settings.large = !this.store.data.settings.large;
        this.store.persist(); this.applySettings(); this.showHelp();
      },
      'toggle-motion': () => {
        this.store.data.settings.lowMotion = !this.store.data.settings.lowMotion;
        this.store.persist(); this.applySettings(); this.showHelp();
      },
    });
  }

  // ---------------------------------------------------------------- 结算与叙事
  confirmDay() {
    if (!this.game || this.game.state.phase !== 'plan') return;
    const res = this.game.settle();
    if (!res.ok) {
      const msg = res.errors && res.errors[0] ? res.errors[0].msg : '今天还不能结算。';
      this.toast(msg, true);
      this.render();
      return;
    }
    this.persist();
    this.selected = null;
    this.previewFace = null;
    this.render();
    this.showNight(res.report);
    if (res.report.achievements.length) {
      this.toast('成就：' + res.report.achievements.map(x => x.name).join('、'));
    }
  }

  showNight(report) {
    const s = this.game.state;
    const sec = (title, list) => list && list.length
      ? `<p class="ov-sec">${title}</p><ul class="ov-list">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const ach = report.achievements.length
      ? `<p class="ov-sec">成就</p><div class="ov-achievements">${report.achievements.map(a => `<span class="ach-chip">${esc(a.name)}</span>`).join('')}</div>` : '';
    const goals = report.chapterDone
      ? `<p class="ov-sec">本章目标</p><ul class="ov-list">${report.goals.map(g => `<li>${g.ok ? '已达成' : '未达成'} · ${esc(goalLabel(s.chapter, g.id))}</li>`).join('')}</ul>` : '';
    const nextLabel = report.chapterDone ? '查看本章结果' : `进入第 ${s.day + 1} 天`;
    this.openOverlay(`
      <p class="ov-kicker">夜间记录</p>
      <h2 class="ov-title">第 ${report.day} 天的桌面</h2>
      <p class="ov-sub">今天做成 / 没赶上 / 谁留言</p>
      ${sec('今天做成', report.made)}
      ${sec('没赶上', report.missed)}
      ${sec('谁留言', report.notes)}
      ${goals}
      ${ach}
      <div class="ov-actions"><button class="btn paper strong" data-ov="night">${nextLabel}</button></div>
    `);
    this.bindOverlay({ night: () => this.afterNight() });
  }

  afterNight() {
    const s = this.game.state;
    if (s.lastReport && s.lastReport.chapterDone) {
      this.showChapterResult();
      return;
    }
    const ev = eventFor(s);
    if (ev) { this.showEvent(ev); return; }
    this.advanceNext();
  }

  showEvent(ev) {
    this.pendingEvent = ev;
    this.openOverlay(`
      <p class="ov-kicker">桌边的事</p>
      <h2 class="ov-title">${esc(ev.title)}</h2>
      <p class="ov-story">${esc(ev.text)}</p>
      <div class="ov-choices">
        ${ev.options.map((o, i) => `<button class="ov-choice" data-ov="choice" data-i="${i}">${esc(o.label)}</button>`).join('')}
      </div>
    `);
    this.bindOverlay({
      choice: b => this.pickEvent(Number(b.dataset.i)),
    });
  }

  pickEvent(i) {
    const ev = this.pendingEvent;
    if (!ev) return;
    const opt = ev.options[i];
    const s = this.game.state;
    if (opt && typeof opt.apply === 'function') opt.apply(s);
    if (!s.seenEvents) s.seenEvents = {};
    s.seenEvents[`${s.chapter}-${s.day}`] = true;
    this.persist();
    this.pendingEvent = null;
    this.openOverlay(`
      <p class="ov-kicker">夜里</p>
      <h2 class="ov-title">${esc(ev.title)}</h2>
      <div class="ov-reply">${esc(opt.reply)}</div>
      <div class="ov-actions"><button class="btn paper strong" data-ov="go">继续</button></div>
    `);
    this.bindOverlay({ go: () => this.advanceNext() });
  }

  advanceNext() {
    const s = this.game.state;
    this.closeOverlay();
    advanceDay(s);
    this.game.undoStack = [];
    this.game.redoStack = [];
    this.selected = null;
    this.previewFace = null;
    this.moveFrom = null;
    this.pendingEvent = null;
    this.persist();
    this.render();
    this.toast(`第 ${s.day} 天 · 手数 ${s.capacity}`);
  }

  showChapterResult() {
    const s = this.game.state;
    if (s.chapter === 1) { this.showEnding(); return; }
    const cr = chapterResult(s);
    const report = s.lastReport || { goals: [] };
    const goals = report.goals.map(g => `<li>${g.ok ? '已达成' : '未达成'} · ${esc(goalLabel(s.chapter, g.id))}</li>`).join('');
    this.openOverlay(`
      <p class="ov-kicker">第一章 · 收束</p>
      <h2 class="ov-title">${esc(cr.title)}</h2>
      <p class="ov-sub">${esc(chapterResult(s).lines[0])}</p>
      <p class="ov-sec">目标</p>
      <ul class="ov-list">${goals}</ul>
      <p class="ov-sec">桌上的话</p>
      <p class="ov-story">${cr.lines.slice(1).map(esc).join('<br><br>')}</p>
      <div class="ov-actions"><button class="btn paper strong" data-ov="next">进入第二章</button></div>
    `);
    this.bindOverlay({ next: () => this.toChapter2() });
  }

  toChapter2() {
    const prev = this.game.state;
    const carry = Math.min(2, prev.material);
    const g = Game.new(1, carry);
    g.state.achievements = { ...prev.achievements };
    g.state.flags.mailDone = prev.flags.mailDone;
    g.state.flags.mailFailed = prev.flags.mailFailed;
    g.state.flags.chapter1Done = true;
    g.state.promises = prev.promises
      .filter(p => p.id === 'postcard')
      .map(p => (p.status === 'open' ? { ...p, status: 'failed' } : p));
    this.game = g;
    this.store.data.slots[this.store.data.active] = g.state;
    this.store.persist();
    this.closeOverlay();
    this.selected = null;
    this.previewFace = null;
    this.render();
    this.showIntro(1);
  }

  showEnding() {
    const s = this.game.state;
    const e = ending(s);
    const backs = CHAPTERS[1].residents.map(rid => {
      const rb = residentBack(s, rid);
      return `<div class="resident-back">
        <h4>${RESIDENTS[rid].name}</h4>
        <div class="home">${esc(rb.home)}</div>
        ${rb.lines.map(l => `<p>${esc(l)}</p>`).join('')}
      </div>`;
    }).join('');
    this.openOverlay(`
      <p class="ov-kicker">比赛独立篇 · 结束</p>
      <h2 class="ov-title">${esc(e.title)}</h2>
      <p class="ov-sub">${esc(e.sub)}</p>
      <p class="ov-story">${e.lines.map(esc).join('<br><br>')}</p>
      <div class="ending-tags">${e.tags.map(t => `<span class="ending-tag">${esc(t)}</span>`).join('')}</div>
      <p class="ov-sec">居民卡背</p>
      ${backs}
      <div class="ov-actions">
        <button class="btn paper small" data-ov="replay">重玩第二章</button>
        <button class="btn paper small" data-ov="menu">回到开始</button>
      </div>
    `);
    this.bindOverlay({
      replay: () => this.replayChapter2(),
      menu: () => { this.closeOverlay(); this.renderStart(); },
    });
  }

  replayChapter2() {
    const g = Game.new(1, 0);
    this.game = g;
    this.store.data.slots[this.store.data.active] = g.state;
    this.store.persist();
    this.closeOverlay();
    this.selected = null;
    this.tab = 'card';
    this.render();
    this.showIntro(1);
  }

  showIntro(chapterIndex) {
    const intro = INTROS[chapterIndex];
    this.openOverlay(`
      <p class="ov-kicker">${chapterIndex === 0 ? '比赛独立篇' : '第二章'}</p>
      <h2 class="ov-title">${esc(intro.title)}</h2>
      <p class="ov-sub">${esc(intro.sub)}</p>
      <p class="ov-story">${intro.lines.map(esc).join('<br><br>')}</p>
      <div class="ov-reply">${esc(intro.tip)}</div>
      <div class="ov-actions"><button class="btn paper strong" data-ov="begin">开始</button></div>
    `);
    this.bindOverlay({
      begin: () => {
        this.closeOverlay();
        this.render();
      },
    });
  }

  // ---------------------------------------------------------------- 浮层工具
  openOverlay(html) {
    this.el.overlayCard.innerHTML = html;
    this.el.overlay.classList.remove('hidden');
  }

  closeOverlay() {
    this.el.overlay.classList.add('hidden');
    this.pendingEvent = null;
  }

  bindOverlay(map) {
    this.el.overlayCard.querySelectorAll('[data-ov]').forEach(btn => {
      const fn = map[btn.dataset.ov];
      if (fn) btn.addEventListener('click', e => { e.stopPropagation(); fn(btn); });
    });
  }

  toast(msg, bad = false) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.el.toast.textContent = msg;
    this.el.toast.classList.toggle('bad', !!bad);
    this.el.toast.classList.add('show');
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.remove('show');
      this.toastTimer = null;
    }, 2600);
  }

  // ---------------------------------------------------------------- 键盘
  onKey(e) {
    if (!this.game) return;
    if (!this.el.overlay.classList.contains('hidden')) return;
    const s = this.game.state;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); this.topAction('undo'); return;
    }
    if (ctrl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault(); this.topAction('redo'); return;
    }
    if (k === 'Escape') {
      this.moveFrom = null; this.selected = null; this.previewFace = null; this.render(); return;
    }
    if (s.phase !== 'plan') return;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      let r = Math.floor(this.cursor / 3);
      let c = this.cursor % 3;
      if (k === 'ArrowLeft') c = Math.max(0, c - 1);
      if (k === 'ArrowRight') c = Math.min(2, c + 1);
      if (k === 'ArrowUp') r = Math.max(0, r - 1);
      if (k === 'ArrowDown') r = Math.min(2, r + 1);
      this.cursor = r * 3 + c;
      if (s.board[this.cursor]) this.select({ zone: 'board', index: this.cursor });
      else this.renderBoard(this.lastAnalysis);
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (this.moveFrom) { this.onSlotClick(this.cursor); return; }
      if (s.board[this.cursor]) this.select({ zone: 'board', index: this.cursor });
      return;
    }
    if (k === 'r' || k === 'R') {
      if (!this.selected) return;
      const res = this.game.rotate(this.selected);
      if (!res.ok) { this.toast(res.msg, true); return; }
      this.afterAction(res); this.previewFace = null; this.render(); return;
    }
    if (k === 'f' || k === 'F') {
      if (!this.selected) return;
      const res = this.game.flip(this.selected);
      if (!res.ok) { this.toast(res.msg, true); return; }
      this.afterAction(res); this.previewFace = null; this.render(); return;
    }
  }
}

function goalLabel(chapter, id) {
  const ch = CHAPTERS[chapter];
  const g = ch.goals.find(x => x.id === id);
  return g ? g.label : id;
}

function DIRCN(ports) {
  const map = { N: '北', E: '东', S: '南', W: '西' };
  return ports.split('').map(p => map[p]).join(' / ') || '无';
}
