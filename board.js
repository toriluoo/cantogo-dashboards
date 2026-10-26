/* Renders ideas_today.json into #ideas. Buttons copy a chat command and
   remember status in localStorage. Nothing here writes the Sheet. */
(function () {
  "use strict";
  var root = document.getElementById("ideas");
  var EN = document.documentElement.lang === "en";
  var src = root && root.getAttribute("data-src");
  var STATUSES = ["proposed", "approved", "in_chat", "qa", "claude", "done", "deferred", "skipped"];
  var LABEL = {
    proposed: ["提议", "proposed"],
    approved: ["已批准", "approved"],
    in_chat: ["聊天出图", "in_chat"],
    qa: ["Vic 审图", "qa"],
    claude: ["Claude HTML", "claude"],
    done: ["已发布", "done"],
    deferred: ["延后", "deferred"],
    skipped: ["跳过", "skipped"]
  };
  var CLS = {
    proposed: "b-neutral",
    approved: "b-blue",
    in_chat: "b-violet",
    qa: "b-warn",
    claude: "b-good",
    done: "b-good",
    deferred: "b-warn",
    skipped: "b-bad"
  };
  var storeKey = "";
  var local = {};
  var data = null;
  var clearBound = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }
  function t(zh, en) { return EN ? en : zh; }
  function statusLabel(st) {
    var pair = LABEL[st] || LABEL.proposed;
    return EN ? pair[1] + " · " + pair[0] : pair[0] + " " + pair[1];
  }
  function signalLabel(sig) {
    if (sig === "High") return EN ? "High" : "强 High";
    if (sig === "Med-High") return EN ? "Med-High" : "中高 Med-High";
    return sig || "";
  }
  function bucket(st) { return st === "skipped" ? 2 : st === "deferred" ? 1 : 0; }
  function statusOf(idea) {
    var hit = local[idea.id];
    if (hit && STATUSES.indexOf(hit) !== -1) return hit;
    return STATUSES.indexOf(idea.status) !== -1 ? idea.status : "proposed";
  }
  function command(verb, idea) { return verb + " " + idea.id + " " + idea.command; }
  function loadStore() {
    try { local = JSON.parse(localStorage.getItem(storeKey) || "{}") || {}; }
    catch (e) { local = {}; }
  }
  function saveStore() {
    try { localStorage.setItem(storeKey, JSON.stringify(local)); } catch (e) {}
  }
  function mailHref(cmd) {
    var body = cmd + "\n\n" + (EN
      ? "Paste this in CantoGo chat."
      : "贴到 CantoGo 聊天。Paste this in CantoGo chat.");
    return "mailto:?subject=" + encodeURIComponent("CantoGo " + cmd) + "&body=" + encodeURIComponent(body);
  }
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 4200);
  }
  function copyText(text) {
    function ok() {
      toast((EN ? "Copied. Paste it in CantoGo chat: " : "已复制。贴到 CantoGo 聊天：") + text);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(ok).catch(function () { fallback(); });
    }
    fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); ok(); }
      catch (e) {
        toast(EN
          ? "Clipboard blocked. Copy the command from the box on the card."
          : "复制被拦住了。请从卡片上的指令框复制。");
      }
      document.body.removeChild(ta);
    }
  }
  function vocabPeek(idea) {
    return (idea.vocab || []).filter(function (v) { return v.peek !== false; });
  }
  function sourceUrl(s) {
    if (s.url) return s.url;
    if (s.shortcode) return "https://www.instagram.com/reel/" + s.shortcode + "/";
    return "";
  }
  function cardHtml(idea) {
    var st = statusOf(idea);
    var peek = vocabPeek(idea);
    var primary = EN ? idea.title_en : idea.title_zh;
    var secondary = EN ? idea.title_zh : idea.title_en;
    var chips = (idea.channels || []).map(function (ch) {
      if (ch === "TikTok" && idea.tiktok_priority) {
        return '<span class="badge b-tt">' + esc(t("TikTok 优先", "TikTok priority")) + "</span>";
      }
      var cls = ch === "TikTok" ? "b-tt" : "b-violet";
      return '<span class="badge ' + cls + '">' + esc(ch) + "</span>";
    }).join("");
    var peekHtml = peek.map(function (v) {
      return "<li><b>" + esc(v.w) + "</b>" +
        (v.j ? '<span class="jp">' + esc(v.j) + "</span>" : '<span class="jp">' + esc(t("粤拼未给", "no Jyutping")) + "</span>") +
        (v.en ? '<span class="gl">' + esc(v.en) + "</span>" : "") + "</li>";
    }).join("");
    var full = (idea.vocab || []).map(function (v) {
      return "<li><span class=\"w\">" + esc(v.w) + "</span><span class=\"j\">" +
        esc(v.j || t("（报告未给）", "(not in report)")) + "</span><span>" + esc(v.en || "—") + "</span>" +
        (v.note_zh || v.note_en ? '<span class="note">' + esc(EN ? (v.note_en || v.note_zh) : (v.note_zh || v.note_en)) + "</span>" : "") +
        "</li>";
    }).join("");
    var srcs = (idea.sources || []).map(function (s) {
      var url = sourceUrl(s);
      var note = EN ? (s.note_en || "") : (s.note_zh || "");
      var label = esc(s.handle || "") + (s.shortcode ? " · " + esc(s.shortcode) : "");
      var inner = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>" : label;
      return "<li>" + inner + (note ? " — " + esc(note) : "") + "</li>";
    }).join("");
    var opts = STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === st ? " selected" : "") + ">" + esc(statusLabel(s)) + "</option>";
    }).join("");
    var approve = command("Approve", idea);
    var slot = EN ? idea.slot_en : idea.slot_zh;
    var why = EN ? idea.why_en : idea.why_zh;
    var detail = EN ? idea.detail_en : idea.detail_zh;
    var format = EN ? idea.format_en : idea.format_zh;
    return '<article class="idea' + (idea.tiktok_priority ? " tt" : "") + (st === "deferred" ? " is-deferred" : "") + (st === "skipped" ? " is-skipped" : "") +
      '" id="idea-' + esc(idea.id) + '" data-id="' + esc(idea.id) + '" data-rank="' + idea.rank + '" data-bucket="' + bucket(st) + '">' +
      '<div class="top"><div class="who"><span class="num">' + idea.rank + "</span><div>" +
      "<h3>" + esc(primary) + '<span class="sub">' + esc(secondary) + "</span></h3>" +
      '<div class="idline">' + esc(idea.id) + " · " + esc(idea.idea_id) + " · " + esc(idea.priority || "") + "</div>" +
      "</div></div>" +
      '<span class="badge ' + CLS[st] + ' st" data-st="' + esc(st) + '">' + esc(statusLabel(st)) + "</span></div>" +
      '<div class="tags"><span class="badge sig-' + esc(idea.signal) + '">' + esc(signalLabel(idea.signal)) + "</span>" + chips + "</div>" +
      (slot ? '<p class="fmt"><span class="lab">' + esc(t("档期", "Slot")) + "</span>" + esc(slot) + "</p>" : "") +
      '<div><div class="idline" style="margin-bottom:6px">' + esc(t("词预览 Vocab", "Vocab peek")) + " · " + peek.length + "</div><ul class=\"peek\">" + peekHtml + "</ul></div>" +
      '<p class="why"><span class="lab">' + esc(t("为什么", "Why")) + "</span>" + esc(why) + "</p>" +
      '<p class="fmt"><span class="lab">' + esc(t("形式", "Format")) + "</span>" + esc(format || "") + "</p>" +
      '<div class="actions">' +
      '<button type="button" class="btn primary" data-verb="Approve">' + esc(t("批准 Approve", "Approve")) + "</button>" +
      '<button type="button" class="btn" data-verb="Defer">' + esc(t("延后 Defer", "Defer")) + "</button>" +
      '<button type="button" class="btn skip" data-verb="Skip">' + esc(t("跳过 Skip", "Skip")) + "</button>" +
      '<a class="btn mail" href="' + esc(mailHref(approve)) + '">' + esc(t("用邮件打开", "Open in email")) + "</a>" +
      "</div>" +
      '<div class="local"><label for="st-' + esc(idea.id) + '">' + esc(t("本机进度", "Local status")) + "</label>" +
      '<select id="st-' + esc(idea.id) + '" data-status>' + opts + "</select>" +
      '<input class="cmd" readonly value="' + esc(approve) + '" aria-label="' + esc(t("聊天指令", "Chat command")) + '"></div>' +
      "<details class=\"full\"><summary>" + esc(t("全部词汇 + 粤拼", "Full vocab + Jyutping")) + " (" + (idea.vocab || []).length + ")</summary>" +
      "<ul class=\"vlist\">" + full + "</ul>" +
      (detail ? '<p class="why">' + esc(detail) + "</p>" : "") +
      (srcs ? '<p class="idline">' + esc(t("信号来源", "Signal sources")) + "</p><ul class=\"srcs\">" + srcs + "</ul>" : "") +
      "</details></article>";
  }
  function tally() {
    var el = document.getElementById("tally");
    if (!el || !data) return;
    var counts = {};
    STATUSES.forEach(function (s) { counts[s] = 0; });
    data.ideas.forEach(function (idea) { counts[statusOf(idea)] += 1; });
    var bits = data.ideas.length + (EN ? " ideas" : " 条");
    ["proposed", "approved", "in_chat", "qa", "claude", "done", "deferred", "skipped"].forEach(function (s) {
      if (!counts[s]) return;
      bits += " · " + statusLabel(s) + " " + counts[s];
    });
    el.textContent = bits;
  }
  function place(article) {
    var list = root;
    var b = +article.dataset.bucket;
    var r = +article.dataset.rank;
    var before = null;
    Array.prototype.forEach.call(list.children, function (k) {
      if (before || k === article) return;
      var kb = +k.dataset.bucket;
      var kr = +k.dataset.rank;
      if (kb > b || (kb === b && kr > r)) before = k;
    });
    list.insertBefore(article, before);
  }
  function applyStatus(article, st, idea, verb) {
    article.dataset.bucket = String(bucket(st));
    article.classList.toggle("is-deferred", st === "deferred");
    article.classList.toggle("is-skipped", st === "skipped");
    var badge = article.querySelector(".st");
    badge.className = "badge st " + CLS[st];
    badge.dataset.st = st;
    badge.textContent = statusLabel(st);
    var sel = article.querySelector("[data-status]");
    if (sel.value !== st) sel.value = st;
    var cmd = command(verb || (st === "deferred" ? "Defer" : st === "skipped" ? "Skip" : st === "approved" ? "Approve" : "Approve"), idea);
    if (verb) {
      article.querySelector(".cmd").value = command(verb, idea);
      article.querySelector(".mail").href = mailHref(command(verb, idea));
    }
    place(article);
    tally();
  }
  function setStatus(idea, st, verb) {
    local[idea.id] = st;
    saveStore();
    var article = document.getElementById("idea-" + idea.id);
    if (article) applyStatus(article, st, idea, verb || null);
  }
  function render(payload) {
    data = payload;
    storeKey = "cg-ideas-board:" + (data.date || "day");
    loadStore();
    var ideas = (data.ideas || []).slice().sort(function (a, b) { return a.rank - b.rank; });
    root.innerHTML = ideas.map(cardHtml).join("") || '<div class="empty">' + esc(t("今天没有选题。", "No ideas in this file.")) + "</div>";
    ideas.forEach(function (idea) {
      var article = document.getElementById("idea-" + idea.id);
      if (!article) return;
      place(article);
      article.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-verb]");
        if (!btn) return;
        var verb = btn.getAttribute("data-verb");
        var next = verb === "Approve" ? "approved" : verb === "Defer" ? "deferred" : "skipped";
        var cmd = command(verb, idea);
        setStatus(idea, next, verb);
        copyText(cmd);
      });
      article.querySelector("[data-status]").addEventListener("change", function (e) {
        setStatus(idea, e.target.value, null);
        toast(EN
          ? "Local mark only (" + idea.id + " → " + e.target.value + "). The Sheet is unchanged."
          : "只改了本机标记（" + idea.id + " → " + e.target.value + "）。没有写入 Sheet。");
      });
      article.querySelector(".cmd").addEventListener("focus", function (e) { e.target.select(); });
    });
    var night = document.getElementById("tonightText");
    if (night) night.textContent = EN ? (data.tonight_en || night.textContent) : (data.tonight_zh || night.textContent);
    var note = document.getElementById("jpNote");
    if (note) note.textContent = EN ? (data.jyutping_note_en || "") : (data.jyutping_note_zh || "");
    var dateBox = document.getElementById("boardDate");
    if (dateBox && data.date) {
      var parts = String(data.date).split("-");
      var dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
      var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
      var wdz = "日一二三四五六"[dt.getUTCDay()];
      dateBox.textContent = EN ? wd + " " + data.date : data.date + " 周" + wdz;
    }
    tally();
    var clear = document.getElementById("clearLocal");
    if (clear && !clearBound) {
      clearBound = true;
      clear.addEventListener("click", function () {
        local = {};
        saveStore();
        render(data);
        toast(EN ? "Local marks cleared. Cards follow ideas_today.json again." : "本机标记已清除。卡片回到 ideas_today.json 里的状态。");
      });
    }
  }
  function fail(msg) {
    root.innerHTML = '<div class="empty">' + esc(msg) + "</div>";
  }
  if (!root || !src) return;
  fetch(src, {cache: "no-store"}).then(function (r) {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then(render).catch(function () {
    fail(t(
      "读不到 ideas_today.json。用本地服务器打开这个页面（不要用 file://）。",
      "Could not load ideas_today.json. Open this page from a local server, not file://."
    ));
  });
})();
