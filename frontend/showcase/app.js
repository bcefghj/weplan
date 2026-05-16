/* ========== WePlan Showcase — app.js ========== */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function h(tag, attrs = {}, ...children) {
  const el = document.createElementNS(
    tag === 'svg' || tag === 'rect' || tag === 'text' || tag === 'line' ||
    tag === 'path' || tag === 'circle' || tag === 'polygon' || tag === 'g' ||
    tag === 'defs' || tag === 'marker' ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml',
    tag
  );
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object')
      Object.assign(el.style, v);
    else el.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  }
  return el;
}

function hSVG(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) {
    if (typeof c === 'string') el.textContent = c;
    else if (c) el.appendChild(c);
  }
  return el;
}

/* ---------- Theme ---------- */
function initTheme() {
  const saved = localStorage.getItem('weplan-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme:dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('weplan-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = $('.theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---------- Mobile Nav ---------- */
function initMobileNav() {
  const toggle = $('.nav-mobile-toggle');
  const links = $('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
  });
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.textContent = '☰';
    })
  );
}

/* ---------- IntersectionObserver Reveal ---------- */
function initReveal() {
  const items = $$('.reveal');
  if (!items.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => obs.observe(el));
}

/* ---------- Counter Animation ---------- */
function initCounters() {
  const counters = $$('[data-count]');
  if (!counters.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCount(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => obs.observe(el));
}

function animateCount(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1600;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * ease) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------- Architecture SVG ---------- */
function initArchDiagram() {
  const container = $('#arch-svg');
  if (!container) return;

  const W = 1100, H = 380;
  const svg = hSVG('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: '100%' });

  const primary = '#FF6B35';
  const accent = '#2B6CB0';
  const green = '#48BB78';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const cardFill = isDark ? '#1A1A1A' : '#FFFFFF';
  const cardStroke = isDark ? '#2D3748' : '#E2E8F0';
  const textFill = isDark ? '#E2E8F0' : '#1A202C';
  const mutedFill = isDark ? '#A0AEC0' : '#4A5568';

  const defs = hSVG('defs', {},
    hSVG('marker', { id: 'arrowhead', markerWidth: '10', markerHeight: '7', refX: '10', refY: '3.5', orient: 'auto' },
      hSVG('polygon', { points: '0 0, 10 3.5, 0 7', fill: primary })
    )
  );
  svg.appendChild(defs);

  const agents = [
    { id: 'user',    label: '用户输入',     icon: '💬', x: 30,  y: 155, w: 100, h: 70, color: mutedFill },
    { id: 'orch',    label: 'Orchestrator', icon: '🎯', x: 180, y: 155, w: 120, h: 70, color: primary },
    { id: 'context', label: 'Context',      icon: '📍', x: 360, y: 40,  w: 110, h: 65, color: accent },
    { id: 'dining',  label: 'Dining',       icon: '🍜', x: 360, y: 155, w: 110, h: 65, color: accent },
    { id: 'activity',label: 'Activity',     icon: '🎢', x: 360, y: 270, w: 110, h: 65, color: accent },
    { id: 'synth',   label: 'Synthesizer',  icon: '🧩', x: 530, y: 155, w: 120, h: 70, color: green },
    { id: 'critic',  label: 'Critic',       icon: '🔍', x: 710, y: 155, w: 110, h: 70, color: '#E53E3E' },
    { id: 'exec',    label: 'Executor',     icon: '⚡', x: 880, y: 115, w: 110, h: 65, color: primary },
    { id: 'notify',  label: 'Notifier',     icon: '🔔', x: 880, y: 220, w: 110, h: 65, color: green },
  ];

  const arrows = [
    ['user','orch'],['orch','context'],['orch','dining'],['orch','activity'],
    ['context','synth'],['dining','synth'],['activity','synth'],
    ['synth','critic'],['critic','exec'],['critic','notify'],
  ];

  function getCenter(a) { return { x: a.x + a.w / 2, y: a.y + a.h / 2 }; }

  arrows.forEach(([fromId, toId]) => {
    const from = agents.find(a => a.id === fromId);
    const to = agents.find(a => a.id === toId);
    const fc = getCenter(from), tc = getCenter(to);
    const line = hSVG('line', {
      x1: String(fc.x), y1: String(fc.y),
      x2: String(tc.x), y2: String(tc.y),
      stroke: primary, 'stroke-width': '2', 'stroke-dasharray': '6,4',
      'marker-end': 'url(#arrowhead)', opacity: '0.6',
    });
    svg.appendChild(line);
  });

  const criticLoopPath = hSVG('path', {
    d: `M ${710 + 55} ${155 + 70 + 5} Q ${710 + 55} ${155 + 110} ${530 + 60} ${155 + 70 + 5}`,
    stroke: '#E53E3E', 'stroke-width': '2', fill: 'none',
    'stroke-dasharray': '5,4', 'marker-end': 'url(#arrowhead)', opacity: '0.5'
  });
  svg.appendChild(criticLoopPath);
  const loopLabel = hSVG('text', {
    x: String(630), y: String(155 + 100), fill: '#E53E3E',
    'font-size': '11', 'font-weight': '600', 'text-anchor': 'middle', 'font-family': 'Inter,sans-serif'
  }, '循环校验');
  svg.appendChild(loopLabel);

  agents.forEach((a, i) => {
    const g = hSVG('g', {
      transform: `translate(${a.x},${a.y})`,
      style: `opacity:0;animation:archFadeIn .5s ease ${i * 0.12}s forwards`
    });
    g.appendChild(hSVG('rect', {
      x: '0', y: '0', width: String(a.w), height: String(a.h),
      rx: '14', ry: '14', fill: cardFill, stroke: a.color, 'stroke-width': '2'
    }));
    g.appendChild(hSVG('text', {
      x: String(a.w / 2), y: String(a.h / 2 - 6),
      'text-anchor': 'middle', 'font-size': '18', 'font-family': 'Inter,sans-serif'
    }, a.icon));
    g.appendChild(hSVG('text', {
      x: String(a.w / 2), y: String(a.h / 2 + 16),
      'text-anchor': 'middle', fill: textFill,
      'font-size': '12', 'font-weight': '600', 'font-family': 'Inter,sans-serif'
    }, a.label));
    svg.appendChild(g);
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = '@keyframes archFadeIn{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(styleEl);

  container.appendChild(svg);
}

/* ---------- Thinking Panel Typewriter ---------- */
function initThinking() {
  const panel = $('#thinking-panel');
  if (!panel) return;

  const lines = [
    { agent: 'Orchestrator', action: '解析意图', result: '场景=家庭周末, 城市=杭州, 人群=带娃' },
    { agent: 'Orchestrator', action: '分配任务', result: '→ Context + Dining + Activity 并行启动' },
    { agent: 'Context Agent', action: '获取上下文', result: '天气=晴 28°C, 位置=西湖区, 时间=周六下午' },
    { agent: 'Dining Agent', action: '搜索餐厅', result: '高德API → 筛选亲子友好 → Top 5 候选' },
    { agent: 'Dining Agent', action: '排序', result: '绿茶(4.8⭐ 800m) > 外婆家(4.7⭐ 1.2km) > ...' },
    { agent: 'Activity Agent', action: '搜索活动', result: '西溪湿地(家庭票¥120) + 浙江科技馆(免费)' },
    { agent: 'Synthesizer', action: '编排时间线', result: '14:00出发 → 14:30科技馆 → 17:00绿茶 → 19:00返程' },
    { agent: 'Critic Agent', action: '校验方案', result: '✓营业时间 ✓交通≤30min ✓年龄适配 ✓预算OK' },
    { agent: 'Critic Agent', action: '最终结论', result: '✅ 方案通过，总评分 92/100' },
  ];

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        typewriterPlay(panel, lines);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.3 });
  obs.observe(panel);
}

function typewriterPlay(panel, lines) {
  panel.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'thinking-line';
    div.innerHTML = `<span class="thinking-agent">[${line.agent}]</span> <span class="thinking-action">${line.action}</span> <span class="thinking-dim">→</span> <span class="thinking-result">${line.result}</span>`;
    panel.appendChild(div);
    setTimeout(() => div.classList.add('visible'), 300 + i * 400);
  });
}

/* ---------- Critic Loop Animation ---------- */
function initCriticLoop() {
  const steps = $$('.critic-loop-step');
  if (!steps.length) return;
  let idx = 0;
  const container = steps[0]?.parentElement;
  if (!container) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        runLoop();
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(container);

  function runLoop() {
    setInterval(() => {
      steps.forEach(s => s.classList.remove('active'));
      steps[idx % steps.length].classList.add('active');
      idx++;
    }, 1000);
  }
}

/* ---------- Vote Bar Animation ---------- */
function initVoteBars() {
  const bars = $$('.vote-bar');
  if (!bars.length) return;
  const targets = [65, 25, 10];
  const container = bars[0]?.closest('.vote-mock');
  if (!container) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        bars.forEach((b, i) => {
          setTimeout(() => { b.style.width = (targets[i] || 0) + '%'; }, 200 + i * 200);
        });
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  obs.observe(container);
}

/* ---------- Smooth Scroll ---------- */
function initSmoothScroll() {
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------- Nav Active State ---------- */
function initNavActive() {
  const sections = $$('section[id]');
  const links = $$('.nav-links a[href^="#"]');
  if (!sections.length || !links.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.style.color = '');
        const active = links.find(l => l.getAttribute('href') === '#' + e.target.id);
        if (active) active.style.color = 'var(--primary)';
      }
    });
  }, { threshold: 0.2, rootMargin: '-60px 0px -40% 0px' });
  sections.forEach(s => obs.observe(s));
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initReveal();
  initCounters();
  initArchDiagram();
  initThinking();
  initCriticLoop();
  initVoteBars();
  initSmoothScroll();
  initNavActive();

  const themeBtn = $('.theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});
