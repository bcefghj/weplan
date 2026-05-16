"""Critic Agent — 确定性校验（不使用 LLM）"""

from typing import Any
from backend.agents.base import BaseAgent


class CriticResult:
    def __init__(self, passed: bool, issues: list[str], suggestions: list[str]):
        self.passed = passed
        self.issues = issues
        self.suggestions = suggestions

    def to_dict(self) -> dict:
        return {"passed": self.passed, "issues": self.issues, "suggestions": self.suggestions}


class CriticAgent(BaseAgent):
    def __init__(self):
        super().__init__("critic")

    async def _execute(self, thinking: list, **kwargs) -> dict:
        plan: dict = kwargs.get("plan", {})
        intent: dict = kwargs.get("intent", {})
        context: dict = kwargs.get("context", {})

        thinking.append({"step": "start", "message": "开始校验方案"})

        issues: list[str] = []
        suggestions: list[str] = []

        nodes = plan.get("nodes", [])
        if not nodes:
            issues.append("方案没有任何时间节点")
            return CriticResult(False, issues, ["请重新生成方案"]).to_dict()

        # 逐项检查
        _check_venue_open(nodes, intent, issues, suggestions)
        _check_travel_time(nodes, issues, suggestions)
        _check_age_appropriate(nodes, intent, issues, suggestions)
        _check_dietary_fit(nodes, intent, issues, suggestions)
        _check_budget(plan, intent, issues, suggestions)
        _check_weather_compatible(nodes, context, issues, suggestions)
        _check_total_duration(plan, intent, issues, suggestions)
        _check_group_size(nodes, intent, issues, suggestions)

        passed = len(issues) == 0
        thinking.append({
            "step": "done",
            "passed": passed,
            "issue_count": len(issues),
            "issues": issues,
        })

        return CriticResult(passed, issues, suggestions).to_dict()


def _check_venue_open(nodes: list[dict], intent: dict, issues: list, suggestions: list):
    """检查场所是否在时段内营业"""
    for node in nodes:
        time_start = node.get("time_start", "")
        if time_start:
            try:
                h = int(time_start.split(":")[0])
                if h < 8:
                    issues.append(f"'{node.get('title')}' 安排在早上 {time_start}，大部分场所尚未营业")
                    suggestions.append(f"建议将 '{node.get('title')}' 推迟到 9:00 之后")
                if h >= 22:
                    issues.append(f"'{node.get('title')}' 安排在 {time_start}，大部分场所已关门")
            except (ValueError, IndexError):
                pass


def _check_travel_time(nodes: list[dict], issues: list, suggestions: list):
    """检查交通时间是否合理"""
    for node in nodes:
        transport_min = node.get("transport_duration_min", 0)
        if transport_min > 60:
            issues.append(f"'{node.get('title')}' 到下一站交通需要 {transport_min} 分钟，过长")
            suggestions.append("建议调整行程顺序或选择更近的替代场所")


def _check_age_appropriate(nodes: list[dict], intent: dict, issues: list, suggestions: list):
    """检查活动是否适龄"""
    child_age = intent.get("child_age")
    if not child_age:
        return

    # 儿童不宜的活动关键词
    inappropriate = ["酒吧", "KTV", "密室", "剧本杀", "攀岩"]
    if child_age < 6:
        inappropriate.extend(["过山车", "蹦极", "漂流"])

    for node in nodes:
        title = node.get("title", "") + node.get("venue_name", "")
        for word in inappropriate:
            if word in title:
                issues.append(f"'{node.get('title')}' 不适合 {child_age} 岁的孩子")
                suggestions.append(f"建议替换为亲子友好的活动")
                break


def _check_dietary_fit(nodes: list[dict], intent: dict, issues: list, suggestions: list):
    """检查餐厅是否符合饮食需求"""
    dietary = intent.get("dietary_requirements", [])
    if not dietary:
        return

    for node in nodes:
        if node.get("category") == "dining":
            venue = node.get("venue_name", "")
            # 简单规则判断
            if "素食" in dietary and any(w in venue for w in ["烤肉", "火锅", "烧烤"]):
                issues.append(f"'{venue}' 可能不适合素食需求")
                suggestions.append("建议更换为素食友好的餐厅")


def _check_budget(plan: dict, intent: dict, issues: list, suggestions: list):
    """检查预算是否超标"""
    budget = intent.get("budget_per_person")
    if not budget:
        return

    total = plan.get("total_cost_per_person", 0)
    if total > budget * 1.2:  # 超过预算 20% 就告警
        issues.append(f"预估人均花费 ¥{total:.0f}，超出预算 ¥{budget}")
        suggestions.append("建议选择更经济的替代方案")


def _check_weather_compatible(nodes: list[dict], context: dict, issues: list, suggestions: list):
    """检查室外活动 vs 天气"""
    weather = context.get("weather", "")
    bad_weather = any(w in weather for w in ["暴雨", "大雨", "雷", "暴雪", "台风"])

    if not bad_weather:
        return

    outdoor_keywords = ["公园", "骑行", "徒步", "户外", "湖", "山", "海", "沙滩", "广场"]
    for node in nodes:
        title = node.get("title", "") + (node.get("venue_name") or "")
        if any(kw in title for kw in outdoor_keywords):
            issues.append(f"当前天气 {weather}，'{node.get('title')}' 是户外活动，可能受影响")
            suggestions.append("建议更换为室内活动或准备雨具")


def _check_total_duration(plan: dict, intent: dict, issues: list, suggestions: list):
    """检查总时长是否合理"""
    nodes = plan.get("nodes", [])
    if not nodes:
        return

    try:
        first_start = nodes[0].get("time_start", "14:00")
        last_end = nodes[-1].get("time_end", "18:00")
        h1, m1 = map(int, first_start.split(":"))
        h2, m2 = map(int, last_end.split(":"))
        actual = (h2 - h1) + (m2 - m1) / 60

        expected = intent.get("duration_hours", 4)
        if actual > expected * 1.5:
            issues.append(f"方案实际时长约 {actual:.1f} 小时，超出预期的 {expected} 小时")
            suggestions.append("建议精简行程或调整时间安排")
    except (ValueError, IndexError):
        pass


def _check_group_size(nodes: list[dict], intent: dict, issues: list, suggestions: list):
    """检查场所容量"""
    group_size = intent.get("group_size", 2)
    if group_size > 10:
        for node in nodes:
            if node.get("category") == "dining":
                suggestions.append(f"人数较多（{group_size}人），建议提前确认 '{node.get('venue_name')}' 是否可接待")
