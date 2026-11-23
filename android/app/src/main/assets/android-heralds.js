/*
 * Cookie Clicker Android — Steam player-based Heralds compatibility.
 * Source-only shim: player counts come from the Android app's native HTTPS
 * request, not an in-page CORS workaround or a fabricated constant.
 * No direct Game.Win calls, no modification to save achievements.
 */
(function () {
  'use strict';
  if (!window.Game || window.CookieAndroidHeralds) return;

  var latest = null;
  var lastApplied = -1;
  var patched = false;

  function boundedPlayers(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
        value > 2000000000 || Math.floor(value) !== value) return null;
    return value;
  }

  function refresh() {
    if (!latest || !window.Game || !Game.ready) return;
    var count = Math.max(0, Math.min(100, latest.players / 100));
    var amount = document.getElementById('heraldsAmount');
    // Cookie Clicker's original Steam code uses players/100 internally and
    // displays floor(heralds). Preserve the fractional CpS precision.
    if (Game.heralds !== count || lastApplied !== count) {
      Game.heralds = count;
      Game.recalculateGains = 1;
      if (typeof Game.CalculateGains === 'function') Game.CalculateGains();
      lastApplied = count;
    }
    if (amount && amount.textContent !== String(Math.floor(count))) {
      amount.textContent = String(Math.floor(count));
    }
    Game.externalDataLoaded = true;
    var display = document.getElementById('heralds');
    if (display) {
      display.setAttribute('data-cookie-android-steam-players', String(latest.players));
      display.setAttribute('data-cookie-android-heralds-cached', latest.cached ? 'yes' : 'no');
    }
  }

  function receive(players, queriedAt, cached) {
    var n = boundedPlayers(players);
    if (n === null) return false;
    latest = {players: n, queriedAt: Number(queriedAt) || Date.now(), cached: !!cached};
    refresh();
    return true;
  }

  // The desktop Game.GrabData implementation relies on Steam's Electron App
  // object (or an unavailable relative Patreon URL). Intercept its assignment
  // during Game.Init so the first call doesn't overwrite our actual count.
  // Other gameplay and save functions are untouched.
  if (Object.getOwnPropertyDescriptor(Game, 'GrabData')?.configurable !== false) {
    var intercepted = function () {refresh();};
    Object.defineProperty(Game, 'GrabData', {
      configurable: true, enumerable: true,
      get: function () {return intercepted;},
      set: function () {patched = true;}
    });
  }

  window.CookieAndroidHeralds = {
    receive: receive,
    status: function () {
      if (!latest) return {available:false,patched:patched};
      return {available:true,players:latest.players,
              displayedHeralds:Math.floor(Math.min(100,latest.players / 100)),
              cached:latest.cached,queriedAt:latest.queriedAt,patched:patched};
    }
  };

  // Game.Init/LoadSave may run after the native response or overwrite the
  // saved offline Herald amount. Restore the current count whenever ready.
  setInterval(refresh, 2000);
})();
