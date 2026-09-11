"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server: WebSocketServer } = require("./ws-lite");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, "lots-state.json");
const EXTEND_MS = 2 * 60 * 1000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function loadState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(lots) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(lots, null, 2));
}

let lots = loadState();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, lots: Object.keys(lots).length }));
    return;
  }
  if (req.url === "/api/lots") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(lots));
    return;
  }
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer();
server.on("upgrade", (req, socket) => {
  const url = req.url || "";
  if (!url.startsWith("/ws")) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket);
});

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function broadcast(payload, except) {
  const raw = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client !== except && client.readyState === 1) client.send(raw);
  });
}

wss.on("connection", (ws) => {
  send(ws, { type: "state", lots, buyers: wss.clients.size });
  broadcast({ type: "presence", buyers: wss.clients.size }, ws);

  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch { send(ws, { type: "error", message: "Bad packet" }); return; }

    if (msg.type === "hello") {
      send(ws, { type: "state", lots, buyers: wss.clients.size });
      return;
    }

    if (msg.type !== "bid") {
      send(ws, { type: "error", message: "Unknown packet" });
      return;
    }

    const lotId = String(msg.lotId || "");
    const lot = lots[lotId];
    if (!lot) { send(ws, { type: "error", message: "Lot not on the board" }); return; }

    const now = Date.now();
    const end = Date.parse(lot.end);
    if (end <= now || lot.status === "closed") {
      lot.status = "closed";
      send(ws, { type: "error", message: "Lot is closed" });
      send(ws, { type: "lot", lot });
      return;
    }
    if (lot.status === "soon") {
      send(ws, { type: "error", message: "Lot has not opened" });
      return;
    }

    const amount = Number(msg.amount);
    const step = Number(lot.step) || 25;
    if (!Number.isFinite(amount) || amount < lot.price + step) {
      send(ws, { type: "error", message: "Bid must be at least $" + (lot.price + step) });
      return;
    }

    const name = String(msg.name || "Floor").slice(0, 40);
    lot.price = Math.round(amount);
    lot.bidder = name;
    lot.status = "live";
    if (end - now < EXTEND_MS) {
      lot.end = new Date(now + EXTEND_MS).toISOString();
    }

    saveState(lots);
    const packet = { type: "lot", lot };
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(JSON.stringify(packet));
    });
  });

  ws.on("close", () => {
    broadcast({ type: "presence", buyers: wss.clients.size });
  });
});

server.listen(PORT, () => {
  console.log("Yard Gate clerk on http://localhost:" + PORT);
  console.log("WebSocket path ws://localhost:" + PORT + "/ws");
});
