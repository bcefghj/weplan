"""分享链接 — 生成短链接，存储方案快照"""

import hashlib
import json
import time
from typing import Optional

_share_store: dict[str, dict] = {}


def create_share_link(plan_data: dict, creator: str = "anonymous") -> dict:
    """生成分享链接，存储方案快照"""
    snapshot = json.dumps(plan_data, ensure_ascii=False, sort_keys=True)
    # 用内容哈希生成短 ID
    hash_id = hashlib.md5(snapshot.encode()).hexdigest()[:8]

    _share_store[hash_id] = {
        "share_id": hash_id,
        "plan_data": plan_data,
        "creator": creator,
        "created_at": time.time(),
        "view_count": 0,
    }

    return {
        "share_id": hash_id,
        "share_url": f"/share/{hash_id}",
        "message": "分享链接已生成",
    }


def get_shared_plan(share_id: str) -> Optional[dict]:
    """通过短链获取方案快照"""
    record = _share_store.get(share_id)
    if record:
        record["view_count"] += 1
        return record
    return None


def list_shares() -> list[dict]:
    """列出所有分享记录"""
    return [
        {
            "share_id": r["share_id"],
            "creator": r["creator"],
            "created_at": r["created_at"],
            "view_count": r["view_count"],
        }
        for r in _share_store.values()
    ]
