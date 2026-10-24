// 《背面有座城》规则引擎
// 只在这里计算连通、供电、床位、service 距离与每日结算。
import { DISTRICTS, CHAPTERS, RESIDENTS, ACHIEVEMENTS } from './data.js';

const DIR_ORDER = 'NESW';
const CW = { N: 'E', E: 'S', S: 'W', W: 'N' };

export function rotatePorts(ports, rot) {
  let set = new Set(ports.split(''));
  const n = ((rot || 0) % 4 + 4) % 4;
  for (let i = 0; i < n; i++) {
    const next = new Set();
    for (const p of set) next.add(CW[p]);
    set = next;
  }
  return DIR_ORDER.split('').filter(d => set.has(d)).join('');
}

export function faceOf(card) {
  return DISTRICTS[card.id].faces[card.face];
}

export function portsOf(card) {
  return rotatePorts(faceOf(card).ports, card.rot);
}

let uidSeq = 0;
function mkUid() {
  uidSeq += 1;
  return 'u' + uidSeq.toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createState(chapterIndex, carry = 0) {
  const ch = CHAPTERS[chapterIndex];
  const board = Array(9).fill(null);
  for (const c of ch.initial) {
    board[c.slot] = { uid: mkUid(), id: c.id, face: c.face, rot: c.rot || 0 };
  }
  const tray = ch.tray.map(c => ({ uid: mkUid(), id: c.id, face: c.face, rot: c.rot || 0 }));

  const homes = {};
  const work = {};
  const fatigue = {};
  const tempDays = {};
  const seed = chapterIndex === 0
    ? [['r01', 0], ['r04', 0], ['r05', 0]]
    : [['r01', 0], ['r03', 0], ['r04', 0], ['r05', 0], ['r02', 2], ['r06', 2]];
  for (const [rid, slot] of seed) {
    if (board[slot]) homes[rid] = board[slot].uid;
  }
  for (const rid of ch.residents) {
    if (!homes[rid]) homes[rid] = null;
    work[rid] = null;
    fatigue[rid] = 0;
    tempDays[rid] = 0;
  }

  return {
    version: 1,
    chapter: chapterIndex,
    day: 1,
    used: 0,
    capacity: ch.hands,
    material: Math.min(9, ch.material + carry),
    carry,
    board,
    tray,
    homes,
    work,
    fatigue,
    tempDays,
    disabled: [],
    ownedAgreements: chapterIndex === 1 ? ['A01', 'A02'] : [],
    enabledAgreements: [],
    agreementChangedToday: false,
    tempBedUid: null,
    a02Used: false,
    shopUsed: false,
    flags: {
      flipDone: false,
      mealEver: false,
      clinicEver: false,
      mailDone: false,
      mailFailed: false,
      letterAsked: false,
      letterPublic: null,
      tempMoved: false,
      chapter1Done: false,
    },
    achievements: {},
    promises: [],
    seenEvents: {},
    phase: 'plan',
    resolutionId: null,
    lastReport: null,
  };
}

function bfs(start, adj) {
  const dist = Array(9).fill(-1);
  if (start < 0) return dist;
  dist[start] = 0;
  const q = [start];
  while (q.length) {
    const s = q.shift();
    for (const n of adj[s]) {
      if (dist[n] === -1) {
        dist[n] = dist[s] + 1;
        q.push(n);
      }
    }
  }
  return dist;
}

// 棋盘结构、道路连接、供电与床位的一次性计算
function buildBoard(state) {
  const bySlot = Array(9).fill(null);
  const byUid = {};
  state.board.forEach((card, slot) => {
    if (!card) return;
    const face = faceOf(card);
    const ports = rotatePorts(face.ports, card.rot);
    const cs = {
      slot, card, face, ports,
      staff: null,
      disabled: state.disabled.includes(card.uid),
      supplyOn: 0,
      demandOn: 0,
      staffed: true,
    };
    bySlot[slot] = cs;
    byUid[card.uid] = cs;
  });

  for (const [rid, uid] of Object.entries(state.work || {})) {
    const cs = byUid[uid];
    if (cs && cs.face.staff && cs.face.staff.who.includes(rid) && !cs.staff) cs.staff = rid;
  }

  const adj = Array.from({ length: 9 }, () => []);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const a = bySlot[i];
      if (!a) continue;
      if (c < 2) {
        const b = bySlot[i + 1];
        if (b && a.ports.includes('E') && b.ports.includes('W')) {
          adj[i].push(i + 1); adj[i + 1].push(i);
        }
      }
      if (r < 2) {
        const b = bySlot[i + 3];
        if (b && a.ports.includes('S') && b.ports.includes('N')) {
          adj[i].push(i + 3); adj[i + 3].push(i);
        }
      }
    }
  }

  const comps = [];
  const compOfSlot = Array(9).fill(-1);
  const seen = new Set();
  for (let i = 0; i < 9; i++) {
    if (!bySlot[i] || seen.has(i)) continue;
    const stack = [i];
    seen.add(i);
    const slots = [];
    while (stack.length) {
      const s = stack.pop();
      slots.push(s);
      for (const n of adj[s]) {
        if (!seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    slots.sort((a, b) => a - b);
    comps.push({ id: comps.length, slots, supply: 0, demand: 0, deficit: 0 });
    slots.forEach(s => { compOfSlot[s] = comps.length - 1; });
  }

  const cards = bySlot.filter(Boolean);
  for (const cs of cards) {
    cs.staffed = cs.face.staff ? !!cs.staff : true;
    cs.supplyOn = (!cs.face.staff || cs.staff) ? (cs.face.supply || 0) : 0;
    cs.demandOn = (cs.disabled || (cs.face.staff && !cs.staff)) ? 0 : (cs.face.power || 0);
    const comp = comps[compOfSlot[cs.slot]];
    comp.supply += cs.supplyOn;
    comp.demand += cs.demandOn;
  }
  for (const comp of comps) comp.deficit = Math.max(0, comp.demand - comp.supply);

  return { bySlot, byUid, adj, comps, compOfSlot, cards };
}

function districtLabel(cs) {
  return DISTRICTS[cs.card.id].name + '·' + cs.face.name;
}

export function analyze(state) {
  const { bySlot, byUid, adj, comps, compOfSlot, cards } = buildBoard(state);
  const ch = CHAPTERS[state.chapter];
  const resIds = ch.residents;
  const A01 = state.enabledAgreements.includes('A01');
  const mealLimit = A01 ? 4 : 3;
  const mealCost = A01 ? 2 : 1;

  const powered = cs => {
    const comp = comps[compOfSlot[cs.slot]];
    return cs.demandOn > 0 && comp.deficit === 0;
  };

  // 床位与归处
  const beds = {};
  for (const cs of cards) {
    let cap = cs.face.beds || 0;
    if (state.tempBedUid === cs.card.uid) cap += 1;
    beds[cs.card.uid] = cap;
  }
  const homeCount = {};
  for (const rid of resIds) {
    const uid = state.homes[rid];
    if (uid && byUid[uid]) homeCount[uid] = (homeCount[uid] || 0) + 1;
  }
  const homeless = resIds.filter(rid => {
    const uid = state.homes[rid];
    return !uid || !byUid[uid] || (beds[uid] || 0) <= 0;
  });
  const bedOver = Object.keys(homeCount)
    .filter(uid => homeCount[uid] > (beds[uid] || 0))
    .map(uid => ({ uid, cap: beds[uid] || 0, count: homeCount[uid], name: DISTRICTS[byUid[uid].card.id].name }));

  // 厨房
  const kitchenCs = cards.find(cs => cs.face.meal) || null;
  const meal = {
    kitchen: kitchenCs, active: false, cost: mealCost, limit: mealLimit,
    participants: [], ok: false, materialOk: state.material >= mealCost,
  };
  if (kitchenCs) {
    const comp = comps[compOfSlot[kitchenCs.slot]];
    meal.active = kitchenCs.staffed && !kitchenCs.disabled && powered(kitchenCs);
    const dist = bfs(kitchenCs.slot, adj);
    meal.participants = resIds.filter(rid => {
      const home = byUid[state.homes[rid]];
      if (!home) return false;
      const d = dist[home.slot];
      return d >= 0 && d <= mealLimit;
    });
    const need = state.chapter === 0 ? 3 : 4;
    meal.ok = meal.active && meal.materialOk && meal.participants.length >= need;
  }

  // 诊室
  const clinicCs = cards.find(cs => cs.face.clinic) || null;
  const clinic = { card: clinicCs, active: false, patients: [], ok: false };
  if (clinicCs) {
    clinic.active = clinicCs.staffed && !clinicCs.disabled && powered(clinicCs);
    const dist = bfs(clinicCs.slot, adj);
    clinic.patients = resIds.filter(rid => {
      const home = byUid[state.homes[rid]];
      if (!home) return false;
      const d = dist[home.slot];
      return d >= 0 && d <= 3;
    });
    clinic.ok = clinic.active && clinic.patients.length > 0;
  }

  // 暖屋
  const warm = resIds.filter(rid => {
    const home = byUid[state.homes[rid]];
    return home && home.face.warm && powered(home);
  });

  // 邮亭
  const postCs = cards.find(cs => cs.face.post) || null;
  const post = { card: postCs, active: !!(postCs && postCs.staffed && !postCs.disabled) };

  const distance = fromSlot => (fromSlot == null ? Array(9).fill(-1) : bfs(fromSlot, adj));

  return {
    cards, bySlot, byUid, adj, comps, compOfSlot,
    beds, homeCount, homeless, bedOver,
    meal, clinic, warm, post, powered, distance,
    A01, mealLimit, mealCost,
  };
}

export function validateConfirm(state, a = analyze(state)) {
  const errors = [];
  const warnings = [];
  const ch = CHAPTERS[state.chapter];

  for (const rid of a.homeless) {
    errors.push({ type: 'home', msg: `${RESIDENTS[rid].name}还没有归处。给这个人指定一张有床位的卡。` });
  }
  for (const b of a.bedOver) {
    errors.push({ type: 'beds', msg: `${b.name}只有 ${b.cap} 张床位，现在住了 ${b.count} 人。` });
  }
  for (const comp of a.comps) {
    if (comp.deficit > 0) {
      const names = comp.slots.map(s => a.bySlot[s]).filter(cs => cs.demandOn > 0).map(districtLabel);
      errors.push({ type: 'power', msg: `${names.join('、')}这一片还差 ${comp.deficit} 点电力。停用其中一项服务，或补上供电源头。`, slots: comp.slots });
    }
  }
  if (a.meal.active && !a.meal.materialOk) {
    errors.push({ type: 'material', msg: `厨房今天需要 ${a.mealCost} 份物资，库存只有 ${state.material} 份。` });
  }
  for (const rid of ch.residents) {
    if (state.work[rid] && (state.fatigue[rid] || 0) >= 2) {
      errors.push({ type: 'rest', msg: `${RESIDENTS[rid].name}已连续工作两日，今天必须休息。` });
    }
  }

  if (!a.meal.ok) {
    if (!a.meal.kitchen) warnings.push('桌上还没有公共厨房，今天不会共食。');
    else if (!a.meal.active) warnings.push('厨房没有运转：确认通电、有人组织。');
    else if (!a.meal.materialOk) warnings.push('厨房的物资不够。');
    else warnings.push(`厨房开了，但只有 ${a.meal.participants.length} 人能走到，饭桌还坐不满。`);
  }
  if (!a.clinic.ok && a.clinic.card) warnings.push('诊室今天没有有效接诊。');
  for (const rid of ch.residents) {
    if ((state.tempDays[rid] || 0) >= 2 && a.byUid[state.homes[rid]] && a.byUid[state.homes[rid]].face.temp) {
      warnings.push(`${RESIDENTS[rid].name}在临时住处已住满两日。最好在下一日前迁居。`);
    }
    if ((state.fatigue[rid] || 0) === 1 && state.work[rid]) {
      warnings.push(`${RESIDENTS[rid].name}明天需要休息，别把关键岗位排在同一天。`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function evaluateGoals(state, a = analyze(state)) {
  const housed = a.homeless.length === 0 && a.bedOver.length === 0;
  if (state.chapter === 0) {
    let lit = false;
    const home = a.byUid[state.homes['r05']];
    if (home) {
      const comp = a.comps[a.compOfSlot[home.slot]];
      lit = comp.supply > 0 && comp.deficit === 0;
    }
    return [
      { id: 'housed', ok: housed },
      { id: 'meal', ok: state.flags.mealEver || a.meal.ok },
      { id: 'lit', ok: lit },
    ];
  }
  return [
    { id: 'housed', ok: housed },
    { id: 'clinic', ok: state.flags.clinicEver || a.clinic.ok },
    { id: 'mealFinal', ok: a.meal.ok },
  ];
}

function unlock(state, list, id) {
  if (state.achievements[id]) return;
  state.achievements[id] = state.day;
  const rec = ACHIEVEMENTS.find(x => x.id === id);
  if (rec) list.push({ id, name: rec.name });
}

export function settleDay(state) {
  if (state.phase !== 'plan') return { ok: false, errors: [{ msg: '今天已经结算过了。' }] };
  const a = analyze(state);
  const v = validateConfirm(state, a);
  if (!v.ok) return { ok: false, errors: v.errors };

  const ch = CHAPTERS[state.chapter];
  const made = [];
  const missed = [];
  const notes = [];
  const achievements = [];

  // 物资结算
  let cost = 0;
  if (a.meal.active) cost = a.mealCost;
  state.material = Math.max(0, Math.min(9, state.material - cost));

  if (a.meal.ok) {
    state.flags.mealEver = true;
    made.push(`共食：${a.meal.participants.length} 人坐下，厨房用掉 ${cost} 份物资。`);
  } else if (a.meal.kitchen) {
    missed.push(a.meal.active ? `厨房开了，但只有 ${a.meal.participants.length} 人能走到，饭没有聚成。` : '厨房没有开：需要通电、有人组织。');
  } else {
    missed.push('今天没有公共厨房，饭桌没有摆出来。');
  }

  if (a.clinic.ok) {
    state.flags.clinicEver = true;
    made.push(`诊疗：阿梨接诊 ${a.clinic.patients.length} 人。`);
  } else if (a.clinic.card) {
    missed.push('诊室今日没有接诊：确认通电并安排阿梨值守。');
  }

  for (const [rid, uid] of Object.entries(state.work)) {
    const cs = a.byUid[uid];
    if (cs && cs.staff === rid) made.push(`${RESIDENTS[rid].name}在${cs.face.name}值守。`);
  }
  if (a.warm.length) made.push(`暖屋：${a.warm.length} 人今晚有暖床位。`);

  const poweredComps = a.comps.filter(c => c.supply > 0 && c.deficit === 0);
  if (poweredComps.length) {
    made.push(`供电：${poweredComps.length} 个片区供需平衡（共 ${poweredComps.reduce((n, c) => n + c.supply, 0)} 点）。`);
  }

  // 承诺
  for (const p of state.promises) {
    if (p.status !== 'open') continue;
    const home = a.byUid[state.homes[p.rid]];
    let can = false;
    if (a.post.active && home) {
      const d = a.distance(a.post.card.slot)[home.slot];
      can = d >= 0 && d <= 3;
    }
    if (can) {
      p.status = 'done';
      made.push(`寄出：${RESIDENTS[p.rid].name}的${p.what}送到了邮亭。`);
      if (p.id === 'postcard') state.flags.mailDone = true;
      notes.push(p.doneNote || '邮亭留下一张手写回执，纸角还带着浆糊。');
    } else if (state.day >= p.dueDay) {
      p.status = 'failed';
      if (p.id === 'postcard') state.flags.mailFailed = true;
      missed.push(`${RESIDENTS[p.rid].name}的${p.what}没有赶上期限。`);
      notes.push(p.failNote || '陶婆把没寄出的信收回抽屉，没有责怪谁。');
    }
  }
  if (state.promises.filter(p => p.status === 'done').length >= 2) unlock(state, achievements, 'a09');

  // 疲劳与临时住处
  for (const rid of ch.residents) {
    if (state.work[rid] && a.byUid[state.work[rid]]) {
      state.fatigue[rid] = Math.min(2, (state.fatigue[rid] || 0) + 1);
    } else {
      state.fatigue[rid] = 0;
    }
    const home = a.byUid[state.homes[rid]];
    if (home && home.face.temp) {
      state.tempDays[rid] = (state.tempDays[rid] || 0) + 1;
    } else {
      if ((state.tempDays[rid] || 0) > 0) state.flags.tempMoved = true;
      state.tempDays[rid] = 0;
    }
  }
  if (state.flags.tempMoved) unlock(state, achievements, 'a04');

  if (a.meal.ok && a.meal.participants.length >= 5) unlock(state, achievements, 'a03');
  for (const comp of a.comps) {
    if (comp.supply > 0 && comp.demand === comp.supply) { unlock(state, achievements, 'a06'); break; }
  }
  const working = Object.entries(state.work).filter(([rid, uid]) => a.byUid[uid] && a.byUid[uid].staff === rid);
  if (working.length >= 3) unlock(state, achievements, 'a02');

  const goals = evaluateGoals(state, a);
  const housed = goals[0].ok;
  if (state.day >= ch.days && state.chapter === 1 && housed) {
    const backHome = ch.residents.some(rid => {
      const home = a.byUid[state.homes[rid]];
      return home && home.card.face === 1 && (home.face.beds || 0) > 0;
    });
    if (backHome) unlock(state, achievements, 'a15');
  }

  const chapterDone = state.day >= ch.days;
  const report = {
    day: state.day,
    chapter: state.chapter,
    made,
    missed,
    notes,
    achievements,
    goals,
    chapterDone,
    material: state.material,
    mealCount: a.meal.ok ? a.meal.participants.length : 0,
    clinicCount: a.clinic.ok ? a.clinic.patients.length : 0,
    warmCount: a.warm.length,
  };

  state.phase = 'night';
  state.resolutionId = `R${state.chapter + 1}-${state.day}-${Date.now()}`;
  state.lastReport = report;
  return { ok: true, report };
}

export function advanceDay(state) {
  if (state.phase !== 'night') return false;
  state.day += 1;
  state.used = 0;
  state.phase = 'plan';
  state.disabled = [];
  state.tempBedUid = null;
  state.agreementChangedToday = false;
  state.lastReport = null;
  for (const rid of CHAPTERS[state.chapter].residents) {
    if ((state.fatigue[rid] || 0) >= 2) state.work[rid] = null;
  }
  return true;
}

export function endingOf(state) {
  const a = analyze(state);
  const goals = evaluateGoals(state, a);
  const all = goals.every(g => g.ok);
  return {
    id: all ? 'together' : 'open',
    title: all ? '今晚都坐下了' : '门留着，话没说完',
    goals,
    letter: state.flags.letterPublic === true ? '公开' : state.flags.letterPublic === false ? '留在背面' : '未决定',
  };
}

// ---------------------------------------------------------------------------
// 操作层：所有正式操作消耗手数，并写入撤销栈
// ---------------------------------------------------------------------------
export class Game {
  constructor(state) {
    this.state = state;
    this.undoStack = [];
    this.redoStack = [];
  }

  static new(chapterIndex = 0, carry = 0) {
    return new Game(createState(chapterIndex, carry));
  }

  snapshot() {
    this.undoStack.push(JSON.stringify(this.state));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) return { ok: false, msg: '没有可以撤销的操作。' };
    this.redoStack.push(JSON.stringify(this.state));
    this.state = JSON.parse(this.undoStack.pop());
    return { ok: true };
  }

  redo() {
    if (!this.redoStack.length) return { ok: false, msg: '没有可以重做的操作。' };
    this.undoStack.push(JSON.stringify(this.state));
    this.state = JSON.parse(this.redoStack.pop());
    return { ok: true };
  }

  canAct() {
    if (this.state.phase !== 'plan') return false;
    return this.state.used < this.state.capacity;
  }

  locate(loc) {
    if (!loc) return null;
    if (loc.zone === 'board') return this.state.board[loc.index] || null;
    if (loc.zone === 'tray') return this.state.tray[loc.index] || null;
    return null;
  }

  noHands() {
    return { ok: false, msg: '今天的手数已经用完。可以撤销，或先确认这一天。' };
  }

  flip(loc) {
    if (!this.canAct()) return this.noHands();
    const card = this.locate(loc);
    if (!card) return { ok: false, msg: '这里没有卡。' };
    this.snapshot();
    this.state.used += 1;
    card.face = card.face === 0 ? 1 : 0;
    const achievements = [];
    if (!this.state.flags.flipDone) {
      this.state.flags.flipDone = true;
      unlock(this.state, achievements, 'a01');
    }
    return { ok: true, achievements };
  }

  rotate(loc) {
    if (!this.canAct()) return this.noHands();
    const card = this.locate(loc);
    if (!card) return { ok: false, msg: '这里没有卡。' };
    this.snapshot();
    this.state.used += 1;
    card.rot = ((card.rot || 0) + 1) % 4;
    return { ok: true };
  }

  move(from, to) {
    if (!this.canAct()) return this.noHands();
    if (from.zone === 'board' && from.index === to) return { ok: false, msg: '已经在这一格。' };
    const card = this.locate(from);
    if (!card) return { ok: false, msg: '这里没有卡。' };
    this.snapshot();
    this.state.used += 1;
    if (from.zone === 'tray') {
      this.state.tray.splice(from.index, 1);
      const occ = this.state.board[to];
      if (occ) this.state.tray.splice(from.index, 0, occ);
      this.state.board[to] = card;
    } else {
      const prev = this.state.board[to];
      this.state.board[to] = card;
      this.state.board[from.index] = prev;
    }
    return { ok: true };
  }

  pickup(slot) {
    if (!this.canAct()) return this.noHands();
    const card = this.state.board[slot];
    if (!card) return { ok: false, msg: '这一格没有卡。' };
    this.snapshot();
    this.state.used += 1;
    this.state.board[slot] = null;
    this.state.tray.push(card);
    return { ok: true };
  }

  setHome(rid, uid) {
    if (!this.state.homes.hasOwnProperty(rid)) return { ok: false, msg: '没有这名居民。' };
    if (!uid) return { ok: false, msg: '必须给居民指定一处归处。' };
    if (this.state.homes[rid] === uid) return { ok: true };
    const cs = Object.values(buildBoard(this.state).byUid).find(x => x.card.uid === uid);
    if (!cs) return { ok: false, msg: '只能选择棋盘上的卡。' };
    if (!(cs.face.beds > 0)) return { ok: false, msg: `${cs.face.name}没有床位，不能作为归处。` };
    if (!this.canAct()) return this.noHands();
    this.snapshot();
    this.state.used += 1;
    this.state.homes[rid] = uid;
    return { ok: true };
  }

  setWork(rid, uid) {
    const ch = CHAPTERS[this.state.chapter];
    if (!ch.residents.includes(rid)) return { ok: false, msg: '这名居民不在本章。' };
    if (!uid) {
      this.state.work[rid] = null;
      return { ok: true };
    }
    const cs = Object.values(buildBoard(this.state).byUid).find(x => x.card.uid === uid);
    if (!cs) return { ok: false, msg: '只能安排在棋盘上的设施。' };
    if (!cs.face.staff || !cs.face.staff.who.includes(rid)) {
      return { ok: false, msg: `${RESIDENTS[rid].name}不能值守${cs.face.name}。` };
    }
    if ((this.state.fatigue[rid] || 0) >= 2) {
      return { ok: false, msg: `${RESIDENTS[rid].name}已连续工作两日，今天必须休息。` };
    }
    const other = Object.entries(this.state.work).find(([r, u]) => r !== rid && u === uid);
    if (other) return { ok: false, msg: `${RESIDENTS[other[0]].name}已经在这里值守。` };
    this.state.work[rid] = uid;
    return { ok: true };
  }

  toggleService(uid) {
    const cs = Object.values(buildBoard(this.state).byUid).find(x => x.card.uid === uid);
    if (!cs) return { ok: false, msg: '没有这张卡。' };
    if (!cs.face.power) return { ok: false, msg: '这一面没有耗电服务。' };
    const i = this.state.disabled.indexOf(uid);
    if (i >= 0) this.state.disabled.splice(i, 1);
    else this.state.disabled.push(uid);
    return { ok: true };
  }

  toggleAgreement(id) {
    if (!this.state.ownedAgreements.includes(id)) return { ok: false, msg: '还没有获得这张约定。' };
    if (this.state.agreementChangedToday) return { ok: false, msg: '今天已经换过一次约定了。' };
    if (!this.canAct()) return this.noHands();
    const i = this.state.enabledAgreements.indexOf(id);
    if (i >= 0) {
      if (this.state.tempBedUid && id === 'A02') {
        this.state.tempBedUid = null;
      }
      this.snapshot();
      this.state.used += 1;
      this.state.enabledAgreements.splice(i, 1);
      this.state.agreementChangedToday = true;
      return { ok: true };
    }
    if (this.state.enabledAgreements.length >= 2) return { ok: false, msg: '同一时刻至多启用两张约定。' };
    this.snapshot();
    this.state.used += 1;
    this.state.enabledAgreements.push(id);
    this.state.agreementChangedToday = true;
    return { ok: true };
  }

  useA02(uid) {
    if (!this.state.enabledAgreements.includes('A02')) return { ok: false, msg: '先启用「借住一晚」。' };
    if (this.state.a02Used) return { ok: false, msg: '这一章已经借住过一次。' };
    if (this.state.tempBedUid) return { ok: false, msg: '今天已经借住过。' };
    const cs = Object.values(buildBoard(this.state).byUid).find(x => x.card.uid === uid);
    if (!cs || cs.card.id !== 'S05' || cs.card.face !== 0) return { ok: false, msg: '只能给合住房借住。' };
    if (!this.canAct()) return this.noHands();
    this.snapshot();
    this.state.used += 1;
    this.state.tempBedUid = uid;
    this.state.a02Used = true;
    return { ok: true };
  }

  shopExchange(uid) {
    if (!this.canAct()) return this.noHands();
    if (this.state.shopUsed) return { ok: false, msg: '本章的交换已经用过了。' };
    const cs = Object.values(buildBoard(this.state).byUid).find(x => x.card.uid === uid);
    if (!cs || cs.card.id !== 'S04' || cs.card.face !== 0) return { ok: false, msg: '需要街角商店的杂货铺。' };
    if (this.state.material < 2) return { ok: false, msg: '物资不足 2 份。' };
    const target = this.state.board.find(c => c && c.id === 'S15') || this.state.tray.find(c => c.id === 'S15');
    if (!target) return { ok: false, msg: '城里没有可交换的长桥卡。' };
    this.snapshot();
    this.state.used += 1;
    this.state.material -= 2;
    target.id = 'S20';
    target.face = 0;
    target.rot = 0;
    this.state.shopUsed = true;
    return { ok: true, msg: '长桥卡换成了报栏。' };
  }

  settle() {
    const res = settleDay(this.state);
    if (res.ok) {
      this.undoStack = [];
      this.redoStack = [];
    }
    return res;
  }
}

export function catalogOf(state) {
  const ch = CHAPTERS[state.chapter];
  return ch;
}

export function residentOrder(state) {
  return CHAPTERS[state.chapter].residents;
}
