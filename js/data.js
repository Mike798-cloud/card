// 《背面有座城》比赛独立篇 · 数据定义
// 所有数值为策划案中的调参初值；卡面结构、互斥用途与规则为确定项。

export const DIRS = ['N', 'E', 'S', 'W'];
export const DIR_CN = { N: '北', E: '东', S: '南', W: '西' };

export const DISTRICTS = {
  S01: {
    id: 'S01', name: '旧锅炉房',
    faces: [
      { name: '锅炉间', ports: 'NES', art: 's01_front', supply: 3, staff: { job: 'boiler', who: ['r01'] }, text: '供电 +3。需要阿岑本日值守。翻转后这份电力会消失。' },
      { name: '暖屋', ports: 'EW', art: 's01_back', beds: 4, power: 1, warm: true, text: '床位 4，暖屋耗电 1。断电时床位仍在，保暖停用。' },
    ],
  },
  S02: {
    id: 'S02', name: '巷口诊所',
    faces: [
      { name: '诊室', ports: 'NEW', art: 's02_front', power: 2, clinic: true, staff: { job: 'clinic', who: ['r03'] }, text: '耗电 2。阿梨值守时可诊疗，患者从家出发不超过 3 段街巷。' },
      { name: '药草院', ports: 'NS', art: 's02_back', beds: 2, herb: true, text: '不耗电，可休养 2 人；不替代急诊。' },
    ],
  },
  S04: {
    id: 'S04', name: '街角商店',
    faces: [
      { name: '杂货铺', ports: 'NE', art: 's04_front', shop: true, text: '本章一次：耗 1 手与 2 物资，换一张指定公共卡（S15 → S20）。' },
      { name: '公共厨房', ports: 'ESW', art: 's04_back', power: 1, meal: true, material: 1, staff: { job: 'kitchen', who: ['r04'] }, text: '耗电 1，每日耗物资 1。麦叔组织后可共食，距离不超过 3 段。' },
    ],
  },
  S05: {
    id: 'S05', name: '楼上住处',
    faces: [
      { name: '合住房', ports: 'NS', art: 's05_front', beds: 4, text: '容纳 4 人，不耗电。' },
      { name: '开放阳台', ports: 'EW', art: 's05_back', beds: 2, text: '容纳 2 人；相邻庭院可休息。' },
    ],
  },
  S06: {
    id: 'S06', name: '转角院',
    faces: [
      { name: '铺装转角', ports: 'NE', art: 's06_front', text: '连接两边，无服务。多留一片路面，可能少一处床位。' },
      { name: '菜圃', ports: 'ES', art: 's06_back', garden: true, staff: { job: 'garden', who: ['r07'] }, text: '连续照料 2 日产物资 1，需季姨。她不在本城。' },
    ],
  },
  S07: {
    id: 'S07', name: '老邮亭',
    faces: [
      { name: '邮务台', ports: 'NSW', art: 's07_front', post: true, staff: { job: 'post', who: ['r05', 'r02', 'r06'] }, text: '投递承诺。需要一名居民值守，可存 1 张未寄明信片。' },
      { name: '交换柜', ports: 'EW', art: 's07_back', text: '居民转交一件物品，不产物资。' },
    ],
  },
  S09: {
    id: 'S09', name: '小广场',
    faces: [
      { name: '集会地', ports: 'NESW', art: 's09_front', meeting: true, text: '承诺讨论，最多 4 人参与。' },
      { name: '临时住处', ports: 'NS', art: 's09_back', beds: 3, temp: true, text: '容纳 3 人；连续住满 2 日需迁居。' },
    ],
  },
  S14: {
    id: 'S14', name: '变电亭',
    faces: [
      { name: '分电亭', ports: 'NES', art: 's14_front', supply: 2, text: '供电 +2，无居民要求。' },
      { name: '安静书角', ports: 'NW', art: 's14_back', rest: true, text: '为相邻住户提供休息。不产物资，不供电。' },
    ],
  },
  S15: {
    id: 'S15', name: '长桥卡',
    faces: [
      { name: '直桥', ports: 'NS', art: 's15_front', text: '贯通南北。桥面本身不提供电力，但能把两个片区接成一个。' },
      { name: '缓坡桥', ports: 'EW', art: 's15_back', text: '连接东西，允许通行，但只容 1 人停留。' },
    ],
  },
  S20: {
    id: 'S20', name: '报栏',
    faces: [
      { name: '公开栏', ports: 'NE', art: 's20_front', publicBoard: true, text: '展示经确认的证词和公共结果。公开前需当事人同意。' },
      { name: '留言墙', ports: 'SW', art: 's20_back', notes: true, text: '保存私人邀请，不自动公开。' },
    ],
  },
};

export const RESIDENTS = {
  r01: {
    id: 'r01', name: '阿岑', role: '老电工', art: 'r01_acen',
    quote: '你先歇着，我再看一眼。',
    desc: '值守锅炉。谨慎，习惯先替别人担责任。',
    wants: '想确认新人能接班。',
  },
  r02: {
    id: 'r02', name: '小电', role: '学徒', art: 'r02_xiaodian',
    quote: '这回让我自己试，你在旁边看着就行。',
    desc: '完成岗位教学后可给指定诊室节电 1。',
    wants: '需要被信任，也会拒绝重复背锅。',
  },
  r03: {
    id: 'r03', name: '阿梨', role: '诊所负责人', art: 'r03_ali',
    quote: '我能留下，明天谁来替班？',
    desc: '值守诊室。温和但不随便保证。',
    wants: '需要稳定轮休。',
  },
  r04: {
    id: 'r04', name: '麦叔', role: '厨师', art: 'r04_maishu',
    quote: '人来齐再揭锅，凉了我再热一回。',
    desc: '组织共食。爱记每个人的口味。',
    wants: '想让饭桌保留。',
  },
  r05: {
    id: 'r05', name: '陶婆', role: '裁缝', art: 'r05_taopo',
    quote: '钥匙我一直留着，可门得有人回去开。',
    desc: '修卡角；不愿被当作只能受照顾的人。',
    wants: '想寄一张明信片，也愿意先帮别人补一张卡。',
  },
  r06: {
    id: 'r06', name: '阿芽', role: '学生', art: 'r06_aya',
    quote: '所以这张翻过去，我就不用上课啦？',
    desc: '学会岗位后可辅助教学；会追问规则。',
    wants: '想把自己的画寄给外城的同学。',
  },
};

export const AGREEMENTS = {
  A01: {
    id: 'A01', name: '先吃上饭', art: 'a01',
    effect: '厨房共食距离从 3 增至 4。',
    cost: '厨房本日耗物资由 1 增至 2。',
    hint: '多走一段路的人也能坐下，但锅里要多下一份。',
  },
  A02: {
    id: 'A02', name: '借住一晚', art: 'a02',
    effect: '每章一次：合住房暂加 1 张床位。',
    cost: '次日必须重新安置；不能连续借住或叠加。',
    hint: '把椅子搬到灯下不算家，只是今晚有个地方。',
  },
};

// 9 个卡位：slot = row * 3 + col
export const CHAPTERS = [
  {
    index: 0,
    title: '第一章',
    subtitle: '先让灯亮',
    days: 4,
    hands: 4,
    material: 4,
    districts: ['S01', 'S04', 'S05', 'S06', 'S07', 'S14'],
    residents: ['r01', 'r04', 'r05'],
    openings: {
      title: '第一章 · 先让灯亮',
      lines: [
        '桌上铺开五张褪色的街区卡，托盘里还剩一张分电亭。',
        '陶婆把一把旧钥匙放在住处卡上，先问今晚能不能回来。',
        '阿岑说锅炉还能烧，但只够照亮一个片区。麦叔把锅盖掀开又盖上，没说话。',
      ],
      tip: '今天先做两件事：让一张卡的背面真正派上用场，再让居民沿卡边走到某处。',
    },
    initial: [
      { slot: 0, id: 'S05', face: 0, rot: 0 },
      { slot: 3, id: 'S07', face: 0, rot: 0 },
      { slot: 6, id: 'S06', face: 0, rot: 0 },
      { slot: 1, id: 'S01', face: 0, rot: 0 },
      { slot: 4, id: 'S04', face: 0, rot: 0 },
    ],
    tray: [{ id: 'S14', face: 0, rot: 0 }],
    goals: [
      { id: 'housed', label: '三人都有一处归处', hint: '床位够、且每人都明确归属一张卡。' },
      { id: 'meal', label: '至少一次真正共食', hint: '厨房通电、麦叔组织、三人能在 3 段街巷内走到。' },
      { id: 'lit', label: '陶婆的归处所在的片区通电', hint: '她住的那张卡必须和有效的供电源头连通。' },
    ],
  },
  {
    index: 1,
    title: '第二章',
    subtitle: '留张椅子',
    days: 4,
    hands: 4,
    material: 4,
    districts: ['S01', 'S02', 'S04', 'S05', 'S06', 'S07', 'S09', 'S14', 'S15', 'S20'],
    residents: ['r01', 'r02', 'r03', 'r04', 'r05', 'r06'],
    openings: {
      title: '第二章 · 留张椅子',
      lines: [
        '阿梨、小电和阿芽搬进了这座城。归处从三个人变成六个人。',
        '锅炉间能供电，翻到背面才多住人；广场能集会，翻过去才是床位。',
        '陶婆把旧信压在桌角，说她愿意分享，但不急。',
      ],
      tip: '诊疗需要电，共食也需要电。你可以让阿岑继续烧锅炉，也可以让小电做一次节电安排。',
    },
    initial: [
      { slot: 0, id: 'S05', face: 0, rot: 0 },
      { slot: 1, id: 'S01', face: 0, rot: 0 },
      { slot: 2, id: 'S09', face: 1, rot: 0 },
      { slot: 3, id: 'S02', face: 0, rot: 0 },
      { slot: 4, id: 'S04', face: 1, rot: 0 },
      { slot: 5, id: 'S15', face: 0, rot: 0 },
      { slot: 6, id: 'S07', face: 0, rot: 0 },
      { slot: 7, id: 'S20', face: 0, rot: 0 },
      { slot: 8, id: 'S06', face: 0, rot: 0 },
    ],
    tray: [{ id: 'S14', face: 0, rot: 0 }],
    goals: [
      { id: 'housed', label: '六个人都有归处', hint: '床位总数够，且每人都明确归属一张已放置的卡。' },
      { id: 'clinic', label: '至少一次有效诊疗', hint: '诊室通电、阿梨值守、患者从家走到诊室不超过 3 段。' },
      { id: 'mealFinal', label: '最后一天，饭桌还开着', hint: '最后一日共食有效，且至少四人能走到。' },
    ],
  },
];

export const ACHIEVEMENTS = [
  { id: 'a01', name: '翻过来看看', desc: '完成首个有效的双面安排。' },
  { id: 'a02', name: '这条路通了', desc: '三名居民在同一天各自走完路线。' },
  { id: 'a03', name: '一桌热饭', desc: '五人或以上有效共食一次。' },
  { id: 'a04', name: '借住之后', desc: '临时住处的居民次日有了正式归处。' },
  { id: 'a06', name: '一点也没剩', desc: '合法使用恰好足够的片区电力。' },
  { id: 'a09', name: '寄到了', desc: '完成两位居民的投递承诺。' },
  { id: 'a12', name: '先问一句', desc: '公开记录前取得当事人同意。' },
  { id: 'a15', name: '背面也住着人', desc: '靠卡背的归处完成本章安置。' },
];
