'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const code = fs.readFileSync(__dirname+'/../app/src/main/assets/android-heralds.js','utf8');
const dom = {
  heraldsAmount:{textContent:'-'},
  heralds:{attrs:{},setAttribute(k,v){this.attrs[k]=v;}}
};
let repeated;
const Game = {heralds:0,ready:0,recalculateGains:0,externalDataLoaded:false,
  CalculateGains(){this.recalculations=(this.recalculations||0)+1;}};
const window = {Game};
const context = vm.createContext({window,Game,document:{getElementById:id=>dom[id]||null},
  setInterval:cb=>{repeated=cb;}, Date, Object, Number, Math});
vm.runInContext(code,context);
assert(window.CookieAndroidHeralds);
let wasCalled=false;
Game.GrabData=function(){wasCalled=true;};
Game.GrabData();
assert(!wasCalled,'Legacy Patreon/Steamworks getter should be intercepted');
assert.strictEqual(window.CookieAndroidHeralds.receive(9450,100,true),true);
assert.strictEqual(Game.heralds,0,'Do not apply before Game.Init');
Game.ready=1;
repeated();
assert.strictEqual(Game.heralds,94.5,'Preserve vanilla fractional bonus');
assert.strictEqual(dom.heraldsAmount.textContent,'94');
assert.strictEqual(dom.heralds.attrs['data-cookie-android-steam-players'],'9450');
assert.strictEqual(dom.heralds.attrs['data-cookie-android-heralds-cached'],'yes');
assert.strictEqual(Game.externalDataLoaded,true);
assert.strictEqual(Game.recalculateGains,1);
const recalc = Game.recalculations;
repeated();
assert.strictEqual(Game.recalculations,recalc,'No redundant gain recalcs');
assert.strictEqual(window.CookieAndroidHeralds.receive(-1,110,false),false);
assert.strictEqual(Game.heralds,94.5,'Failed/invalid count must not wipe last result');
Game.heralds=13; // Simulate a saved offline boost being loaded.
repeated();
assert.strictEqual(Game.heralds,94.5,'Restore last count after a save loads');
window.CookieAndroidHeralds.receive(15000,120,false);
assert.strictEqual(Game.heralds,100,'Cap at 100 heralds');
assert.strictEqual(dom.heraldsAmount.textContent,'100');
assert.strictEqual(dom.heralds.attrs['data-cookie-android-heralds-cached'],'no');
console.log('PASS: native count delivery, cached count, invalid input, original fractional math, cap, save restore, disabled legacy getter');
