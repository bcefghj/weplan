"""Notification Agent — 生成自然语言分享消息"""

import json
from typing import Any

from backend.agents.base import BaseAgent
from backend.llm.client import chat_with_tools
from backend.llm.prompts import NOTIFIER_PROMPT, GENERATE_SHARE_MESSAGE_TOOL


class NotifierAgent(BaseAgent):
    def __init__(self):
        super().__init__("notifier")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        plan: dict = kwargs.get("plan", {})
        intent: dict = kwargs.get("intent", {})
        execution: dict = kwargs.get("execution", {})

        thinking.append({"step": "start", "message": "生成分享消息"})

        # 构建方案摘要
        summary = _build_plan_summary(plan, intent, execution)

        # 存放消息
        share_msg = {"message": ""}

        async def tool_executor(fn_name: str, fn_args: dict) -> str:
            if fn_name == "generate_share_message":
                share_msg["message"] = fn_args.get("message", "")
                return json.dumps({"status": "ok"}, ensure_ascii=False)
            return json.dumps({"error": f"未知工具: {fn_name}"}, ensure_ascii=False)

        messages = [
            {"role": "system", "content": NOTIFIER_PROMPT},
            {"role": "user", "content": f"请根据以下方案信息生成分享消息：\n\n{summary}"},
        ]

        result_text = await chat_with_tools(
            messages=messages,
            tools=[GENERATE_SHARE_MESSAGE_TOOL],
            tool_executor=tool_executor,
            thinking=thinking,
        )

        # 优先用工具输出的消息，否则用文本回复
        message = share_msg["message"] or result_text

        thinking.append({"step": "done", "message_length": len(message)})

        return {
            "share_message": message,
            "plan_title": plan.get("title", ""),
        }


def _build_plan_summary(plan: dict, intent: dict, execution: dict) -> str:
    """构建方案摘要供 LLM 生成分享消息"""
    parts = [
        f"方案名称：{plan.get('title', '')}",
        f"场景：{intent.get('scene_type', '')}，{intent.get('group_size', 2)}人",
        f"时间线：",
    ]

    for node in plan.get("nodes", []):
        line = f"  {node.get('time_start', '')}~{node.get('time_end', '')} {node.get('title', '')} @ {node.get('venue_name', '')}"
        if node.get("cost_per_person", 0) > 0:
            line += f"（人均¥{node['cost_per_person']:.0f}）"
        parts.append(line)

    # 执行结果
    actions = execution.get("actions", [])
    if actions:
        parts.append("\n已完成的操作：")
        for a in actions:
            status = "✅" if a.get("success") else "❌"
            parts.append(f"  {status} {a.get('message', '')}")

    total_cost = plan.get("total_cost_per_person", 0)
    if total_cost > 0:
        parts.append(f"\n预估人均花费：¥{total_cost:.0f}")

    return "\n".join(parts)
