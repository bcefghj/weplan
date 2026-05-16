"""Mock 餐厅预约服务 — 返回真实感数据"""

import asyncio
import random
import uuid
from typing import Optional

_reservations: dict[str, dict] = {}


async def check_availability(
    restaurant_name: str,
    date: str,
    time: str,
    party_size: int,
) -> dict:
    """检查餐厅可用性"""
    await asyncio.sleep(random.uniform(0.3, 0.8))

    available = random.random() > 0.15  # 85% 概率有位
    wait_minutes = 0 if available else random.choice([15, 20, 30, 45])

    return {
        "restaurant": restaurant_name,
        "date": date,
        "time": time,
        "party_size": party_size,
        "available": available,
        "wait_minutes": wait_minutes,
        "available_times": [time] if available else _suggest_times(time),
        "private_room": random.random() > 0.5 and party_size >= 6,
    }


async def make_reservation(
    restaurant_name: str,
    date: str,
    time: str,
    party_size: int,
    contact_name: str = "用户",
    contact_phone: str = "138****8888",
) -> dict:
    """预约餐厅"""
    await asyncio.sleep(random.uniform(0.5, 1.2))

    success = random.random() > 0.05  # 95% 成功率
    confirmation_code = f"R{uuid.uuid4().hex[:8].upper()}" if success else None

    result = {
        "restaurant": restaurant_name,
        "date": date,
        "time": time,
        "party_size": party_size,
        "contact_name": contact_name,
        "success": success,
        "confirmation_code": confirmation_code,
        "message": f"已为您预订 {restaurant_name} {date} {time} {party_size}人座" if success else "预订失败，请稍后重试",
    }

    if success and confirmation_code:
        _reservations[confirmation_code] = result

    return result


async def cancel_reservation(confirmation_code: str) -> dict:
    """取消预约"""
    await asyncio.sleep(random.uniform(0.2, 0.5))

    if confirmation_code in _reservations:
        del _reservations[confirmation_code]
        return {"success": True, "message": f"预约 {confirmation_code} 已取消"}

    return {"success": False, "message": "未找到该预约"}


def _suggest_times(original: str) -> list[str]:
    """根据原始时间推荐替代时段"""
    h, m = map(int, original.split(":"))
    suggestions = []
    for delta in [-30, 30, 60]:
        new_h = h + (m + delta) // 60
        new_m = (m + delta) % 60
        if 10 <= new_h <= 21:
            suggestions.append(f"{new_h:02d}:{new_m:02d}")
    return suggestions
