// 叙事文本：章节开场、夜间事件、结局。
import { CHAPTERS, RESIDENTS, DISTRICTS } from './data.js';

export const INTROS = [
  {
    title: '第一章 · 先让灯亮',
    sub: '四天，三个人，一盏灯。',
    lines: [
      '桌上铺开五张褪色的街区卡，托盘里还剩一张分电亭。',
      '陶婆把一把旧钥匙放在住处卡上，先问今晚能不能回来。',
      '阿岑说锅炉还能烧，但只够照亮一个片区。麦叔把锅盖掀开又盖上，没说话。',
    ],
    tip: '先做两件事：让一张卡的背面真正派上用场，再让居民沿卡边走到某处。',
  },
  {
    title: '第二章 · 留张椅子',
    sub: '归处从三个人变成六个人。',
    lines: [
      '阿梨、小电和阿芽搬进了这座城。桌上的卡一下挤满了。',
      '锅炉间能供电，翻到背面才多住人；广场能集会，翻过去才是床位。',
      '陶婆把旧信压在桌角，说她愿意分享，但不急。',
    ],
    tip: '诊疗需要电，共食也需要电。你可以让阿岑继续烧锅炉，也可以换一种安排。',
  },
];

export const EVENTS = {
  '0-1': {
    title: '陶婆的明信片',
    text: '陶婆把一张写好地址的明信片推到桌边：“明天之前，能替我送到邮亭吗？送不到也没关系，你说一声就行。”',
    options: [
      {
        label: '接下：明天送到邮亭',
        reply: '陶婆点点头，把明信片压在钥匙下面。',
        apply(state) {
          state.promises.push({
            id: 'postcard', rid: 'r05', what: '明信片', dueDay: 2, status: 'open',
            doneNote: '陶婆把邮亭的回执折好，压在钥匙下面。',
            failNote: '陶婆把没寄出的信收回抽屉，没有责怪谁。',
          });
        },
      },
      {
        label: '说清楚：改到第四天',
        reply: '陶婆说好，那就第四天。她把明信片留在桌角，没有收回去。',
        apply(state) {
          state.promises.push({
            id: 'postcard', rid: 'r05', what: '明信片', dueDay: 4, status: 'open',
            doneNote: '明信片晚了两天，但还是寄到了。陶婆说，晚到也算到。',
            failNote: '到第四天，明信片仍然没有送出去。',
          });
        },
      },
      {
        label: '这次不接',
        reply: '陶婆把明信片收回围裙口袋：“那我明天自己走一趟。”',
        apply(state) { state.flags.mailDeclined = true; },
      },
    ],
  },
  '1-1': {
    title: '阿芽的画',
    text: '阿芽把一张画塞进你手里：“外城的同学说想看看这里。邮亭还开着的话，能帮我寄掉吗？”',
    options: [
      {
        label: '收下：第四天前寄出',
        reply: '阿芽在画角写了日期，认真得像在交作业。',
        apply(state) {
          state.promises.push({
            id: 'drawing', rid: 'r06', what: '画', dueDay: 4, status: 'open',
            doneNote: '阿芽的画寄出去了。她在背面又补了一句：这里晚上有灯。',
            failNote: '阿芽把画拿回去，说下次自己寄。',
          });
        },
      },
      {
        label: '让她自己安排',
        reply: '阿芽想了想，把画折好放进书包：“那我自己找时间。”',
        apply(state) { state.flags.drawingDeclined = true; },
      },
    ],
  },
  '1-2': {
    title: '陶婆的旧信',
    text: '陶婆把一封旧信放在桌角：“这上面有我的名字，也有别人的。要贴在公开栏上，得先问过我。”',
    options: [
      {
        label: '先问陶婆，再公开',
        reply: '陶婆看了很久，说可以。她要求把另一位的名字遮掉。',
        apply(state) { state.flags.letterAsked = true; state.flags.letterPublic = true; },
      },
      {
        label: '先问陶婆，最后留在背面',
        reply: '陶婆说，那就留着吧。她把信重新压回桌角，像压住一件旧衣服。',
        apply(state) { state.flags.letterAsked = true; state.flags.letterPublic = false; },
      },
      {
        label: '不问了，直接贴出去',
        reply: '公开栏第二天就围了人。陶婆站在最外圈，没有往里挤。',
        apply(state) { state.flags.letterAsked = false; state.flags.letterPublic = true; },
      },
      {
        label: '不动它',
        reply: '旧信留在桌角。没有人被公开，也没有人真的谈开。',
        apply(state) { state.flags.letterAsked = false; state.flags.letterPublic = null; },
      },
    ],
  },
};

export function eventFor(state) {
  const key = `${state.chapter}-${state.day}`;
  const ev = EVENTS[key];
  if (!ev) return null;
  if (state.seenEvents && state.seenEvents[key]) return null;
  return ev;
}

export function goalText(chapter, id) {
  const ch = CHAPTERS[chapter];
  const g = ch.goals.find(x => x.id === id);
  return g ? g.label : id;
}

export function chapterResult(state) {
  const ch = CHAPTERS[state.chapter];
  const report = state.lastReport;
  const goals = report ? report.goals : [];
  const done = goals.filter(g => g.ok).length;
  if (state.chapter === 0) {
    return {
      title: done === goals.length ? '灯亮着，桌子也摆开了' : '灯亮了一半',
      lines: [
        done === goals.length
          ? '第四天夜里，三处归处都有人回去，饭桌坐满了，陶婆住的那一片亮着灯。'
          : '第四天夜里，有些事成了，有些还差一点。没有人被赶出去，城市带着没做完的部分继续往前。',
        state.flags.mailDone
          ? '邮亭留下了陶婆的回执。她把回执和钥匙放在一起。'
          : state.flags.mailFailed
            ? '明信片没有赶上。陶婆说，第二章再寄也一样。'
            : '陶婆没有再提明信片。她把钥匙留在桌上。',
        '他们把卡收进盒子，第二天又铺开。桌上多出了四张卡的位置。',
      ],
      next: '进入第二章',
    };
  }
  const all = goals.every(g => g.ok);
  return {
    title: all ? '今晚都坐下了' : '门留着，话没说完',
    lines: [],
    next: all ? '看结尾' : '看结尾',
  };
}

export function ending(state) {
  const all = state.lastReport && state.lastReport.goals.every(g => g.ok);
  const letter = state.flags.letterPublic;
  const letterLines = letter === true
    ? (state.flags.letterAsked
      ? '旧信贴在公开栏上，名字遮掉了一处。陶婆站在旁边，没有走开。'
      : '旧信贴在公开栏上。陶婆看过之后，把钥匙留在了桌角。')
    : letter === false
      ? '旧信留在背面。陶婆说，有些话不用让整条街都知道。'
      : '旧信始终没有打开。它和钥匙一起留在桌角。';
  const mail = state.flags.mailDone
    ? '邮亭寄出的明信片有了回音。回信很短：门口那盏灯，我看见了。'
    : state.flags.mailFailed
      ? '明信片最终没有寄到。陶婆说，下次她自己去。'
      : '陶婆没有提明信片。她只是把钥匙又擦了一遍。';

  if (all) {
    return {
      id: 'together',
      title: '今晚都坐下了',
      sub: '六个人都有归处，饭桌和诊疗都按约开放。',
      lines: [
        '第六张椅子不是空的。阿梨把诊室的门留到很晚，麦叔把锅端上桌时，所有人都已经坐下了。',
        mail,
        letterLines,
        '你把最后一张卡翻回正面，桌上的城市仍然可以继续摆。没有谁被留在背面。',
      ],
      tags: ['饭桌仍在', '灯有人接', state.flags.letterAsked ? '旧信经过同意' : '旧信留在背面'],
    };
  }
  return {
    id: 'open',
    title: '门留着，话没说完',
    sub: '公共条件只满足了一部分，但这座城仍然住得下去。',
    lines: [
      '最后一天，饭桌没有完全坐满。有人先走了，有人说明天再来。',
      mail,
      letterLines,
      '你把没完成的卡留在桌上，没有替谁宣布结束。门留着，灯也留着。',
    ],
    tags: ['门留着', '还可以再摆一次'],
  };
}

export function residentBack(state, rid) {
  const r = RESIDENTS[rid];
  const home = state.homes[rid];
  let homeName = '还没有归处';
  for (const card of state.board) {
    if (card && card.uid === home) homeName = DISTRICTS[card.id].name + '·' + DISTRICTS[card.id].faces[card.face].name;
  }
  const lines = [];
  if (rid === 'r05') {
    lines.push(state.flags.mailDone ? '“寄到了。回执我留着。”' : state.flags.mailFailed ? '“没赶上。下次我自己走。”' : '“钥匙还在。门得有人回去开。”');
    lines.push(state.flags.letterPublic === true ? '“信贴出去了。名字遮一处，是我要求的。”' : '“有些话留在背面就好。”');
  } else if (rid === 'r01') {
    lines.push(state.fatigue.r01 > 0 ? '“锅炉今天稳。明天得有人换手。”' : '“我先歇一会儿，你替我盯一眼。”');
    lines.push('“小电能接，我就不用一直守着。”');
  } else if (rid === 'r04') {
    lines.push(state.flags.mealEver ? '“人齐了，锅才没白热。”' : '“锅还热着，等人来。”');
    lines.push('“下回别把饭点排在我休息那天。”');
  } else if (rid === 'r03') {
    lines.push(state.flags.clinicEver ? '“今天接了几个。明天谁替班？”' : '“诊室空着一天，不致命，但别成习惯。”');
  } else if (rid === 'r02') {
    lines.push('“这回让我自己试，你在旁边看着就行。”');
    lines.push('“别每次都让我背锅，我也会记。”');
  } else if (rid === 'r06') {
    lines.push(state.flags.letterPublic !== null ? '“原来信也可以贴在墙上。”' : '“我的画寄出去了吗？”');
    lines.push('“所以这张翻过去，我就不用上课啦？”');
  }
  return { home: homeName, quote: r.quote, lines };
}
