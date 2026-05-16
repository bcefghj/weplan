"""Execution Agent — 执行预约/下单/叫车等动作"""

import json
from typing import Any

from backend.agents.base import BaseAgent
from backend.models.action import ActionType, ActionResult
from backend.tools import mock_booking, mock_ordering, mock_taxi, mock_delivery


class ExecutorAgent(BaseAgent):
    def __init__(self):
        super().__init__("executor")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        plan: dict = kwargs.get("plan", {})
        intent: dict = kwargs.get("intent", {})

        thinking.append({"step": "start", "message": "开始执行方案"})

        nodes = plan.get("nodes", [])
        actions: list[dict] = []

        for node in nodes:
            node_actions = await self._execute_node(node, intent, thinking)
            actions.extend(node_actions)

        # 检查是否需要叫车（相邻节点间有 taxi 交通）
        for i, node in enumerate(nodes[:-1]):
            if node.get("transport_to_next") == "taxi":
                taxi_result = await self._call_taxi(node, nodes[i + 1], thinking)
                actions.append(taxi_result)

        success_count = sum(1 for a in actions if a.get("success", False))
        thinking.append({
            "step": "done",
            "total_actions": len(actions),
            "success_count": success_count,
        })

        return {
            "actions": actions,
            "total": len(actions),
            "success_count": success_count,
            "all_success": success_count == len(actions),
        }

    async def _execute_node(self, node: dict, intent: dict, thinking: list) -> list[dict]:
        """为单个节点执行所需动作"""
        results = []
        category = node.get("category", "")
        venue = node.get("venue_name", "")
        time_start = node.get("time_start", "14:00")

        if category == "dining" and node.get("booking_required", True):
            thinking.append({"step": "booking", "venue": venue})
            # 预约餐厅
            result = await mock_booking.make_reservation(
                restaurant_name=venue,
                date="今天",
                time=time_start,
                party_size=intent.get("group_size", 2),
            )
            results.append({
                "action_type": ActionType.RESTAURANT_BOOKING.value,
                "node_id": node.get("node_id", ""),
                "venue": venue,
                "success": result.get("success", False),
                "confirmation_code": result.get("confirmation_code"),
                "message": result.get("message", ""),
            })

        elif category == "activity":
            # 检查是否需要购票
            thinking.append({"step": "check_tickets", "venue": venue})
            ticket_info = await mock_ordering.check_tickets(
                venue_name=venue,
                date="今天",
                quantity=intent.get("group_size", 2),
            )
            if ticket_info.get("price", 0) > 0:
                buy_result = await mock_ordering.buy_tickets(
                    venue_name=venue,
                    date="今天",
                    quantity=intent.get("group_size", 2),
                )
                results.append({
                    "action_type": ActionType.TICKET_PURCHASE.value,
                    "node_id": node.get("node_id", ""),
                    "venue": venue,
                    "success": buy_result.get("success", False),
                    "order_id": buy_result.get("order_id"),
                    "total_price": buy_result.get("total_price", 0),
                    "message": buy_result.get("message", ""),
                })

        return results

    async def _call_taxi(self, from_node: dict, to_node: dict, thinking: list) -> dict:
        """叫车"""
        origin = from_node.get("venue_address", from_node.get("venue_name", ""))
        destination = to_node.get("venue_address", to_node.get("venue_name", ""))

        thinking.append({"step": "taxi", "from": origin, "to": destination})

        result = await mock_taxi.call_taxi(
            origin=origin,
            destination=destination,
        )

        return {
            "action_type": ActionType.TAXI_CALL.value,
            "from": origin,
            "to": destination,
            "success": result.get("success", False),
            "ride_id": result.get("ride_id"),
            "wait_minutes": result.get("wait_minutes"),
            "message": result.get("message", ""),
        }
