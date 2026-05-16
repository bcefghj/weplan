"""ToolHarness — 工具调用的统一封装层
提供超时控制、指数退避重试、降级兜底、调用日志。
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable, Optional

from backend.config import TOOL_TIMEOUT, TOOL_MAX_RETRIES

logger = logging.getLogger("weplan.tools")


@dataclass
class ToolResult:
    success: bool
    data: Any = None
    error: Optional[str] = None
    source: str = "live"       # "live" / "cache" / "fallback"
    latency_ms: int = 0


class ToolHarness:
    """为每个外部 API 调用提供统一的容错包装"""

    def __init__(
        self,
        name: str,
        timeout: float = TOOL_TIMEOUT,
        max_retries: int = TOOL_MAX_RETRIES,
        fallback_fn: Optional[Callable[..., Any]] = None,
    ):
        self.name = name
        self.timeout = timeout
        self.max_retries = max_retries
        self.fallback_fn = fallback_fn
        self._cache: dict[str, ToolResult] = {}
        self.call_log: list[dict] = []

    async def execute(
        self,
        fn: Callable[..., Awaitable[Any]],
        *args: Any,
        cache_key: Optional[str] = None,
        **kwargs: Any,
    ) -> ToolResult:
        # 命中缓存
        if cache_key and cache_key in self._cache:
            cached = self._cache[cache_key]
            logger.info("[%s] cache hit: %s", self.name, cache_key)
            return ToolResult(success=True, data=cached.data, source="cache", latency_ms=0)

        last_error = ""
        for attempt in range(self.max_retries + 1):
            start = time.time()
            try:
                result = await asyncio.wait_for(
                    fn(*args, **kwargs),
                    timeout=self.timeout,
                )
                latency = int((time.time() - start) * 1000)
                tool_result = ToolResult(success=True, data=result, latency_ms=latency)

                if cache_key:
                    self._cache[cache_key] = tool_result

                self._log(True, latency, attempt)
                return tool_result

            except asyncio.TimeoutError:
                last_error = f"timeout after {self.timeout}s"
                logger.warning("[%s] attempt %d timeout", self.name, attempt + 1)
            except Exception as e:
                last_error = str(e)
                logger.warning("[%s] attempt %d error: %s", self.name, attempt + 1, e)

            # 指数退避
            if attempt < self.max_retries:
                await asyncio.sleep(0.5 * (2 ** attempt))

        # 所有重试失败，尝试 fallback
        if self.fallback_fn:
            try:
                fb_data = self.fallback_fn(*args, **kwargs) if not asyncio.iscoroutinefunction(self.fallback_fn) \
                    else await self.fallback_fn(*args, **kwargs)
                logger.info("[%s] fallback succeeded", self.name)
                self._log(True, 0, -1, source="fallback")
                return ToolResult(success=True, data=fb_data, source="fallback", latency_ms=0)
            except Exception as e:
                last_error = f"fallback also failed: {e}"

        self._log(False, 0, self.max_retries)
        return ToolResult(success=False, error=last_error)

    def _log(self, success: bool, latency_ms: int, attempt: int, source: str = "live"):
        entry = {
            "tool": self.name,
            "success": success,
            "latency_ms": latency_ms,
            "attempt": attempt,
            "source": source,
            "ts": time.time(),
        }
        self.call_log.append(entry)
        logger.info("[%s] %s", self.name, entry)
