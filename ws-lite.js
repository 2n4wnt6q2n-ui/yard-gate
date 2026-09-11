"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function acceptKey(key) {
  return crypto.createHash("sha1").update(key + GUID).digest("base64");
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 15;
  const masked = (buf[1] & 128) !== 0;
  let len = buf[1] & 127;
  let offset = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (masked) offset += 4;
  if (buf.length < offset + len) return null;
  let payload = buf.subarray(offset, offset + len);
  if (masked) {
    const mask = buf.subarray(offset - 4, offset);
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
    payload = out;
  }
  return { opcode, payload, rest: buf.subarray(offset + len) };
}

function encodeText(text) {
  const payload = Buffer.from(text, "utf8");
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeClose() {
  const header = Buffer.alloc(2);
  header[0] = 0x88;
  header[1] = 0;
  return header;
}

class Socket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.readyState = 1;
    this._buf = Buffer.alloc(0);
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("close", () => { this.readyState = 3; this.emit("close"); });
    socket.on("error", () => { this.readyState = 3; this.emit("close"); });
  }
  send(text) {
    if (this.readyState !== 1) return;
    this.socket.write(encodeText(text));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 2;
    try { this.socket.write(encodeClose()); } catch (e) {}
    this.socket.end();
  }
  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (true) {
      const frame = decodeFrame(this._buf);
      if (!frame) break;
      this._buf = frame.rest;
      if (frame.opcode === 8) { this.close(); return; }
      if (frame.opcode === 9) {
        const pong = Buffer.from([0x8a, frame.payload.length]);
        this.socket.write(Buffer.concat([pong, frame.payload]));
        continue;
      }
      if (frame.opcode === 1) this.emit("message", frame.payload);
    }
  }
}

class Server extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }
  handleUpgrade(req, socket) {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Accept: " + acceptKey(key),
      "",
      "",
    ].join("\r\n");
    socket.write(headers);
    const ws = new Socket(socket);
    this.clients.add(ws);
    ws.on("close", () => {
      this.clients.delete(ws);
      this.emit("close", ws);
    });
    this.emit("connection", ws);
  }
}

module.exports = { Server };
