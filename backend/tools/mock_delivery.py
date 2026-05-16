"""Mock 鲜花蛋糕配送服务"""

import asyncio
import random
import uuid

_deliveries: dict[str, dict] = {}

_FLOWER_CATALOG = [
    {"name": "向日葵花束", "price": 99, "description": "10支向日葵，阳光满满"},
    {"name": "红玫瑰花束", "price": 199, "description": "11支红玫瑰，经典浪漫"},
    {"name": "混搭鲜花篮", "price": 158, "description": "多品种混搭，色彩缤纷"},
    {"name": "百合花束", "price": 128, "description": "6支百合，清新淡雅"},
]

_CAKE_CATALOG = [
    {"name": "草莓奶油蛋糕", "price": 168, "size": "8寸", "description": "新鲜草莓+动物奶油"},
    {"name": "提拉米苏", "price": 198, "size": "8寸", "description": "经典意式口味"},
    {"name": "芒果千层", "price": 228, "size": "8寸", "description": "多层薄饼+新鲜芒果"},
    {"name": "巧克力慕斯", "price": 188, "size": "8寸", "description": "比利时黑巧+轻盈慕斯"},
    {"name": "水果拼盘蛋糕", "price": 148, "size": "8寸", "description": "多种时令水果"},
]


async def order_flowers(
    flower_type: str = "混搭鲜花篮",
    delivery_address: str = "",
    delivery_time: str = "",
    message_card: str = "",
) -> dict:
    """订购鲜花"""
    await asyncio.sleep(random.uniform(0.5, 1.0))

    flower = None
    for f in _FLOWER_CATALOG:
        if flower_type in f["name"] or f["name"] in flower_type:
            flower = f
            break
    if not flower:
        flower = random.choice(_FLOWER_CATALOG)

    order_id = f"FL{uuid.uuid4().hex[:8].upper()}"
    result = {
        "order_id": order_id,
        "success": True,
        "flower": flower["name"],
        "price": flower["price"],
        "delivery_address": delivery_address,
        "delivery_time": delivery_time,
        "message_card": message_card,
        "message": f"鲜花 {flower['name']}（¥{flower['price']}）已下单，预计 {delivery_time or '2小时内'} 送达",
    }
    _deliveries[order_id] = {**result, "status": "preparing"}
    return result


async def order_cake(
    cake_type: str = "草莓奶油蛋糕",
    delivery_address: str = "",
    delivery_time: str = "",
) -> dict:
    """订购蛋糕"""
    await asyncio.sleep(random.uniform(0.5, 1.2))

    cake = None
    for c in _CAKE_CATALOG:
        if cake_type in c["name"] or c["name"] in cake_type:
            cake = c
            break
    if not cake:
        cake = random.choice(_CAKE_CATALOG)

    order_id = f"CK{uuid.uuid4().hex[:8].upper()}"
    result = {
        "order_id": order_id,
        "success": True,
        "cake": cake["name"],
        "size": cake["size"],
        "price": cake["price"],
        "delivery_address": delivery_address,
        "delivery_time": delivery_time,
        "message": f"蛋糕 {cake['name']} {cake['size']}（¥{cake['price']}）已下单，预计 {delivery_time or '3小时内'} 送达",
    }
    _deliveries[order_id] = {**result, "status": "preparing"}
    return result


async def get_delivery_status(order_id: str) -> dict:
    """查询配送状态"""
    await asyncio.sleep(random.uniform(0.1, 0.3))

    if order_id in _deliveries:
        delivery = _deliveries[order_id]
        statuses = ["preparing", "picked_up", "delivering", "delivered"]
        delivery["status"] = random.choice(statuses)
        return delivery

    return {"order_id": order_id, "status": "not_found", "message": "未找到该订单"}
