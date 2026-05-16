"""Dining Agent — 餐厅搜索与推荐"""

import json
from typing import Any

from backend.agents.base import BaseAgent
from backend.llm.client import chat_with_tools
from backend.llm.prompts import DINING_PROMPT, SEARCH_POI_TOOL, SEARCH_NEARBY_TOOL
from backend.tools.amap import search_poi, search_nearby
from backend.config import DEFAULT_CITY, DEFAULT_LOCATION


class DiningAgent(BaseAgent):
    def __init__(self):
        super().__init__("dining")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        intent: dict = kwargs.get("intent", {})
        context: dict = kwargs.get("context", {})

        city = intent.get("city", DEFAULT_CITY)
        scene_type = intent.get("scene_type", "friends")
        group_size = intent.get("group_size", 2)
        budget = intent.get("budget_per_person")
        dietary = intent.get("dietary_requirements", [])
        child_age = intent.get("child_age")
        location = intent.get("location") or DEFAULT_LOCATION.get(city, "")

        thinking.append({"step": "start", "message": f"搜索 {city} 餐厅，场景={scene_type}, 人数={group_size}"})

        # 构建搜索关键词
        keywords = _build_keywords(scene_type, dietary, child_age, budget)
        all_restaurants: list[dict] = []

        # 搜索多个关键词
        for kw in keywords:
            result = await search_poi(keyword=kw, city=city)
            if result.success and result.data:
                thinking.append({"step": "search", "keyword": kw, "count": len(result.data), "source": result.source})
                all_restaurants.extend(result.data)
            else:
                thinking.append({"step": "search_fail", "keyword": kw, "error": result.error})

        # 去重
        seen = set()
        unique = []
        for r in all_restaurants:
            name = r.get("name", "")
            if name and name not in seen:
                seen.add(name)
                unique.append(r)

        # 让 LLM 筛选排序
        if unique:
            ranked = await _rank_restaurants(unique, intent, context, thinking)
        else:
            ranked = unique

        top5 = ranked[:5]
        thinking.append({"step": "done", "count": len(top5)})

        return {
            "restaurants": top5,
            "total_found": len(unique),
            "search_keywords": keywords,
        }


def _build_keywords(scene_type: str, dietary: list, child_age: int | None, budget: int | None) -> list[str]:
    """根据场景构建搜索关键词"""
    keywords = ["餐厅"]

    if scene_type == "family":
        keywords.append("亲子餐厅")
        if child_age and child_age <= 6:
            keywords.append("儿童餐")
    elif scene_type == "couple":
        keywords.append("浪漫餐厅")
        keywords.append("西餐厅")
    elif scene_type == "friends":
        keywords.append("聚餐")
        keywords.append("火锅")

    if "素食" in dietary:
        keywords.append("素食餐厅")
    if "清真" in dietary:
        keywords.append("清真餐厅")

    if budget and budget <= 50:
        keywords.append("小吃")
    elif budget and budget >= 200:
        keywords.append("高档餐厅")

    return keywords[:4]  # 最多搜 4 个关键词


async def _rank_restaurants(restaurants: list[dict], intent: dict, context: dict, thinking: list) -> list[dict]:
    """使用 LLM 对餐厅进行排序推荐"""
    restaurant_text = json.dumps(restaurants[:15], ensure_ascii=False, indent=2)
    intent_text = json.dumps(intent, ensure_ascii=False)

    messages = [
        {"role": "system", "content": DINING_PROMPT},
        {"role": "user", "content": f"""以下是搜索到的餐厅列表：
{restaurant_text}

用户需求：{intent_text}
天气：{context.get('weather', '晴')}

请从中选出最合适的 5 家餐厅，按推荐度排序。
直接返回 JSON 数组，每个元素包含 name、address、location、tel、recommendation_reason 字段。"""},
    ]

    try:
        from backend.llm.client import chat
        resp = await chat(messages, temperature=0.5)
        content = resp.content or ""

        # 尝试解析 JSON
        content = content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1])

        ranked = json.loads(content)
        if isinstance(ranked, list):
            thinking.append({"step": "rank", "message": "LLM 排序完成"})
            return ranked
    except Exception as e:
        thinking.append({"step": "rank_error", "error": str(e)})

    return restaurants
