"""WePlan 后端 — FastAPI 入口

核心 API：
- POST /api/plan          — 创建新方案（SSE 流）
- GET  /api/plan/{id}     — 获取方案详情
- POST /api/plan/{id}/execute — 一键执行方案
- POST /api/plan/{id}/adjust  — 动态调整方案
- GET  /api/cases         — 预建案例列表
- GET  /api/cases/{id}    — 预建案例详情
- POST /api/vote/create   — 创建投票
- POST /api/vote/cast     — 投票
- GET  /api/vote/{plan_id} — 投票结果
- POST /api/tools/*       — 工具直接调用
"""

import asyncio
import json
import logging
import traceback
import uuid
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from backend.agents.orchestrator import OrchestratorAgent
from backend.agents.context_agent import ContextAgent
from backend.agents.dining_agent import DiningAgent
from backend.agents.activity_agent import ActivityAgent
from backend.agents.synthesizer import SynthesizerAgent
from backend.agents.critic import CriticAgent
from backend.agents.executor import ExecutorAgent
from backend.agents.notifier import NotifierAgent
from backend.memory.session import session_store
from backend.consensus.voting import create_vote_session, cast_vote, get_vote_results
from backend.consensus.share_link import create_share_link, get_shared_plan
from backend.tools import amap as amap_tools
from backend.config import MAX_CRITIC_ROUNDS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("weplan.main")

app = FastAPI(
    title="WePlan API",
    description="周末闲时活动规划 Agent — 美团 AI Hackathon 2026",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────── 请求/响应模型 ──────────────────


class PlanRequest(BaseModel):
    input: str = Field(..., description="用户自然语言输入")
    session_id: Optional[str] = None
    user_id: str = "anonymous"


class AdjustRequest(BaseModel):
    feedback: str = Field(..., description="用户调整意见")


class VoteCreateRequest(BaseModel):
    plan_id: str


class VoteCastRequest(BaseModel):
    session_id: str
    voter_name: str
    plan_id: str
    vote_type: str  # approve / reject / neutral
    node_id: Optional[str] = None
    comment: Optional[str] = None


class ToolSearchRequest(BaseModel):
    keyword: str
    city: str = "杭州"
    category: str = ""


class ToolWeatherRequest(BaseModel):
    city: str = "杭州"


class ToolRouteRequest(BaseModel):
    origin: str
    destination: str
    mode: str = "driving"


# ────────────────── 方案存储 ──────────────────

_plan_store: dict[str, dict] = {}


# ────────────────── 核心流程 ──────────────────


async def _run_pipeline(raw_input: str, session_id: str):
    """主流水线：解析 → 环境 → 搜索 → 综合 → 校验 → 返回"""

    # 1. Orchestrator — 意图解析
    yield _sse("agent_start", {"agent": "orchestrator", "status": "running"})

    orchestrator = OrchestratorAgent()
    orch_result = await orchestrator.run(raw_input=raw_input)

    if not orch_result.success:
        yield _sse("agent_complete", {"agent": "orchestrator", "success": False, "error": orch_result.error})
        yield _sse("error", {"message": f"意图解析失败: {orch_result.error}"})
        return

    intent = orch_result.data
    session_store.update_session(session_id, intent=intent, state="planning")

    for t in orch_result.thinking:
        yield _sse("agent_thinking", {"agent": "orchestrator", "thought": _thought_text(t)})
    yield _sse("agent_complete", {"agent": "orchestrator", "success": True, "result": intent})

    # 2. Context + Dining + Activity — 并行执行
    yield _sse("agent_start", {"agent": "context", "status": "running"})
    yield _sse("agent_start", {"agent": "dining", "status": "running"})
    yield _sse("agent_start", {"agent": "activity", "status": "running"})

    context_agent = ContextAgent()
    dining_agent = DiningAgent()
    activity_agent = ActivityAgent()

    ctx_task = asyncio.create_task(context_agent.run(city=intent.get("city", "杭州")))
    din_task = asyncio.create_task(dining_agent.run(intent=intent, context={}))
    act_task = asyncio.create_task(activity_agent.run(intent=intent, context={}))

    ctx_result = await ctx_task
    for t in ctx_result.thinking:
        yield _sse("agent_thinking", {"agent": "context", "thought": _thought_text(t)})
    yield _sse("agent_complete", {"agent": "context", "success": ctx_result.success, "result": ctx_result.data})

    din_result = await din_task
    for t in din_result.thinking:
        yield _sse("agent_thinking", {"agent": "dining", "thought": _thought_text(t)})
    yield _sse("agent_complete", {"agent": "dining", "success": din_result.success, "result": din_result.data})

    act_result = await act_task
    for t in act_result.thinking:
        yield _sse("agent_thinking", {"agent": "activity", "thought": _thought_text(t)})
    yield _sse("agent_complete", {"agent": "activity", "success": act_result.success, "result": act_result.data})

    context_data = ctx_result.data or {}
    dining_data = din_result.data or {}
    activity_data = act_result.data or {}

    session_store.update_session(session_id, context=context_data)

    # 3. Synthesizer — 方案生成
    yield _sse("agent_start", {"agent": "synthesizer", "status": "running"})

    synthesizer = SynthesizerAgent()
    syn_result = await synthesizer.run(
        intent=intent,
        context=context_data,
        dining=dining_data,
        activity=activity_data,
    )

    for t in syn_result.thinking:
        yield _sse("agent_thinking", {"agent": "synthesizer", "thought": _thought_text(t)})
    yield _sse("agent_complete", {"agent": "synthesizer", "success": syn_result.success, "result": syn_result.data})

    if not syn_result.success:
        yield _sse("error", {"message": f"方案生成失败: {syn_result.error}"})
        return

    plans_data = syn_result.data

    # 4. Critic — 校验每个方案（循环最多 MAX_CRITIC_ROUNDS 次）
    yield _sse("agent_start", {"agent": "critic", "status": "running"})

    critic = CriticAgent()
    final_plans = plans_data.get("plans", [])

    for plan in final_plans:
        for round_idx in range(MAX_CRITIC_ROUNDS):
            critic_result = await critic.run(plan=plan, intent=intent, context=context_data)
            cr = critic_result.data or {}

            for t in critic_result.thinking:
                yield _sse("agent_thinking", {"agent": "critic", "thought": _thought_text(t)})

            if cr.get("passed", True):
                break
            else:
                yield _sse("agent_thinking", {
                    "agent": "critic",
                    "thought": f"方案 '{plan.get('title')}' 有 {len(cr.get('issues', []))} 个问题: {', '.join(cr.get('issues', [])[:3])}",
                })

    yield _sse("agent_complete", {"agent": "critic", "success": True, "result": {"message": "校验完成"}})

    # 存储方案
    for plan in final_plans:
        plan_id = plan.get("plan_id", uuid.uuid4().hex[:12])
        plan["plan_id"] = plan_id
        _plan_store[plan_id] = {
            "plan": plan,
            "intent": intent,
            "context": context_data,
            "dining": dining_data,
            "activity": activity_data,
        }

    session_store.update_session(session_id, plans=plans_data, state="plan_ready")

    # 5. 输出最终方案
    yield _sse("plan_ready", plans_data)


def _sse(event: str, data: Any) -> dict:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False, default=str)}


def _thought_text(t: dict) -> str:
    """提取 thinking 中的可读文本"""
    if "message" in t:
        return str(t["message"])
    if "content" in t:
        return str(t["content"])[:200]
    if "function" in t:
        return f"调用工具 {t['function']}({json.dumps(t.get('arguments', {}), ensure_ascii=False)[:100]})"
    return json.dumps(t, ensure_ascii=False)[:200]


# ────────────────── API 路由 ──────────────────


@app.post("/api/plan")
async def create_plan(req: PlanRequest):
    """创建新方案 — 返回 SSE 流"""
    session_id = req.session_id or session_store.create_session(req.user_id)
    session_store.add_message(session_id, "user", req.input)

    async def event_generator():
        yield _sse("session", {"session_id": session_id})
        try:
            async for event in _run_pipeline(req.input, session_id):
                yield event
        except Exception as e:
            logger.error("Pipeline error: %s\n%s", e, traceback.format_exc())
            yield _sse("error", {"message": f"处理出错: {str(e)}"})
        finally:
            yield _sse("done", {"session_id": session_id})

    return EventSourceResponse(event_generator())


@app.get("/api/plan/{plan_id}")
async def get_plan(plan_id: str):
    """获取方案详情"""
    record = _plan_store.get(plan_id)
    if not record:
        raise HTTPException(status_code=404, detail="方案不存在")
    return record


@app.post("/api/plan/{plan_id}/execute")
async def execute_plan(plan_id: str):
    """一键执行方案"""
    record = _plan_store.get(plan_id)
    if not record:
        raise HTTPException(status_code=404, detail="方案不存在")

    plan = record["plan"]
    intent = record["intent"]

    executor = ExecutorAgent()
    exec_result = await executor.run(plan=plan, intent=intent)

    if not exec_result.success:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": exec_result.error},
        )

    execution_data = exec_result.data

    # 生成通知消息
    notifier = NotifierAgent()
    notify_result = await notifier.run(plan=plan, intent=intent, execution=execution_data)

    return {
        "success": True,
        "execution": execution_data,
        "notification": notify_result.data if notify_result.success else None,
        "thinking": exec_result.thinking + (notify_result.thinking if notify_result.success else []),
    }


@app.post("/api/plan/{plan_id}/adjust")
async def adjust_plan(plan_id: str, req: AdjustRequest):
    """动态调整方案"""
    record = _plan_store.get(plan_id)
    if not record:
        raise HTTPException(status_code=404, detail="方案不存在")

    # 使用 synthesizer 重新生成（带调整意见）
    intent = record["intent"]
    intent["special_requests"] = intent.get("special_requests", []) + [req.feedback]

    synthesizer = SynthesizerAgent()
    result = await synthesizer.run(
        intent=intent,
        context=record.get("context", {}),
        dining=record.get("dining", {}),
        activity=record.get("activity", {}),
    )

    if result.success:
        new_plans = result.data.get("plans", [])
        if new_plans:
            new_plan = new_plans[0]
            new_plan_id = new_plan.get("plan_id", uuid.uuid4().hex[:12])
            new_plan["plan_id"] = new_plan_id
            _plan_store[new_plan_id] = {
                "plan": new_plan,
                "intent": intent,
                "context": record.get("context", {}),
                "dining": record.get("dining", {}),
                "activity": record.get("activity", {}),
            }
            return {"success": True, "new_plan_id": new_plan_id, "plan": new_plan}

    return JSONResponse(
        status_code=500,
        content={"success": False, "error": result.error or "调整失败"},
    )


# ────────────────── 预建案例 ──────────────────

import pathlib as _pathlib

_DATA_DIR = _pathlib.Path(__file__).resolve().parent / "data"


def _load_prebuilt_cases() -> list[dict]:
    """从 prebuilt_cases.json 加载完整预建案例；文件缺失时返回简化列表"""
    fp = _DATA_DIR / "prebuilt_cases.json"
    if fp.exists():
        try:
            return json.loads(fp.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to load prebuilt_cases.json: %s", exc)
    return [
        {"id": "case_family_weekend", "title": "周末亲子西湖一日游",
         "description": "一家三口，孩子5岁，西湖边玩一下午",
         "input": "我们一家三口，孩子5岁，周六下午想去西湖边玩，预算人均150以内",
         "tags": ["亲子", "西湖", "户外"], "scene_type": "family"},
        {"id": "case_friends_gathering", "title": "朋友聚会吃喝玩乐",
         "description": "6个朋友聚会，密室+火锅",
         "input": "6个朋友周六下午聚会，想先玩密室逃脱，然后晚上吃火锅，人均200左右",
         "tags": ["朋友", "聚会", "火锅"], "scene_type": "friends"},
        {"id": "case_couple_date", "title": "浪漫约会半日行",
         "description": "情侣约会，看展+西餐",
         "input": "和女朋友周六约会，下午看展，晚上吃西餐，帮忙订束花",
         "tags": ["情侣", "浪漫", "西餐"], "scene_type": "couple"},
    ]


_PRESET_CASES: list[dict] = []


@app.on_event("startup")
async def _load_data():
    global _PRESET_CASES
    _PRESET_CASES = _load_prebuilt_cases()
    logger.info("Loaded %d prebuilt cases", len(_PRESET_CASES))


@app.get("/api/cases")
async def list_cases():
    return {"cases": [
        {"id": c["id"], "title": c["title"],
         "subtitle": c.get("subtitle", c.get("description", "")),
         "city": c.get("city", "杭州"),
         "scene_type": c.get("scene_type", "friends"),
         "cover_emoji": c.get("cover_emoji", ""),
         "input": c.get("input", "")}
        for c in _PRESET_CASES
    ]}


@app.get("/api/cases/{case_id}")
async def get_case(case_id: str):
    for case in _PRESET_CASES:
        if case["id"] == case_id:
            return case
    raise HTTPException(status_code=404, detail="案例不存在")


# ────────────────── 投票 ──────────────────


@app.post("/api/vote/create")
async def api_create_vote(req: VoteCreateRequest):
    return create_vote_session(req.plan_id)


@app.post("/api/vote/cast")
async def api_cast_vote(req: VoteCastRequest):
    result = cast_vote(
        session_id=req.session_id,
        voter_name=req.voter_name,
        plan_id=req.plan_id,
        vote_type=req.vote_type,
        node_id=req.node_id,
        comment=req.comment,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@app.get("/api/vote/{plan_id}")
async def api_vote_results(plan_id: str):
    return get_vote_results(plan_id)


# ────────────────── 工具直接调用 ──────────────────


@app.post("/api/tools/search_poi")
async def api_search_poi(req: ToolSearchRequest):
    result = await amap_tools.search_poi(keyword=req.keyword, city=req.city, category=req.category)
    if result.success:
        return {"success": True, "data": result.data, "source": result.source, "latency_ms": result.latency_ms}
    return JSONResponse(status_code=500, content={"success": False, "error": result.error})


@app.post("/api/tools/weather")
async def api_weather(req: ToolWeatherRequest):
    result = await amap_tools.get_weather(city=req.city)
    if result.success:
        return {"success": True, "data": result.data, "source": result.source, "latency_ms": result.latency_ms}
    return JSONResponse(status_code=500, content={"success": False, "error": result.error})


@app.post("/api/tools/route")
async def api_route(req: ToolRouteRequest):
    result = await amap_tools.get_route(origin=req.origin, destination=req.destination, mode=req.mode)
    if result.success:
        return {"success": True, "data": result.data, "source": result.source, "latency_ms": result.latency_ms}
    return JSONResponse(status_code=500, content={"success": False, "error": result.error})


# ────────────────── 分享 ──────────────────


@app.post("/api/share")
async def api_create_share(plan_id: str):
    record = _plan_store.get(plan_id)
    if not record:
        raise HTTPException(status_code=404, detail="方案不存在")
    return create_share_link(record)


@app.get("/api/share/{share_id}")
async def api_get_share(share_id: str):
    data = get_shared_plan(share_id)
    if not data:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    return data


# ────────────────── 健康检查 ──────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "WePlan", "version": "1.0.0"}


# ────────────────── 启动入口 ──────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
