from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import uuid


class VoteType(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    NEUTRAL = "neutral"


class VoteSession(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:10])
    plan_id: str
    created_by: str = ""
    voters: list[str] = Field(default_factory=list)
    is_active: bool = True


class Vote(BaseModel):
    voter_name: str
    plan_id: str
    node_id: Optional[str] = None     # 对某个节点投票；为空则对整个方案投票
    vote_type: VoteType
    comment: Optional[str] = None


class VoteResult(BaseModel):
    plan_id: str
    total_votes: int = 0
    approve_count: int = 0
    reject_count: int = 0
    neutral_count: int = 0
    node_votes: dict[str, dict[str, int]] = Field(default_factory=dict)
    comments: list[dict[str, str]] = Field(default_factory=list)
