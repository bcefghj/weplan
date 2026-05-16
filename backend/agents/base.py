"""Agent 基类"""

from abc import ABC, abstractmethod
from typing import Any
import time


class AgentResult:
    def __init__(
        self,
        agent_name: str,
        success: bool,
        data: Any = None,
        error: str | None = None,
        thinking: list[dict] | None = None,
        duration_ms: int = 0,
    ):
        self.agent_name = agent_name
        self.success = success
        self.data = data
        self.error = error
        self.thinking = thinking or []
        self.duration_ms = duration_ms

    def to_dict(self) -> dict:
        return {
            "agent_name": self.agent_name,
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "thinking": self.thinking,
            "duration_ms": self.duration_ms,
        }


class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    async def run(self, **kwargs) -> AgentResult:
        start = time.time()
        thinking: list[dict] = []
        try:
            result = await self._execute(thinking=thinking, **kwargs)
            return AgentResult(
                agent_name=self.name,
                success=True,
                data=result,
                thinking=thinking,
                duration_ms=int((time.time() - start) * 1000),
            )
        except Exception as e:
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(e),
                thinking=thinking,
                duration_ms=int((time.time() - start) * 1000),
            )

    @abstractmethod
    async def _execute(self, thinking: list, **kwargs) -> Any:
        pass
