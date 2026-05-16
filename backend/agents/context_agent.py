"""Context Agent — 环境感知（天气、时间、位置）"""

import json
from datetime import datetime
from typing import Any

from backend.agents.base import BaseAgent
from backend.tools.amap import get_weather
from backend.config import DEFAULT_CITY, DEFAULT_LOCATION


class ContextAgent(BaseAgent):
    def __init__(self):
        super().__init__("context")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        city: str = kwargs.get("city", DEFAULT_CITY)
        thinking.append({"step": "start", "message": f"获取 {city} 环境数据"})

        # 获取天气
        weather_result = await get_weather(city)
        weather_data = {}
        if weather_result.success:
            weather_data = weather_result.data
            thinking.append({"step": "weather", "data": weather_data, "source": weather_result.source})
        else:
            thinking.append({"step": "weather_error", "error": weather_result.error})
            weather_data = {"weather": "晴", "temperature": "25"}

        # 当前时间
        now = datetime.now()
        is_weekend = now.weekday() >= 5

        context = {
            "city": city,
            "weather": weather_data.get("weather", "晴"),
            "temperature": weather_data.get("temperature", "25"),
            "humidity": weather_data.get("humidity", ""),
            "wind": f"{weather_data.get('winddirection', '')}风 {weather_data.get('windpower', '')}级",
            "current_time": now.strftime("%H:%M"),
            "current_date": now.strftime("%Y-%m-%d"),
            "is_weekend": is_weekend,
            "day_of_week": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][now.weekday()],
            "location": DEFAULT_LOCATION.get(city, ""),
            "outdoor_recommendation": _outdoor_recommendation(weather_data),
        }

        thinking.append({"step": "done", "context": context})
        return context


def _outdoor_recommendation(weather: dict) -> str:
    """根据天气给出户外/室内建议"""
    w = weather.get("weather", "")
    temp = int(weather.get("temperature", 25) or 25)

    if any(bad in w for bad in ["暴雨", "大雨", "雷", "暴雪", "台风"]):
        return "建议室内活动，当前天气不适合户外"
    if temp >= 38:
        return "高温预警，建议室内或傍晚出行"
    if temp <= 0:
        return "低温预警，建议室内活动并注意保暖"
    if "雨" in w:
        return "有小雨，可短时间户外但建议备伞，优先室内"
    if "阴" in w:
        return "阴天适合户外，不晒不热"
    return "天气适宜户外活动"
