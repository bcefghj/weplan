"""Activity Agent — 活动场所搜索与推荐"""

import json
from typing import Any

from backend.agents.base import BaseAgent
from backend.llm.client import chat_with_tools
from backend.llm.prompts import ACTIVITY_PROMPT, SEARCH_POI_TOOL
from backend.tools.amap import search_poi
from backend.config import DEFAULT_CITY, DEFAULT_LOCATION


class ActivityAgent(BaseAgent):
    def __init__(self):
        super().__init__("activity")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        intent: dict = kwargs.get("intent", {})
        context: dict = kwargs.get("context", {})

        city = intent.get("city", DEFAULT_CITY)
        scene_type = intent.get("scene_type", "friends")
        interests = intent.get("interests", [])
        child_age = intent.get("child_age")
        weather = context.get("weather", "晴")
        outdoor_rec = context.get("outdoor_recommendation", "")

        thinking.append({"step": "start", "message": f"搜索 {city} 活动，场景={scene_type}"})

        # 构建搜索关键词
        keywords = _build_activity_keywords(scene_type, interests, child_age, weather)
        all_activities: list[dict] = []

        for kw in keywords:
            result = await search_poi(keyword=kw, city=city)
            if result.success and result.data:
                thinking.append({"step": "search", "keyword": kw, "count": len(result.data), "source": result.source})
                all_activities.extend(result.data)
            else:
                thinking.append({"step": "search_fail", "keyword": kw, "error": result.error})

        # 去重
        seen = set()
        unique = []
        for a in all_activities:
            name = a.get("name", "")
            if name and name not in seen:
                seen.add(name)
                unique.append(a)

        # LLM 排序
        if unique:
            ranked = await _rank_activities(unique, intent, context, thinking)
        else:
            ranked = unique

        top5 = ranked[:5]
        thinking.append({"step": "done", "count": len(top5)})

        return {
            "activities": top5,
            "total_found": len(unique),
            "search_keywords": keywords,
        }


def _build_activity_keywords(
    scene_type: str,
    interests: list[str],
    child_age: int | None,
    weather: str,
) -> list[str]:
    """根据场景和兴趣构建活动搜索关键词"""
    keywords = []

    # 根据兴趣直接搜索
    for interest in interests[:2]:
        keywords.append(interest)

    is_bad_weather = any(w in weather for w in ["雨", "雪", "雷", "暴"])

    if scene_type == "family":
        if child_age and child_age <= 6:
            keywords.extend(["儿童乐园", "海洋馆"])
        elif child_age and child_age <= 12:
            keywords.extend(["科技馆", "动物园"])
        else:
            keywords.extend(["公园", "博物馆"])
    elif scene_type == "friends":
        if is_bad_weather:
            keywords.extend(["密室逃脱", "桌游", "KTV"])
        else:
            keywords.extend(["户外运动", "景点"])
    elif scene_type == "couple":
        if is_bad_weather:
            keywords.extend(["电影院", "展览"])
        else:
            keywords.extend(["公园", "湖滨"])
    elif scene_type == "solo":
        keywords.extend(["书店", "咖啡馆", "博物馆"])

    if not keywords:
        keywords = ["景点", "公园"]

    return keywords[:4]


async def _rank_activities(activities: list[dict], intent: dict, context: dict, thinking: list) -> list[dict]:
    """使用 LLM 排序推荐活动"""
    activities_text = json.dumps(activities[:15], ensure_ascii=False, indent=2)
    intent_text = json.dumps(intent, ensure_ascii=False)

    messages = [
        {"role": "system", "content": ACTIVITY_PROMPT},
        {"role": "user", "content": f"""以下是搜索到的活动/景点列表：
{activities_text}

用户需求：{intent_text}
天气：{context.get('weather', '晴')}，{context.get('outdoor_recommendation', '')}

请选出最合适的 5 个活动，按推荐度排序。
直接返回 JSON 数组，每个元素包含 name、address、location、type、recommendation_reason 字段。"""},
    ]

    try:
        from backend.llm.client import chat
        resp = await chat(messages, temperature=0.5)
        content = resp.content or ""
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

    return activities
