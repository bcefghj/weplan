"""投票机制 — 多人对方案进行投票"""

import time
import uuid
from typing import Optional

from backend.models.vote import VoteSession, Vote, VoteResult, VoteType

_vote_sessions: dict[str, VoteSession] = {}
_votes: dict[str, list[Vote]] = {}  # plan_id -> votes


def create_vote_session(plan_id: str, created_by: str = "host") -> dict:
    """创建投票会话，返回会话信息和分享 token"""
    session = VoteSession(
        plan_id=plan_id,
        created_by=created_by,
    )
    _vote_sessions[session.session_id] = session
    _votes.setdefault(plan_id, [])

    return {
        "session_id": session.session_id,
        "plan_id": plan_id,
        "vote_url": f"/vote/{session.session_id}",
        "message": "投票会话已创建，可分享给朋友",
    }


def cast_vote(
    session_id: str,
    voter_name: str,
    plan_id: str,
    vote_type: str,
    node_id: Optional[str] = None,
    comment: Optional[str] = None,
) -> dict:
    """投票"""
    session = _vote_sessions.get(session_id)
    if not session:
        return {"success": False, "message": "投票会话不存在"}
    if not session.is_active:
        return {"success": False, "message": "投票已结束"}

    try:
        vt = VoteType(vote_type)
    except ValueError:
        return {"success": False, "message": f"无效的投票类型: {vote_type}"}

    vote = Vote(
        voter_name=voter_name,
        plan_id=plan_id,
        node_id=node_id,
        vote_type=vt,
        comment=comment,
    )

    _votes.setdefault(plan_id, []).append(vote)
    if voter_name not in session.voters:
        session.voters.append(voter_name)

    return {
        "success": True,
        "message": f"{voter_name} 已投票: {vote_type}",
        "total_votes": len(_votes[plan_id]),
    }


def get_vote_results(plan_id: str) -> dict:
    """获取投票结果"""
    votes = _votes.get(plan_id, [])

    approve = sum(1 for v in votes if v.vote_type == VoteType.APPROVE and not v.node_id)
    reject = sum(1 for v in votes if v.vote_type == VoteType.REJECT and not v.node_id)
    neutral = sum(1 for v in votes if v.vote_type == VoteType.NEUTRAL and not v.node_id)

    # 按节点统计
    node_votes: dict[str, dict[str, int]] = {}
    for v in votes:
        if v.node_id:
            if v.node_id not in node_votes:
                node_votes[v.node_id] = {"approve": 0, "reject": 0, "neutral": 0}
            node_votes[v.node_id][v.vote_type.value] += 1

    comments = [
        {"voter": v.voter_name, "comment": v.comment}
        for v in votes if v.comment
    ]

    result = VoteResult(
        plan_id=plan_id,
        total_votes=len(votes),
        approve_count=approve,
        reject_count=reject,
        neutral_count=neutral,
        node_votes=node_votes,
        comments=comments,
    )

    return result.model_dump()
