/*
 * Wooden Panel Resizer — Steam PC and Android
 * Uses Cookie Clicker's existing wooden dividers; does not replace artwork.
 * Keep the registration ID unchanged for compatibility with version 1.0.0.
 */
(function () {
  'use strict';
  if (!window.Game || typeof Game.registerMod !== 'function' || window.CookiePortPanelResizer) return;

  var STORAGE_KEY = 'cookiePort.woodenPanels.v2';
  var LEGACY_STORAGE_KEY = 'cookiePort.androidWoodenPanels.v1';
  var dimensions = {left: null, right: null, height: null};
  var bottomBeam = null;
  var originalTickerLimit = null;
  var tickerCompact = false;
  var drag = null;
  var installed = false;
  var rafPending = false;
  var lastTap = {side: '', at: 0, x: NaN};
  var LEFT_MIN = 190;
  var RIGHT_MIN = 290;
  var MIDDLE_MIN = 195;
  var COOKIE_HEIGHT_MIN = 185;
  var NARROW_TICKER_WIDTH = 300; // narrow middle panel, corresponding to desktop window below ~900px

  function el(id) {return document.getElementById(id);}
  function gameWidth() {
    var game = el('game');
    return game ? (game.clientWidth || game.offsetWidth || 0) : 0;
  }
  function clamp(n, low, high) {
    return Math.round(Math.max(low, Math.min(high, n)));
  }
  function isNumber(n) {return typeof n === 'number' && Number.isFinite(n);}
  function isCustomized() {return isNumber(dimensions.left) || isNumber(dimensions.right);}
  function hasSavedLayout() {return isCustomized() || isNumber(dimensions.height);}
  function gameHeight() {
    var game = el('game');
    return game ? (game.clientHeight || game.offsetHeight || 0) : 0;
  }
  function safeHeight(h) {
    var max = gameHeight() - 24;
    if (!max) return null;
    var min = Math.min(COOKIE_HEIGHT_MIN, max);
    return clamp(h, min, Math.max(min, max));
  }
  // Keep the stock wood and building artwork. These layout rules only fix
  // spaces that become exposed when the original panels are resized.
  function installLayoutPolish() {
    if (el('cookiePortLayoutPolish')) return;
    var style = document.createElement('style');
    style.id = 'cookiePortLayoutPolish';
    style.textContent = [
      // The vanilla black gradient and filler overrun a shortened sectionLeft
      // because Cookie Clicker intentionally leaves overflow visible.
      '#sectionLeft.cookiePortShortLeft {overflow:hidden;}',
      '#sectionLeft.cookiePortShortLeft .blackGradient, #sectionLeft.cookiePortShortLeft .blackFiller {display:none !important;}',
      '#cookiePortLeftFill {position:absolute;left:0;bottom:0;pointer-events:none;display:none;',
      '  background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.04) 85%,rgba(0,0,0,.12)),url(img/bgBlue.jpg) repeat;',
      '  box-shadow:inset -14px 0 16px -15px #000,inset 0 12px 12px -13px #000;}',
      // Only enhance the Store when at least two ORIGINAL 300px product tiles
      // actually fit. Everything below this width keeps vanilla CSS exactly.
      '#sectionRight.cookiePortExpandedStore #store {position:relative;width:100%;}',
      '#sectionRight.cookiePortExpandedStore #storeTitle {width:calc(100% - 16px);}',
      '#sectionRight.cookiePortExpandedStore #upgrades,',
      '#sectionRight.cookiePortExpandedStore #toggleUpgrades,',
      '#sectionRight.cookiePortExpandedStore #techUpgrades,',
      '#sectionRight.cookiePortExpandedStore #vaultUpgrades {width:100%;box-sizing:border-box;}',
      // Keep Cookie Clicker's own blue/dark wallpaper and wooden top trim.
      // No solid wooden slab, gradients, overlays, stretched product sprites,
      // alternate skins or replacement graphics.
      '#sectionRight.cookiePortExpandedStore #products {',
      '  width:100%;height:auto;min-height:60px;box-sizing:border-box;',
      '  padding:16px 10px 10px;',
      '  display:grid;grid-template-columns:repeat(var(--cookiePortStoreCols,2),300px);',
      '  grid-auto-rows:64px;gap:4px 4px;justify-content:center;align-content:start;',
      '  background:url(img/panelGradientLeft.png) no-repeat top left,',
      '    url(img/panelGradientRight.png) no-repeat top right,',
      '    url(img/panelHorizontal.png?v=2) repeat-x top;',
      '}',
      // A centered tray holds the game's original Buy/Sell bar and any
      // compatible separate-mod control bars, with vanilla textures intact.
      '#sectionRight.cookiePortExpandedStore #cookiePortStoreToolbar {',
      '  display:flex;align-items:center;justify-content:center;gap:12px;',
      '  flex-wrap:wrap;width:100%;box-sizing:border-box;padding:4px 12px 10px;',
      '  min-height:38px;background:none;border:0;}',
      '#sectionRight.cookiePortExpandedStore #cookiePortStoreToolbar #storeBulk {',
      '  position:relative;flex:0 0 300px;width:240px;height:32px;',
      '  box-sizing:content-box;margin:0;padding:0 0 0 60px;}',
      '#sectionRight.cookiePortExpandedStore #cookiePortStoreToolbar .cookiePortExternalStoreControl {',
      '  position:relative !important;top:auto !important;bottom:auto !important;',
      '  left:auto !important;right:auto !important;float:none !important;',
      '  margin:0 !important;transform:none !important;max-width:300px;',
      '  flex:0 1 300px;box-sizing:border-box;}',
      // Vanilla 300x64 product graphics, prices and silhouettes are untouched.
      '#sectionRight.cookiePortExpandedStore #products>.product {',
      '  width:300px;height:64px;min-width:300px;max-width:300px;',
      '  margin:0;padding:0;box-sizing:content-box;',
      '}',
    ].join('\\n');
    // The separator is intentionally a real newline, not a literal slash-n.
    style.textContent = style.textContent.replace(/\\n/g, '\n');
    document.head.appendChild(style);
  }
  // Do not copy or restyle another mod's contents. Move the actual DOM node
  // (and therefore retain its event listeners) into the same header row as
  // vanilla Buy/Sell. Use placeholders to restore original placement when
  // the Store is resized back to its normal 300px width.
  var storeToolbar = null;
  var placedStoreControls = [];
  var storeObserver = null;
  var rescanScheduled = false;
  function isToolControl(node, section) {
    if (!node || node.nodeType !== 1 || node.id === 'storeBulk') return false;
    if (node.closest('#cookiePortStoreToolbar,.product,#upgrades,#techUpgrades,#vaultUpgrades,#toggleUpgrades')) return false;
    if (node.matches('#store,#storeTitle,#products,.storeSection,#sectionRight')) return false;
    if (node.querySelector('.product,canvas,iframe')) return false;
    var rect = node.getBoundingClientRect();
    var parent = section.getBoundingClientRect();
    if (rect.width < 145 || rect.width > 390 || rect.height < 20 || rect.height > 105) return false;
    if (rect.top < parent.top - 20 || rect.top > parent.top + 210) return false;
    var text = (node.textContent || '').trim();
    if (!text || text.length > 160) return false;
    var description = (node.id + ' ' + String(node.className || '')).toLowerCase();
    if (/autoclick|auto.click|mod.control|store.control|toolbar|bulk/.test(description)) return true;
    var color = window.getComputedStyle(node).backgroundColor;
    var match = color.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
    return !!(match && Math.max(+match[1],+match[2],+match[3]) < 75 &&
      (node.querySelector('button,input,select,.option,a') || /click|speed|buy|sell|auto/i.test(text)));
  }
  function getToolbar() {
    var store = el('store');
    if (!store) return null;
    if (!storeToolbar || !storeToolbar.isConnected) {
      storeToolbar = document.createElement('div');
      storeToolbar.id = 'cookiePortStoreToolbar';
      storeToolbar.style.display = 'none';
      var products = el('products');
      store.insertBefore(storeToolbar, products && products.parentNode === store ? products : null);
    }
    return storeToolbar;
  }
  function moveControl(node, external) {
    if (!node || !node.parentNode || node.parentNode === storeToolbar) return;
    var marker = document.createComment('cookiePortStoreControlOrigin');
    node.parentNode.insertBefore(marker, node);
    placedStoreControls.push({node: node, marker: marker, external: external});
    if (external) node.classList.add('cookiePortExternalStoreControl');
    storeToolbar.appendChild(node);
  }
  function restoreControls() {
    for (var i = placedStoreControls.length - 1; i >= 0; i--) {
      var entry = placedStoreControls[i];
      if (entry.external) entry.node.classList.remove('cookiePortExternalStoreControl');
      if (entry.marker.parentNode && entry.node.isConnected) {
        entry.marker.parentNode.insertBefore(entry.node, entry.marker);
      }
      if (entry.marker.parentNode) entry.marker.remove();
    }
    placedStoreControls = [];
    if (storeToolbar) storeToolbar.style.display = 'none';
  }
  function syncStoreControls(expanded) {
    var section = el('sectionRight');
    var products = el('products');
    if (!section || !products) return;
    if (!expanded) {restoreControls();return;}
    var tray = getToolbar();
    if (!tray) return;
    tray.style.display = 'flex';
    // RebuildStore may have replaced #products' innerHTML. Prefer the new
    // #storeBulk instead of retaining a stale bar with the same ID.
    var newBulk = Array.prototype.find.call(products.children,function (n) {return n.id === 'storeBulk';});
    if (newBulk) {
      for (var i=placedStoreControls.length-1;i>=0;i--) {
        var existing=placedStoreControls[i];
        if (existing.node.id === 'storeBulk') {
          existing.node.remove();
          if (existing.marker.parentNode) existing.marker.remove();
          placedStoreControls.splice(i,1);
        }
      }
      moveControl(newBulk, false);
    }
    // Third-party mods can add their own compact black control bars. Detect
    // only small, visible controls near the Store's top; no broad CSS or
    // changes to products, upgrade cards, tooltips or arbitrary mod content.
    var candidates = Array.prototype.slice.call(section.querySelectorAll('[id],.storePre'))
      .filter(function (node) {return isToolControl(node,section);});
    candidates.forEach(function (node) {
      if (candidates.some(function (other) {return other!==node && other.contains(node);})) return;
      if (placedStoreControls.some(function (entry) {return entry.node === node;})) return;
      moveControl(node, true);
    });
  }
  function observeStoreControls() {
    if (storeObserver || !el('sectionRight')) return;
    storeObserver = new MutationObserver(function () {
      if (rescanScheduled) return;
      rescanScheduled = true;
      setTimeout(function () {
        rescanScheduled = false;
        var right = el('sectionRight');
        if (right) syncStoreControls(right.classList.contains('cookiePortExpandedStore'));
      }, 40);
    });
    storeObserver.observe(el('sectionRight'), {subtree:true,childList:true});
  }
  var leftFill = null;
  function updateExposedSpace() {
    var game = el('game');
    var left = el('sectionLeft');
    var right = el('sectionRight');
    if (!game || !left || !right) return;
    if (!leftFill) {
      leftFill = document.createElement('div');
      leftFill.id = 'cookiePortLeftFill';
      // Put it behind the existing panels, not over cookies or click targets.
      game.insertBefore(leftFill, left);
    }
    var short = isNumber(dimensions.height) && left.offsetHeight < gameHeight() - 20;
    left.classList.toggle('cookiePortShortLeft', short);
    leftFill.style.display = short ? 'block' : 'none';
    if (short) {
      leftFill.style.width = left.offsetWidth + 'px';
      leftFill.style.top = Math.max(0,left.offsetHeight - 8) + 'px';
    }
    var w = right.clientWidth || right.offsetWidth;
    // Keep default store behavior until two original 300px cards can fit.
    var expanded = w >= 626;
    right.classList.toggle('cookiePortExpandedStore', expanded);
    var products = el('products');
    if (products) {
      if (expanded) {
        var available = Math.max(1, Math.floor((w - 20 + 4) / 304));
        var total = products.querySelectorAll('.product').length;
        var cols = Math.max(2, Math.min(available, total || 2));
        // When possible, use complete rows rather than leaving a lone tile
        // hanging on the last row. Do not shrink to a narrow 2-column list.
        var minBalanced = Math.max(3, Math.ceil(cols * 0.75));
        for (var count = cols; count >= minBalanced; count--) {
          if (total >= count * 2 && total % count === 0) {cols = count; break;}
        }
        var nextCols = String(cols);
        if (products.style.getPropertyValue('--cookiePortStoreCols') !== nextCols) {
          products.style.setProperty('--cookiePortStoreCols', nextCols);
        }
      } else if (products.style.getPropertyValue('--cookiePortStoreCols')) {
        products.style.removeProperty('--cookiePortStoreCols');
      }
    }
    syncStoreControls(expanded);
  }

  function updateTickerLayout() {
    if (typeof Game.tickerTooNarrow !== 'number' || typeof Game.windowW !== 'number') return;
    if (originalTickerLimit === null) originalTickerLimit = Game.tickerTooNarrow;
    // The original achievement checks Game.windowW < Game.tickerTooNarrow,
    // not sectionMiddle.width. Make the threshold reflect a physically
    // squashed news ticker. Never call Game.Win() ourselves.
    var widths = effectiveWidths();
    var centerWidth = widths ? gameWidth() - widths.left - widths.right : Infinity;
    var compact = centerWidth < NARROW_TICKER_WIDTH;
    var nextLimit = compact ? Math.max(originalTickerLimit, Math.ceil(Game.windowW) + 1) : originalTickerLimit;
    if (Game.tickerTooNarrow !== nextLimit || compact !== tickerCompact) {
      Game.tickerTooNarrow = nextLimit;
      tickerCompact = compact;
      if (typeof Game.getNewTicker === 'function') Game.getNewTicker(true);
    }
  }
  function updateBottomBeam() {
    if (!bottomBeam) return;
    var left = el('sectionLeft');
    bottomBeam.style.width = (left ? left.offsetWidth : 0) + 'px';
    var h = isNumber(dimensions.height) ? dimensions.height : gameHeight();
    bottomBeam.style.top = Math.max(0, h - 16) + 'px';
  }
  function applyHeight() {
    var left = el('sectionLeft');
    if (!left) return;
    if (isNumber(dimensions.height)) {
      dimensions.height = safeHeight(dimensions.height);
      if (dimensions.height === null) return;
      left.style.bottom = 'auto';
      left.style.height = dimensions.height + 'px';
    } else {
      left.style.height = '';
      left.style.bottom = '';
    }
    updateBottomBeam();
    syncGraphics();
    updateExposedSpace();
  }

  function safeWidths(left, right, preferred) {
    var width = gameWidth();
    if (!width) return null;
    var leftMin = LEFT_MIN;
    var rightMin = RIGHT_MIN;
    var middleMin = MIDDLE_MIN;
    var reserve = leftMin + rightMin + middleMin;
    if (width < reserve) {
      var ratio = width / reserve;
      leftMin *= ratio;
      rightMin *= ratio;
      middleMin *= ratio;
    }
    left = isNumber(left) ? left : width * 0.30;
    right = isNumber(right) ? right : 318;
    if (preferred === 'right') {
      left = clamp(left, leftMin, width - middleMin - rightMin);
      right = clamp(right, rightMin, width - middleMin - left);
    } else {
      right = clamp(right, rightMin, width - middleMin - leftMin);
      left = clamp(left, leftMin, width - middleMin - right);
    }
    return {left: left, right: right};
  }
  function syncGraphics() {
    try {
      var section = el('sectionLeft');
      if (Game.LeftBackground && Game.LeftBackground.canvas && section) {
        var canvas = Game.LeftBackground.canvas;
        var w = section.offsetWidth;
        if (w > 0 && canvas.width !== w) canvas.width = w;
        var h = section.offsetHeight;
        if (h > 0 && canvas.height !== h) canvas.height = h;
      }
    } catch (_) {}
  }
  function clearWidths() {
    var left = el('sectionLeft');
    var middle = el('sectionMiddle');
    var right = el('sectionRight');
    var leftBeam = el('leftBeam');
    var rightBeam = el('rightBeam');
    if (!left || !middle || !right || !leftBeam || !rightBeam) return;
    // Truly restore the vanilla CSS (30% left and original 318px store).
    left.style.width = '';
    middle.style.left = '';
    middle.style.right = '';
    right.style.width = '';
    leftBeam.style.left = '';
    rightBeam.style.right = '';
    syncGraphics();
  }
  function applyWidths(preferred) {
    if (!isCustomized()) {
      clearWidths();
      applyHeight();
      updateTickerLayout();
      return;
    }
    var layout = safeWidths(dimensions.left, dimensions.right, preferred);
    if (!layout) return;
    var left = el('sectionLeft');
    var middle = el('sectionMiddle');
    var right = el('sectionRight');
    var leftBeam = el('leftBeam');
    var rightBeam = el('rightBeam');
    if (!left || !middle || !right || !leftBeam || !rightBeam) return;
    dimensions.left = layout.left;
    dimensions.right = layout.right;
    left.style.width = layout.left + 'px';
    middle.style.left = layout.left + 'px';
    leftBeam.style.left = layout.left + 'px';
    middle.style.right = layout.right + 'px';
    right.style.width = layout.right + 'px';
    rightBeam.style.right = (layout.right - 1) + 'px';
    applyHeight();
    updateTickerLayout();
    updateExposedSpace();
  }
  function queueApply(preferred) {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      applyWidths(preferred);
    });
  }
  function persist() {
    try {
      if (hasSavedLayout()) localStorage.setItem(STORAGE_KEY, JSON.stringify(dimensions));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }
  function restore() {
    try {
      var data = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      var saved = data ? JSON.parse(data) : null;
      if (saved && typeof saved === 'object') {
        if (isNumber(saved.left)) dimensions.left = saved.left;
        if (isNumber(saved.right)) dimensions.right = saved.right;
        if (isNumber(saved.height)) dimensions.height = saved.height;
      }
    } catch (_) {}
  }
  function logicalX(event) {
    var game = el('game');
    if (!game) return NaN;
    var rect = game.getBoundingClientRect();
    if (!rect.width) return NaN;
    // Android's scaled layout and desktop's normal layout both work here.
    return (event.clientX - rect.left) * gameWidth() / rect.width;
  }
  function logicalY(event) {
    var game = el('game');
    if (!game) return NaN;
    var rect = game.getBoundingClientRect();
    if (!rect.height) return NaN;
    return (event.clientY - rect.top) * gameHeight() / rect.height;
  }
  function effectiveWidths() {
    var left = el('sectionLeft');
    var right = el('sectionRight');
    var middle = el('sectionMiddle');
    var leftWidth = left && left.offsetWidth ? left.offsetWidth : gameWidth() * 0.3;
    var rightWidth = 318;
    // In vanilla desktop CSS the store content itself measures ~300px, while
    // the separator and Buildings panel reserve 318px. Use that reservation.
    try {
      var middleRight = middle && window.getComputedStyle ? parseFloat(window.getComputedStyle(middle).right) : NaN;
      if (isNumber(middleRight)) rightWidth = middleRight;
      else if (right && right.offsetWidth) rightWidth = right.offsetWidth;
    } catch (_) {if (right && right.offsetWidth) rightWidth = right.offsetWidth;}
    return safeWidths(isNumber(dimensions.left) ? dimensions.left : leftWidth,
      isNumber(dimensions.right) ? dimensions.right : rightWidth, 'left');
  }
  function onDown(event, side, handle) {
    if (event.isPrimary === false || (typeof event.button === 'number' && event.button !== 0) || drag) return;
    var x = side === 'bottom' ? logicalY(event) : logicalX(event);
    if (!isNumber(x)) return;
    var current = side === 'bottom' ? null : effectiveWidths();
    if (side !== 'bottom' && !current) return;
    var beamX = side === 'bottom'
      ? (isNumber(dimensions.height) ? dimensions.height : gameHeight())
      : (side === 'left' ? current.left : gameWidth() - current.right - 15);
    drag = {
      pointerId: event.pointerId,
      side: side,
      handle: handle,
      startX: x,
      grabOffset: x - beamX,
      startDimensions: {left: dimensions.left, right: dimensions.right},
      moved: false
    };
    try {handle.setPointerCapture(event.pointerId);} catch (_) {}
    handle.classList.add('cookiePortDragging');
    event.preventDefault();
    event.stopPropagation();
  }
  function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var x = drag.side === 'bottom' ? logicalY(event) : logicalX(event);
    if (!isNumber(x)) return;
    if (!drag.moved && Math.abs(x - drag.startX) <= 2) return;
    if (!drag.moved) {
      if (drag.side !== 'bottom') {
        var original = effectiveWidths();
        if (!original) return;
        dimensions.left = original.left;
        dimensions.right = original.right;
      }
      drag.moved = true;
    }
    var beamX = x - drag.grabOffset;
    if (drag.side === 'bottom') dimensions.height = safeHeight(beamX);
    else if (drag.side === 'left') dimensions.left = beamX;
    else dimensions.right = gameWidth() - beamX - 15;
    queueApply(drag.side);
    event.preventDefault();
    event.stopPropagation();
  }
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var wasDrag = drag.moved;
    var side = drag.side;
    var x = side === 'bottom' ? logicalY(event) : logicalX(event);
    drag.handle.classList.remove('cookiePortDragging');
    drag = null;
    if (wasDrag) {
      // Prevent a queued frame from overwriting our just-finished drag.
      applyWidths(side);
      persist();
      if (typeof Game.resize === 'function') Game.resize();
      lastTap.at = 0;
    } else if (event.pointerType === 'touch') {
      var now = Date.now();
      if (lastTap.side === side && now - lastTap.at < 350 && Math.abs(x - lastTap.x) < 22) {
        reset();
        lastTap.at = 0;
      } else {
        lastTap = {side: side, at: now, x: x};
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
  function installHandle(beam, side) {
    // No replacement sprite: this is a transparent pointer target over the wood.
    beam.style.touchAction = 'none';
    beam.style.userSelect = 'none';
    beam.style.cursor = 'col-resize';
    var handle = document.createElement('div');
    handle.className = 'cookiePortBeamHit';
    handle.setAttribute('aria-label', side === 'left' ? 'Resize cookie and buildings panels' : 'Resize buildings and store panels');
    handle.style.cssText = 'position:absolute;top:0;bottom:0;left:-12px;width:40px;height:100%;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;cursor:col-resize;background:transparent;z-index:1;';
    beam.appendChild(handle);
    handle.addEventListener('pointerdown', function (event) {onDown(event, side, handle);});
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('lostpointercapture', function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      var wasDrag = drag.moved;
      var side = drag.side;
      drag = null;
      handle.classList.remove('cookiePortDragging');
      if (wasDrag) {applyWidths(side); persist();}
    });
    handle.addEventListener('click', function (event) {event.preventDefault(); event.stopPropagation();});
    handle.addEventListener('dblclick', function (event) {reset(); event.preventDefault(); event.stopPropagation();});
  }
  function installBottomHandle() {
    var game = el('game');
    if (!game || bottomBeam) return;
    var bar = document.createElement('div');
    bar.id = 'cookiePortBottomBeam';
    bar.setAttribute('role', 'separator');
    bar.setAttribute('aria-label', 'Drag vertically to shorten or grow the cookie panel');
    bar.setAttribute('title', 'Drag this wooden edge vertically to resize the cookie panel');
    // Use the game's own wooden horizontal separator texture, no custom art.
    bar.style.cssText = 'position:absolute;left:0;top:0;width:30%;height:16px;z-index:102;' +
      'background:url(img/panelGradientLeft.png) no-repeat top left,' +
      'url(img/panelGradientRight.png) no-repeat top right,' +
      'url(img/panelHorizontal.png?v=2) repeat-x;' +
      'touch-action:none;user-select:none;-webkit-user-select:none;cursor:row-resize;';
    game.appendChild(bar);
    bottomBeam = bar;
    bar.addEventListener('pointerdown', function (event) {onDown(event, 'bottom', bar);});
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', finishDrag);
    bar.addEventListener('pointercancel', finishDrag);
    bar.addEventListener('lostpointercapture', function (event) {
      if (!drag || drag.pointerId !== event.pointerId || drag.side !== 'bottom') return;
      var moved = drag.moved;
      drag = null;
      bar.classList.remove('cookiePortDragging');
      if (moved) {applyWidths('left'); persist();}
    });
    bar.addEventListener('click', function (event) {event.preventDefault(); event.stopPropagation();});
    bar.addEventListener('dblclick', function (event) {reset(); event.preventDefault(); event.stopPropagation();});
  }
  function reset() {
    dimensions.left = null;
    dimensions.right = null;
    dimensions.height = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}
    applyWidths('left');
    if (typeof Game.resize === 'function') Game.resize();
    return 'Panel sizes restored to defaults.';
  }
  function install() {
    if (installed) return;
    var leftBeam = el('leftBeam');
    var rightBeam = el('rightBeam');
    if (!leftBeam || !rightBeam || !el('sectionMiddle') || !el('game')) return;
    installed = true;
    installLayoutPolish();
    observeStoreControls();
    restore();
    installHandle(leftBeam, 'left');
    installHandle(rightBeam, 'right');
    installBottomHandle();
    applyWidths('left');
    var products = el('products');
    if (products && window.MutationObserver) {
      // Game.BuildStore() replaces product children on load/reset. A tiny
      // child-list observer recalculates columns without observing styles,
      // so it cannot loop when we set the grid column count.
      new MutationObserver(function () {updateExposedSpace();})
        .observe(products, {childList:true});
    }
    window.addEventListener('resize', function () {queueApply('left');});
    window.addEventListener('orientationchange', function () {setTimeout(function () {applyWidths('left');}, 250);});
  }

  window.CookiePortPanelResizer = {
    reset: reset,
    getWidths: function () {
      return {left: dimensions.left, right: dimensions.right, height: dimensions.height, customized: hasSavedLayout(), tickerCompact: tickerCompact};
    }
  };
  Game.registerMod('CookiePort Android Panel Resizer', {
    name: 'Wooden Panel Resizer (PC + Android)',
    init: function () {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once: true});
      else install();
    }
  });
})();
