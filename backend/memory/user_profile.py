"""用户画像 — SQLite 存储用户偏好"""

import json
import os
import aiosqlite
from typing import Optional
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "user_profiles.db"


async def _ensure_db():
    """确保数据库和表已创建"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                display_name TEXT DEFAULT '',
                city TEXT DEFAULT '杭州',
                interests TEXT DEFAULT '[]',
                dietary TEXT DEFAULT '[]',
                preferred_budget_min INTEGER DEFAULT 0,
                preferred_budget_max INTEGER DEFAULT 500,
                has_children INTEGER DEFAULT 0,
                child_age INTEGER DEFAULT 0,
                history_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def get_profile(user_id: str) -> Optional[dict]:
    await _ensure_db()
    async with aiosqlite.connect(str(DB_PATH)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            d = dict(row)
            d["interests"] = json.loads(d.get("interests", "[]"))
            d["dietary"] = json.loads(d.get("dietary", "[]"))
            return d
    return None


async def upsert_profile(user_id: str, **kwargs) -> dict:
    await _ensure_db()

    existing = await get_profile(user_id)

    interests = json.dumps(kwargs.get("interests", existing.get("interests", []) if existing else []), ensure_ascii=False)
    dietary = json.dumps(kwargs.get("dietary", existing.get("dietary", []) if existing else []), ensure_ascii=False)

    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.execute("""
            INSERT INTO user_profiles (user_id, display_name, city, interests, dietary,
                preferred_budget_min, preferred_budget_max, has_children, child_age)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                display_name = COALESCE(excluded.display_name, display_name),
                city = COALESCE(excluded.city, city),
                interests = excluded.interests,
                dietary = excluded.dietary,
                preferred_budget_min = COALESCE(excluded.preferred_budget_min, preferred_budget_min),
                preferred_budget_max = COALESCE(excluded.preferred_budget_max, preferred_budget_max),
                has_children = COALESCE(excluded.has_children, has_children),
                child_age = COALESCE(excluded.child_age, child_age),
                updated_at = CURRENT_TIMESTAMP
        """, (
            user_id,
            kwargs.get("display_name", existing.get("display_name", "") if existing else ""),
            kwargs.get("city", existing.get("city", "杭州") if existing else "杭州"),
            interests,
            dietary,
            kwargs.get("preferred_budget_min", existing.get("preferred_budget_min", 0) if existing else 0),
            kwargs.get("preferred_budget_max", existing.get("preferred_budget_max", 500) if existing else 500),
            kwargs.get("has_children", existing.get("has_children", 0) if existing else 0),
            kwargs.get("child_age", existing.get("child_age", 0) if existing else 0),
        ))
        await db.commit()

    return await get_profile(user_id) or {"user_id": user_id}


async def increment_history(user_id: str):
    """增加使用次数"""
    await _ensure_db()
    async with aiosqlite.connect(str(DB_PATH)) as db:
        await db.execute(
            "UPDATE user_profiles SET history_count = history_count + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (user_id,),
        )
        await db.commit()
