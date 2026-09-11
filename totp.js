"use strict";

const crypto = require("crypto");
const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) { out += ALPH[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/=+$/g, "");
  let bits = 0, value = 0; const out = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = ALPH.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const bin = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1000000).padStart(6, "0");
}
function generateSecret() { return base32Encode(crypto.randomBytes(20)); }
function verify(secret, code, window) {
  const clean = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 30000);
  const w = window == null ? 1 : window;
  for (let i = -w; i <= w; i++) if (hotp(key, now + i) === clean) return true;
  return false;
}
function otpauth(username, secret) {
  return "otpauth://totp/YardGate:" + encodeURIComponent(username) + "?secret=" + secret + "&issuer=YardGate&digits=6&period=30";
}
module.exports = { generateSecret, verify, otpauth };
