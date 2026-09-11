(function () {
  var KEY = "yardgate-session";
  function session() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function api(path, method, body) {
    var s = session();
    var headers = { "Content-Type": "application/json" };
    if (s && s.token) headers.Authorization = "Bearer " + s.token;
    return fetch(path, { method: method || "GET", headers: headers, body: body ? JSON.stringify(body) : undefined }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Desk error");
        return data;
      });
    });
  }
  function paintNav() {
    var slot = document.querySelector("[data-account-slot]");
    if (!slot) return;
    var s = session();
    slot.innerHTML = (s && s.user) ? '<a href="desk.html">@' + s.user.username + "</a>" : '<a href="join.html">Join</a>';
  }
  window.YardGateAccount = {
    session: session,
    username: function () { return session() && session().user && session().user.username; },
    token: function () { return session() && session().token; },
    register: function (fields) { return api("/api/register", "POST", fields); },
    resendVerify: function (fields) { return api("/api/resend-verify", "POST", fields); },
    login: function (fields) {
      return api("/api/login", "POST", fields).then(function (data) { if (data.token) save(data); return data; });
    },
    finish2fa: function (pending, code) {
      return api("/api/2fa/login", "POST", { pending: pending, code: code }).then(function (data) { save(data); return data; });
    },
    setup2fa: function () { return api("/api/2fa/setup", "POST", {}); },
    confirm2fa: function (code) {
      return api("/api/2fa/confirm", "POST", { code: code }).then(function (data) {
        var s = session(); if (s) save({ token: s.token, user: data.user }); return data;
      });
    },
    payFee: function () { return api("/api/fee", "POST", {}).then(function (data) { save({ token: session().token, user: data.user }); return data; }); },
    setPrice: function (lotId, price, step) { return api("/api/lots/" + lotId + "/price", "PATCH", { price: price, step: step }); },
    listLot: function (fields) { return api("/api/lots", "POST", fields); },
    setBuyUse: function (buyUse) {
      return api("/api/buy-use", "PATCH", { buyUse: buyUse }).then(function (data) {
        var s = session(); if (s) save({ token: s.token, user: data.user }); return data;
      });
    },
    logout: function () { clear(); window.location.href = "index.html"; },
    api: api
  };
  paintNav();
})();
