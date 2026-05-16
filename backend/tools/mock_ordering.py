"""Mock 门票购买服务"""

import asyncio
import random
import uuid


_TICKET_DB: dict[str, dict] = {
    "西湖游船": {"price": 55, "stock": 200, "venue": "西湖风景名胜区"},
    "灵隐寺": {"price": 75, "stock": 500, "venue": "灵隐寺"},
    "宋城千古情": {"price": 290, "stock": 100, "venue": "宋城景区"},
    "杭州动物园": {"price": 20, "stock": 1000, "venue": "杭州动物园"},
    "杭州海底世界": {"price": 120, "stock": 300, "venue": "杭州海底世界"},
    "杭州乐园": {"price": 160, "stock": 200, "venue": "杭州乐园"},
    "浙江省博物馆": {"price": 0, "stock": 500, "venue": "浙江省博物馆"},
}

_orders: dict[str, dict] = {}


async def check_tickets(venue_name: str, date: str, quantity: int = 1) -> dict:
    """查询门票可用性"""
    await asyncio.sleep(random.uniform(0.2, 0.6))

    ticket_info = None
    for name, info in _TICKET_DB.items():
        if name in venue_name or venue_name in name:
            ticket_info = info
            break

    if not ticket_info:
        return {
            "venue": venue_name,
            "available": True,
            "price": 0,
            "note": "该场所免费开放或无需购票",
        }

    available = ticket_info["stock"] >= quantity
    return {
        "venue": venue_name,
        "date": date,
        "available": available,
        "price": ticket_info["price"],
        "quantity_requested": quantity,
        "remaining_stock": ticket_info["stock"],
    }


async def buy_tickets(
    venue_name: str,
    date: str,
    quantity: int = 1,
    contact_phone: str = "138****8888",
) -> dict:
    """购买门票"""
    await asyncio.sleep(random.uniform(0.5, 1.5))

    ticket_info = None
    for name, info in _TICKET_DB.items():
        if name in venue_name or venue_name in name:
            ticket_info = info
            break

    if not ticket_info:
        order_id = f"T{uuid.uuid4().hex[:8].upper()}"
        result = {
            "venue": venue_name,
            "date": date,
            "quantity": quantity,
            "total_price": 0,
            "success": True,
            "order_id": order_id,
            "message": f"{venue_name} 免费入场，已登记 {quantity} 人",
        }
        _orders[order_id] = result
        return result

    success = random.random() > 0.05
    order_id = f"T{uuid.uuid4().hex[:8].upper()}" if success else None
    total = ticket_info["price"] * quantity

    result = {
        "venue": venue_name,
        "date": date,
        "quantity": quantity,
        "unit_price": ticket_info["price"],
        "total_price": total,
        "success": success,
        "order_id": order_id,
        "message": f"成功购买 {venue_name} 门票 ×{quantity}，合计 ¥{total}" if success else "购票失败，库存不足",
    }

    if success and order_id:
        _orders[order_id] = result

    return result
