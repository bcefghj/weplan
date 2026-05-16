import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件（优先从项目根目录查找）
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

# ── MiniMax M2.7 配置 ──
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL = "https://api.minimax.io/v1"
MINIMAX_MODEL = "MiniMax-M2.7"

# ── 高德地图配置 ──
AMAP_API_KEY = os.getenv("AMAP_API_KEY", "")
AMAP_BASE_URL = "https://restapi.amap.com/v3"

# ── 默认城市与坐标 ──
DEFAULT_CITY = os.getenv("DEFAULT_CITY", "杭州")
DEFAULT_LOCATION: dict[str, str] = {
    "杭州": "120.153576,30.287459",
    "北京": "116.397428,39.90923",
    "上海": "121.472644,31.231706",
    "深圳": "114.085947,22.547",
    "广州": "113.280637,23.125178",
    "成都": "104.065735,30.659462",
}

# ── Agent 参数 ──
MAX_CRITIC_ROUNDS = 3
TOOL_TIMEOUT = 8.0
TOOL_MAX_RETRIES = 2
