"""Mock 打车服务"""

import asyncio
import random
import uuid

_rides: dict[str, dict] = {}


async def estimate_price(origin: str, destination: str) -> dict:
    """估算打车费用"""
    await asyncio.sleep(random.uniform(0.2, 0.5))

    distance_km = round(random.uniform(2, 15), 1)
    base_price = 13
    per_km = 2.5
    price = round(base_price + distance_km * per_km + random.uniform(-3, 5), 0)
    duration_min = int(distance_km * random.uniform(2.5, 4.5))

    return {
        "origin": origin,
        "destination": destination,
        "estimated_price": price,
        "estimated_distance_km": distance_km,
        "estimated_duration_min": duration_min,
        "surge_multiplier": 1.0 if random.random() > 0.2 else round(random.uniform(1.1, 1.5), 1),
    }


async def call_taxi(
    origin: str,
    destination: str,
    passenger_count: int = 1,
) -> dict:
    """叫车"""
    await asyncio.sleep(random.uniform(0.8, 2.0))

    success = random.random() > 0.1
    ride_id = f"RIDE{uuid.uuid4().hex[:8].upper()}" if success else None
    wait_min = random.randint(3, 12) if success else 0

    car_models = ["大众朗逸", "丰田卡罗拉", "比亚迪秦", "别克英朗", "吉利帝豪"]
    plates = [f"浙A·{random.choice('ABCDEFGH')}{random.randint(1000,9999)}{random.choice('ABCDEFGH')}" for _ in range(1)]

    result = {
        "ride_id": ride_id,
        "success": success,
        "origin": origin,
        "destination": destination,
        "wait_minutes": wait_min,
        "driver_name": f"{'张王李赵'[random.randint(0,3)]}师傅",
        "car_model": random.choice(car_models),
        "plate_number": plates[0] if success else None,
        "message": f"已为您叫车，预计 {wait_min} 分钟到达" if success else "当前附近无可用车辆，请稍后重试",
    }

    if success and ride_id:
        _rides[ride_id] = {**result, "status": "waiting"}

    return result


async def get_taxi_status(ride_id: str) -> dict:
    """查询叫车状态"""
    await asyncio.sleep(random.uniform(0.1, 0.3))

    if ride_id in _rides:
        ride = _rides[ride_id]
        statuses = ["waiting", "on_the_way", "arrived", "in_trip", "completed"]
        ride["status"] = random.choice(statuses)
        return ride

    return {"ride_id": ride_id, "status": "not_found", "message": "未找到该订单"}
