/* ============================================================
   WePlan · AI 周末生活规划师 — 核心逻辑
   ============================================================ */

// ─── 工具函数 ───
const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  for (const child of (Array.isArray(children) ? children : [children])) {
    if (child == null) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── 状态管理 ───
const state = {
  mode: 'showcase',   // 'showcase' | 'live'
  theme: localStorage.getItem('weplan-theme') || 'light',
  city: '杭州',
  sceneMode: 'family',
  currentCase: null,
  currentPlanIdx: 0,
  thinkingExpanded: false,
  isAnimating: false,
  votes: {}
};

// ─── 预建案例数据（从后端API加载 + 本地fallback） ───
let API_CASES = {};     // 从 /api/cases/:id 加载的完整案例
let API_CASE_LIST = []; // 案例列表

async function loadCasesFromAPI() {
  try {
    const resp = await fetch('/api/cases');
    if (!resp.ok) return;
    const data = await resp.json();
    API_CASE_LIST = data.cases || [];
    renderPresetButtons();
  } catch (e) {
    console.warn('Failed to load cases from API:', e);
  }
}

async function loadCaseDetail(caseId) {
  if (API_CASES[caseId]) return API_CASES[caseId];
  try {
    const resp = await fetch(`/api/cases/${caseId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    API_CASES[caseId] = data;
    return data;
  } catch (e) {
    console.warn('Failed to load case detail:', e);
    return null;
  }
}

function convertAPICaseToLocal(apiCase) {
  if (!apiCase || !apiCase.plans) return null;
  const agents = (apiCase.agent_thinking || []).map(a => ({
    name: a.agent.charAt(0).toUpperCase() + a.agent.slice(1),
    icon: { orchestrator: '🎯', context: '📋', dining: '🍽', activity: '🎪', synthesizer: '🧩', critic: '🔍' }[a.agent] || '⚙️',
    thinking: (a.thoughts || []).join('\n')
  }));

  const plans = apiCase.plans.map(p => ({
    name: p.name || p.id || '方案',
    title: p.name || '推荐方案',
    subtitle: p.style || '',
    scores: {
      cost: (p.scores?.cost || 70) / 100,
      fun: (p.scores?.fun || 70) / 100,
      convenience: (p.scores?.convenience || 70) / 100,
      fit: (p.scores?.fit || 70) / 100,
      uniqueness: (p.scores?.uniqueness || 70) / 100,
    },
    totalCost: `¥${p.total_cost || '?'}`,
    duration: `${p.total_duration_hours || '?'}h`,
    count: (p.nodes || []).length,
    timeline: (p.nodes || []).map(n => ({
      time: n.time || n.id || '',
      icon: { transport: '🚗', activity: '🎪', dining: '🍽', rest: '☕' }[n.type] || '📍',
      title: n.title || '',
      subtitle: n.subtitle || '',
      tags: [
        n.cost ? { text: `¥${n.cost}`, type: 'price' } : null,
        n.status === 'reserved' ? { text: '已预约', type: 'booked' } : null,
      ].filter(Boolean),
      detail: n.subtitle || ''
    }))
  }));

  return {
    id: apiCase.id,
    userMessage: apiCase.input || '',
    aiReply: `收到！正在为你规划「${apiCase.title}」🎯\n\n${apiCase.subtitle || ''}\n\nAgent 团队开始工作...`,
    agents: agents.length ? agents : AGENT_PIPELINE_TEMPLATE.map(a => ({ ...a, thinking: '正在分析...' })),
    plans: plans
  };
}

function renderPresetButtons() {
  const container = document.querySelector('.preset-buttons');
  if (!container || !API_CASE_LIST.length) return;
  container.innerHTML = '';
  const emojis = { family: '👨‍👩‍👧', friends: '👫', couple: '💑', solo: '🧘', umbrella: '🌧️' };
  API_CASE_LIST.forEach(c => {
    const btn = h('button', {
      className: 'preset-btn',
      dataset: { case: c.id },
      onClick: () => playShowcaseFromAPI(c.id)
    }, [
      h('span', { className: 'preset-emoji', textContent: emojis[c.cover_emoji] || emojis[c.scene_type] || '🗓' }),
      h('span', { className: 'preset-text', textContent: c.title })
    ]);
    container.appendChild(btn);
  });
}

const PREBUILT_CASES = {
  'family-park': {
    id: 'family-park',
    userMessage: '这个周末想带家人出去玩，孩子5岁，想找点有趣的亲子活动，预算500以内，最好在西湖附近。',
    aiReply: '收到！我来为您规划一个温馨的家庭亲子周末 🎪\n\n根据您的需求，我会综合考虑：\n• 适合5岁小朋友的活动\n• 西湖周边的优质场所\n• 500元以内的合理预算\n• 交通便捷、行程紧凑\n\n正在调度 AI Agent 团队为您规划中...',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '接收到家庭亲子出游需求。关键约束: 5岁儿童、西湖附近、预算500。将任务分发给上下文分析、活动搜索、餐饮推荐、交通规划等Agent。' },
      { name: 'Context', icon: '📋', thinking: '分析用户画像:\n- 家庭出游，含5岁幼儿\n- 地点偏好: 西湖附近\n- 预算: ¥500以内\n- 时间: 周末（周六/周日）\n- 天气预报: 周六晴 26°C，适合户外\n- 注意: 幼儿需要休息时间，避免过于紧凑' },
      { name: 'Activity', icon: '🎪', thinking: '搜索杭州西湖附近亲子活动:\n1. 杭州少儿公园（满陇桂雨）- 评分4.8，免费\n2. 太子湾公园亲子区 - 评分4.7，免费\n3. 西湖边划船体验 - 评分4.6，¥80/小时\n4. 浙江自然博物馆 - 评分4.9，免费\n\n推荐组合: 少儿公园(户外) + 自然博物馆(室内备选)' },
      { name: 'Dining', icon: '🍽', thinking: '搜索亲子友好餐厅:\n1. 外婆家(西湖银泰) - ¥75/人，儿童椅✓\n2. 绿茶餐厅(龙井路) - ¥65/人，环境好\n3. 弄堂里(南山路) - ¥80/人，杭帮菜\n4. 新白鹿(西湖文化广场) - ¥55/人，排队少\n\n推荐: 绿茶餐厅，环境适合家庭，性价比高' },
      { name: 'Transport', icon: '🚗', thinking: '规划交通路线:\n- 出发地假设: 市区\n- 方案1: 打车到少儿公园(约¥25)，步行到绿茶餐厅(800m)\n- 方案2: 地铁1号线到龙翔桥站，步行15分钟\n- 返程: 打车回家(约¥30)\n- 总交通费: ¥55-80' },
      { name: 'Budget', icon: '💰', thinking: '预算核算:\n- 交通: ¥60（打车往返）\n- 少儿公园: 免费（部分游乐设施¥30）\n- 西湖划船: ¥80（1小时）\n- 午餐(绿茶餐厅): ¥195（3人）\n- 小食/饮料: ¥40\n- 总计: ¥405，在预算内 ✅' },
      { name: 'Optimizer', icon: '✨', thinking: '优化建议:\n1. 时间安排上午为主，避免下午幼儿犯困\n2. 少儿公园→划船→午餐，动线合理\n3. 预留弹性时间应对小朋友突发状况\n4. 备选方案: 如遇下雨改去浙江自然博物馆\n\n生成3套差异化方案供选择。' }
    ],
    plans: [
      {
        name: '方案 A',
        title: '🌈 西湖亲子慢游',
        subtitle: '轻松惬意，适合带小朋友',
        scores: { cost: 0.7, fun: 0.85, convenience: 0.9, fit: 0.95, uniqueness: 0.6 },
        totalCost: '¥405',
        duration: '5h',
        count: 4,
        timeline: [
          {
            time: '09:30',
            icon: '🚗',
            title: '出发',
            subtitle: '滴滴快车 → 少儿公园',
            tags: [{ text: '约25分钟', type: 'status' }],
            detail: '建议提前叫车，周末早高峰可能需要等待。到达少儿公园南门入口最方便。'
          },
          {
            time: '10:00',
            icon: '🎪',
            title: '杭州少儿公园',
            subtitle: '满陇桂雨景区内，大型儿童乐园',
            tags: [{ text: '★ 4.8', type: 'rating' }, { text: '免费入园', type: 'price' }],
            detail: '公园内有滑梯、秋千、沙池等设施，适合5岁儿童。桂花季节(9-10月)尤其美丽。建议游玩1.5小时。'
          },
          {
            time: '11:30',
            icon: '🚣',
            title: '西湖手划船',
            subtitle: '苏堤附近码头，一家三口泛舟',
            tags: [{ text: '★ 4.6', type: 'rating' }, { text: '¥80/h', type: 'price' }],
            detail: '手划船可坐4人，小朋友需穿救生衣。建议选苏堤到三潭印月方向，风景最佳。'
          },
          {
            time: '12:30',
            icon: '🍽',
            title: '绿茶餐厅（龙井路店）',
            subtitle: '杭帮菜代表，环境清幽',
            tags: [{ text: '★ 4.5', type: 'rating' }, { text: '¥65/人', type: 'price' }, { text: '已预约', type: 'booked' }],
            detail: '推荐菜品: 绿茶烤肉、面包诱惑(小朋友最爱)、龙井虾仁。环境有花园，适合家庭用餐。'
          },
          {
            time: '14:00',
            icon: '🏠',
            title: '返程休息',
            subtitle: '打车回家，小朋友午睡',
            tags: [{ text: '约30分钟', type: 'status' }],
            detail: '下午小朋友可能犯困，建议回家休息。如果精力充沛可以在西湖边散步到白堤。'
          }
        ]
      },
      {
        name: '方案 B',
        title: '🏛 博物馆探索日',
        subtitle: '寓教于乐，培养好奇心',
        scores: { cost: 0.85, fun: 0.75, convenience: 0.85, fit: 0.8, uniqueness: 0.8 },
        totalCost: '¥320',
        duration: '5.5h',
        count: 4,
        timeline: [
          {
            time: '09:00',
            icon: '🚇',
            title: '地铁出发',
            subtitle: '地铁1号线 → 武林广场站',
            tags: [{ text: '约35分钟', type: 'status' }, { text: '¥4/人', type: 'price' }],
            detail: '地铁出行更稳定，不受交通拥堵影响。武林广场站C出口出站。'
          },
          {
            time: '09:45',
            icon: '🏛',
            title: '浙江自然博物馆',
            subtitle: '恐龙展厅 + 海洋生物馆',
            tags: [{ text: '★ 4.9', type: 'rating' }, { text: '免费', type: 'price' }],
            detail: '5岁小朋友最爱的恐龙化石展、活体蝴蝶馆。周末建议提前在"浙江自然博物院"公众号预约。'
          },
          {
            time: '12:00',
            icon: '🍽',
            title: '新白鹿（西湖文化广场店）',
            subtitle: '高性价比杭帮菜',
            tags: [{ text: '★ 4.4', type: 'rating' }, { text: '¥55/人', type: 'price' }],
            detail: '招牌蛋黄鸡翅、糖醋里脊都很受小朋友欢迎。距博物馆步行5分钟。'
          },
          {
            time: '13:30',
            icon: '🎨',
            title: '亲子手工坊',
            subtitle: 'CHUMS创意空间，陶艺体验',
            tags: [{ text: '★ 4.7', type: 'rating' }, { text: '¥128/组', type: 'price' }],
            detail: '家长和小朋友一起做陶艺，作品可以烧制后邮寄到家。约1.5小时体验。'
          },
          {
            time: '15:00',
            icon: '🏠',
            title: '返程',
            subtitle: '地铁返回，满载而归',
            tags: [{ text: '约35分钟', type: 'status' }],
            detail: '带上博物馆纪念品和陶艺作品，结束充实的一天！'
          }
        ]
      },
      {
        name: '方案 C',
        title: '🌿 西溪湿地野趣',
        subtitle: '亲近自然，户外探险',
        scores: { cost: 0.6, fun: 0.9, convenience: 0.7, fit: 0.85, uniqueness: 0.9 },
        totalCost: '¥480',
        duration: '6h',
        count: 4,
        timeline: [
          {
            time: '09:00',
            icon: '🚗',
            title: '出发',
            subtitle: '驾车/打车 → 西溪湿地北门',
            tags: [{ text: '约40分钟', type: 'status' }],
            detail: '西溪湿地北门(周家村入口)停车方便，自驾推荐。打车约¥45。'
          },
          {
            time: '09:45',
            icon: '🛶',
            title: '摇橹船游湿地',
            subtitle: '穿越芦苇荡，寻找白鹭',
            tags: [{ text: '★ 4.8', type: 'rating' }, { text: '¥100/船', type: 'price' }],
            detail: '一条船可坐6人，船夫会讲解湿地生态。可以观赏到白鹭、翠鸟等鸟类。全程约40分钟。'
          },
          {
            time: '10:45',
            icon: '🎣',
            title: '亲子垂钓体验',
            subtitle: '湿地渔庄，体验传统捕鱼',
            tags: [{ text: '★ 4.5', type: 'rating' }, { text: '¥60/人', type: 'price' }],
            detail: '专门的儿童钓台，安全有保障。钓到的鱼可以带走或现场加工。小朋友会非常兴奋！'
          },
          {
            time: '12:00',
            icon: '🍽',
            title: '西溪农家菜',
            subtitle: '湿地内生态餐厅',
            tags: [{ text: '★ 4.3', type: 'rating' }, { text: '¥80/人', type: 'price' }],
            detail: '推荐西溪鱼圆、农家土鸡煲。可以吃到刚钓的鱼做成的菜。环境田园风情。'
          },
          {
            time: '14:00',
            icon: '🦋',
            title: '湿地探索步道',
            subtitle: '观鸟+植物认知小游戏',
            tags: [{ text: '免费', type: 'price' }],
            detail: '2公里平坦步道，沿途有植物标识牌。可以和小朋友玩"认识几种植物"的游戏。'
          },
          {
            time: '15:00',
            icon: '🏠',
            title: '返程',
            subtitle: '满载自然记忆回家',
            tags: [{ text: '约40分钟', type: 'status' }],
            detail: '在湿地商店可以买到特色明信片和手工皂作为纪念。'
          }
        ]
      }
    ]
  },

  'friends-gathering': {
    id: 'friends-gathering',
    userMessage: '周六想和3-4个朋友聚一聚，吃吃喝喝玩玩，最好有点新奇的活动，预算不限，杭州市区就行。',
    aiReply: '好的！我来安排一个充满惊喜的朋友聚会 🎉\n\n我会为你们找到：\n• 时下最in的新奇体验\n• 氛围感满分的餐厅酒吧\n• 合理的行程动线\n\nAgent 团队开始工作了...',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '朋友聚会需求，4-5人，追求新奇体验，预算不限。分发任务: 重点关注社交性强的活动、网红餐厅、夜生活选项。' },
      { name: 'Context', icon: '📋', thinking: '用户画像:\n- 朋友聚会，4-5人年轻群体\n- 偏好: 新奇、好玩\n- 预算: 不限\n- 地点: 杭州市区\n- 时间: 周六全天\n- 推测需求: 社交互动 > 观光游览' },
      { name: 'Activity', icon: '🎪', thinking: '搜索杭州新奇社交活动:\n1. 密室逃脱(谜巢) - 评分4.9，沉浸式体验\n2. 飞盘/腰旗橄榄球 - 黄龙体育中心\n3. Livehouse演出 - MAO/酒球会\n4. VR体验馆 - META VR Park\n5. 陶艺/花艺工作坊\n\n推荐: 密室逃脱(下午) + Livehouse(晚上)' },
      { name: 'Dining', icon: '🍽', thinking: '搜索适合朋友聚餐的餐厅:\n1. 解香楼(高端杭帮菜) - ¥200/人\n2. 蔡澜越南粉(网红) - ¥60/人\n3. 大龙燚火锅 - ¥130/人\n4. omakase日料 - ¥350/人\n\n推荐: 下午茶→火锅→酒吧 三段式' },
      { name: 'Transport', icon: '🚗', thinking: '市区内活动，距离不远:\n- 建议打车为主，方便灵活\n- 备选: 共享单车短途接驳\n- 预计交通总费: ¥100-150(全程打车)' },
      { name: 'Budget', icon: '💰', thinking: '预算估算(5人):\n- 密室逃脱: ¥198/人 × 5 = ¥990\n- 火锅晚餐: ¥130/人 × 5 = ¥650\n- Livehouse: ¥100/人 × 5 = ¥500\n- 下午茶: ¥50/人 × 5 = ¥250\n- 交通: ¥150\n- 总计约 ¥2,540(¥508/人)' },
      { name: 'Optimizer', icon: '✨', thinking: '优化点:\n1. 密室→火锅→Livehouse，节奏从烧脑到放松\n2. 备选夜间活动: 剧本杀/台球\n3. 提前预约密室和餐厅\n4. 生成3套方案: 冒险型/美食型/文艺型' }
    ],
    plans: [
      {
        name: '方案 A',
        title: '🎭 冒险解谜之夜',
        subtitle: '密室 + 火锅 + 音乐现场',
        scores: { cost: 0.5, fun: 0.95, convenience: 0.8, fit: 0.9, uniqueness: 0.95 },
        totalCost: '¥508/人',
        duration: '8h',
        count: 4,
        timeline: [
          {
            time: '14:00',
            icon: '☕',
            title: '集合·下午茶',
            subtitle: '%Arabica 咖啡（湖滨银泰）',
            tags: [{ text: '★ 4.6', type: 'rating' }, { text: '¥50/人', type: 'price' }],
            detail: '经典网红咖啡店，适合碰面集合。推荐西班牙拿铁和抹茶拿铁。'
          },
          {
            time: '15:00',
            icon: '🔐',
            title: '谜巢·沉浸式密室',
            subtitle: '「时间旅行者」主题，90分钟',
            tags: [{ text: '★ 4.9', type: 'rating' }, { text: '¥198/人', type: 'price' }, { text: '已预约', type: 'booked' }],
            detail: '杭州评分最高的沉浸式密室，含NPC互动、机关道具，5人组队最佳。难度★★★★☆。'
          },
          {
            time: '17:30',
            icon: '🍲',
            title: '大龙燚火锅',
            subtitle: '成都老火锅，微辣~特辣可选',
            tags: [{ text: '★ 4.7', type: 'rating' }, { text: '¥130/人', type: 'price' }],
            detail: '密室出来正好饿了！推荐毛肚、鸭肠、酥肉三件套。可以点鸳鸯锅照顾不吃辣的朋友。'
          },
          {
            time: '20:00',
            icon: '🎵',
            title: 'MAO Livehouse',
            subtitle: '本周演出：杭州本地独立乐队',
            tags: [{ text: '★ 4.5', type: 'rating' }, { text: '¥100/人', type: 'price' }],
            detail: '杭州老牌Livehouse，氛围超好。演出约2小时，有吧台可以点酒。建议早到占前排位置。'
          },
          {
            time: '22:30',
            icon: '🏠',
            title: '散场',
            subtitle: '打车各自回家',
            tags: [{ text: '约¥30/人', type: 'price' }],
            detail: '周六晚高峰后打车方便，注意提前叫车。'
          }
        ]
      },
      {
        name: '方案 B',
        title: '🍜 美食探店局',
        subtitle: '一路吃吃喝喝逛逛',
        scores: { cost: 0.6, fun: 0.8, convenience: 0.9, fit: 0.85, uniqueness: 0.7 },
        totalCost: '¥420/人',
        duration: '7h',
        count: 4,
        timeline: [
          {
            time: '13:00',
            icon: '🍜',
            title: '奎元馆',
            subtitle: '百年老字号，虾爆鳝面',
            tags: [{ text: '★ 4.5', type: 'rating' }, { text: '¥40/人', type: 'price' }],
            detail: '先来碗杭州老面开胃，奎元馆的虾爆鳝面是杭州美食名片。'
          },
          {
            time: '14:30',
            icon: '🍵',
            title: '茶馆品茗',
            subtitle: '青藤茶馆，品龙井·聊天',
            tags: [{ text: '★ 4.7', type: 'rating' }, { text: '¥80/人', type: 'price' }],
            detail: '包间可以安静聊天，最佳下午茶时光。配茶点心值得一试。'
          },
          {
            time: '17:00',
            icon: '🦞',
            title: '胖哥俩肉蟹煲',
            subtitle: '正餐大排档，一起动手吃蟹',
            tags: [{ text: '★ 4.4', type: 'rating' }, { text: '¥120/人', type: 'price' }],
            detail: '朋友聚会最适合一起动手的菜！配上冰啤酒，气氛拉满。'
          },
          {
            time: '19:30',
            icon: '🍸',
            title: 'J.Boroski 酒吧',
            subtitle: '无菜单调酒吧，隐藏入口',
            tags: [{ text: '★ 4.8', type: 'rating' }, { text: '¥150/人', type: 'price' }],
            detail: '杭州最有格调的隐藏酒吧，需要按门铃进入。调酒师会根据你的心情定制鸡尾酒。'
          },
          {
            time: '22:00',
            icon: '🏠',
            title: '散场回家',
            subtitle: '微醺回家，完美周末',
            tags: [{ text: '请勿酒驾', type: 'status' }],
            detail: '注意安全，打车回家。'
          }
        ]
      },
      {
        name: '方案 C',
        title: '🎨 文艺复兴日',
        subtitle: '手作 + 展览 + 清吧',
        scores: { cost: 0.65, fun: 0.75, convenience: 0.85, fit: 0.7, uniqueness: 0.85 },
        totalCost: '¥380/人',
        duration: '7h',
        count: 4,
        timeline: [
          {
            time: '13:00',
            icon: '🎨',
            title: '手工银饰DIY',
            subtitle: '纯银戒指/手链制作体验',
            tags: [{ text: '★ 4.8', type: 'rating' }, { text: '¥200/人', type: 'price' }],
            detail: '每人可制作一枚纯银戒指，约2小时。适合朋友一起做对戒或友谊手链，超有纪念意义！'
          },
          {
            time: '15:30',
            icon: '🖼',
            title: '中国美院美术馆',
            subtitle: '当季展览：数字艺术新浪潮',
            tags: [{ text: '★ 4.7', type: 'rating' }, { text: '免费', type: 'price' }],
            detail: '象山校区的美术馆，建筑本身就是王澍大师作品。当季展览以数字交互艺术为主题。'
          },
          {
            time: '17:30',
            icon: '🍽',
            title: '院子餐厅',
            subtitle: '创意融合菜，庭院用餐',
            tags: [{ text: '★ 4.6', type: 'rating' }, { text: '¥150/人', type: 'price' }],
            detail: '就在美院附近的创意餐厅，融合中西料理，庭院环境很适合拍照打卡。'
          },
          {
            time: '20:00',
            icon: '🎶',
            title: '酒球会',
            subtitle: '独立音乐现场 + 精酿啤酒',
            tags: [{ text: '★ 4.5', type: 'rating' }, { text: '¥80/人', type: 'price' }],
            detail: '杭州独立音乐圣地，氛围自由松弛。精酿啤酒种类丰富，适合边听歌边聊天。'
          },
          {
            time: '22:00',
            icon: '🏠',
            title: '散场',
            subtitle: '带着手作纪念品回家',
            tags: [{ text: '约¥30/人', type: 'price' }],
            detail: '文艺满满的一天，银饰作品就是最好的纪念！'
          }
        ]
      }
    ]
  }
};

// ─── 雷达图绘制 ───
const RADAR_LABELS = ['花费', '趣味', '便捷', '适合度', '特色'];
const PLAN_COLORS = [
  { fill: 'rgba(255,107,53,0.18)', stroke: '#FF6B35' },
  { fill: 'rgba(43,108,176,0.18)', stroke: '#2B6CB0' },
  { fill: 'rgba(56,161,105,0.18)', stroke: '#38A169' }
];

function drawRadarChart(canvasEl, allScores, activePlanIdx) {
  const ctx = canvasEl.getContext('2d');
  const W = canvasEl.width;
  const H = canvasEl.height;
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(cx, cy) - 36;
  const n = RADAR_LABELS.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, W, H);

  const levels = 4;
  for (let lv = 1; lv <= levels; lv++) {
    const r = (maxR / levels) * lv;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = startAngle + angleStep * (i % n);
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const a = startAngle + angleStep * i;
    const x = cx + maxR * Math.cos(a);
    const y = cy + maxR * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const labelR = maxR + 18;
    const lx = cx + labelR * Math.cos(a);
    const ly = cy + labelR * Math.sin(a);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(RADAR_LABELS[i], lx, ly);
  }

  allScores.forEach((scores, idx) => {
    const values = [scores.cost, scores.fun, scores.convenience, scores.fit, scores.uniqueness];
    const color = PLAN_COLORS[idx];
    const isActive = idx === activePlanIdx;

    ctx.beginPath();
    values.forEach((v, i) => {
      const a = startAngle + angleStep * i;
      const r = maxR * v;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = color.fill;
    ctx.fill();
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.globalAlpha = isActive ? 1 : 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (isActive) {
      values.forEach((v, i) => {
        const a = startAngle + angleStep * i;
        const r = maxR * v;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color.stroke;
        ctx.fill();
      });
    }
  });
}

function renderRadarLegend(plans) {
  const legend = $('#radarLegend');
  legend.innerHTML = '';
  plans.forEach((plan, idx) => {
    const item = h('div', { className: 'legend-item' }, [
      h('span', { className: 'legend-dot', style: { background: PLAN_COLORS[idx].stroke } }),
      h('span', { textContent: plan.name })
    ]);
    legend.appendChild(item);
  });
}

// ─── 时间线渲染 ───
function renderTimeline(plan) {
  const timeline = $('#timeline');
  timeline.innerHTML = '';
  plan.timeline.forEach((item, idx) => {
    const tags = (item.tags || []).map(tag => {
      const typeClass = tag.type === 'rating' ? 'tag-rating'
        : tag.type === 'price' ? 'tag-price'
        : tag.type === 'booked' ? 'tag-booked'
        : 'tag-status';
      return h('span', { className: `timeline-tag ${typeClass}`, textContent: tag.text });
    });

    const card = h('div', { className: 'timeline-card', onClick: () => card.classList.toggle('expanded') }, [
      h('div', { className: 'timeline-card-header' }, [
        h('div', {}, [
          h('div', { className: 'timeline-card-title' }, [
            h('span', { className: 'activity-icon', textContent: item.icon }),
            h('span', { textContent: item.title })
          ]),
          h('div', { className: 'timeline-card-subtitle', textContent: item.subtitle })
        ]),
        h('span', { className: 'timeline-time', textContent: item.time })
      ]),
      h('div', { className: 'timeline-tags' }, tags),
      item.detail ? h('div', { className: 'timeline-card-detail', textContent: item.detail }) : null
    ]);

    const node = h('div', {
      className: 'timeline-item',
      style: { animationDelay: `${idx * 120}ms` }
    }, [
      h('div', { className: 'timeline-dot' }),
      card
    ]);

    timeline.appendChild(node);
  });
}

// ─── 方案面板渲染 ───
function renderPlans(caseData) {
  const plans = caseData.plans;
  state.currentCase = caseData;
  state.currentPlanIdx = 0;

  $('#canvasEmpty').style.display = 'none';
  $('#canvasContent').style.display = 'block';

  const tabsContainer = $('#planTabs');
  tabsContainer.innerHTML = '';
  const tabIcons = ['🌟', '💡', '🎯'];
  plans.forEach((plan, idx) => {
    const tab = h('button', {
      className: `plan-tab${idx === 0 ? ' active' : ''}`,
      dataset: { plan: String(idx) },
      onClick: () => switchPlan(idx)
    }, [
      h('span', { className: 'tab-icon', textContent: tabIcons[idx] }),
      ` ${plan.name}`
    ]);
    tabsContainer.appendChild(tab);
  });

  renderPlanContent(0);
  const allScores = plans.map(p => p.scores);
  drawRadarChart($('#radarCanvas'), allScores, 0);
  renderRadarLegend(plans);
}

function renderPlanContent(idx) {
  const plan = state.currentCase.plans[idx];
  $('#planTitle').textContent = plan.title;
  $('#planSubtitle').textContent = plan.subtitle;
  $('#statCost').textContent = plan.totalCost;
  $('#statDuration').textContent = plan.duration;
  $('#statCount').textContent = `${plan.count} 项`;
  renderTimeline(plan);
}

function switchPlan(idx) {
  state.currentPlanIdx = idx;
  $$('.plan-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  renderPlanContent(idx);
  const allScores = state.currentCase.plans.map(p => p.scores);
  drawRadarChart($('#radarCanvas'), allScores, idx);
}

// ─── 聊天功能 ───
function addMessage(who, text, options = {}) {
  const messages = $('#chatMessages');
  const isUser = who === 'user';

  const bubble = h('div', { className: 'message-bubble' });
  const msgEl = h('div', { className: `message ${isUser ? 'user-message' : 'ai-message'}` }, [
    h('div', { className: `avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`, textContent: isUser ? '👤' : '🤖' }),
    h('div', { className: 'message-content' }, [
      bubble,
      h('div', { className: 'message-time', textContent: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) })
    ])
  ]);

  messages.appendChild(msgEl);
  messages.scrollTop = messages.scrollHeight;

  if (options.typing && !isUser) {
    typewriterEffect(bubble, text);
  } else {
    bubble.innerHTML = text.replace(/\n/g, '<br>');
  }

  return msgEl;
}

async function typewriterEffect(el, text) {
  el.classList.add('typing-cursor');
  const lines = text.split('\n');
  let html = '';

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    for (let ci = 0; ci < line.length; ci++) {
      html += line[ci];
      el.innerHTML = html.replace(/\n/g, '<br>');
      el.closest('.chat-messages')?.scrollTo({ top: el.closest('.chat-messages').scrollHeight, behavior: 'smooth' });
      await sleep(18 + Math.random() * 12);
    }
    if (li < lines.length - 1) {
      html += '\n';
      el.innerHTML = html.replace(/\n/g, '<br>');
      await sleep(60);
    }
  }

  el.classList.remove('typing-cursor');
}

// ─── Agent 思维面板 ───
const AGENT_PIPELINE_TEMPLATE = [
  { name: 'Orchestrator', icon: '🎯' },
  { name: 'Context', icon: '📋' },
  { name: 'Activity', icon: '🎪' },
  { name: 'Dining', icon: '🍽' },
  { name: 'Transport', icon: '🚗' },
  { name: 'Budget', icon: '💰' },
  { name: 'Optimizer', icon: '✨' }
];

function renderPipeline(agentSteps, activeIdx) {
  const pipeline = $('#pipeline');
  pipeline.innerHTML = '';

  agentSteps.forEach((agent, idx) => {
    if (idx > 0) {
      const arrow = h('div', { className: `pipeline-arrow${idx <= activeIdx ? ' active' : ''}` }, [
        document.createTextNode('→')
      ]);
      pipeline.appendChild(arrow);
    }

    const statusClass = idx < activeIdx ? 'completed'
      : idx === activeIdx ? 'running'
      : 'waiting';

    const iconContent = idx < activeIdx ? '✓' : agent.icon;

    const node = h('div', {
      className: 'pipeline-node',
      onClick: () => showAgentDetail(agent, idx, statusClass)
    }, [
      h('div', { className: `node-icon ${statusClass}`, textContent: iconContent }),
      h('div', { className: 'node-name', textContent: agent.name })
    ]);

    pipeline.appendChild(node);
  });
}

function showAgentDetail(agent, idx, status) {
  const detail = $('#agentDetail');
  const statusText = status === 'completed' ? '✅ 已完成'
    : status === 'running' ? '⏳ 运行中'
    : '○ 等待中';

  if (!agent.thinking) {
    detail.innerHTML = `<div class="detail-placeholder">${agent.name} 尚未开始工作</div>`;
    return;
  }

  detail.innerHTML = '';
  const card = h('div', { className: 'agent-detail-card' }, [
    h('div', { className: 'agent-detail-header' }, [
      h('span', { textContent: `${agent.icon} ${agent.name}` }),
      h('span', { textContent: statusText, style: { fontSize: '.78rem', fontWeight: '400', marginLeft: 'auto', color: 'var(--text-muted)' } })
    ]),
    h('div', { className: 'agent-detail-text', textContent: agent.thinking })
  ]);
  detail.appendChild(card);
}

async function animatePipeline(agents) {
  for (let i = 0; i < agents.length; i++) {
    renderPipeline(agents, i);
    showAgentDetail(agents[i], i, 'running');
    $('#thinkingBarStatus').textContent = `${agents[i].icon} ${agents[i].name} 正在思考...`;
    await sleep(800 + Math.random() * 600);
  }
  renderPipeline(agents, agents.length);
  $('#thinkingBarStatus').textContent = '全部完成 ✅';
}

// ─── 展示模式 — 从API加载预建案例 ───
async function playShowcaseFromAPI(caseId) {
  if (state.isAnimating) return;
  state.isAnimating = true;

  const apiCase = await loadCaseDetail(caseId);
  if (!apiCase) {
    showToast('案例加载失败，请稍后重试');
    state.isAnimating = false;
    return;
  }

  const caseData = convertAPICaseToLocal(apiCase);
  if (!caseData || !caseData.plans.length) {
    showToast('案例数据格式异常');
    state.isAnimating = false;
    return;
  }

  $('#presetScenes').style.display = 'none';
  $('#thinkingPanel').classList.add('expanded');
  state.thinkingExpanded = true;

  addMessage('user', caseData.userMessage);
  await sleep(500);

  const aiMsgPromise = new Promise(resolve => {
    const el = addMessage('ai', '', { typing: false });
    const bubble = el.querySelector('.message-bubble');
    typewriterEffect(bubble, caseData.aiReply).then(resolve);
  });

  await sleep(300);
  await animatePipeline(caseData.agents);
  await aiMsgPromise;
  await sleep(400);

  addMessage('ai', `方案已生成！为你准备了${caseData.plans.length}套差异化方案，请在右侧面板查看和对比 👉`);
  await sleep(300);

  renderPlans(caseData);
  state.isAnimating = false;
}

// ─── 展示模式 — 预建案例播放（本地硬编码fallback） ───
async function playShowcase(caseKey) {
  if (state.isAnimating) return;
  state.isAnimating = true;

  const caseData = PREBUILT_CASES[caseKey];
  if (!caseData) { state.isAnimating = false; return; }

  $('#presetScenes').style.display = 'none';
  $('#thinkingPanel').classList.add('expanded');
  state.thinkingExpanded = true;

  addMessage('user', caseData.userMessage);
  await sleep(500);

  const aiMsgPromise = new Promise(resolve => {
    const el = addMessage('ai', '', { typing: false });
    const bubble = el.querySelector('.message-bubble');
    typewriterEffect(bubble, caseData.aiReply).then(resolve);
  });

  await sleep(300);
  await animatePipeline(caseData.agents);
  await aiMsgPromise;
  await sleep(400);

  addMessage('ai', '方案已生成！为你准备了3套差异化方案，请在右侧面板查看和对比 👉');
  await sleep(300);

  renderPlans(caseData);
  state.isAnimating = false;
}

// ─── 在线模式 ───
async function planLive(userInput) {
  addMessage('user', userInput);
  state.mode = 'live';
  $('#modeBadge').textContent = '在线模式';
  $('#modeBadge').classList.add('live');

  const thinkingMsg = addMessage('ai', '正在为你规划中...', { typing: false });

  $('#thinkingPanel').classList.add('expanded');
  state.thinkingExpanded = true;
  renderPipeline(AGENT_PIPELINE_TEMPLATE, 0);
  $('#thinkingBarStatus').textContent = '正在连接 Agent...';

  try {
    const resp = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: userInput, user_id: 'demo_user' })
    });

    if (resp.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentAgentIdx = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, data, thinkingMsg);
              if (currentEvent === 'agent_start') currentAgentIdx++;
            } catch (e) { /* skip malformed events */ }
          }
        }
      }
    } else {
      const data = await resp.json();
      if (data.plans) {
        renderPlans({ plans: data.plans, agents: data.agents || AGENT_PIPELINE_TEMPLATE });
        thinkingMsg.querySelector('.message-bubble').textContent = '方案已生成，请查看右侧面板！';
      }
    }
  } catch (err) {
    thinkingMsg.querySelector('.message-bubble').innerHTML = '⚠️ 无法连接到后端服务。<br>提示：您可以点击预设场景按钮体验展示模式。';
    console.warn('Live mode unavailable:', err.message);
    state.mode = 'showcase';
    $('#modeBadge').textContent = '展示模式';
    $('#modeBadge').classList.remove('live');
  }
}

function handleSSEEvent(eventType, data, thinkingMsg) {
  const AGENT_ICONS = { orchestrator: '🎯', context: '📋', dining: '🍽', activity: '🎪', synthesizer: '🧩', critic: '🔍', executor: '⚡', notifier: '🔔' };

  switch (eventType) {
    case 'agent_start': {
      const agentName = data.agent || 'Agent';
      $('#thinkingBarStatus').textContent = `${AGENT_ICONS[agentName] || '⚙️'} ${agentName} 启动中...`;
      break;
    }
    case 'agent_thinking': {
      const agentName = data.agent || 'Agent';
      showAgentDetail(
        { name: agentName, icon: AGENT_ICONS[agentName] || '⚙️', thinking: data.thought || '' },
        0, 'running'
      );
      break;
    }
    case 'agent_complete': {
      const agentName = data.agent || 'Agent';
      $('#thinkingBarStatus').textContent = `${AGENT_ICONS[agentName] || '✅'} ${agentName} 完成`;
      break;
    }
    case 'plan_ready': {
      if (data.plans) {
        const localCase = {
          plans: data.plans.map((p, idx) => ({
            name: p.title || `方案 ${String.fromCharCode(65 + idx)}`,
            title: p.title || `方案 ${String.fromCharCode(65 + idx)}`,
            subtitle: p.summary || p.highlight || '',
            scores: {
              cost: ((p.score?.cost || 70) / 100),
              fun: ((p.score?.fun || 70) / 100),
              convenience: ((p.score?.convenience || 70) / 100),
              fit: ((p.score?.fit || 70) / 100),
              uniqueness: ((p.score?.uniqueness || 70) / 100),
            },
            totalCost: `¥${p.total_cost_per_person || '?'}/人`,
            duration: `${p.total_duration_hours || '?'}h`,
            count: (p.nodes || []).length,
            timeline: (p.nodes || []).map(n => ({
              time: n.time_start || '',
              icon: { activity: '🎪', dining: '🍽', transport: '🚗', rest: '☕' }[n.category] || '📍',
              title: n.title || n.venue_name || '',
              subtitle: n.description || n.venue_address || '',
              tags: [
                n.cost_per_person ? { text: `¥${n.cost_per_person}/人`, type: 'price' } : null,
                n.booking_status === 'confirmed' ? { text: '已预约', type: 'booked' } : null,
              ].filter(Boolean),
              detail: n.description || ''
            }))
          }))
        };
        renderPlans(localCase);
        if (thinkingMsg) {
          thinkingMsg.querySelector('.message-bubble').textContent = '方案已生成，请查看右侧面板！ 🎯';
        }
        addMessage('ai', '方案已就绪！请在右侧面板查看 🎯');
      }
      break;
    }
    case 'error':
      if (thinkingMsg) {
        thinkingMsg.querySelector('.message-bubble').innerHTML = `⚠️ ${data.message || '处理出错'}<br><small>您可以点击预设场景按钮体验展示模式。</small>`;
      }
      break;
    case 'done':
      $('#thinkingBarStatus').textContent = '全部完成 ✅';
      break;
  }
}

// ─── 一键执行 ───
async function executeAll() {
  if (!state.currentCase) return;
  const plan = state.currentCase.plans[state.currentPlanIdx];
  const modal = $('#executeModal');
  const body = $('#executeBody');

  modal.style.display = 'flex';
  body.innerHTML = '';

  const items = plan.timeline.filter(t => t.title !== '返程' && t.title !== '散场' && t.title !== '返程休息' && t.title !== '散场回家');

  items.forEach(item => {
    const row = h('div', { className: 'execute-item', dataset: { title: item.title } }, [
      h('div', { className: 'execute-icon', textContent: item.icon }),
      h('div', { className: 'execute-info' }, [
        h('div', { className: 'execute-name', textContent: item.title }),
        h('div', { className: 'execute-desc', textContent: item.subtitle })
      ]),
      h('div', { className: 'execute-status pending' })
    ]);
    body.appendChild(row);
  });

  for (const item of body.querySelectorAll('.execute-item')) {
    const status = item.querySelector('.execute-status');
    status.className = 'execute-status running';
    status.textContent = '⏳';
    await sleep(1000 + Math.random() * 800);
    status.className = 'execute-status';
    status.innerHTML = '';
    const check = h('div', { className: 'execute-checkmark', textContent: '✓' });
    status.appendChild(check);

    const dot = $(`.timeline-item:nth-child(${[...body.children].indexOf(item) + 1}) .timeline-dot`);
    if (dot) dot.classList.add('completed');
  }

  await sleep(400);
  const doneMsg = h('div', {
    style: { textAlign: 'center', padding: '16px', fontSize: '.9rem', color: 'var(--success)', fontWeight: '600' }
  }, [
    h('div', { textContent: '🎉', style: { fontSize: '2rem', marginBottom: '8px' } }),
    h('span', { textContent: '所有环节已安排就绪！祝你周末愉快！' })
  ]);
  body.appendChild(doneMsg);
}

// ─── 分享功能 ───
function openShareModal() {
  if (!state.currentCase) return;
  const plan = state.currentCase.plans[state.currentPlanIdx];
  const modal = $('#shareModal');

  const preview = $('#sharePreview');
  preview.innerHTML = `<strong>${plan.title}</strong><br>${plan.subtitle}<br><br>`;
  plan.timeline.forEach(t => {
    preview.innerHTML += `${t.time} ${t.icon} ${t.title}<br>`;
  });
  preview.innerHTML += `<br>💰 ${plan.totalCost} · ⏱ ${plan.duration}`;

  $('#shareLinkInput').value = `https://weplan.meituan.com/s/${Date.now().toString(36)}`;
  modal.style.display = 'flex';
}

// ─── 投票功能 ───
function openVoteModal() {
  if (!state.currentCase) return;
  const plan = state.currentCase.plans[state.currentPlanIdx];
  const modal = $('#voteModal');
  const body = $('#voteBody');
  body.innerHTML = '';
  state.votes = {};

  plan.timeline.forEach((item, idx) => {
    const btns = [
      { label: '❤️ Love', cls: 'love', val: 'love' },
      { label: '👍 OK', cls: 'ok', val: 'ok' },
      { label: '🤔 疑虑', cls: 'concern', val: 'concern' },
      { label: '👎 No', cls: 'no', val: 'no' }
    ];

    const btnEls = btns.map(b => {
      return h('button', {
        className: `vote-btn ${b.cls}`,
        textContent: b.label,
        onClick: (e) => {
          e.currentTarget.parentElement.querySelectorAll('.vote-btn').forEach(el => el.classList.remove('selected'));
          e.currentTarget.classList.add('selected');
          state.votes[idx] = b.val;
        }
      });
    });

    const row = h('div', { className: 'vote-item' }, [
      h('div', { className: 'vote-item-info' }, [
        h('span', { className: 'vote-item-icon', textContent: item.icon }),
        h('span', { className: 'vote-item-name', textContent: item.title })
      ]),
      h('div', { className: 'vote-buttons' }, btnEls)
    ]);
    body.appendChild(row);
  });

  modal.style.display = 'flex';
}

// ─── Toast 通知 ───
function showToast(message, duration = 2500) {
  let toast = $('.toast');
  if (!toast) {
    toast = h('div', { className: 'toast' });
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── 主题切换 ───
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  state.theme = next;
  localStorage.setItem('weplan-theme', next);
  if (state.currentCase) {
    const allScores = state.currentCase.plans.map(p => p.scores);
    drawRadarChart($('#radarCanvas'), allScores, state.currentPlanIdx);
  }
}

// ─── 城市选择器 ───
function initCitySelector() {
  const selector = $('#citySelector');
  selector.addEventListener('click', (e) => {
    e.stopPropagation();
    selector.classList.toggle('open');
  });

  $$('.city-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      $$('.city-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      state.city = opt.dataset.city;
      selector.querySelector('.city-name').textContent = opt.dataset.city;
      selector.classList.remove('open');
      showToast(`已切换到${opt.dataset.city}`);
    });
  });

  document.addEventListener('click', () => selector.classList.remove('open'));
}

// ─── 模式标签切换 ───
function initModeTabs() {
  $$('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.sceneMode = tab.dataset.mode;
      showToast(`已切换至${tab.querySelector('.mode-label').textContent}模式`);
    });
  });
}

// ─── 聊天输入 ───
function initChatInput() {
  const input = $('#chatInput');
  const btn = $('#sendBtn');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btn.addEventListener('click', sendMessage);
}

function sendMessage() {
  const input = $('#chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  planLive(text);
}

// ─── 预设场景按钮 ───
function initPresetButtons() {
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseKey = btn.dataset.case;
      if (PREBUILT_CASES[caseKey]) {
        playShowcase(caseKey);
      } else {
        playShowcaseFromAPI(caseKey);
      }
    });
  });
}

// ─── Agent 思维面板折叠 ───
function initThinkingPanel() {
  const bar = $('#thinkingToggleBar');
  const panel = $('#thinkingPanel');

  bar.addEventListener('click', () => {
    state.thinkingExpanded = !state.thinkingExpanded;
    panel.classList.toggle('expanded', state.thinkingExpanded);
  });

  const toggleBtn = $('#thinkingToggle');
  toggleBtn.addEventListener('click', () => {
    state.thinkingExpanded = !state.thinkingExpanded;
    panel.classList.toggle('expanded', state.thinkingExpanded);
    toggleBtn.classList.toggle('active', state.thinkingExpanded);
  });
}

// ─── 底部操作按钮 ───
function initActionButtons() {
  $('#executeBtn').addEventListener('click', executeAll);
  $('#shareBtn').addEventListener('click', openShareModal);
  $('#voteBtn').addEventListener('click', openVoteModal);

  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) $(`#${modalId}`).style.display = 'none';
    });
  });

  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });

  $('#submitVote')?.addEventListener('click', () => {
    const total = Object.keys(state.votes).length;
    if (total === 0) { showToast('请至少为一个环节投票'); return; }
    showToast(`投票已提交！共 ${total} 项`);
    $('#voteModal').style.display = 'none';
  });

  $('#copyLinkBtn')?.addEventListener('click', () => {
    const input = $('#shareLinkInput');
    input.select();
    navigator.clipboard?.writeText(input.value).then(() => showToast('链接已复制'));
  });

  $$('.share-channel').forEach(ch => {
    ch.addEventListener('click', () => {
      showToast(`正在打开${ch.querySelector('span:last-child').textContent}分享...`);
      setTimeout(() => { $('#shareModal').style.display = 'none'; }, 800);
    });
  });
}

// ─── 清空对话 ───
function initClearChat() {
  $('#clearChat').addEventListener('click', () => {
    const messages = $('#chatMessages');
    messages.innerHTML = '';
    addMessage('ai', '你好！我是 WePlan，你的 AI 周末活动规划师 🎯\n\n告诉我你这个周末想怎么过，我会为你量身打造完美方案！');
    $('#canvasEmpty').style.display = 'flex';
    $('#canvasContent').style.display = 'none';
    $('#presetScenes').style.display = 'block';
    state.currentCase = null;
    state.isAnimating = false;
    $('#pipeline').innerHTML = '';
    $('#agentDetail').innerHTML = '<div class="detail-placeholder">点击任意 Agent 节点查看详细思维过程</div>';
    $('#thinkingBarStatus').textContent = '';
    $('#thinkingPanel').classList.remove('expanded');
    state.thinkingExpanded = false;
    showToast('对话已清空');
  });
}

// ─── 移动端标签切换 ───
function initMobileTabs() {
  $$('.mobile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.mobile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = tab.dataset.panel;
      if (panel === 'chat') {
        $('#chatPanel').classList.remove('hidden');
        $('.canvas-panel').classList.remove('visible');
      } else {
        $('#chatPanel').classList.add('hidden');
        $('.canvas-panel').classList.add('visible');
      }
    });
  });
}

// ─── 初始化主题 ───
function initTheme() {
  const saved = localStorage.getItem('weplan-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    state.theme = saved;
  }
  $('#themeToggle').addEventListener('click', toggleTheme);
}

// ─── 应用初始化 ───
function init() {
  initTheme();
  initCitySelector();
  initModeTabs();
  initChatInput();
  initPresetButtons();
  initThinkingPanel();
  initActionButtons();
  initClearChat();
  initMobileTabs();
  loadCasesFromAPI();
}

document.addEventListener('DOMContentLoaded', init);
