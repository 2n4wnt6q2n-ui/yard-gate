(function () {
  var WS_PATH = (function () {
    if (window.YARD_GATE_WS) return window.YARD_GATE_WS;
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/ws";
  })();
  function pad(n) { return String(n).padStart(2, "0"); }
  function formatRemain(ms) {
    if (ms <= 0) return "Closed";
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    if (d > 0) return d + "d " + pad(h) + ":" + pad(m) + ":" + pad(s);
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  function money(n) { return "$" + Number(n).toLocaleString(); }
  function bidderName() {
    try { var stored = localStorage.getItem("yardgate-bidder"); if (stored) return stored; } catch (e) {}
    return "";
  }
  function setBidderName(name) { try { localStorage.setItem("yardgate-bidder", name); } catch (e) {} }
  function ensureName() {
    var n = bidderName();
    if (n) return n;
    n = (window.prompt("Buyer name on this desk", "Floor") || "Floor").slice(0, 40);
    setBidderName(n);
    return n;
  }
  function cardFor(id) { return document.querySelector('.lot[data-lot="' + id + '"]'); }
  function applyLot(lot) {
    var card = cardFor(lot.id);
    if (!card) return;
    var priceEl = card.querySelector("[data-price]");
    var timer = card.querySelector("[data-end]");
    var tag = card.querySelector(".tag");
    var btn = card.querySelector("[data-bid]");
    var note = card.querySelector("[data-last]");
    var input = card.querySelector("[data-offer]");
    var end = Date.parse(lot.end);
    var closed = !end || end <= Date.now() || lot.status === "closed";
    if (priceEl) { priceEl.setAttribute("data-price", String(lot.price)); priceEl.textContent = money(lot.price); }
    if (timer) timer.setAttribute("data-end", lot.end);
    if (btn) {
      btn.setAttribute("data-step", String(lot.step || 25));
      btn.disabled = closed || lot.status === "soon";
      btn.textContent = closed ? "Lot closed" : lot.status === "soon" ? "Not open" : "Place bid";
    }
    if (input) {
      input.min = lot.price + (lot.step || 25);
      input.step = lot.step || 25;
      input.placeholder = String(lot.price + (lot.step || 25));
    }
    if (tag) {
      if (closed) { tag.textContent = "Closed"; tag.className = "tag done"; }
      else if (lot.status === "soon") { tag.textContent = "Opens"; tag.className = "tag soon"; }
      else { tag.textContent = "Live"; tag.className = "tag"; }
    }
    if (note) {
      note.textContent = lot.bidder ? "High bidder " + lot.bidder + " · raise " + money(lot.step) : "Raise " + money(lot.step);
    }
  }
  function tick() {
    document.querySelectorAll("[data-end]").forEach(function (el) {
      var end = Date.parse(el.getAttribute("data-end"));
      if (!end) return;
      var left = end - Date.now();
      el.textContent = formatRemain(left);
      el.classList.toggle("urgent", left > 0 && left < 15 * 60 * 1000);
      if (left <= 0) {
        var card = el.closest(".lot");
        if (!card) return;
        var tag = card.querySelector(".tag");
        var btn = card.querySelector("[data-bid]");
        if (tag) { tag.textContent = "Closed"; tag.className = "tag done"; }
        if (btn) { btn.disabled = true; btn.textContent = "Lot closed"; }
      }
    });
  }
  var statusEl = document.querySelector("[data-ws-status]");
  var socket = null;
  var retry = 0;
  function setStatus(text, ok) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.state = ok ? "live" : "down";
  }
  function connect() {
    try { socket = new WebSocket(WS_PATH); }
    catch (e) { setStatus("Clerk offline — start the Yard Gate server", false); return; }
    socket.addEventListener("open", function () {
      retry = 0;
      setStatus("Clerk live — bids go to every desk", true);
      socket.send(JSON.stringify({ type: "hello" }));
    });
    socket.addEventListener("message", function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "state" && msg.lots) {
        Object.keys(msg.lots).forEach(function (id) { applyLot(msg.lots[id]); });
        if (typeof msg.buyers === "number" && statusEl) {
          setStatus("Clerk live · " + msg.buyers + " desk" + (msg.buyers === 1 ? "" : "s"), true);
        }
      }
      if (msg.type === "lot" && msg.lot) applyLot(msg.lot);
      if (msg.type === "presence" && statusEl && typeof msg.buyers === "number") {
        setStatus("Clerk live · " + msg.buyers + " desk" + (msg.buyers === 1 ? "" : "s"), true);
      }
      if (msg.type === "error") {
        var flash = document.querySelector("[data-ws-error]");
        if (flash) flash.textContent = msg.message;
      }
    });
    socket.addEventListener("close", function () {
      setStatus("Clerk reconnecting…", false);
      retry += 1;
      setTimeout(connect, Math.min(8000, 600 * retry));
    });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-bid]");
    if (!btn || btn.disabled) return;
    var card = btn.closest(".lot");
    if (!card) return;
    var lotId = card.getAttribute("data-lot");
    var priceEl = card.querySelector("[data-price]");
    var input = card.querySelector("[data-offer]");
    var step = Number(btn.getAttribute("data-step") || 25);
    var current = Number(priceEl && priceEl.getAttribute("data-price"));
    var offer = input && input.value ? Number(input.value) : current + step;
    if (!(offer >= current + step)) {
      if (input) input.setAttribute("aria-invalid", "true");
      return;
    }
    if (input) input.removeAttribute("aria-invalid");
    if (!socket || socket.readyState !== 1) {
      setStatus("Clerk is down — bid not sent", false);
      return;
    }
    socket.send(JSON.stringify({ type: "bid", lotId: lotId, amount: offer, name: ensureName() }));
    if (input) input.value = "";
  });
  tick();
  setInterval(tick, 1000);
  connect();
})();
