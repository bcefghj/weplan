/* ============================================================
   WePlan Desktop Demo · app.js
   桌面双栏布局 · 6预建案例 · 地图 · 雷达图 · Agent流水线
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ─── State ─── */
const state = {
  mode: 'showcase',
  theme: localStorage.getItem('weplan-theme') || 'light',
  city: '',
  location: null,
  currentCase: null,
  currentPlanIdx: 0,
  thinkingExpanded: false,
  isAnimating: false,
  votes: {},
};

/* ─── Map Manager ─── */
const MapManager = {
  map: null, markers: [], polylines: [], infoWindow: null, _pending: null,

  init() {
    if (typeof AMap === 'undefined') { this._pending = true; return; }
    try {
      this.map = new AMap.Map('mapContainer', {
        zoom: 13, center: [120.15, 30.25],
        mapStyle: 'amap://styles/whitesmoke', viewMode: '2D',
      });
      this.map.addControl(new AMap.Scale());
      this.infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) });
      if (this._pending && typeof this._pending === 'object') this.renderPlan(this._pending);
    } catch (e) { console.warn('Map init failed', e); }
  },

  setCenter(lng, lat, zoom) {
    if (!this.map) return;
    this.map.setZoomAndCenter(zoom || 13, [lng, lat]);
  },

  renderPlan(plan) {
    if (!this.map) { this._pending = plan; return; }
    this.clear();
    const tl = plan.timeline || [];
    const positions = [];
    const colors = { transport: '#3182CE', dining: '#E53E3E', activity: '#38A169', rest: '#ECC94B' };

    tl.forEach((item, idx) => {
      if (!item.location) return;
      const [lng, lat] = item.location.split(',').map(Number);
      if (isNaN(lng) || isNaN(lat)) return;
      positions.push([lng, lat]);

      const color = colors[item.type || item.nodeType] || '#FF6B35';
      const marker = new AMap.Marker({
        position: [lng, lat],
        content: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${idx + 1}</div>`,
        offset: new AMap.Pixel(-13, -13),
      });
      marker.on('click', () => {
        const html = `<div style="padding:8px;min-width:200px;font-size:13px">
          <strong>${item.icon || ''} ${item.title}</strong><br>
          <span style="color:#718096">${item.subtitle || ''}</span>
          ${item.rating ? `<div style="margin-top:4px">⭐ 高德 ${item.rating}${item.dianping_rating ? ` · 点评 ${item.dianping_rating}` : ''}${item.meituan_rating ? ` · 美团 ${item.meituan_rating}` : ''}</div>` : ''}
          ${item.cost ? `<div>💰 ¥${item.cost}/人</div>` : ''}
          ${item.business_area ? `<div>📍 ${item.business_area}</div>` : ''}
        </div>`;
        this.infoWindow.setContent(html);
        this.infoWindow.open(this.map, [lng, lat]);
      });
      marker.setMap(this.map);
      this.markers.push(marker);
    });

    if (positions.length >= 2) {
      const line = new AMap.Polyline({
        path: positions, strokeColor: '#FF6B35', strokeWeight: 4,
        strokeOpacity: 0.7, strokeStyle: 'solid',
        showDir: true, dirColor: '#fff',
      });
      line.setMap(this.map);
      this.polylines.push(line);
    }
    if (positions.length > 0) this.map.setFitView(this.markers, false, [60, 60, 60, 60]);
    const mapSection = $('.plan-map-section');
    if (mapSection) mapSection.style.display = '';
  },

  highlightNode(idx) {
    if (!this.map || !this.markers[idx]) return;
    const pos = this.markers[idx].getPosition();
    this.map.setZoomAndCenter(15, pos);
    this.markers[idx].emit('click', { target: this.markers[idx] });
  },

  clear() {
    this.markers.forEach(m => m.setMap(null));
    this.polylines.forEach(p => p.setMap(null));
    this.markers = [];
    this.polylines = [];
    if (this.infoWindow) this.infoWindow.close();
  }
};

/* ─── Radar Chart ─── */
const RADAR_LABELS = ['花费', '趣味', '便捷', '适合度', '特色'];
const PLAN_COLORS = [
  { fill: 'rgba(255,107,53,0.18)', stroke: '#FF6B35' },
  { fill: 'rgba(43,108,176,0.18)', stroke: '#2B6CB0' },
  { fill: 'rgba(56,161,105,0.18)', stroke: '#38A169' },
];

function drawRadarChart(canvas, allScores, activeIdx) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 30;
  ctx.clearRect(0, 0, W, H);
  const n = RADAR_LABELS.length;
  const angleStep = (Math.PI * 2) / n;

  for (let ring = 1; ring <= 5; ring++) {
    const r = (R / 5) * ring;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i * angleStep - Math.PI / 2;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(160,174,192,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const a = i * angleStep - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    ctx.strokeStyle = 'rgba(160,174,192,0.3)';
    ctx.stroke();

    const lx = cx + (R + 18) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#718096';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(RADAR_LABELS[i], lx, ly);
  }

  allScores.forEach((scores, pIdx) => {
    if (!scores || scores.length < n) return;
    const c = PLAN_COLORS[pIdx] || PLAN_COLORS[0];
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const val = Math.max(0, Math.min(1, scores[idx]));
      const a = idx * angleStep - Math.PI / 2;
      const x = cx + R * val * Math.cos(a), y = cy + R * val * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = pIdx === activeIdx ? 2.5 : 1.2;
    ctx.globalAlpha = pIdx === activeIdx ? 1 : 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (pIdx === activeIdx) {
      for (let i = 0; i < n; i++) {
        const val = Math.max(0, Math.min(1, scores[i]));
        const a = i * angleStep - Math.PI / 2;
        const x = cx + R * val * Math.cos(a), y = cy + R * val * Math.sin(a);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.stroke;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  });
}

/* ─── 6 Prebuilt Cases ─── */
const DEMO_CASES = {
  'family-park': {
    id: 'family-park',
    userMessage: '今天下午带娃出去玩，孩子5岁，老婆在减肥，别离家太远',
    aiReply: '收到！正在为你规划「杭州·家庭温馨半日游」🎯 5岁萌娃+健康妈妈的完美下午',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析意图：家庭亲子游，孩子5岁，妻子减肥需求，距离近，下午时段' },
      { name: 'Context', icon: '📋', thinking: '杭州·晴天28°C·适合户外，定位：西湖区附近' },
      { name: 'Dining', icon: '🍽', thinking: '搜索轻食/沙拉/杭帮菜餐厅，排除火锅烧烤类高热量，筛选有儿童椅的' },
      { name: 'Activity', icon: '🎪', thinking: '搜索亲子乐园/公园/博物馆，筛选5岁适龄，排除需要长时间步行的' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成3套差异化方案：公园慢游/博物馆探索/商圈一站式' },
      { name: 'Critic', icon: '🔍', thinking: '方案A最优：亲子适配10/10，低卡餐厅满足减肥需求，距离合理' },
    ],
    plans: [
      {
        name: '亲子慢游', title: '🌈 西湖亲子慢游', subtitle: '轻松惬意·适合带小朋友',
        scores: [0.85, 0.9, 0.8, 0.95, 0.7],
        totalCost: '¥356', duration: '4h', count: 6,
        timeline: [
          { time: '14:00', icon: '🚗', title: '出发', subtitle: '滴滴快车·约15分钟', nodeType: 'transport', location: '120.155,30.260', cost: '18' },
          { time: '14:15', icon: '🎪', title: '嘟嘟城儿童职业体验馆', subtitle: '适合3-8岁·角色扮演', nodeType: 'activity', location: '120.163,30.258', rating: '4.6', dianping_rating: '4.5', meituan_rating: '4.6', cost: '196', business_area: '来福士' },
          { time: '16:15', icon: '🚶', title: '步行前往', subtitle: '步行约10分钟', nodeType: 'transport', location: '120.162,30.257' },
          { time: '16:25', icon: '🍽', title: 'gaga鲜语(来福士店)', subtitle: '轻食沙拉·有低卡选项', nodeType: 'dining', location: '120.163,30.258', rating: '4.5', dianping_rating: '4.4', meituan_rating: '4.5', cost: '62', business_area: '来福士' },
          { time: '17:25', icon: '🌅', title: '来福士天台花园', subtitle: '免费·看日落·拍照', nodeType: 'activity', location: '120.163,30.258', rating: '4.3', cost: '0', business_area: '来福士' },
          { time: '17:45', icon: '🚗', title: '返程回家', subtitle: '滴滴快车·约15分钟', nodeType: 'transport', location: '120.155,30.260', cost: '22' },
        ],
      },
      {
        name: '博物馆探索', title: '🏛 博物馆探索日', subtitle: '寓教于乐·培养好奇心',
        scores: [0.9, 0.75, 0.85, 0.9, 0.8],
        totalCost: '¥280', duration: '5h', count: 5,
        timeline: [
          { time: '13:30', icon: '🚇', title: '地铁出发', subtitle: '1号线→武林广场站', nodeType: 'transport', location: '120.167,30.276', cost: '4' },
          { time: '14:00', icon: '🏛', title: '浙江自然博物馆', subtitle: '恐龙展厅·海洋馆·免费', nodeType: 'activity', location: '120.167,30.276', rating: '4.9', dianping_rating: '4.8', cost: '0', business_area: '武林广场' },
          { time: '16:00', icon: '☕', title: 'Manner Coffee(武林)', subtitle: '手冲咖啡·有鲜榨果汁', nodeType: 'dining', location: '120.166,30.275', rating: '4.4', dianping_rating: '4.3', cost: '28', business_area: '武林广场' },
          { time: '16:30', icon: '🍽', title: '新白鹿(武林店)', subtitle: '杭帮菜·有沙拉·性价比高', nodeType: 'dining', location: '120.168,30.275', rating: '4.5', dianping_rating: '4.6', meituan_rating: '4.5', cost: '55', business_area: '武林广场' },
          { time: '18:00', icon: '🚇', title: '地铁返程', subtitle: '1号线直达', nodeType: 'transport', location: '120.167,30.276', cost: '4' },
        ],
      },
      {
        name: '西溪湿地', title: '🌿 西溪湿地野趣', subtitle: '自然探索·湿地泛舟',
        scores: [0.75, 0.95, 0.65, 0.85, 0.9],
        totalCost: '¥420', duration: '4.5h', count: 5,
        timeline: [
          { time: '13:30', icon: '🚗', title: '打车出发', subtitle: '约25分钟到西溪湿地', nodeType: 'transport', location: '120.062,30.265', cost: '35' },
          { time: '14:00', icon: '🛶', title: '西溪湿地摇橹船', subtitle: '一家三口泛舟·赏荷花', nodeType: 'activity', location: '120.062,30.268', rating: '4.7', dianping_rating: '4.6', cost: '100', business_area: '西溪湿地' },
          { time: '15:30', icon: '🌾', title: '河渚街散步', subtitle: '古街小吃·手工体验', nodeType: 'activity', location: '120.065,30.270', rating: '4.4', cost: '0', business_area: '西溪湿地' },
          { time: '16:30', icon: '🍽', title: '西溪花间堂·餐厅', subtitle: '农家菜·有素菜·环境好', nodeType: 'dining', location: '120.064,30.269', rating: '4.5', dianping_rating: '4.3', cost: '85', business_area: '西溪湿地' },
          { time: '18:00', icon: '🚗', title: '返程', subtitle: '打车约25分钟', nodeType: 'transport', location: '120.155,30.260', cost: '35' },
        ],
      },
    ],
  },

  'friends-gathering': {
    id: 'friends-gathering',
    userMessage: '周六4个朋友聚一聚，吃喝玩乐来点新奇的',
    aiReply: '好嘞！4人派对安排上了 🎉 为你打造「杭州·朋友聚会嗨玩局」',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析：朋友聚会4人，周六全天，要求新奇刺激' },
      { name: 'Context', icon: '📋', thinking: '杭州·周六·晴，适合户外+室内混搭' },
      { name: 'Dining', icon: '🍽', thinking: '搜索特色火锅/新奇餐厅/精酿啤酒吧' },
      { name: 'Activity', icon: '🎪', thinking: '搜索密室逃脱/剧本杀/LiveHouse/轰趴' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成3套：密室+火锅夜/美食探店/文艺复兴日' },
      { name: 'Critic', icon: '🔍', thinking: '方案均通过，密室方案趣味度最高' },
    ],
    plans: [
      {
        name: '密室冒险夜', title: '🔮 密室冒险+火锅夜', subtitle: '刺激解谜·辣到飞起',
        scores: [0.7, 0.95, 0.75, 0.85, 0.95],
        totalCost: '¥280/人', duration: '6h', count: 5,
        timeline: [
          { time: '14:00', icon: '🚇', title: '地铁集合', subtitle: '凤起路站B口·步行5分钟', nodeType: 'transport', location: '120.170,30.268' },
          { time: '14:15', icon: '🔮', title: '迷境密室逃脱', subtitle: '「午夜博物馆」主题·2h', nodeType: 'activity', location: '120.172,30.268', rating: '4.8', dianping_rating: '4.7', cost: '128', business_area: '凤起路' },
          { time: '16:30', icon: '☕', title: '%Arabica(湖滨)', subtitle: '网红咖啡·拍照休息', nodeType: 'dining', location: '120.159,30.254', rating: '4.6', dianping_rating: '4.5', cost: '45', business_area: '湖滨银泰' },
          { time: '17:30', icon: '🍲', title: '巴奴毛肚火锅', subtitle: '毛肚火锅·4人套餐', nodeType: 'dining', location: '120.162,30.257', rating: '4.7', dianping_rating: '4.6', meituan_rating: '4.7', cost: '120', business_area: '来福士' },
          { time: '19:30', icon: '🎵', title: 'MAO Livehouse', subtitle: '独立乐队现场·今晚有演出', nodeType: 'activity', location: '120.175,30.271', rating: '4.5', dianping_rating: '4.4', cost: '80', business_area: '庆春路' },
        ],
      },
      {
        name: '美食探店', title: '🍜 美食探店局', subtitle: '从早吃到晚·杭州味道',
        scores: [0.6, 0.85, 0.9, 0.8, 0.8],
        totalCost: '¥200/人', duration: '5h', count: 5,
        timeline: [
          { time: '14:00', icon: '🚗', title: '打车到河坊街', subtitle: '约15分钟', nodeType: 'transport', location: '120.167,30.249', cost: '15' },
          { time: '14:20', icon: '🍡', title: '河坊街小吃', subtitle: '定胜糕·龙须糖·糖炒栗子', nodeType: 'dining', location: '120.167,30.249', rating: '4.3', cost: '30', business_area: '河坊街' },
          { time: '15:30', icon: '🍵', title: '太极茶道', subtitle: '龙井茶品鉴·茶艺表演', nodeType: 'activity', location: '120.168,30.248', rating: '4.6', dianping_rating: '4.5', cost: '58', business_area: '河坊街' },
          { time: '16:30', icon: '🍽', title: '知味观(河坊街总店)', subtitle: '杭帮菜·片儿川·东坡肉', nodeType: 'dining', location: '120.169,30.249', rating: '4.7', dianping_rating: '4.6', meituan_rating: '4.7', cost: '75', business_area: '河坊街' },
          { time: '18:30', icon: '🍺', title: '斑马精酿', subtitle: 'IPA+小食拼盘', nodeType: 'dining', location: '120.174,30.267', rating: '4.5', dianping_rating: '4.4', cost: '65', business_area: '凤起路' },
        ],
      },
      {
        name: '文艺复兴日', title: '🎨 文艺复兴日', subtitle: '看展+书店+精酿',
        scores: [0.75, 0.8, 0.8, 0.75, 0.9],
        totalCost: '¥220/人', duration: '6h', count: 5,
        timeline: [
          { time: '13:30', icon: '🚗', title: '打车集合', subtitle: '中国美院象山', nodeType: 'transport', location: '120.123,30.211', cost: '25' },
          { time: '14:00', icon: '🎨', title: '中国美术学院民艺博物馆', subtitle: '隈研吾设计·免费', nodeType: 'activity', location: '120.123,30.211', rating: '4.8', dianping_rating: '4.7', cost: '0', business_area: '象山' },
          { time: '15:30', icon: '📚', title: '钟书阁(滨江)', subtitle: '最美书店·打卡拍照', nodeType: 'activity', location: '120.190,30.210', rating: '4.7', dianping_rating: '4.6', cost: '0', business_area: '滨江' },
          { time: '17:00', icon: '🍽', title: '弄堂里(南宋御街)', subtitle: '杭帮菜·环境文艺', nodeType: 'dining', location: '120.165,30.250', rating: '4.6', dianping_rating: '4.5', meituan_rating: '4.5', cost: '85', business_area: '南宋御街' },
          { time: '19:00', icon: '🍻', title: '走嗨精酿(南山路)', subtitle: '西湖边精酿·夜景绝佳', nodeType: 'dining', location: '120.148,30.240', rating: '4.5', dianping_rating: '4.4', cost: '70', business_area: '南山路' },
        ],
      },
    ],
  },

  'couple-date': {
    id: 'couple-date',
    userMessage: '和女朋友约会，找个浪漫有氛围的地方逛逛吃吃',
    aiReply: '浪漫约会安排！💑 为你准备了「杭州·浪漫约会日」',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析：情侣约会，浪漫氛围，逛+吃' },
      { name: 'Context', icon: '📋', thinking: '杭州·晴·日落19:15，适合安排夕阳环节' },
      { name: 'Dining', icon: '🍽', thinking: '搜索西餐/日料/法餐等浪漫餐厅，有窗景的优先' },
      { name: 'Activity', icon: '🎪', thinking: '搜索西湖/南山路/文艺街区等约会地标' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成3套：西湖漫步/南山路文艺/钱塘江夜景' },
      { name: 'Critic', icon: '🔍', thinking: '氛围感校验通过，路线流畅度OK' },
    ],
    plans: [
      {
        name: '西湖浪漫', title: '🌸 西湖浪漫漫步', subtitle: '断桥·白堤·日落·法餐',
        scores: [0.6, 0.85, 0.8, 0.95, 0.85],
        totalCost: '¥680', duration: '6h', count: 5,
        timeline: [
          { time: '14:00', icon: '🚗', title: '打车到断桥', subtitle: '约20分钟', nodeType: 'transport', location: '120.152,30.261', cost: '25' },
          { time: '14:30', icon: '🌸', title: '断桥→白堤漫步', subtitle: '西湖十景·拍照胜地', nodeType: 'activity', location: '120.152,30.261', rating: '4.9', cost: '0', business_area: '西湖风景区' },
          { time: '16:00', icon: '☕', title: '湖畔居茶楼', subtitle: '西湖边品茶·看日落', nodeType: 'dining', location: '120.148,30.256', rating: '4.6', dianping_rating: '4.5', cost: '88', business_area: '湖滨' },
          { time: '17:30', icon: '🌅', title: '苏堤看日落', subtitle: '19:15日落·最佳观赏点', nodeType: 'activity', location: '120.139,30.245', rating: '4.8', cost: '0', business_area: '苏堤' },
          { time: '19:30', icon: '🍽', title: '西湖一号法餐厅', subtitle: '湖景法餐·红酒牛排', nodeType: 'dining', location: '120.147,30.253', rating: '4.7', dianping_rating: '4.6', meituan_rating: '4.7', cost: '350', business_area: '湖滨28' },
        ],
      },
      {
        name: '南山路文艺', title: '🎭 南山路文艺之旅', subtitle: '看展·咖啡·书店·西餐',
        scores: [0.7, 0.8, 0.85, 0.9, 0.9],
        totalCost: '¥520', duration: '5.5h', count: 5,
        timeline: [
          { time: '14:00', icon: '🚗', title: '打车到南山路', subtitle: '约15分钟', nodeType: 'transport', location: '120.150,30.240', cost: '20' },
          { time: '14:20', icon: '🎨', title: '中国美术馆(南山路)', subtitle: '当代艺术展·免费', nodeType: 'activity', location: '120.150,30.240', rating: '4.6', dianping_rating: '4.5', cost: '0', business_area: '南山路' },
          { time: '15:30', icon: '📚', title: '纯真年代书吧', subtitle: '湖景书店·文青打卡地', nodeType: 'activity', location: '120.149,30.239', rating: '4.7', dianping_rating: '4.6', cost: '45', business_area: '南山路' },
          { time: '17:00', icon: '🍽', title: '绿茶餐厅(龙井路)', subtitle: '杭帮菜·环境清幽', nodeType: 'dining', location: '120.131,30.246', rating: '4.5', dianping_rating: '4.4', meituan_rating: '4.5', cost: '75', business_area: '龙井路' },
          { time: '19:00', icon: '🌃', title: '西湖音乐喷泉', subtitle: '免费·光影秀·19:30开始', nodeType: 'activity', location: '120.153,30.252', rating: '4.6', cost: '0', business_area: '湖滨' },
        ],
      },
      {
        name: '钱塘夜景', title: '🌃 钱塘江夜景约会', subtitle: '日料·灯光秀·江景',
        scores: [0.55, 0.9, 0.7, 0.85, 0.95],
        totalCost: '¥750', duration: '5h', count: 4,
        timeline: [
          { time: '16:00', icon: '🚗', title: '打车到钱江新城', subtitle: '约25分钟', nodeType: 'transport', location: '120.212,30.245', cost: '30' },
          { time: '16:30', icon: '🏙', title: '城市阳台', subtitle: '钱塘江观景·日落', nodeType: 'activity', location: '120.212,30.245', rating: '4.5', cost: '0', business_area: '钱江新城' },
          { time: '18:00', icon: '🍣', title: '板前寿司(万象城)', subtitle: 'Omakase·料理精致', nodeType: 'dining', location: '120.215,30.248', rating: '4.8', dianping_rating: '4.7', meituan_rating: '4.7', cost: '280', business_area: '钱江新城' },
          { time: '20:00', icon: '🌃', title: '钱塘江灯光秀', subtitle: '两岸LED·免费', nodeType: 'activity', location: '120.212,30.244', rating: '4.7', cost: '0', business_area: '钱江新城' },
        ],
      },
    ],
  },

  'solo-relax': {
    id: 'solo-relax',
    userMessage: '一个人想找个安静地方待一会儿',
    aiReply: '给自己一段安静时光 🧘 为你规划「杭州·独处时光」',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析：独处/安静/放松，一人，时间灵活' },
      { name: 'Context', icon: '📋', thinking: '杭州·晴·适合户外放空' },
      { name: 'Dining', icon: '🍽', thinking: '搜索安静咖啡馆/茶室/独食友好餐厅' },
      { name: 'Activity', icon: '🎪', thinking: '搜索书店/公园/寺庙/茶园等安静场所' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成：龙井问茶/书店咖啡/运河漫步' },
      { name: 'Critic', icon: '🔍', thinking: '所有方案噪音低、人流少，适合独处' },
    ],
    plans: [
      {
        name: '龙井问茶', title: '🍵 龙井问茶独处', subtitle: '茶园·寺院·远离喧嚣',
        scores: [0.8, 0.7, 0.6, 0.95, 0.85],
        totalCost: '¥180', duration: '4h', count: 4,
        timeline: [
          { time: '14:00', icon: '🚗', title: '打车到龙井村', subtitle: '约30分钟', nodeType: 'transport', location: '120.115,30.229', cost: '35' },
          { time: '14:30', icon: '🍵', title: '龙井茶园散步', subtitle: '茶田小径·远眺山景', nodeType: 'activity', location: '120.115,30.229', rating: '4.8', cost: '0', business_area: '龙井' },
          { time: '15:30', icon: '☕', title: '龙井草堂', subtitle: '茶室·龙井茶+点心', nodeType: 'dining', location: '120.117,30.228', rating: '4.6', dianping_rating: '4.5', cost: '68', business_area: '龙井' },
          { time: '17:00', icon: '🏯', title: '法喜寺', subtitle: '千年古刹·静心', nodeType: 'activity', location: '120.099,30.230', rating: '4.7', dianping_rating: '4.6', cost: '0', business_area: '天竺路' },
        ],
      },
      {
        name: '书店咖啡', title: '📖 书店咖啡之旅', subtitle: '阅读·发呆·独享下午',
        scores: [0.85, 0.65, 0.9, 0.9, 0.75],
        totalCost: '¥120', duration: '3.5h', count: 3,
        timeline: [
          { time: '14:00', icon: '📚', title: '晓风书屋(体育场路)', subtitle: '老牌独立书店·安静', nodeType: 'activity', location: '120.170,30.272', rating: '4.6', dianping_rating: '4.5', cost: '0', business_area: '体育场路' },
          { time: '15:30', icon: '☕', title: 'M Stand(武林)', subtitle: '设计感咖啡馆·有插座', nodeType: 'dining', location: '120.166,30.274', rating: '4.5', dianping_rating: '4.4', cost: '42', business_area: '武林广场' },
          { time: '17:00', icon: '🍽', title: '面条铺(武林路)', subtitle: '一人食友好·葱油拌面', nodeType: 'dining', location: '120.164,30.272', rating: '4.4', cost: '32', business_area: '武林路' },
        ],
      },
      {
        name: '运河漫步', title: '🚶 运河漫步', subtitle: '京杭运河·慢节奏',
        scores: [0.9, 0.75, 0.7, 0.85, 0.8],
        totalCost: '¥95', duration: '3h', count: 3,
        timeline: [
          { time: '15:00', icon: '🚶', title: '大兜路历史街区', subtitle: '运河边老房子·安静', nodeType: 'activity', location: '120.148,30.290', rating: '4.5', cost: '0', business_area: '大兜路' },
          { time: '16:00', icon: '☕', title: '运河边咖啡馆', subtitle: '户外座·看船来船往', nodeType: 'dining', location: '120.147,30.292', rating: '4.3', cost: '38', business_area: '大兜路' },
          { time: '17:00', icon: '🍜', title: '拱墅小吃', subtitle: '片儿川·简单一餐', nodeType: 'dining', location: '120.146,30.293', rating: '4.4', cost: '25', business_area: '大兜路' },
        ],
      },
    ],
  },

  'rainy-indoor': {
    id: 'rainy-indoor',
    userMessage: '下雨了，找个室内活动打发时间',
    aiReply: '雨天也精彩！🌧️ 为你安排「杭州·雨天室内好去处」',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析：雨天·室内活动·打发时间·一人或朋友' },
      { name: 'Context', icon: '📋', thinking: '杭州·中雨·22°C·纯室内方案' },
      { name: 'Dining', icon: '🍽', thinking: '搜索商场内餐厅/火锅/下午茶' },
      { name: 'Activity', icon: '🎪', thinking: '搜索商场/电影院/博物馆/温泉/密室' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成：商场一日/博物馆+影院/温泉spa' },
      { name: 'Critic', icon: '🔍', thinking: '全部室内，无天气风险' },
    ],
    plans: [
      {
        name: '商场探索', title: '🏬 商场一日游', subtitle: '逛吃逛吃·雨天不愁',
        scores: [0.7, 0.8, 0.95, 0.8, 0.65],
        totalCost: '¥350', duration: '5h', count: 4,
        timeline: [
          { time: '13:00', icon: '🚇', title: '地铁到湖滨银泰', subtitle: '龙翔桥站直达', nodeType: 'transport', location: '120.160,30.255', cost: '4' },
          { time: '13:30', icon: '🍽', title: '西贝莜面村(银泰)', subtitle: '午餐·家常菜', nodeType: 'dining', location: '120.160,30.255', rating: '4.5', dianping_rating: '4.4', meituan_rating: '4.5', cost: '75', business_area: '湖滨银泰' },
          { time: '14:30', icon: '🎬', title: '百美汇影城', subtitle: '看新片·VIP厅', nodeType: 'activity', location: '120.161,30.256', rating: '4.3', cost: '60', business_area: '湖滨银泰' },
          { time: '17:00', icon: '🧋', title: '喜茶(湖滨)', subtitle: '奶茶+甜品·逛街休息', nodeType: 'dining', location: '120.160,30.254', rating: '4.4', dianping_rating: '4.3', cost: '35', business_area: '湖滨银泰' },
        ],
      },
      {
        name: '博物馆+影院', title: '🏛 博物馆+影院', subtitle: '知识+娱乐·充实一天',
        scores: [0.8, 0.75, 0.85, 0.75, 0.8],
        totalCost: '¥220', duration: '5h', count: 4,
        timeline: [
          { time: '13:00', icon: '🚗', title: '打车到浙博', subtitle: '约20分钟', nodeType: 'transport', location: '120.148,30.242', cost: '20' },
          { time: '13:30', icon: '🏛', title: '浙江省博物馆(孤山)', subtitle: '免费·越王勾践剑', nodeType: 'activity', location: '120.148,30.255', rating: '4.8', dianping_rating: '4.7', cost: '0', business_area: '孤山' },
          { time: '15:30', icon: '☕', title: '星巴克臻选(天目里)', subtitle: '设计空间·雨天发呆', nodeType: 'dining', location: '120.135,30.282', rating: '4.5', dianping_rating: '4.4', cost: '55', business_area: '天目里' },
          { time: '17:00', icon: '🎬', title: '天目里·百美汇', subtitle: '文艺片放映', nodeType: 'activity', location: '120.135,30.282', rating: '4.4', cost: '45', business_area: '天目里' },
        ],
      },
      {
        name: '温泉放松', title: '♨️ 温泉spa放松', subtitle: '泡汤·按摩·彻底放松',
        scores: [0.5, 0.85, 0.7, 0.9, 0.75],
        totalCost: '¥450', duration: '4h', count: 3,
        timeline: [
          { time: '14:00', icon: '🚗', title: '打车出发', subtitle: '约30分钟', nodeType: 'transport', location: '120.030,30.220', cost: '40' },
          { time: '14:30', icon: '♨️', title: '杭州临安湍口温泉', subtitle: '露天温泉·含自助餐', nodeType: 'activity', location: '120.030,30.220', rating: '4.6', dianping_rating: '4.5', meituan_rating: '4.5', cost: '268', business_area: '临安' },
          { time: '18:00', icon: '🚗', title: '返程', subtitle: '约30分钟', nodeType: 'transport', location: '120.155,30.260', cost: '40' },
        ],
      },
    ],
  },

  'beijing-culture': {
    id: 'beijing-culture',
    userMessage: '在北京，想来个文化探索日',
    aiReply: '首都文化之旅安排！🏛️ 为你规划「北京·文化探索日」',
    agents: [
      { name: 'Orchestrator', icon: '🎯', thinking: '解析：北京·文化探索·一日游·含吃饭' },
      { name: 'Context', icon: '📋', thinking: '北京·晴·26°C·故宫需预约' },
      { name: 'Dining', icon: '🍽', thinking: '搜索北京特色餐厅：烤鸭/炸酱面/涮羊肉' },
      { name: 'Activity', icon: '🎪', thinking: '搜索故宫/胡同/798/颐和园等文化地标' },
      { name: 'Synthesizer', icon: '🧩', thinking: '生成：故宫+胡同/798+三里屯/颐和园+清华' },
      { name: 'Critic', icon: '🔍', thinking: '故宫方案需预约提醒已添加' },
    ],
    plans: [
      {
        name: '故宫胡同', title: '🏯 故宫+胡同深度游', subtitle: '皇城根下·老北京味道',
        scores: [0.65, 0.9, 0.75, 0.85, 0.9],
        totalCost: '¥420', duration: '7h', count: 6,
        timeline: [
          { time: '09:00', icon: '🚇', title: '地铁到天安门东', subtitle: '1号线', nodeType: 'transport', location: '116.403,39.915', cost: '5' },
          { time: '09:30', icon: '🏯', title: '故宫博物院', subtitle: '需提前预约·建议3h', nodeType: 'activity', location: '116.397,39.918', rating: '4.9', dianping_rating: '4.8', cost: '60', business_area: '东城区' },
          { time: '12:30', icon: '🍽', title: '四季民福烤鸭(故宫店)', subtitle: '排队名店·片皮鸭', nodeType: 'dining', location: '116.403,39.920', rating: '4.7', dianping_rating: '4.6', meituan_rating: '4.7', cost: '120', business_area: '东城区' },
          { time: '14:00', icon: '🏔', title: '景山公园', subtitle: '俯瞰故宫全景·¥2门票', nodeType: 'activity', location: '116.396,39.925', rating: '4.7', cost: '2', business_area: '景山' },
          { time: '15:00', icon: '🏘', title: '南锣鼓巷', subtitle: '胡同文化·文创小店', nodeType: 'activity', location: '116.403,39.937', rating: '4.4', dianping_rating: '4.3', cost: '0', business_area: '南锣鼓巷' },
          { time: '17:00', icon: '🍜', title: '方砖厂69号炸酱面', subtitle: '老北京炸酱面·地道', nodeType: 'dining', location: '116.404,39.938', rating: '4.6', dianping_rating: '4.5', cost: '28', business_area: '南锣鼓巷' },
        ],
      },
      {
        name: '798艺术', title: '🎨 798+三里屯', subtitle: '当代艺术·潮流地标',
        scores: [0.7, 0.85, 0.8, 0.75, 0.95],
        totalCost: '¥380', duration: '6h', count: 5,
        timeline: [
          { time: '10:00', icon: '🚇', title: '地铁到望京南', subtitle: '14号线', nodeType: 'transport', location: '116.488,39.984', cost: '5' },
          { time: '10:30', icon: '🎨', title: '798艺术区', subtitle: 'UCCA尤伦斯+画廊群', nodeType: 'activity', location: '116.494,39.984', rating: '4.6', dianping_rating: '4.5', cost: '60', business_area: '798' },
          { time: '13:00', icon: '🍽', title: 'At Cafe(798)', subtitle: '园区内·西餐简餐', nodeType: 'dining', location: '116.493,39.983', rating: '4.3', cost: '85', business_area: '798' },
          { time: '14:30', icon: '🚗', title: '打车到三里屯', subtitle: '约20分钟', nodeType: 'transport', location: '116.454,39.933', cost: '25' },
          { time: '15:00', icon: '🏬', title: '三里屯太古里', subtitle: '潮牌+买手店+Red', nodeType: 'activity', location: '116.454,39.933', rating: '4.5', dianping_rating: '4.4', cost: '0', business_area: '三里屯' },
        ],
      },
      {
        name: '颐和园', title: '🌳 颐和园+清华园', subtitle: '皇家园林·学术氛围',
        scores: [0.75, 0.8, 0.7, 0.8, 0.85],
        totalCost: '¥250', duration: '6h', count: 5,
        timeline: [
          { time: '09:00', icon: '🚇', title: '地铁到北宫门', subtitle: '4号线', nodeType: 'transport', location: '116.273,39.993', cost: '5' },
          { time: '09:30', icon: '🌳', title: '颐和园', subtitle: '昆明湖·长廊·十七孔桥', nodeType: 'activity', location: '116.273,39.993', rating: '4.8', dianping_rating: '4.7', cost: '30', business_area: '海淀区' },
          { time: '12:30', icon: '🍽', title: '清华园食堂', subtitle: '学生食堂体验·实惠', nodeType: 'dining', location: '116.326,40.003', rating: '4.2', cost: '20', business_area: '清华大学' },
          { time: '13:30', icon: '🏫', title: '清华大学(校园开放)', subtitle: '二校门·荷塘月色', nodeType: 'activity', location: '116.326,40.003', rating: '4.7', cost: '0', business_area: '清华大学' },
          { time: '15:30', icon: '📚', title: '万圣书园', subtitle: '学术书店·知识殿堂', nodeType: 'activity', location: '116.318,39.990', rating: '4.6', dianping_rating: '4.5', cost: '0', business_area: '五道口' },
        ],
      },
    ],
  },
};


/* ═══════════════════════════════════════════════════════════════
   SECTION 5b – Radar Helpers (chart draw fn lives above DEMO_CASES)
   ═══════════════════════════════════════════════════════════════ */

function computePlanScores(plan) {
  const tl = plan.timeline || [];
  const acts = tl.filter(n => (n.nodeType || n.type) !== 'transport');
  const rawCost = parseFloat(String(plan.totalCost).replace(/[^0-9.]/g, '')) || 300;
  return [
    Math.max(0.2, Math.min(1, 1.1 - rawCost / 600)),
    Math.min(1, 0.45 + acts.length * 0.1),
    Math.max(0.3, Math.min(1, 1.05 - tl.filter(n => (n.nodeType || n.type) === 'transport').length * 0.12)),
    (() => {
      const r = acts.map(n => parseFloat(n.rating) || 0).filter(v => v > 0);
      return r.length ? Math.min(1, (r.reduce((a, b) => a + b) / r.length) / 5) : 0.7;
    })(),
    Math.min(1, 0.5 + new Set(acts.map(n => n.nodeType || n.type)).size * 0.14),
  ].map(v => +v.toFixed(2));
}

function renderRadarLegend(plans) {
  const wrapper = $('#radarCanvas')?.parentElement;
  if (!wrapper) return;
  wrapper.querySelectorAll('.radar-legend').forEach(e => e.remove());
  const legend = document.createElement('div');
  legend.className = 'radar-legend';
  legend.style.cssText = 'display:flex;justify-content:center;gap:16px;margin-top:8px;font-size:12px;color:#64748B';
  plans.forEach((p, i) => {
    const c = PLAN_COLORS[i % PLAN_COLORS.length];
    const item = document.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:center;gap:4px;cursor:pointer';
    item.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${c.stroke};display:inline-block"></span>${p.name}`;
    item.onclick = () => switchPlan(i);
    legend.appendChild(item);
  });
  wrapper.appendChild(legend);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 – Timeline Rendering
   ═══════════════════════════════════════════════════════════════ */

function _stars(r) {
  if (!r) return '';
  const v = parseFloat(r);
  if (isNaN(v) || v <= 0) return '';
  return '★'.repeat(Math.floor(v)) + (v % 1 >= 0.3 ? '½' : '');
}

function renderTimeline(plan) {
  const container = $('#planTimeline');
  if (!container) return;
  container.innerHTML = '';
  const tl = plan.timeline || [];
  const typeColors = { transport: '#3182CE', dining: '#E53E3E', activity: '#38A169', rest: '#ECC94B' };

  tl.forEach((item, idx) => {
    const nodeType = item.nodeType || item.type || 'activity';
    const dotColor = typeColors[nodeType] || '#FF6B35';
    const featured = parseFloat(item.rating) >= 4.5;

    let ratingsHTML = '';
    if (item.rating && parseFloat(item.rating) > 0)
      ratingsHTML += `<span class="rating-badge amap">⭐ 高德 ${_stars(item.rating)} ${item.rating}</span>`;
    if (item.dianping_rating && parseFloat(item.dianping_rating) > 0)
      ratingsHTML += `<span class="rating-badge dianping">📝 点评 ${_stars(item.dianping_rating)} ${item.dianping_rating}</span>`;
    if (item.meituan_rating && parseFloat(item.meituan_rating) > 0)
      ratingsHTML += `<span class="rating-badge meituan">🟡 美团 ${_stars(item.meituan_rating)} ${item.meituan_rating}</span>`;

    const costLine = item.cost && item.cost !== '0'
      ? `<div class="cost-line">💰 ¥${item.cost}/人${item.business_area ? ` · 📍 ${item.business_area}` : ''}</div>`
      : (item.business_area ? `<div class="cost-line">📍 ${item.business_area}</div>` : '');

    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.style.animationDelay = `${idx * 0.08}s`;
    el.innerHTML = `
      <div class="timeline-dot" style="background:${dotColor}"></div>
      <div class="timeline-card${featured ? ' featured' : ''}">
        <div class="timeline-card-header">
          <div class="timeline-title">${item.icon || '📌'} ${item.title}</div>
          <div class="timeline-time">${item.time || ''}</div>
        </div>
        <div class="timeline-subtitle">${item.subtitle || ''}</div>
        ${ratingsHTML ? `<div class="rating-row">${ratingsHTML}</div>` : ''}
        ${costLine}
        ${featured ? '<span class="badge-featured">🏆 精选</span>' : ''}
        ${nodeType !== 'transport' ? `<button class="swap-btn" data-idx="${idx}">🔄 换</button>` : ''}
      </div>`;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.swap-btn')) return;
      const wasExpanded = el.classList.contains('expanded');
      $$('.timeline-item.expanded').forEach(x => x.classList.remove('expanded'));
      if (!wasExpanded) el.classList.add('expanded');
      MapManager.highlightNode(idx);
    });

    const swapBtn = el.querySelector('.swap-btn');
    if (swapBtn) {
      swapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        swapNode(idx, item);
      });
    }

    container.appendChild(el);
  });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 – Plan Panel Rendering
   ═══════════════════════════════════════════════════════════════ */

function renderPlans(caseData) {
  if (!caseData || !caseData.plans) return;
  state.currentCase = caseData;
  state.currentPlanIdx = 0;

  const planEmpty = $('#planEmpty');
  const planContent = $('#planContent');
  if (planEmpty) planEmpty.style.display = 'none';
  if (planContent) planContent.style.display = '';

  const tabs = $('#planTabs');
  if (tabs) {
    tabs.innerHTML = '';
    const icons = ['🌟', '💡', '🎯'];
    caseData.plans.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'plan-tab' + (i === 0 ? ' active' : '');
      btn.textContent = `${icons[i] || '📌'} ${p.name || `方案${String.fromCharCode(65 + i)}`}`;
      btn.onclick = () => switchPlan(i);
      tabs.appendChild(btn);
    });
  }

  renderPlanContent(0);
}

function renderPlanContent(idx) {
  const plan = state.currentCase.plans[idx];
  if (!plan) return;

  renderTimeline(plan);
  MapManager.renderPlan(plan);

  const allScores = state.currentCase.plans.map(p => p.scores || computePlanScores(p));
  drawRadarChart($('#radarCanvas'), allScores, idx);
  renderRadarLegend(state.currentCase.plans);

  const stats = $('#planStats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-item"><div class="stat-value">${plan.totalCost || '—'}</div><div class="stat-label">预计花费</div></div>
      <div class="stat-item"><div class="stat-value">${plan.duration || '—'}</div><div class="stat-label">总时长</div></div>
      <div class="stat-item"><div class="stat-value">${plan.count || plan.timeline.length} 站</div><div class="stat-label">活动数</div></div>`;
  }
}

function switchPlan(idx) {
  state.currentPlanIdx = idx;
  $$('.plan-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  renderPlanContent(idx);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 – Chat Functions
   ═══════════════════════════════════════════════════════════════ */

function addMessage(who, text, opts = {}) {
  const welcomeBlock = $('#welcomeBlock');
  if (welcomeBlock) welcomeBlock.style.display = 'none';
  const list = $('#messageList');
  if (!list) return { el: null, bubble: null };

  const msg = document.createElement('div');
  msg.className = `message ${who}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (opts.typing) {
    bubble.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
    msg.appendChild(bubble);
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
    return { el: msg, bubble };
  }

  bubble.textContent = text;
  msg.appendChild(bubble);
  list.appendChild(msg);
  list.scrollTop = list.scrollHeight;
  return { el: msg, bubble };
}

async function typewriterEffect(bubble, text) {
  bubble.textContent = '';
  for (let i = 0; i < text.length; i++) {
    bubble.textContent += text[i];
    const list = $('#messageList');
    if (list) list.scrollTop = list.scrollHeight;
    if (i % 3 === 0) await sleep(20);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9 – Agent Pipeline
   ═══════════════════════════════════════════════════════════════ */

const AGENT_PIPELINE_TEMPLATE = [
  { key: 'orchestrator', name: 'Orchestrator', icon: '🎯', desc: '意图解析·任务分配' },
  { key: 'context',      name: 'Context',      icon: '📋', desc: '环境感知·天气/位置/时间' },
  { key: 'dining',       name: 'Dining',       icon: '🍽', desc: '餐厅搜索·口味匹配' },
  { key: 'activity',     name: 'Activity',     icon: '🎪', desc: '活动推荐·场景筛选' },
  { key: 'synthesizer',  name: 'Synthesizer',  icon: '🧩', desc: '方案编排·路线优化' },
  { key: 'critic',       name: 'Critic',       icon: '🔍', desc: '质量校验·约束检查' },
  { key: 'executor',     name: 'Executor',     icon: '⚡', desc: '预订执行·确认座位' },
  { key: 'notifier',     name: 'Notifier',     icon: '🔔', desc: '通知推送·日程同步' },
];

function renderPipeline(agents, activeIdx) {
  const container = $('#thinkingPipeline');
  if (!container) return;
  container.innerHTML = '';

  agents.forEach((agent, idx) => {
    const node = document.createElement('div');
    let status = idx < activeIdx ? ' done' : idx === activeIdx ? ' active' : '';
    node.className = 'pipeline-node' + status;
    node.innerHTML = `<div class="pipeline-icon">${agent.icon}</div><div class="pipeline-name">${agent.name}</div>`;
    node.onclick = () => showAgentDetail(agent, idx, status.trim());

    if (idx > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'pipeline-arrow';
      arrow.textContent = '→';
      container.appendChild(arrow);
    }
    container.appendChild(node);
  });
}

function showAgentDetail(agent, idx, status) {
  const detail = $('#thinkingDetail');
  if (!detail) return;
  const statusLabel = { done: '✅ 完成', active: '⚙️ 运行中', '': '⏳ 等待中' }[status || ''] || '';
  detail.innerHTML = `<div class="thinking-card">
    <div class="thinking-card-header">${agent.icon} ${agent.name} <span style="font-size:12px;opacity:0.7;margin-left:8px">${statusLabel}</span></div>
    <div class="thinking-card-body">${agent.thinking || agent.desc || ''}</div>
  </div>`;
}

async function animatePipeline(agents) {
  const panel = $('#thinkingPanel');
  const showThinking = $('#agentThinkingCheck')?.checked !== false;
  if (showThinking && panel) panel.style.display = '';

  const steps = agents.map(a => {
    const tpl = AGENT_PIPELINE_TEMPLATE.find(t =>
      t.name === a.name || t.key === (a.name || '').toLowerCase()
    ) || {};
    return { ...tpl, ...a };
  });

  for (let i = 0; i < steps.length; i++) {
    renderPipeline(steps, i);
    showAgentDetail(steps[i], i, 'active');
    await sleep(500 + Math.random() * 400);
  }
  renderPipeline(steps, steps.length);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 – Showcase Mode (prebuilt demo)
   ═══════════════════════════════════════════════════════════════ */

async function playShowcase(caseKey) {
  if (state.isAnimating) return;
  state.isAnimating = true;
  state.mode = 'showcase';

  const caseData = DEMO_CASES[caseKey];
  if (!caseData) { state.isAnimating = false; return; }

  addMessage('user', caseData.userMessage);
  await sleep(400);

  const aiMsg = addMessage('ai', '', { typing: true });
  await sleep(800);
  await typewriterEffect(aiMsg.bubble, caseData.aiReply);
  await sleep(200);

  if (caseData.agents && caseData.agents.length > 0) {
    await animatePipeline(caseData.agents);
  }
  await sleep(300);

  addMessage('ai', `方案已生成！为你准备了${caseData.plans.length}套差异化方案，请在右侧面板查看 👉`);
  renderPlans(caseData);
  saveHistory(caseData.userMessage, caseData.plans[0].title);

  state.isAnimating = false;
}

async function loadCasesFromAPI() {
  try {
    const resp = await fetch('/api/cases');
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.cases?.length) return;
    const prompts = $('#presetPrompts');
    data.cases.forEach(c => {
      const chip = document.createElement('button');
      chip.className = 'prompt-bubble';
      chip.dataset.prompt = c.input || c.title;
      chip.dataset.caseId = c.id;
      const emojis = { family: '🎪', friends: '🎉', couple: '💑', solo: '🧘', rainy: '🌧️', culture: '🏛️' };
      chip.textContent = `${emojis[c.scene_type] || '📍'} ${c.title}`;
      chip.addEventListener('click', () => playShowcaseFromAPI(c.id));
      if (prompts) prompts.appendChild(chip);
    });
  } catch (e) { /* API not available, use local demo cases */ }
}

async function loadCaseDetail(caseId) {
  const resp = await fetch(`/api/cases/${caseId}`);
  if (!resp.ok) throw new Error('Failed to load case');
  return resp.json();
}

function convertAPICaseToLocal(apiCase) {
  const plans = (apiCase.plans || []).map((p, i) => ({
    name: p.name || p.title || `方案${String.fromCharCode(65 + i)}`,
    title: p.title || p.name || `方案${String.fromCharCode(65 + i)}`,
    subtitle: p.subtitle || p.description || '',
    scores: p.scores ? (Array.isArray(p.scores) ? p.scores : Object.values(p.scores)).map(v => parseFloat(v) / (parseFloat(v) > 1 ? 5 : 1)) : null,
    totalCost: p.total_cost ? `¥${p.total_cost}` : (p.totalCost || '—'),
    duration: p.duration || p.total_duration_hours ? `${p.total_duration_hours}h` : '—',
    count: (p.timeline || p.nodes || []).length,
    timeline: (p.timeline || p.nodes || []).map(n => ({
      time: n.time || n.time_start || n.start_time || '',
      icon: n.icon || { activity: '🎪', dining: '🍽', transport: '🚗', rest: '☕' }[n.type || n.category || n.node_type] || '📍',
      title: n.title || n.name || n.venue_name || '',
      subtitle: n.subtitle || n.description || n.venue_address || '',
      nodeType: n.type || n.node_type || n.category || 'activity',
      location: n.location || '',
      rating: n.rating || '',
      dianping_rating: n.dianping_rating || '',
      meituan_rating: n.meituan_rating || '',
      cost: n.cost || n.cost_per_person || n.price || '',
      business_area: n.business_area || '',
    })),
  }));
  return {
    userMessage: apiCase.input || apiCase.query || '',
    aiReply: apiCase.aiReply || '方案已生成！',
    plans,
    agents: apiCase.agents || [],
  };
}

async function playShowcaseFromAPI(caseId) {
  if (state.isAnimating) return;
  state.isAnimating = true;

  addMessage('user', '加载预建方案...');
  try {
    const apiCase = await loadCaseDetail(caseId);
    const local = convertAPICaseToLocal(apiCase);
    if (local.agents?.length) await animatePipeline(local.agents);
    const panel = $('#thinkingPanel');
    if (panel) panel.style.display = 'none';
    renderPlans(local);
    addMessage('ai', `已加载方案，共 ${local.plans.length} 套选择 👉`);
    saveHistory(local.userMessage || caseId, local.plans[0]?.title || '方案');
  } catch (e) {
    addMessage('ai', '加载失败，请稍后重试');
    showToast('加载失败');
  }
  state.isAnimating = false;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 – Live Mode (SSE streaming to backend)
   ═══════════════════════════════════════════════════════════════ */

async function planLive(userInput) {
  state.mode = 'live';
  addMessage('user', userInput);
  const aiMsg = addMessage('ai', '', { typing: true });

  const panel = $('#thinkingPanel');
  const showThinking = $('#agentThinkingCheck')?.checked !== false;
  if (showThinking && panel) {
    panel.style.display = '';
    const pipeEl = $('#thinkingPipeline');
    if (pipeEl) pipeEl.innerHTML = '';
    const detEl = $('#thinkingDetail');
    if (detEl) detEl.innerHTML = '';
  }

  try {
    const body = { input: userInput, city: state.city || '杭州' };
    if (state.location) body.location = `${state.location.lng},${state.location.lat}`;

    const resp = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    if (resp.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              handleSSEEvent(currentEvent, data, aiMsg);
            } catch (e) { /* skip malformed JSON */ }
          }
        }
      }
    } else {
      const data = await resp.json();
      if (data.plans) {
        if (panel) panel.style.display = 'none';
        const converted = convertAPICaseToLocal(data);
        renderPlans(converted);
        if (aiMsg.bubble) aiMsg.bubble.textContent = `已生成 ${converted.plans.length} 套方案 👉`;
        saveHistory(userInput, converted.plans[0]?.title || '方案');
      }
    }
  } catch (e) {
    console.warn('SSE failed, falling back to demo:', e);
    if (aiMsg.bubble) aiMsg.bubble.textContent = '后端未连接，使用演示数据...';
    showToast('无法连接后端，使用演示数据');
    await sleep(400);
    matchAndPlayDemo(userInput);
  }
}

const _SSE_AGENT_ICONS = {
  orchestrator: '🎯', context: '📋', dining: '🍽', activity: '🎪',
  synthesizer: '🧩', critic: '🔍', executor: '⚡', notifier: '🔔',
};

function handleSSEEvent(eventType, data, aiMsg) {
  const pipeline = $('#thinkingPipeline');
  const detail = $('#thinkingDetail');

  switch (eventType) {
    case 'agent_start': {
      const name = (data.agent || '').toLowerCase();
      const icon = _SSE_AGENT_ICONS[name] || '⚙️';
      if (pipeline) {
        if (pipeline.children.length > 0) {
          const arrow = document.createElement('div');
          arrow.className = 'pipeline-arrow';
          arrow.textContent = '→';
          pipeline.appendChild(arrow);
        }
        const node = document.createElement('div');
        node.className = 'pipeline-node active';
        node.innerHTML = `<div class="pipeline-icon">${icon}</div><div class="pipeline-name">${data.agent}</div>`;
        pipeline.appendChild(node);
      }
      if (aiMsg?.bubble) aiMsg.bubble.textContent = `${icon} ${data.agent} 启动中...`;
      break;
    }
    case 'agent_thinking':
    case 'thinking': {
      if (detail) detail.innerHTML = `<div class="thinking-card"><div class="thinking-card-body">${data.thought || data.text || '思考中...'}</div></div>`;
      if (aiMsg?.bubble) aiMsg.bubble.textContent = data.thought || data.text || '思考中...';
      break;
    }
    case 'agent_complete': {
      const nodes = pipeline?.querySelectorAll('.pipeline-node.active');
      if (nodes?.length) {
        const last = nodes[nodes.length - 1];
        last.classList.remove('active');
        last.classList.add('done');
      }
      break;
    }
    case 'plan_ready': {
      const panel = $('#thinkingPanel');
      if (panel) panel.style.display = 'none';
      if (aiMsg?.bubble) aiMsg.bubble.textContent = '方案已生成！请在右侧面板查看 👉';
      if (data.plans) {
        const converted = convertAPICaseToLocal(data);
        renderPlans(converted);
      }
      break;
    }
    case 'error': {
      const panel = $('#thinkingPanel');
      if (panel) panel.style.display = 'none';
      const msg = data.message || '处理出错';
      if (aiMsg?.bubble) aiMsg.bubble.textContent = `出了点问题：${msg}`;
      showToast(msg);
      break;
    }
    case 'done': {
      const panel = $('#thinkingPanel');
      if (panel) panel.style.display = 'none';
      break;
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 12 – Swap & Budget
   ═══════════════════════════════════════════════════════════════ */

async function swapNode(nodeIdx, currentNode) {
  if (!state.currentCase) return;
  const plan = state.currentCase.plans[state.currentPlanIdx];
  const btn = $$('.swap-btn')[nodeIdx];
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  showToast('正在搜索替代选项...');

  try {
    const resp = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node_index: nodeIdx,
        node_type: currentNode.nodeType || currentNode.type || 'activity',
        plan: { timeline: plan.timeline, city: state.city || '杭州' },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.node) {
        Object.assign(plan.timeline[nodeIdx], data.node);
        renderPlanContent(state.currentPlanIdx);
        showToast(`已替换: ${data.node.title}`);
        return;
      }
    }
  } catch (e) { /* fallback to local pool */ }

  const alts = _getSwapAlternatives(currentNode);
  const pick = alts.find(a => a.title !== currentNode.title) || alts[0];
  if (pick && pick.title !== currentNode.title) {
    Object.assign(plan.timeline[nodeIdx], pick);
    renderPlanContent(state.currentPlanIdx);
    showToast(`已替换: ${pick.title}`);
  } else {
    showToast('暂无替换选项');
  }
  if (btn) { btn.textContent = '🔄 换'; btn.disabled = false; }
}

function _getSwapAlternatives(node) {
  const pools = {
    activity: [
      { icon: '🏛', title: '浙江省博物馆', subtitle: '免费·文化探索', nodeType: 'activity', rating: '4.9', cost: '0', location: '120.145,30.254', business_area: '孤山' },
      { icon: '🌅', title: '太子湾公园', subtitle: '免费·花园散步', nodeType: 'activity', rating: '4.7', cost: '0', location: '120.142,30.235', business_area: '太子湾' },
      { icon: '⛲', title: '西湖音乐喷泉', subtitle: '夜间灯光秀', nodeType: 'activity', rating: '4.6', cost: '0', location: '120.153,30.248', business_area: '湖滨' },
      { icon: '🥾', title: '九溪烟树徒步', subtitle: '山间溪流·天然氧吧', nodeType: 'activity', rating: '4.8', cost: '0', location: '120.118,30.212', business_area: '九溪' },
    ],
    dining: [
      { icon: '🍽', title: '新白鹿餐厅', subtitle: '杭帮菜·性价比高', nodeType: 'dining', rating: '4.4', dianping_rating: '4.3', meituan_rating: '4.5', cost: '55', location: '120.168,30.277', business_area: '文化广场' },
      { icon: '🍽', title: '知味观', subtitle: '百年老字号·杭州小吃', nodeType: 'dining', rating: '4.6', dianping_rating: '4.5', cost: '70', location: '120.170,30.247', business_area: '河坊街' },
      { icon: '🍽', title: '外婆家', subtitle: '排队名店·家常菜', nodeType: 'dining', rating: '4.3', dianping_rating: '4.2', cost: '50', location: '120.171,30.260', business_area: '龙翔桥' },
      { icon: '🍽', title: '弄堂里', subtitle: '本帮菜·怀旧氛围', nodeType: 'dining', rating: '4.5', cost: '85', location: '120.165,30.255', business_area: '南山路' },
    ],
    rest: [
      { icon: '☕', title: '星巴克臻选', subtitle: '湖滨旗舰店', nodeType: 'rest', rating: '4.4', cost: '45', location: '120.168,30.252', business_area: '湖滨' },
      { icon: '☕', title: 'Seesaw Coffee', subtitle: '精品咖啡·安静', nodeType: 'rest', rating: '4.6', cost: '40', location: '120.172,30.258', business_area: '延安路' },
      { icon: '☕', title: 'M Stand', subtitle: '设计感咖啡馆·有插座', nodeType: 'rest', rating: '4.5', cost: '42', location: '120.166,30.274', business_area: '武林' },
    ],
  };
  const type = node.nodeType || node.type || 'activity';
  const pool = pools[type] || pools.activity;
  return pool.sort(() => Math.random() - 0.5);
}

async function budgetAdjust(direction) {
  if (!state.currentCase) return;
  const plan = state.currentCase.plans[state.currentPlanIdx];
  showToast(direction === 'cheaper' ? '💰 寻找更省钱方案...' : '✨ 升级体验中...');

  try {
    const resp = await fetch('/api/budget-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, plan: { timeline: plan.timeline, city: state.city || '杭州' } }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.plan) {
        plan.timeline = data.plan.timeline;
        renderPlanContent(state.currentPlanIdx);
        showToast(direction === 'cheaper' ? '已优化省钱！' : '已升级体验！');
        return;
      }
    }
  } catch (e) { /* fallback */ }

  _localBudgetAdjust(plan, direction);
  renderPlanContent(state.currentPlanIdx);
  showToast(direction === 'cheaper' ? '已优化省钱！' : '已升级体验！');
}

function _localBudgetAdjust(plan, direction) {
  const multiplier = direction === 'cheaper' ? 0.7 : 1.5;
  plan.timeline.forEach(n => {
    if (n.cost && parseFloat(n.cost) > 0) {
      n.cost = String(Math.round(parseFloat(n.cost) * multiplier));
    }
  });
  const totalNum = plan.timeline.reduce((s, n) => s + (parseFloat(n.cost) || 0), 0);
  plan.totalCost = `¥${Math.round(totalNum)}${String(plan.totalCost).includes('/人') ? '/人' : ''}`;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 13 – Execute & Share
   ═══════════════════════════════════════════════════════════════ */

async function executeAll() {
  if (!state.currentCase) return;
  const modal = $('#executeModal');
  const body = $('#executeBody');
  if (!modal || !body) return;
  modal.style.display = 'flex';

  const plan = state.currentCase.plans[state.currentPlanIdx];
  const steps = (plan.timeline || []).filter(n => (n.nodeType || n.type) !== 'transport');
  body.innerHTML = '';

  for (const [idx, step] of steps.entries()) {
    const el = document.createElement('div');
    el.className = 'exec-item';
    el.innerHTML = `
      <div class="exec-icon">${step.icon || '📌'}</div>
      <div class="exec-info">
        <div class="exec-title">${step.title}</div>
        <div class="exec-status pending">准备中...</div>
      </div>`;
    body.appendChild(el);
    await sleep(600 + Math.random() * 400);
    el.querySelector('.exec-status').textContent = '✅ 已确认';
    el.querySelector('.exec-status').className = 'exec-status done';
  }

  await sleep(400);
  const doneEl = document.createElement('div');
  doneEl.className = 'exec-done';
  doneEl.innerHTML = '🎉 全部安排就绪！享受你的周末吧！';
  body.appendChild(doneEl);

  await sleep(500);
  const shareBlock = document.createElement('div');
  shareBlock.style.cssText = 'margin-top:16px;padding:12px;background:var(--bg-secondary,#f1f5f9);border-radius:10px;font-size:13px;line-height:1.8;white-space:pre-wrap';
  shareBlock.textContent = generateShareText(plan);
  body.appendChild(shareBlock);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn primary';
  copyBtn.style.marginTop = '10px';
  copyBtn.textContent = '📋 复制发给朋友';
  copyBtn.onclick = () => {
    navigator.clipboard?.writeText(shareBlock.textContent)
      .then(() => showToast('已复制，粘贴给朋友吧！'));
  };
  body.appendChild(copyBtn);
}

function generateShareText(plan) {
  const lines = [`搞定了！周末安排：${plan.title || plan.name}`, ''];
  (plan.timeline || []).forEach(n => {
    if ((n.nodeType || n.type) === 'transport') return;
    lines.push(`${n.time || ''} ${n.icon || ''} ${n.title}${n.cost && n.cost !== '0' ? ` (¥${n.cost}/人)` : ''}`);
  });
  lines.push('', `💰 预计花费 ${plan.totalCost || '—'} · ⏱ 时长 ${plan.duration || '—'}`);
  lines.push('', '我已经帮你都约好了！👌');
  lines.push('—— 由 WePlan AI 规划');
  return lines.join('\n');
}

function openShareModal() {
  if (!state.currentCase) return;
  const modal = $('#shareModal');
  const body = $('#shareBody');
  if (!modal || !body) return;

  const plan = state.currentCase.plans[state.currentPlanIdx];
  const text = generateShareText(plan);
  body.innerHTML = `
    <div class="share-preview" style="padding:16px;background:var(--bg-secondary,#f1f5f9);border-radius:10px;font-size:13px;line-height:1.8;white-space:pre-wrap">${text}</div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="action-btn primary" id="copyShareText">📋 一键复制</button>
      <button class="action-btn" id="closeShareBtn">关闭</button>
    </div>`;
  modal.style.display = 'flex';

  body.querySelector('#copyShareText').onclick = () => {
    navigator.clipboard?.writeText(text).then(() => showToast('文案已复制！'));
  };
  body.querySelector('#closeShareBtn').onclick = () => { modal.style.display = 'none'; };
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 14 – Voice Input (Web Speech API)
   ═══════════════════════════════════════════════════════════════ */

function initVoiceInput() {
  const btn = $('#micBtn');
  if (!btn) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { btn.style.display = 'none'; return; }

  let recognition = null;
  let isListening = false;

  btn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      isListening = false;
      btn.classList.remove('listening');
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const input = $('#chatInput');
      if (input) input.value = transcript;
      if (e.results[e.results.length - 1].isFinal) sendMessage();
    };
    recognition.onend = () => { isListening = false; btn.classList.remove('listening'); };
    recognition.onerror = () => { isListening = false; btn.classList.remove('listening'); };

    recognition.start();
    isListening = true;
    btn.classList.add('listening');
    showToast('正在聆听...');
  });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 15 – History (localStorage)
   ═══════════════════════════════════════════════════════════════ */

function getHistory() {
  try { return JSON.parse(localStorage.getItem('weplan-history') || '[]'); } catch { return []; }
}

function saveHistory(query, planTitle) {
  const h = getHistory();
  h.unshift({
    query,
    title: planTitle,
    time: new Date().toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
  });
  if (h.length > 10) h.length = 10;
  localStorage.setItem('weplan-history', JSON.stringify(h));
}

function renderHistory() {
  const drawer = $('#historyDrawer');
  const list = $('#historyList');
  if (!drawer || !list) return;

  const h = getHistory();
  if (h.length === 0) {
    list.innerHTML = '<div class="history-empty" style="padding:32px;text-align:center;color:#94a3b8">暂无历史记录</div>';
  } else {
    list.innerHTML = '';
    h.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `<div class="history-query">${item.query}</div><div class="history-meta">${item.title} · ${item.time}</div>`;
      el.onclick = () => {
        drawer.style.display = 'none';
        const input = $('#chatInput');
        if (input) input.value = item.query;
        sendMessage();
      };
      list.appendChild(el);
    });
  }
  drawer.style.display = 'flex';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 16 – GPS Location
   ═══════════════════════════════════════════════════════════════ */

async function initLocation() {
  const label = $('#cityLabel');
  if (label) label.textContent = '定位中...';

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        state.location = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        MapManager.setCenter(state.location.lng, state.location.lat, 13);
        try {
          if (typeof AMap !== 'undefined' && AMap.Geocoder) {
            const geocoder = new AMap.Geocoder();
            geocoder.getAddress([state.location.lng, state.location.lat], (status, result) => {
              if (status === 'complete' && result.regeocode) {
                const addr = result.regeocode.addressComponent;
                state.city = (addr.city || addr.province || '杭州').replace(/市$/, '');
                const district = addr.district || '';
                if (label) label.textContent = district ? `${state.city}·${district}` : state.city;
              }
            });
          }
        } catch (e) {
          state.city = '杭州';
          if (label) label.textContent = '杭州';
        }
      },
      () => ipFallbackLocation(),
      { timeout: 5000, enableHighAccuracy: false }
    );
  } else {
    await ipFallbackLocation();
  }
}

async function ipFallbackLocation() {
  const label = $('#cityLabel');
  try {
    const resp = await fetch('/api/locate');
    if (resp.ok) {
      const data = await resp.json();
      state.city = (data.city || '杭州').replace(/市$/, '');
      if (label) label.textContent = state.city;
      if (data.location) {
        const [lng, lat] = data.location.split(',').map(Number);
        state.location = { lng, lat };
        MapManager.setCenter(lng, lat, 13);
      }
      return;
    }
  } catch (e) { /* fallback below */ }
  state.city = '杭州';
  if (label) label.textContent = '杭州';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 17 – Toast / Theme / City Selector
   ═══════════════════════════════════════════════════════════════ */

function showToast(msg, duration = 2200) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  state.theme = next;
  localStorage.setItem('weplan-theme', next);
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function initCitySelector() {
  const badge = $('#locationDisplay');
  if (!badge) return;
  badge.style.cursor = 'pointer';
  badge.addEventListener('click', () => {
    const city = prompt('输入城市名称：', state.city || '杭州');
    if (city?.trim()) {
      state.city = city.trim();
      const label = $('#cityLabel');
      if (label) label.textContent = state.city;
      showToast(`已切换到 ${state.city}`);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 18 – Initialization
   ═══════════════════════════════════════════════════════════════ */

function initChatInput() {
  const input = $('#chatInput');
  const sendBtn = $('#sendBtn');

  if (input) {
    if (input.tagName === 'TEXTAREA') {
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
}

function sendMessage() {
  const input = $('#chatInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text || state.isAnimating) return;
  input.value = '';
  if (input.tagName === 'TEXTAREA') input.style.height = '';

  const panel = $('#thinkingPanel');
  if (panel) panel.style.display = '';

  planLive(text);
}

function matchAndPlayDemo(input) {
  const lower = input.toLowerCase();
  if (/娃|孩子|家|亲子|宝宝|baby|小朋友/.test(lower)) return playShowcase('family-park');
  if (/朋友|聚|哥们|姐妹|同事|团建|兄弟|同学/.test(lower)) return playShowcase('friends-gathering');
  if (/女朋友|男朋友|约会|浪漫|情侣|老婆|老公/.test(lower)) return playShowcase('couple-date');
  if (/一个人|独处|安静|独自|发呆|solo|放松|散心/.test(lower)) return playShowcase('solo-relax');
  if (/雨|室内|下雨|阴天|台风/.test(lower)) return playShowcase('rainy-indoor');
  if (/北京|故宫|胡同|798|颐和园|文化/.test(lower)) return playShowcase('beijing-culture');
  playShowcase('family-park');
}

function initPresetButtons() {
  $$('.prompt-bubble').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (!prompt || state.isAnimating) return;
      matchAndPlayDemo(prompt);
    });
  });
}

function initThinkingPanel() {
  const toggle = $('#thinkingCollapseBtn');
  const body = $('#thinkingBody');
  if (toggle && body) {
    toggle.addEventListener('click', () => {
      state.thinkingExpanded = !state.thinkingExpanded;
      body.style.display = state.thinkingExpanded ? 'none' : '';
      toggle.style.transform = state.thinkingExpanded ? 'rotate(180deg)' : '';
    });
  }
}

function initActionButtons() {
  $('#executeBtn')?.addEventListener('click', executeAll);
  $('#shareBtn')?.addEventListener('click', openShareModal);
  $('#cheaperBtn')?.addEventListener('click', () => budgetAdjust('cheaper'));
  $('#premiumBtn')?.addEventListener('click', () => budgetAdjust('premium'));

  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay') || btn.closest('.history-drawer');
      if (modal) modal.style.display = 'none';
    });
  });

  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
  });

  $('#voteSubmit')?.addEventListener('click', () => {
    showToast('感谢你的反馈！');
    const modal = $('#voteModal');
    if (modal) modal.style.display = 'none';
  });

  $('#copyLink')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(window.location.href)
      .then(() => showToast('链接已复制！'));
  });
}

function initClearChat() {
  $('#clearChatBtn')?.addEventListener('click', () => {
    const list = $('#messageList');
    if (list) list.innerHTML = '';
    const welcome = $('#welcomeBlock');
    if (welcome) welcome.style.display = '';
    const planContent = $('#planContent');
    const planEmpty = $('#planEmpty');
    if (planContent) planContent.style.display = 'none';
    if (planEmpty) planEmpty.style.display = '';
    const panel = $('#thinkingPanel');
    if (panel) { panel.style.display = 'none'; }
    const pipeEl = $('#thinkingPipeline');
    if (pipeEl) pipeEl.innerHTML = '';
    const detEl = $('#thinkingDetail');
    if (detEl) detEl.innerHTML = '';
    MapManager.clear();
    state.currentCase = null;
    state.currentPlanIdx = 0;
    state.isAnimating = false;
    showToast('已清空');
  });
}

function initMobileTabs() {
  const chatPanel = $('#chatPanel');
  const planPanel = $('#planPanel');
  $$('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (target === 'chat') {
        if (chatPanel) chatPanel.style.display = '';
        if (planPanel) planPanel.style.display = 'none';
      } else {
        if (chatPanel) chatPanel.style.display = 'none';
        if (planPanel) planPanel.style.display = '';
      }
    });
  });
}

function initHistoryBtn() {
  const btn = $('#historyBtn');
  const drawer = $('#historyDrawer');
  if (btn && drawer) {
    btn.addEventListener('click', () => { renderHistory(); drawer.style.display = 'flex'; });
  }
}

function initAgentThinkingToggle() {
  const check = $('#agentThinkingCheck');
  const panel = $('#thinkingPanel');
  if (check) {
    check.addEventListener('change', () => {
      if (panel) panel.style.display = check.checked ? '' : 'none';
    });
  }
}

async function init() {
  initTheme();
  initChatInput();
  initPresetButtons();
  initVoiceInput();
  initThinkingPanel();
  initActionButtons();
  initClearChat();
  initHistoryBtn();
  initMobileTabs();
  initAgentThinkingToggle();
  initCitySelector();

  const themeBtn = $('#themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  setTimeout(() => {
    MapManager.init();
    initLocation();
    loadCasesFromAPI();
  }, 500);
}

document.addEventListener('DOMContentLoaded', init);
