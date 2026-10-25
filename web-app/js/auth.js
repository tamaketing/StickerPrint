/* การล็อกอินอย่างง่าย (ฝั่งเบราว์เซอร์)
 * เก็บเฉพาะ "เวลาหมดอายุ" ไม่ได้เก็บรหัสผ่าน
 * หมายเหตุ: เป็นการกันคนทั่วไป ไม่ใช่ระบบความปลอดภัยระดับเซิร์ฟเวอร์ */
(function (global) {
  "use strict";

  var CFG = global.APP_CONFIG || {};
  var SESSION_KEY = "sp_auth_session";
  var REMEMBER_KEY = "sp_auth_remember";

  function storage(name) {
    try { return global[name] || null; } catch (e) { return null; }
  }

  function safeGet(store, key) {
    if (!store) return null;
    try { return store.getItem(key); } catch (e) { return null; }
  }
  function safeSet(store, key, value) {
    if (!store) return false;
    try { store.setItem(key, value); return true; } catch (e) { return false; }
  }
  function safeRemove(store, key) {
    if (!store) return;
    try { store.removeItem(key); } catch (e) { /* ignore */ }
  }

  function makeToken(hours) {
    var exp = Date.now() + hours * 3600 * 1000;
    return JSON.stringify({ exp: exp, sig: global.sha256Hex((CFG.passwordHash || "") + "|" + exp) });
  }

  function parseToken(raw) {
    if (!raw) return null;
    try {
      var t = JSON.parse(raw);
      if (!t || typeof t.exp !== "number") return null;
      if (t.exp <= Date.now()) return null;
      var expected = global.sha256Hex((CFG.passwordHash || "") + "|" + t.exp);
      if (t.sig !== expected) return null;
      return t;
    } catch (e) {
      return null;
    }
  }

  function currentToken() {
    var t = parseToken(safeGet(storage("sessionStorage"), SESSION_KEY));
    if (t) return t;
    t = parseToken(safeGet(storage("localStorage"), REMEMBER_KEY));
    return t || null;
  }

  function isAuthed() {
    return !!currentToken();
  }

  function login(password, remember) {
    var hash = global.sha256Hex(String(password == null ? "" : password));
    if (hash !== String(CFG.passwordHash || "").toLowerCase()) {
      return { ok: false, message: "รหัสผ่านไม่ถูกต้อง" };
    }

    var hours = remember
      ? (CFG.rememberDays || 30) * 24
      : (CFG.sessionHours || 12);

    var token = makeToken(hours);
    var sessionStore = storage("sessionStorage");
    var localStore = storage("localStorage");

    if (remember) {
      safeRemove(sessionStore, SESSION_KEY);
      if (!safeSet(localStore, REMEMBER_KEY, token)) {
        safeSet(sessionStore, SESSION_KEY, token);
      }
    } else {
      safeRemove(localStore, REMEMBER_KEY);
      if (!safeSet(sessionStore, SESSION_KEY, token)) {
        safeSet(localStore, REMEMBER_KEY, token);
      }
    }
    return { ok: true };
  }

  function logout() {
    safeRemove(storage("sessionStorage"), SESSION_KEY);
    safeRemove(storage("localStorage"), REMEMBER_KEY);
  }

  global.Auth = {
    isAuthed: isAuthed,
    login: login,
    logout: logout,
    expiresAt: function () {
      var t = currentToken();
      return t ? new Date(t.exp) : null;
    }
  };
})(window);
