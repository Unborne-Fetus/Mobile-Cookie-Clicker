/* Cookie Clicker Android: loads mods copied from a user's Steam installation at APK build time.
 * Does not modify Cookie Clicker's source or include any third-party mod payload.
 * On-screen manager is integrated into the game's own Options page and prompt UI.
 * The original Electron/Steam Workshop manager cannot execute inside Android WebView.
 */
(function () {
  'use strict';
  if (window.CookieSteamMods || !window.Game || typeof Game.Launch !== 'function') return;
  var STORAGE_KEY = 'cookiePort.steamSnapshot.v1';
  var list = [];
  var preferences = { enabled: {}, order: [] };
  var lastReport = [];
  var loaded = [];
  var catalogPromise = fetch('/assets/mods/catalog.json', { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Mod catalog not packaged');
    return response.json();
  }).then(function (data) {
    list = Array.isArray(data.mods) ? data.mods.filter(function (m) {
      return typeof m.id === 'string' && typeof m.key === 'string';
    }) : [];
    readPreferences();
  }).catch(function (e) {
    lastReport.push(String(e.message || e));
    list = [];
    readPreferences();
  });

  function readPreferences() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        if (saved.enabled && typeof saved.enabled === 'object') preferences.enabled = saved.enabled;
        if (Array.isArray(saved.order)) preferences.order = saved.order;
      }
    } catch (e) { lastReport.push('Bad saved mod settings; using package defaults.'); }
  }
  function writePreferences() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); }
    catch (e) { lastReport.push('Could not save mod configuration: ' + e.message); }
  }
  function isEnabled(mod) {
    return Object.prototype.hasOwnProperty.call(preferences.enabled, mod.key)
      ? !!preferences.enabled[mod.key] : !!mod.enabledDefault;
  }
  function idKey(id) { return String(id).replace(/\W+/g, ' ').trim().toLowerCase(); }
  function byKey(key) { return list.find(function (m) { return m.key === key; }); }
  function htmlEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function ordered() {
    var score = {};
    preferences.order.forEach(function (key, index) { score[key] = index; });
    return list.slice().sort(function (a, b) {
      var ai = Object.prototype.hasOwnProperty.call(score, a.key) ? score[a.key] : 100000 + list.indexOf(a);
      var bi = Object.prototype.hasOwnProperty.call(score, b.key) ? score[b.key] : 100000 + list.indexOf(b);
      return ai - bi;
    });
  }
  function resolveEnabled() {
    var records = ordered();
    var byId = {};
    records.forEach(function (m) { byId[idKey(m.id)] = m; });
    var states = {};
    var result = [];
    function visit(m, stack) {
      if (states[m.key] === 'ok') return true;
      if (states[m.key] === 'fail') return false;
      if (states[m.key] === 'busy') {
        lastReport.push('Dependency cycle: ' + stack.concat([m.name]).join(' > '));
        states[m.key] = 'fail'; return false;
      }
      states[m.key] = 'busy';
      if (!isEnabled(m)) { states[m.key] = 'fail'; return false; }
      if (!m.script) {
        lastReport.push('Not loaded (no JavaScript entrypoint): ' + m.name);
        states[m.key] = 'fail'; return false;
      }
      var deps = Array.isArray(m.dependencies) ? m.dependencies : [];
      for (var i = 0; i < deps.length; i++) {
        var dependency = byId[idKey(deps[i])];
        if (!dependency || !isEnabled(dependency) || !visit(dependency, stack.concat([m.name]))) {
          lastReport.push('Skipping ' + m.name + ': required mod unavailable: ' + deps[i]);
          states[m.key] = 'fail'; return false;
        }
      }
      states[m.key] = 'ok'; result.push(m);
      return true;
    }
    records.forEach(function (m) { if (isEnabled(m)) visit(m, []); });
    return result;
  }
  function loadScript(mod) {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      var finished = false;
      var timeout = setTimeout(function () { done(false, 'timed out'); }, 15000);
      function done(ok, reason) {
        if (finished) return;
        finished = true; clearTimeout(timeout);
        if (ok) loaded.push(mod.id);
        else {
          lastReport.push('Could not load ' + mod.name + ': ' + reason);
          try { if (Game.brokenMods) Game.brokenMods.push(mod.name); } catch (_) {}
        }
        resolve();
      }
      script.onload = function () { done(true); };
      script.onerror = function () { done(false, 'script error or missing asset'); };
      script.src = mod.script;
      document.head.appendChild(script);
    });
  }
  function startMods(continueGame) {
    catalogPromise.then(function () {
      var queue = resolveEnabled();
      var sequence = Promise.resolve();
      queue.forEach(function (mod) { sequence = sequence.then(function () { return loadScript(mod); }); });
      return sequence;
    }).catch(function (e) {
      lastReport.push('Mod loader error: ' + (e && e.message || e));
    }).then(function () { continueGame(); });
  }
  function restart() {
    try { if (Game.ready && Game.WriteSave) Game.WriteSave(0); } catch (_) {}
    location.reload();
  }
  function open() {
    if (!Game.ready || !Game.Prompt) return;
    var mods = ordered();
    var html = '<h3 class="title">Manage mods</h3>' +
      '<div style="font-size:11px;opacity:0.85;padding:5px">Installed on Steam when this APK was built. Changes here affect only Android.</div>';
    if (!mods.length) html += '<div class="listing">No Steam mods were packaged.</div>';
    mods.forEach(function (m, i) {
      var label = isEnabled(m) ? 'Enabled' : 'Disabled';
      html += '<div class="listing" style="text-align:left;padding:6px 4px;border-bottom:1px solid #555">' +
        '<div><b>' + htmlEscape(m.name) + '</b> <small>(' + htmlEscape(m.origin) + (m.script ? '' : ', no main.js') + ')</small></div>' +
        (m.author ? '<small>by ' + htmlEscape(m.author) + '</small><br>' : '') +
        (m.description ? '<small>' + htmlEscape(m.description) + '</small><br>' : '') +
        (m.script ? ('<a class="option smallFancyButton" onclick="CookieSteamMods.toggle(' + i + ')">' + label + '</a> ') : '<small>Not supported by Android loader</small> ') +
        '<a class="option smallFancyButton" onclick="CookieSteamMods.move(' + i + ',-1)">Up</a> ' +
        '<a class="option smallFancyButton" onclick="CookieSteamMods.move(' + i + ',1)">Down</a></div>';
    });
    html += '<div class="listing"><a class="option smallFancyButton" onclick="CookieSteamMods.restart()">Restart to apply changes</a></div>';
    html += '<div class="listing"><a class="option smallFancyButton" onclick="CookieSteamMods.disableAllAndReload()">Restart with all mods disabled (safe mode)</a></div>';
    if (lastReport.length) html += '<div class="listing"><small>' + htmlEscape(lastReport.slice(-5).join('; ')) + '</small></div>';
    Game.Prompt(html, ['Close']);
  }
  function toggle(index) {
    var m = ordered()[index];
    if (!m) return;
    preferences.enabled[m.key] = !isEnabled(m);
    writePreferences(); open();
  }
  function move(index, step) {
    var mods = ordered();
    var other = index + step;
    if (index < 0 || other < 0 || other >= mods.length) return;
    var m = mods.splice(index, 1)[0];
    mods.splice(other, 0, m);
    preferences.order = mods.map(function (entry) { return entry.key; });
    writePreferences(); open();
  }
  function disableAllAndReload() {
    // Set every known mod false, including entries introduced by a future APK update.
    catalogPromise.then(function () {
      list.forEach(function (m) { preferences.enabled[m.key] = false; });
      writePreferences(); restart();
    });
  }
  function installInGameMenu() {
    if (Game.UpdateMenu && !Game.UpdateMenu._androidSteamMods) {
      var oldUpdateMenu = Game.UpdateMenu;
      Game.UpdateMenu = function () {
        var returnValue = oldUpdateMenu.apply(this, arguments);
        if (Game.onMenu === 'prefs') {
          var menu = document.getElementById('menu');
          if (menu && !document.getElementById('cookiePortSteamModSection')) {
            var panel = document.createElement('div');
            panel.id = 'cookiePortSteamModSection';
            panel.className = 'block';
            panel.style.cssText = 'padding:0;margin:8px 4px';
            panel.innerHTML = '<div class="subsection" style="padding:0">' +
              '<div class="title">Mods</div>' +
              '<div class="listing"><a class="option smallFancyButton" id="cookiePortOpenMods">Manage mods</a>' +
              '<label>Steam mods bundled at build time. Restart to apply changes.</label></div></div>';
            // The base game ends its Options menu with a spacer; place Mods above it.
            var last = menu.lastElementChild;
            if (last && last.style && last.style.height === '128px') menu.insertBefore(panel, last);
            else menu.appendChild(panel);
            var btn = document.getElementById('cookiePortOpenMods');
            btn.addEventListener('click', function (event) { event.preventDefault(); open(); });
          }
        }
        return returnValue;
      };
      Game.UpdateMenu._androidSteamMods = true;
    }
  }
  window.CookieSteamMods = {
    open: open, toggle: toggle, move: move, restart: restart,
    disableAllAndReload: disableAllAndReload,
    report: function () { return 'Installed: ' + list.length + '\nLoaded: ' + loaded.join(', ') + '\n' + lastReport.join('\n'); }
  };

  // The actual Steam mod manager lives in Electron; the unmodified game calls
  // Game.Launch -> Game.Load(callback) -> Game.Init. Hook before Game.Init so
  // Steam-style Game.registerMod scripts keep their original init/save hooks.
  var originalLaunch = Game.Launch;
  Game.Launch = function () {
    var returned = originalLaunch.apply(this, arguments);
    installInGameMenu();
    var originalLoad = Game.Load;
    Game.Load = function (callback) {
      Game.Load = originalLoad;
      return originalLoad.call(this, function () { startMods(callback); });
    };
    return returned;
  };
})();
