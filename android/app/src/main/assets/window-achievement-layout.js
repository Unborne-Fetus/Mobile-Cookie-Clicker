/* Android-only window layout compatibility controls. No copyrighted game code. */
(function () {
  'use strict';
  if (window.CookiePortAchievementLayout) return;

  var state = {
    narrow: false,
    short: false,
    viewportBefore: null,
    leftHeightBefore: null,
    leftBottomBefore: null
  };

  function ready() {
    return !!(window.Game && Game.ready && Game.resize);
  }

  function viewport() {
    return document.querySelector('meta[name="viewport"]');
  }

  function leftPanel() {
    return document.getElementById('sectionLeft');
  }

  function syncCanvas() {
    var section = leftPanel();
    if (ready() && section && Game.LeftBackground && Game.LeftBackground.canvas) {
      Game.LeftBackground.canvas.width = section.offsetWidth;
      Game.LeftBackground.canvas.height = section.offsetHeight;
    }
  }

  function refresh() {
    if (ready()) {
      Game.resize();
      syncCanvas();
      if (state.narrow && Game.getNewTicker) Game.getNewTicker(true);
    }
  }

  function refreshLater() {
    // WebView viewport changes are applied asynchronously.
    [100, 450, 1100].forEach(function(ms) { setTimeout(refresh, ms); });
  }

  function narrow(on) {
    var el = viewport();
    if (!el) return 'Could not find the page viewport setting.';
    if (!ready()) return 'Let Cookie Clicker finish loading first.';
    if (state.viewportBefore === null) state.viewportBefore = el.getAttribute('content') || '';
    state.narrow = on;
    // Reproduces a real narrow browser window, rather than calling Game.Win().
    el.setAttribute('content', on ? 'width=820, initial-scale=1' : state.viewportBefore);
    refreshLater();
    return on ? 'Narrow window enabled. Tap the NEWS TICKER to earn Stifling the press. Use Check layout status to confirm width is below 900.' : 'Normal game width restored.';
  }

  function shortPanel(on) {
    var section = leftPanel();
    if (!section) return 'Could not find the cookie panel.';
    if (!ready()) return 'Let Cookie Clicker finish loading first.';
    if (state.leftHeightBefore === null) {
      state.leftHeightBefore = section.style.height;
      state.leftBottomBefore = section.style.bottom;
    }
    state.short = on;
    // The cookie position and milk position now overlap visibly in the real
    // game canvas; the game's OWN normal achievement condition remains intact.
    section.style.height = on ? '185px' : state.leftHeightBefore;
    section.style.bottom = on ? 'auto' : state.leftBottomBefore;
    syncCanvas();
    setTimeout(syncCanvas, 80);
    return on ? 'Short cookie panel enabled. With at least 3 regular achievements, the cookie should touch the milk. Toggle again to restore.' : 'Original cookie panel height restored.';
  }

  function status() {
    if (!ready()) return 'Game has not finished loading yet.';
    var h = Game.LeftBackground && Game.LeftBackground.canvas ? Game.LeftBackground.canvas.height : 0;
    var width = Math.floor(Game.windowW || 0);
    var milk = Number(Game.milkHd || 0);
    var hasMilk = Game.milkProgress > 0.1;
    var overlap = h > 0 && (h * 0.4 + 112) > ((1 - milk) * h);
    var tickerWidth = Number(Game.tickerTooNarrow || 900);
    return 'Actual game viewport width: ' + width + 'px (must be below ' + tickerWidth + ' for Stifling the press).\n'
      + 'Cookie panel canvas height: ' + h + 'px.\n'
      + 'Regular achievements: ' + Game.AchievementsOwned + ' (need at least 3).\n'
      + 'Cookie/milk overlap according to original game check: ' + (overlap ? 'YES' : 'NO') + '.\n'
      + 'Cookie-dunker eligibility: ' + (hasMilk && overlap ? 'YES (game should award it)' : 'NOT YET') + '.\n'
      + 'Cookie-dunker earned: ' + (Game.HasAchiev('Cookie-dunker') ? 'YES' : 'NO') + '.\n'
      + 'Stifling the press earned: ' + (Game.HasAchiev('Stifling the press') ? 'YES' : 'NO') + '.';
  }

  window.CookiePortAchievementLayout = {
    toggleNarrow: function () { return narrow(!state.narrow); },
    toggleShort: function () { return shortPanel(!state.short); },
    restore: function () {
      if (state.narrow) narrow(false);
      if (state.short) shortPanel(false);
      return 'Original layout restored.';
    },
    status: status
  };
})();
