from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import uuid


class TransportMode(str, Enum):
    WALK = "walk"
    DRIVE = "drive"
    TRANSIT = "transit"
    TAXI = "taxi"


class PlanNode(BaseModel):
    """方案中的单个时间节点"""

    node_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    time_start: str          # "14:00"
    time_end: str            # "15:30"
    title: str               # "西湖骑行"
    category: str            # "activity" / "dining" / "transport" / "rest"
    venue_name: Optional[str] = None
    venue_address: Optional[str] = None
    venue_location: Optional[str] = None   # "lng,lat"
    venue_phone: Optional[str] = None
    cost_per_person: float = 0.0
    description: str = ""
    transport_to_next: Optional[TransportMode] = None
    transport_duration_min: int = 0
    tags: list[str] = Field(default_factory=list)
    booking_required: bool = False
    booking_status: Optional[str] = None   # "pending" / "confirmed" / "failed"


class PlanScore(BaseModel):
    """方案五维评分（0-100）"""

    cost: int = 70
    fun: int = 70
    convenience: int = 70
    fit: int = 70            # 适合度（对群体需求的匹配程度）
    uniqueness: int = 70     # 特色


class Plan(BaseModel):
    """完整方案"""

    plan_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str = ""
    summary: str = ""
    nodes: list[PlanNode] = Field(default_factory=list)
    total_cost_per_person: float = 0.0
    total_duration_hours: float = 0.0
    score: PlanScore = Field(default_factory=PlanScore)
    highlight: str = ""      # 方案亮点一句话


class PlanComparison(BaseModel):
    """多方案对比结果"""

    plans: list[Plan] = Field(default_factory=list)
    recommendation_index: int = 0   # 推荐方案的索引
    recommendation_reason: str = ""
