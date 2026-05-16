"""会话管理 — 内存字典存储，支持多轮对话状态"""

import time
import uuid
from typing import Any, Optional


class SessionStore:
    """简单的内存会话存储"""

    def __init__(self):
        self._sessions: dict[str, dict[str, Any]] = {}

    def create_session(self, user_id: str = "anonymous") -> str:
        session_id = uuid.uuid4().hex[:16]
        self._sessions[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": time.time(),
            "updated_at": time.time(),
            "messages": [],
            "intent": None,
            "context": None,
            "plans": None,
            "selected_plan": None,
            "execution_result": None,
            "state": "init",  # init → planning → plan_ready → executing → done
        }
        return session_id

    def get_session(self, session_id: str) -> Optional[dict]:
        return self._sessions.get(session_id)

    def update_session(self, session_id: str, **kwargs) -> bool:
        if session_id not in self._sessions:
            return False
        self._sessions[session_id].update(kwargs)
        self._sessions[session_id]["updated_at"] = time.time()
        return True

    def add_message(self, session_id: str, role: str, content: str):
        session = self._sessions.get(session_id)
        if session:
            session["messages"].append({
                "role": role,
                "content": content,
                "timestamp": time.time(),
            })
            session["updated_at"] = time.time()

    def list_sessions(self) -> list[dict]:
        return [
            {
                "session_id": s["session_id"],
                "user_id": s["user_id"],
                "state": s["state"],
                "created_at": s["created_at"],
                "message_count": len(s["messages"]),
            }
            for s in self._sessions.values()
        ]

    def delete_session(self, session_id: str) -> bool:
        return self._sessions.pop(session_id, None) is not None


# 全局单例
session_store = SessionStore()
