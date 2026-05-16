(function () {
  "use strict";

  const API_BASE = window.location.origin;
  const POLL_INTERVAL = 5000;
  const CATEGORY_LABELS = {
    activity: "活动",
    dining: "餐饮",
    transport: "交通",
    rest: "休息",
  };
  const VOTE_OPTIONS = [
    { key: "love", emoji: "❤️", label: "Love" },
    { key: "ok", emoji: "👍", label: "OK" },
    { key: "concern", emoji: "🤔", label: "有顾虑" },
    { key: "reject", emoji: "❌", label: "不行" },
  ];

  /* ---------- State ---------- */
  let planId = null;
  let planData = null;
  let nickname = "";
  let votes = {};          // { nodeId: "love" | "ok" | "concern" | "reject" }
  let hasSubmitted = false;
  let pollTimer = null;

  /* ---------- DOM refs ---------- */
  const $loading = document.getElementById("loadingScreen");
  const $error = document.getElementById("errorScreen");
  const $errorMsg = document.getElementById("errorMsg");
  const $main = document.getElementById("mainContent");
  const $planTitle = document.getElementById("planTitle");
  const $planHighlight = document.getElementById("planHighlight");
  const $planCost = document.getElementById("planCost");
  const $planDuration = document.getElementById("planDuration");
  const $planCount = document.getElementById("planCount");
  const $nicknameInput = document.getElementById("nicknameInput");
  const $nicknameConfirm = document.getElementById("nicknameConfirm");
  const $nicknameSection = document.getElementById("nicknameSection");
  const $timeline = document.getElementById("timeline");
  const $resultsContainer = document.getElementById("resultsContainer");
  const $submitBtn = document.getElementById("submitVoteBtn");
  const $submitHint = document.getElementById("submitHint");
  const $submitArea = document.getElementById("submitArea");
  const $votedBanner = document.getElementById("votedBanner");

  /* ---------- Init ---------- */
  function init() {
    planId = new URLSearchParams(window.location.search).get("id");
    if (!planId) {
      showError("缺少方案 ID，请检查链接");
      return;
    }

    const stored = localStorage.getItem("weplan_vote_" + planId);
    if (stored) {
      hasSubmitted = true;
    }

    loadPlan();
    bindEvents();
  }

  /* ---------- API ---------- */
  async function loadPlan() {
    try {
      const resp = await fetch(API_BASE + "/api/plan/" + planId);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      planData = await resp.json();
      renderPlan();
      $loading.style.display = "none";
      $main.style.display = "block";
      startPolling();
    } catch (e) {
      showError("加载失败: " + e.message);
    }
  }

  async function submitVotes() {
    if (!nickname || Object.keys(votes).length === 0) return;

    $submitBtn.disabled = true;
    $submitBtn.textContent = "提交中...";

    try {
      const votePayloads = Object.entries(votes).map(([nodeId, voteType]) => ({
        voter_name: nickname,
        plan_id: planId,
        node_id: nodeId,
        vote_type: mapVoteType(voteType),
        comment: null,
      }));

      for (const payload of votePayloads) {
        const resp = await fetch(API_BASE + "/api/vote/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error("投票失败");
      }

      hasSubmitted = true;
      localStorage.setItem("weplan_vote_" + planId, JSON.stringify({
        nickname: nickname,
        votes: votes,
        time: Date.now(),
      }));

      disableAllVoting();
      $submitArea.style.display = "none";
      $votedBanner.style.display = "flex";
      fetchResults();
    } catch (e) {
      $submitBtn.disabled = false;
      $submitBtn.textContent = "提交投票";
      alert("投票提交失败，请重试: " + e.message);
    }
  }

  async function fetchResults() {
    try {
      const resp = await fetch(API_BASE + "/api/vote/" + planId);
      if (!resp.ok) return;
      const data = await resp.json();
      renderResults(data);
    } catch (_) {
      // silent
    }
  }

  function mapVoteType(key) {
    const map = { love: "approve", ok: "neutral", concern: "neutral", reject: "reject" };
    return map[key] || "neutral";
  }

  /* ---------- Polling ---------- */
  function startPolling() {
    fetchResults();
    pollTimer = setInterval(fetchResults, POLL_INTERVAL);
  }

  /* ---------- Render ---------- */
  function renderPlan() {
    const plan = planData.plans ? planData.plans[0] : planData;
    $planTitle.textContent = plan.title || "周末方案";
    $planHighlight.textContent = plan.highlight || plan.summary || "";
    $planCost.textContent = "¥" + (plan.total_cost_per_person || 0);
    $planDuration.textContent = (plan.total_duration_hours || 0) + "小时";
    $planCount.textContent = (plan.nodes || []).length;

    $timeline.innerHTML = "";
    (plan.nodes || []).forEach(function (node) {
      $timeline.appendChild(createNodeCard(node));
    });

    if (hasSubmitted) {
      disableAllVoting();
      $submitArea.style.display = "none";
      $votedBanner.style.display = "flex";
      $nicknameInput.disabled = true;
      $nicknameConfirm.disabled = true;
    }
  }

  function createNodeCard(node) {
    var el = document.createElement("div");
    el.className = "tl-node";
    el.dataset.category = node.category || "activity";
    el.dataset.nodeId = node.node_id;

    var categoryLabel = CATEGORY_LABELS[node.category] || node.category || "";
    var venueHtml = node.venue_name
      ? '<div class="tl-venue">📍 ' + escapeHtml(node.venue_name) + "</div>"
      : "";
    var costHtml =
      node.cost_per_person > 0
        ? '<div class="tl-cost">💰 ¥' + node.cost_per_person + "/人</div>"
        : "";

    var voteBtnsHtml = VOTE_OPTIONS.map(function (opt) {
      return (
        '<button class="vote-btn" data-vote="' + opt.key +
        '" data-node="' + node.node_id + '">' +
        '<span class="vote-emoji">' + opt.emoji + "</span>" +
        '<span class="vote-label">' + opt.label + "</span>" +
        "</button>"
      );
    }).join("");

    el.innerHTML =
      '<div class="tl-dot"></div>' +
      '<div class="tl-card">' +
      '<div class="tl-card-header">' +
      '<span class="tl-time">' + escapeHtml(node.time_start) + " - " + escapeHtml(node.time_end) + "</span>" +
      '<span class="tl-category">' + escapeHtml(categoryLabel) + "</span>" +
      "</div>" +
      '<div class="tl-title">' + escapeHtml(node.title) + "</div>" +
      (node.description ? '<div class="tl-desc">' + escapeHtml(node.description) + "</div>" : "") +
      venueHtml +
      costHtml +
      '<div class="vote-buttons">' + voteBtnsHtml + "</div>" +
      "</div>";

    return el;
  }

  function renderResults(data) {
    if (!data || !data.node_votes || Object.keys(data.node_votes).length === 0) {
      if (data && data.total_votes > 0) {
        renderOverallResults(data);
      }
      return;
    }

    var plan = planData.plans ? planData.plans[0] : planData;
    var nodeMap = {};
    (plan.nodes || []).forEach(function (n) {
      nodeMap[n.node_id] = n;
    });

    var html = "";

    if (data.total_votes > 0) {
      html += '<div class="result-voters">';
      html += '<div class="result-voters-title">已有 ' + data.total_votes + " 票</div>";
      html += "</div>";
      html += '<div class="result-divider"></div>';
    }

    Object.keys(data.node_votes).forEach(function (nodeId) {
      var nodeInfo = nodeMap[nodeId];
      var nodeName = nodeInfo ? nodeInfo.title : nodeId;
      var counts = data.node_votes[nodeId];
      var total =
        (counts.approve || 0) + (counts.reject || 0) + (counts.neutral || 0);
      if (total === 0) return;

      html += '<div class="result-node">';
      html += '<div class="result-node-title">' + escapeHtml(nodeName) + "</div>";
      html += '<div class="result-bars">';
      html += renderBar("❤️👍", "ok", (counts.approve || 0) + (counts.neutral || 0), total);
      html += renderBar("❌", "reject", counts.reject || 0, total);
      html += "</div></div>";
    });

    if (html) {
      $resultsContainer.innerHTML = html;
    }
  }

  function renderOverallResults(data) {
    var total = data.total_votes;
    var html =
      '<div class="result-node">' +
      '<div class="result-node-title">整体投票</div>' +
      '<div class="result-bars">' +
      renderBar("👍 赞成", "ok", data.approve_count || 0, total) +
      renderBar("🤔 中立", "concern", data.neutral_count || 0, total) +
      renderBar("❌ 反对", "reject", data.reject_count || 0, total) +
      "</div></div>";
    $resultsContainer.innerHTML = html;
  }

  function renderBar(label, type, count, total) {
    var pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      '<div class="result-bar-row">' +
      '<span class="result-bar-label">' + label + "</span>" +
      '<div class="result-bar-track">' +
      '<div class="result-bar-fill ' + type + '" style="width:' + pct + '%"></div>' +
      "</div>" +
      '<span class="result-bar-count">' + count + "</span>" +
      "</div>"
    );
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    $nicknameConfirm.addEventListener("click", confirmNickname);
    $nicknameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") confirmNickname();
    });

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".vote-btn");
      if (!btn || btn.disabled) return;
      handleVote(btn);
    });

    $submitBtn.addEventListener("click", submitVotes);
  }

  function confirmNickname() {
    var val = $nicknameInput.value.trim();
    if (!val) {
      $nicknameInput.focus();
      return;
    }
    nickname = val;
    $nicknameInput.disabled = true;
    $nicknameConfirm.disabled = true;
    $nicknameConfirm.textContent = "✓";
    updateSubmitState();
  }

  function handleVote(btn) {
    if (!nickname) {
      $nicknameInput.focus();
      shakeElement($nicknameSection);
      return;
    }

    var nodeId = btn.dataset.node;
    var voteType = btn.dataset.vote;

    var siblings = btn.parentElement.querySelectorAll(".vote-btn");
    siblings.forEach(function (s) {
      s.classList.remove("selected");
    });
    btn.classList.add("selected");
    votes[nodeId] = voteType;
    updateSubmitState();
  }

  function updateSubmitState() {
    if (!planData) return;
    var plan = planData.plans ? planData.plans[0] : planData;
    var totalNodes = (plan.nodes || []).length;
    var votedNodes = Object.keys(votes).length;

    if (nickname && votedNodes === totalNodes) {
      $submitBtn.disabled = false;
      $submitHint.textContent = "已完成所有投票，点击提交";
    } else if (nickname && votedNodes > 0) {
      $submitBtn.disabled = false;
      $submitHint.textContent = "已投 " + votedNodes + "/" + totalNodes + " 项";
    } else {
      $submitBtn.disabled = true;
      if (!nickname) {
        $submitHint.textContent = "请先输入昵称";
      } else {
        $submitHint.textContent = "请为活动投票";
      }
    }
  }

  function disableAllVoting() {
    document.querySelectorAll(".vote-btn").forEach(function (btn) {
      btn.disabled = true;
    });
  }

  /* ---------- Helpers ---------- */
  function showError(msg) {
    $loading.style.display = "none";
    $error.style.display = "flex";
    $errorMsg.textContent = msg;
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function shakeElement(el) {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "shake 0.4s ease";
    setTimeout(function () {
      el.style.animation = "";
    }, 500);
  }

  var style = document.createElement("style");
  style.textContent =
    "@keyframes shake { 0%,100% { transform:translateX(0) } " +
    "20%,60% { transform:translateX(-6px) } 40%,80% { transform:translateX(6px) } }";
  document.head.appendChild(style);

  /* ---------- Start ---------- */
  init();
})();
