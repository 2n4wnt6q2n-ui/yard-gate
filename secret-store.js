"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const KEY_FILE = path.join(__dirname, "totp.key");
const VAULT_FILE = path.join(__dirname, "totp-secrets.json");
function loadKey() {
  if (process.env.TOTP_MASTER_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.TOTP_MASTER_KEY)) {
    return Buffer.from(process.env.TOTP_MASTER_KEY, "hex");
  }
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE);
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}
function loadVault() { try { return JSON.parse(fs.readFileSync(VAULT_FILE, "utf8")); } catch (e) { return {}; } }
function saveVault(vault) { fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), { mode: 0o600 }); }
function encrypt(plain) {
  const key = loadKey(); const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + cipher.getAuthTag().toString("hex") + ":" + enc.toString("hex");
}
function decrypt(blob) {
  if (!blob || blob.indexOf(":") < 0) return "";
  const parts = String(blob).split(":"); if (parts.length !== 3) return "";
  const key = loadKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[0], "hex"));
  decipher.setAuthTag(Buffer.from(parts[1], "hex"));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "hex")), decipher.final()]).toString("utf8");
}
function put(username, field, plain) {
  const vault = loadVault(); const row = vault[username] || {};
  if (!plain) delete row[field]; else row[field] = encrypt(plain);
  if (!Object.keys(row).length) delete vault[username]; else vault[username] = row;
  saveVault(vault);
}
function get(username, field) {
  const row = loadVault()[username]; if (!row || !row[field]) return "";
  try { return decrypt(row[field]); } catch (e) { return ""; }
}
function clear(username) { const vault = loadVault(); delete vault[username]; saveVault(vault); }
function migrateFromAccount(user) {
  if (!user || !user.username) return;
  if (user.totpSecret) { put(user.username, "secret", user.totpSecret); user.totpSecret = ""; }
  if (user.totpPending) { put(user.username, "pending", user.totpPending); user.totpPending = ""; }
}
module.exports = { put, get, clear, migrateFromAccount };
