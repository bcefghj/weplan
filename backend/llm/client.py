"""MiniMax M2.7 客户端 — 基于 openai 库的 AsyncOpenAI 封装"""

import json
import logging
from typing import Any, AsyncGenerator, Callable, Awaitable, Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageToolCall

from backend.config import MINIMAX_API_KEY, MINIMAX_BASE_URL, MINIMAX_MODEL

logger = logging.getLogger("weplan.llm")

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=MINIMAX_API_KEY,
            base_url=MINIMAX_BASE_URL,
        )
    return _client


async def chat(
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    stream: bool = False,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> Any:
    """基础对话，返回 message 或异步生成器（stream=True）"""

    kwargs: dict[str, Any] = dict(
        model=MINIMAX_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    client = get_client()

    if stream:
        return await _stream_chat(client, kwargs)

    resp = await client.chat.completions.create(**kwargs)
    return resp.choices[0].message


async def _stream_chat(client: AsyncOpenAI, kwargs: dict) -> AsyncGenerator[str, None]:
    """流式输出，逐 token 返回文本"""
    kwargs["stream"] = True
    response = await client.chat.completions.create(**kwargs)
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


ToolExecutor = Callable[[str, dict], Awaitable[str]]


async def chat_with_tools(
    messages: list[dict],
    tools: list[dict],
    tool_executor: ToolExecutor,
    max_rounds: int = 6,
    temperature: float = 0.7,
    thinking: Optional[list[dict]] = None,
) -> str:
    """带工具调用的完整循环：LLM ↔ 工具 直到返回文本"""

    msgs = list(messages)
    if thinking is None:
        thinking = []

    for round_idx in range(max_rounds):
        resp = await chat(msgs, tools=tools, temperature=temperature)

        # 如果模型直接返回文本
        if resp.content and not resp.tool_calls:
            thinking.append({"round": round_idx, "type": "final_answer", "content": resp.content})
            return resp.content

        # 处理 tool calls
        if resp.tool_calls:
            msgs.append(_message_from_assistant(resp))

            for tc in resp.tool_calls:
                fn_name = tc.function.name
                fn_args = _safe_parse_args(tc.function.arguments)
                thinking.append({
                    "round": round_idx,
                    "type": "tool_call",
                    "function": fn_name,
                    "arguments": fn_args,
                })

                try:
                    result = await tool_executor(fn_name, fn_args)
                except Exception as e:
                    result = json.dumps({"error": str(e)}, ensure_ascii=False)

                thinking.append({
                    "round": round_idx,
                    "type": "tool_result",
                    "function": fn_name,
                    "result": result[:2000],
                })

                msgs.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
        else:
            # 既没有 content 也没有 tool_calls
            return resp.content or ""

    return msgs[-1].get("content", "") if isinstance(msgs[-1], dict) else ""


def _message_from_assistant(msg) -> dict:
    """将 openai message 对象转为 dict 用于追加到消息列表"""
    d: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
    if msg.tool_calls:
        d["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
    return d


def _safe_parse_args(raw: str) -> dict:
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"raw": raw}
