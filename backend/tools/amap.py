"""高德地图 Web Service API 封装"""

import json
import logging
from typing import Optional

import httpx

from backend.config import AMAP_API_KEY, AMAP_BASE_URL, DEFAULT_CITY, DEFAULT_LOCATION
from backend.tools.harness import ToolHarness, ToolResult

logger = logging.getLogger("weplan.tools.amap")

_http: Optional[httpx.AsyncClient] = None


def _get_http() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=10.0)
    return _http


# ────────────────────── fallback 数据 ──────────────────────

_FALLBACK_WEATHER = {
    "杭州": {"city": "杭州", "weather": "晴", "temperature": "28", "winddirection": "东南", "windpower": "≤3"},
    "北京": {"city": "北京", "weather": "多云", "temperature": "26", "winddirection": "北", "windpower": "3"},
}

_FALLBACK_POIS = {
    "杭州_餐厅": [
        {"name": "绿茶餐厅（龙井路店）", "address": "杭州市西湖区龙井路 83 号", "location": "120.130816,30.246454",
         "tel": "0571-87888022", "type": "餐饮服务", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "外婆家（湖滨银泰店）", "address": "杭州市上城区东坡路 7 号", "location": "120.168735,30.253689",
         "tel": "0571-87068517", "type": "餐饮服务", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "新白鹿餐厅（西溪店）", "address": "杭州市西湖区紫荆花路 1 号", "location": "120.085288,30.277238",
         "tel": "0571-88859777", "type": "餐饮服务", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "知味观（河坊街店）", "address": "杭州市上城区河坊街 83 号", "location": "120.170413,30.247155",
         "tel": "0571-87805921", "type": "餐饮服务", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "弄堂里（南山路店）", "address": "杭州市上城区南山路 202-2 号", "location": "120.156087,30.243276",
         "tel": "0571-87069877", "type": "餐饮服务", "pname": "浙江省", "cityname": "杭州市"},
    ],
    "杭州_景点": [
        {"name": "西湖风景名胜区", "address": "杭州市西湖区龙井路 1 号", "location": "120.148732,30.242706",
         "tel": "0571-87179539", "type": "风景名胜", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "灵隐寺", "address": "杭州市西湖区灵隐路法云弄 1 号", "location": "120.099875,30.268795",
         "tel": "0571-87968665", "type": "风景名胜", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "宋城景区", "address": "杭州市西湖区之江路 148 号", "location": "120.094831,30.184508",
         "tel": "0571-87313101", "type": "风景名胜", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "杭州动物园", "address": "杭州市西湖区虎跑路 40 号", "location": "120.150072,30.227776",
         "tel": "0571-87970657", "type": "风景名胜", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "浙江省博物馆（孤山馆区）", "address": "杭州市西湖区孤山路 25 号", "location": "120.145277,30.253801",
         "tel": "0571-87971177", "type": "科教文化", "pname": "浙江省", "cityname": "杭州市"},
    ],
    "杭州_亲子": [
        {"name": "杭州乐园", "address": "杭州市萧山区风情大道 2555 号", "location": "120.225441,30.132988",
         "tel": "0571-82886688", "type": "风景名胜", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "杭州海底世界", "address": "杭州市上城区万松岭路", "location": "120.161534,30.239543",
         "tel": "0571-87088197", "type": "科教文化", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "DO都城少儿社会体验馆", "address": "杭州市江干区钱江新城新业路", "location": "120.213847,30.252764",
         "tel": "0571-86510200", "type": "科教文化", "pname": "浙江省", "cityname": "杭州市"},
    ],
    "杭州_运动": [
        {"name": "西湖公共自行车租赁点", "address": "杭州市西湖区", "location": "120.148732,30.242706",
         "tel": "", "type": "交通设施", "pname": "浙江省", "cityname": "杭州市"},
        {"name": "杭州攀岩公园", "address": "杭州市拱墅区", "location": "120.155,30.310",
         "tel": "", "type": "运动健身", "pname": "浙江省", "cityname": "杭州市"},
    ],
}


def _fallback_weather(city: str) -> dict:
    return _FALLBACK_WEATHER.get(city, _FALLBACK_WEATHER["杭州"])


def _fallback_poi(keyword: str, city: str, **_) -> list[dict]:
    key = f"{city}_{keyword}"
    for k, v in _FALLBACK_POIS.items():
        if keyword in k or k in keyword:
            return v
    # 找不到精确匹配，返回景点兜底
    return _FALLBACK_POIS.get(f"{city}_景点", _FALLBACK_POIS["杭州_景点"])


# ────────────────────── API 方法 ──────────────────────

_weather_harness = ToolHarness("amap_weather", fallback_fn=_fallback_weather)
_poi_harness = ToolHarness("amap_poi", fallback_fn=_fallback_poi)
_route_harness = ToolHarness("amap_route")
_geocode_harness = ToolHarness("amap_geocode")


async def _raw_weather(city: str) -> dict:
    http = _get_http()
    resp = await http.get(
        f"{AMAP_BASE_URL}/weather/weatherInfo",
        params={"key": AMAP_API_KEY, "city": city, "extensions": "base"},
    )
    data = resp.json()
    if data.get("status") == "1" and data.get("lives"):
        live = data["lives"][0]
        return {
            "city": live.get("city", city),
            "weather": live.get("weather", ""),
            "temperature": live.get("temperature", ""),
            "winddirection": live.get("winddirection", ""),
            "windpower": live.get("windpower", ""),
            "humidity": live.get("humidity", ""),
            "reporttime": live.get("reporttime", ""),
        }
    raise ValueError(f"高德天气 API 返回异常: {data}")


async def get_weather(city: str = DEFAULT_CITY) -> ToolResult:
    return await _weather_harness.execute(_raw_weather, city, cache_key=f"weather_{city}")


async def _raw_search_poi(keyword: str, city: str, category: str = "", location: str = "", radius: int = 5000) -> list[dict]:
    http = _get_http()
    params = {
        "key": AMAP_API_KEY,
        "keywords": keyword,
        "city": city,
        "offset": 10,
        "extensions": "all",
    }
    if category:
        params["types"] = category
    if location:
        params["location"] = location
        params["radius"] = radius
        params["sortrule"] = "distance"

    resp = await http.get(f"{AMAP_BASE_URL}/place/text", params=params)
    data = resp.json()
    if data.get("status") == "1":
        pois = data.get("pois", [])
        return [
            {
                "name": p.get("name", ""),
                "address": p.get("address", ""),
                "location": p.get("location", ""),
                "tel": p.get("tel", ""),
                "type": p.get("type", ""),
                "pname": p.get("pname", ""),
                "cityname": p.get("cityname", ""),
                "business_area": p.get("business_area", ""),
                "rating": p.get("biz_ext", {}).get("rating", ""),
                "cost": p.get("biz_ext", {}).get("cost", ""),
            }
            for p in pois
        ]
    raise ValueError(f"高德 POI 搜索异常: {data}")


async def search_poi(keyword: str, city: str = DEFAULT_CITY, category: str = "", location: str = "", radius: int = 5000) -> ToolResult:
    return await _poi_harness.execute(
        _raw_search_poi, keyword, city, category, location, radius,
        cache_key=f"poi_{city}_{keyword}_{category}",
    )


async def _raw_search_nearby(location: str, keyword: str, radius: int = 3000) -> list[dict]:
    http = _get_http()
    params = {
        "key": AMAP_API_KEY,
        "location": location,
        "keywords": keyword,
        "radius": radius,
        "offset": 10,
        "sortrule": "distance",
    }
    resp = await http.get(f"{AMAP_BASE_URL}/place/around", params=params)
    data = resp.json()
    if data.get("status") == "1":
        pois = data.get("pois", [])
        return [
            {
                "name": p.get("name", ""),
                "address": p.get("address", ""),
                "location": p.get("location", ""),
                "tel": p.get("tel", ""),
                "distance": p.get("distance", ""),
                "type": p.get("type", ""),
            }
            for p in pois
        ]
    raise ValueError(f"高德周边搜索异常: {data}")


async def search_nearby(location: str, keyword: str, radius: int = 3000) -> ToolResult:
    return await _poi_harness.execute(
        _raw_search_nearby, location, keyword, radius,
        cache_key=f"nearby_{location}_{keyword}_{radius}",
    )


async def _raw_get_route(origin: str, destination: str, mode: str = "driving") -> dict:
    http = _get_http()
    if mode == "driving":
        url = f"{AMAP_BASE_URL}/direction/driving"
        params = {"key": AMAP_API_KEY, "origin": origin, "destination": destination, "strategy": 10}
    elif mode == "walking":
        url = f"{AMAP_BASE_URL}/direction/walking"
        params = {"key": AMAP_API_KEY, "origin": origin, "destination": destination}
    else:
        url = f"{AMAP_BASE_URL}/direction/transit/integrated"
        params = {"key": AMAP_API_KEY, "origin": origin, "destination": destination, "city": DEFAULT_CITY}

    resp = await http.get(url, params=params)
    data = resp.json()
    if data.get("status") == "1":
        route = data.get("route", {})
        paths = route.get("paths") or route.get("transits", [])
        if paths:
            p = paths[0]
            return {
                "distance": p.get("distance", "0"),
                "duration": p.get("duration", "0"),
                "mode": mode,
            }
    return {"distance": "0", "duration": "0", "mode": mode, "note": "未获取到路线"}


async def get_route(origin: str, destination: str, mode: str = "driving") -> ToolResult:
    return await _route_harness.execute(
        _raw_get_route, origin, destination, mode,
        cache_key=f"route_{origin}_{destination}_{mode}",
    )


async def _raw_geocode(address: str) -> dict:
    http = _get_http()
    resp = await http.get(
        f"{AMAP_BASE_URL}/geocode/geo",
        params={"key": AMAP_API_KEY, "address": address},
    )
    data = resp.json()
    if data.get("status") == "1" and data.get("geocodes"):
        geo = data["geocodes"][0]
        return {"location": geo.get("location", ""), "formatted_address": geo.get("formatted_address", "")}
    raise ValueError(f"地理编码失败: {data}")


async def geocode(address: str) -> ToolResult:
    return await _geocode_harness.execute(_raw_geocode, address, cache_key=f"geo_{address}")
