"""Orchestrator Agent — 解析自然语言为结构化意图"""

import json
from typing import Any

from backend.agents.base import BaseAgent
from backend.llm.client import chat_with_tools
from backend.llm.prompts import ORCHESTRATOR_PROMPT, PARSE_INTENT_TOOL
from backend.models.intent import UserIntent, SceneType
from backend.config import DEFAULT_CITY


class OrchestratorAgent(BaseAgent):
    def __init__(self):
        super().__init__("orchestrator")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        raw_input: str = kwargs.get("raw_input", "")
        thinking.append({"step": "start", "message": f"开始解析用户输入: {raw_input}"})

        # 保存解析结果的容器
        parsed_data: dict[str, Any] = {}

        async def tool_executor(fn_name: str, fn_args: dict) -> str:
            if fn_name == "parse_intent":
                parsed_data.update(fn_args)
                thinking.append({"step": "parsed", "data": fn_args})
                return json.dumps({"status": "ok", "message": "意图已解析"}, ensure_ascii=False)
            return json.dumps({"error": f"未知工具: {fn_name}"}, ensure_ascii=False)

        messages = [
            {"role": "system", "content": ORCHESTRATOR_PROMPT},
            {"role": "user", "content": raw_input},
        ]

        await chat_with_tools(
            messages=messages,
            tools=[PARSE_INTENT_TOOL],
            tool_executor=tool_executor,
            thinking=thinking,
        )

        # 将解析结果构造为 UserIntent
        if not parsed_data:
            thinking.append({"step": "fallback", "message": "LLM 未调用工具，使用默认值"})
            parsed_data = {"scene_type": "friends", "city": DEFAULT_CITY, "group_size": 2}

        # 确保 scene_type 有效
        scene_type = parsed_data.get("scene_type", "friends")
        if scene_type not in [e.value for e in SceneType]:
            scene_type = "friends"

        intent = UserIntent(
            scene_type=SceneType(scene_type),
            city=parsed_data.get("city", DEFAULT_CITY),
            group_size=parsed_data.get("group_size", 2),
            duration_hours=parsed_data.get("duration_hours", 4.0),
            budget_per_person=parsed_data.get("budget_per_person"),
            child_age=parsed_data.get("child_age"),
            dietary_requirements=parsed_data.get("dietary_requirements", []),
            interests=parsed_data.get("interests", []),
            start_time=parsed_data.get("start_time", "14:00"),
            special_requests=parsed_data.get("special_requests", []),
            location=parsed_data.get("location"),
            raw_input=raw_input,
        )

        thinking.append({"step": "done", "intent": intent.model_dump()})
        return intent.model_dump()
