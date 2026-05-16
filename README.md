<p align="center">
  <img src="https://img.shields.io/badge/WePlan-AI%20Weekend%20Planner-FF6B35?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4eiIvPjxwYXRoIGQ9Ik0xMi41IDdIMTF2Nmw1LjI1IDMuMTUuNzUtMS4yMy00LjUtMi42N1Y3eiIvPjwvc3ZnPg==&logoColor=white" alt="WePlan"/>
</p>

<h1 align="center">WePlan — AI 周末生活规划师</h1>

<p align="center">
  <strong>一句话输入，AI 自动规划吃喝玩乐完整方案，群体投票达成共识，一键预约全搞定</strong>
</p>

<p align="center">
  <a href="http://121.41.74.45/">项目展示</a> ·
  <a href="http://121.41.74.45/demo">在线 Demo</a> ·
  <a href="http://121.41.74.45/weplan_report.pdf">技术报告 PDF</a> ·
  <a href="http://121.41.74.45/design_doc.pdf">设计文档</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/MiniMax-M2.7-FF4081?style=flat-square" />
  <img src="https://img.shields.io/badge/AMap-API-1AAD19?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
</p>

---

## 参赛信息

| 项目 | 信息 |
|------|------|
| 赛事 | 美团 AI Hackathon 2026 |
| 赛道 | 命题赛道 · 赛题06：本地探索——周末闲时活动规划 |
| 参赛者 | 戴尚好 |
| 学校 | 中国科学技术大学 |
| 团队名称 | bcefghj |
| 邮箱 | bcefghj@163.com |
| 个人主页 | [bcefghj.github.io](https://bcefghj.github.io) |

---

## 项目亮点

### 不是搜索推荐，是「帮你把事情做完」

WePlan 接受一句自然语言输入（如"今天下午带老婆孩子出去玩"），通过 8 个 AI Agent 协作，在 10 秒内生成 2-3 个完整的吃喝玩乐方案，用户确认后一键完成预约、购票、叫车等全部动作。

### 三大核心差异化

| 差异化 | 说明 |
|--------|------|
| **全链路闭环** | 从意图理解 → 数据采集 → 方案生成 → 校验 → 执行 → 通知，一气呵成 |
| **群体共识投票** | 方案分享给家人/朋友，4级投票(Love/OK/Concerns/No)达成共识 |
| **透明推理** | Agent Thinking 可视化面板，每一步推理过程全透明 |

### 新特性（v2.0）

| 特性 | 说明 |
|------|------|
| **地图路线可视化** | 高德 JS API 2.0 嵌入，Marker + Polyline 展示完整路线，点击节点地图联动 |
| **多平台评分对比** | 高德 + 大众点评 + 美团三平台评分同时展示，精选推荐徽章 |
| **Surgical Swap** | 不满意某个节点？"换一个"按钮实时调用高德 API 替换单个节点 |
| **Budget Adjust** | "更省钱/更高级"一键级联调整全方案预算，雷达图同步更新 |
| **微信风格分享** | 生成"搞定了，下午2点出发，先去…"的自然语言文案，一键复制到微信 |

---

## 系统架构

```
用户输入: "今天下午带老婆孩子出去玩几小时，孩子5岁，老婆在减肥"
     │
     ▼
[Orchestrator Agent] — 意图解析 + 任务分发
     │ (并行调度)
     ├──► [Context Agent]   — 天气 + 时间 + 位置（高德API）
     ├──► [Dining Agent]    — 餐厅搜索 + 儿童友好 + 低卡筛选
     └──► [Activity Agent]  — 活动搜索 + 年龄适配 + 门票查询
              │ (结果汇总)
              ▼
     [Plan Synthesizer] — 生成 2-3 个备选方案
              │ (校验)
              ▼
     [Critic Agent] ← 确定性规则校验（非 LLM）
              │         最多循环 3 次
       ┌──────┴──────┐
    通过│          不通过│→ 反馈修改
       ▼
     [Execution Agent] — 预约/购票/叫车（Mock）
              │
              ▼
     [Notification Agent] — "搞定了，2点出发..."
```

### 架构理论基础

- **Claude Code 论文** (arXiv:2604.14228)：98.4% 确定性基础设施 + 1.6% AI 决策逻辑
- **Harness Engineering**：每个工具都有 timeout / retry / fallback，确保 Demo 永不崩溃
- **无 LangChain**：从零构建轻量多 Agent 框架，完全可控

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| **AI** | MiniMax M2.7 | OpenAI 兼容 API，100 TPS 极速推理，204K 上下文，Function Calling |
| **数据** | 高德地图 API | 真实 POI 搜索 + 路线规划 + 天气查询 |
| **后端** | Python + FastAPI | 异步处理，SSE 流式输出，ToolHarness 可靠性层 |
| **前端** | HTML + CSS + JS | 纯原生，无框架依赖，深色/浅色双主题 |
| **部署** | 阿里云 ECS + Nginx | Ubuntu 22.04, 2vCPU, 4GiB |

---

## 在线体验

| 入口 | URL | 说明 |
|------|-----|------|
| 项目展示 | http://121.41.74.45/ | 产品介绍，14章节全动画 |
| Demo | http://121.41.74.45/demo | 在线体验，支持预建案例和自定义输入 |
| 群体投票 | http://121.41.74.45/vote?id={plan_id} | 家人/朋友投票页面 |
| 技术报告 | http://121.41.74.45/weplan_report.pdf | 100页完整技术文档 |
| 设计文档 | http://121.41.74.45/design_doc.pdf | 2页设计文档（赛题要求） |
| API | http://121.41.74.45/api/cases | 预建案例 JSON |

---

## 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/bcefghj/weplan.git
cd weplan

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API keys

# 启动后端
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 访问 Demo
open http://localhost:8000/demo
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `MINIMAX_API_KEY` | MiniMax M2.7 API Key |
| `AMAP_API_KEY` | 高德地图 Web Service API Key |
| `DEFAULT_CITY` | 默认城市（杭州/北京） |

---

## 项目结构

```
weplan/
├── backend/
│   ├── main.py                  # FastAPI 入口 + API 路由
│   ├── config.py                # 配置管理
│   ├── llm/
│   │   ├── client.py            # MiniMax M2.7 客户端
│   │   └── prompts.py           # Agent 系统提示词
│   ├── agents/
│   │   ├── base.py              # Agent 基类 + AgentResult
│   │   ├── orchestrator.py      # 意图解析 Agent
│   │   ├── context_agent.py     # 环境信息 Agent
│   │   ├── dining_agent.py      # 餐厅推荐 Agent
│   │   ├── activity_agent.py    # 活动推荐 Agent
│   │   ├── synthesizer.py       # 方案整合 Agent
│   │   ├── critic.py            # 确定性校验 Agent
│   │   ├── executor.py          # 执行 Agent
│   │   └── notifier.py          # 通知 Agent
│   ├── tools/
│   │   ├── harness.py           # ToolHarness (timeout/retry/fallback)
│   │   ├── amap.py              # 高德地图 API
│   │   ├── mock_booking.py      # Mock 餐厅预约
│   │   ├── mock_ordering.py     # Mock 门票购买
│   │   ├── mock_taxi.py         # Mock 打车
│   │   └── mock_delivery.py     # Mock 配送
│   ├── data/
│   │   ├── venues_hangzhou.json # 杭州 100+ POI 数据
│   │   ├── venues_beijing.json  # 北京 100+ POI 数据
│   │   └── prebuilt_cases.json  # 6 个预建案例
│   ├── memory/                  # 会话 + 用户画像
│   ├── consensus/               # 群体投票机制
│   └── models/                  # Pydantic 数据模型
├── frontend/
│   ├── demo/                    # Demo 交互页面
│   ├── showcase/                # 项目展示页面
│   └── vote/                    # 群体投票页面
├── docs/
│   ├── weplan_report.tex        # 100页 LaTeX 技术报告
│   └── design_2page.tex         # 2页设计文档
├── deploy/
│   ├── nginx.conf               # Nginx 配置
│   ├── deploy.sh                # 一键部署脚本
│   └── systemd/                 # systemd 服务文件
├── requirements.txt
├── .env.example
└── README.md
```

---

## 预建场景

| 场景 | 城市 | 人群 | 天气 | 特点 |
|------|------|------|------|------|
| 家庭温馨半日游 | 杭州 | 家庭(5岁娃+减肥妈妈) | 晴 | 亲子乐园+轻食+西湖 |
| 朋友周末聚会 | 杭州 | 朋友(4人,2男2女) | 晴 | 良渚+citywalk+火锅 |
| 雨天室内方案 | 杭州 | 家庭 | 雨 | 海洋馆+商场+简餐 |
| 亲子科技探索 | 北京 | 家庭 | 晴 | 奥森+科技馆+有机餐 |
| 文艺青年之旅 | 北京 | 朋友 | 晴 | 798+三里屯+创意料理 |
| 动态调整 | 杭州 | 家庭 | 晴 | 多轮对话动态修改方案 |

---

## API 文档

### 创建方案（SSE 流式）

```
POST /api/plan
Content-Type: application/json

{
  "input": "今天下午带老婆孩子出去玩，孩子5岁，老婆在减肥",
  "city": "杭州",
  "mode": "live"
}
```

SSE 事件流：

```
event: agent_start
data: {"agent": "orchestrator", "status": "running"}

event: agent_thinking
data: {"agent": "orchestrator", "thought": "解析到家庭场景..."}

event: agent_complete
data: {"agent": "orchestrator", "result": {...}}

event: plan_ready
data: {"plans": [...], "share_message": "搞定了，2点出发..."}
```

### 获取预建案例

```
GET /api/cases
GET /api/cases/{case_id}
```

### 群体投票

```
POST /api/vote/create   # 创建投票会话
POST /api/vote/cast     # 投票
GET  /api/vote/{plan_id} # 获取投票结果
```

### Surgical Swap（单点替换）

```
POST /api/swap
Content-Type: application/json

{
  "node_index": 2,
  "node_type": "dining",
  "plan": { ... }
}
```

### Budget Adjust（预算调整）

```
POST /api/budget-adjust
Content-Type: application/json

{
  "direction": "cheaper",  // "cheaper" | "premium"
  "plan": { ... }
}
```

---

## 评审维度对标

| 维度 | WePlan 的表现 |
|------|--------------|
| **创新性** | 8-Agent 协作 + Critic 循环 + 群体投票 + Agent Thinking 可视化 + Surgical Swap + Budget Adjust |
| **完整性** | 全链路闭环 + 100页文档 + 在线 Demo + GitHub + 地图可视化 + 多平台评分 |
| **应用效果** | 真实高德 API + 高德地图 JS 2.0 + MiniMax M2.7 实时推理 + 流式输出 + 6大场景 |
| **商业价值** | 与美团小团 AI 管家高度契合，直接对接美团服务生态 |

---

## 致谢

- [MiniMax](https://www.minimax.io/) — M2.7 大模型 API
- [高德开放平台](https://lbs.amap.com/) — POI 搜索、路线规划、天气查询
- [Claude Code 论文](https://arxiv.org/abs/2604.14228) — Harness Engineering 架构理念
- 美团 AI Hackathon 2026 组委会

---

## License

MIT License

Copyright (c) 2026 戴尚好 (bcefghj)
