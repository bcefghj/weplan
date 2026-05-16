from pydantic import BaseModel, Field
from typing import Optional, Any
from enum import Enum
import uuid


class ActionType(str, Enum):
    RESTAURANT_BOOKING = "restaurant_booking"
    TICKET_PURCHASE = "ticket_purchase"
    TAXI_CALL = "taxi_call"
    FLOWER_ORDER = "flower_order"
    CAKE_ORDER = "cake_order"


class ActionRequest(BaseModel):
    action_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    action_type: ActionType
    node_id: str              # 关联的 PlanNode
    params: dict[str, Any] = Field(default_factory=dict)


class ActionResult(BaseModel):
    action_id: str
    action_type: ActionType
    success: bool
    data: dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    confirmation_code: Optional[str] = None
    message: str = ""
