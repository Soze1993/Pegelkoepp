'use strict';
// Quick 261010-j0z — KDA winner avatar (TV end overlay, tablet popup/banner, detail modal).
// Node built-ins only: node:test, node:assert, node:fs, node:path, node:vm.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const TV_SRC = fs.readFileSync(path.join(ROOT, 'public', 'tv.js'), 'utf8');
const INDEX_SRC = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const kda = require(path.join(ROOT, 'server', 'game-types', 'kegler-des-abends.js'));

// ---------------------------------------------------------------------------
// Harness: hand-rolled DOM stub + vm sandbox
// ---------------------------------------------------------------------------

function makeEl(tag, counters) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: {},
    className: '',
    textContent: '',
    classList: { add() {}, remove() {} },
    appendChild(child) { el.children.push(child); return child; },
    insertBefore(child, ref) {
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i < 0) el.children.push(child); else el.children.splice(i, 0, child);
      return child;
    },
    replaceChildren() { el.children = Array.prototype.slice.call(arguments); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    setAttribute() {},
    remove() {}
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return ''; },
    set() { counters.innerHTMLWrites++; },
    enumerable: true,
    configurable: true
  });
  return el;
}

function makeSandbox() {
  const counters = { innerHTMLWrites: 0 };
  const byId = {};
  const document = {
    getElementById(id) {
      if (!byId[id]) byId[id] = makeEl('div', counters);
      return byId[id];
    },
    createElement(tag) { return makeEl(tag, counters); },
    addEventListener() {}
  };
  const sandbox = {
    document,
    window: { innerWidth: 1920, innerHeight: 1080 },
    io() { return { on() {}, emit() {} }; },
    fetch() { return new Promise(() => {}); },
    Audio: function Audio() { this.play = function () { return Promise.resolve(); }; },
    console,
    // timers MUST be stubbed: renderEndOverlay arms a 90 s timeout that would keep node alive
    setTimeout() { return 1; },
    setInterval() { return 1; },
    clearTimeout() {},
    clearInterval() {}
  };
  vm.createContext(sandbox);
  return { sandbox, counters };
}

function loadTv() {
  const ctx = makeSandbox();
  vm.runInContext(TV_SRC, ctx.sandbox, { filename: 'tv.js' });
  ctx.game = ctx.sandbox.document.getElementById('game');
  return ctx;
}

function walk(el, out) {
  out = out || [];
  out.push(el);
  (el.children || []).forEach(function (c) { walk(c, out); });
  return out;
}

function findByClass(root, cls) {
  return walk(root).filter(function (n) { return n.className === cls; });
}

function imgs(root) {
  return walk(root).filter(function (n) { return n.tagName === 'IMG'; });
}

function parentOf(root, target) {
  return walk(root).find(function (n) { return (n.children || []).indexOf(target) >= 0; });
}

// Real engine: play a 4-player tournament to its end
const FIXTURE_PLAYERS = [
  { id: 7, name: 'Tino', emoji: '🦊' },
  { id: 12, name: 'Uwe', emoji: '🐻' },
  { id: 3, name: 'Paul', emoji: '🐸' },
  { id: 21, name: 'Rolf', emoji: '🦉' }
];

function playOut() {
  let s = kda.initState(FIXTURE_PLAYERS, { seed: 'avatar' });
  let iterations = 0;
  while (!kda.isFinished(s) && iterations < 200) {
    const match = s.bracket.find(function (m) { return !m.done && !m.isBye && m.p1 && m.p2; });
    if (!match) break;
    s = kda.applyThrow(s, match.p1.id, 9);
    s = kda.applyThrow(s, match.p2.id, 0);
    iterations++;
  }
  assert.ok(s.done, 'tournament must be done');
  assert.ok(s.gewinner, 'final state must carry a gewinner');
  return s;
}

function overlayOf(ctx) {
  return ctx.game.children[0];
}

const MALFORMED_IDS = [
  ['path segments', '../../etc/passwd'],
  ['quote + handler', '1" onerror="alert(1)'],
  ['numeric string', '7'],
  ['fraction', 3.5],
  ['zero', 0],
  ['negative', -1],
  ['null', null]
];

// ---------------------------------------------------------------------------
// TV end overlay (public/tv.js)
// ---------------------------------------------------------------------------

test('OVL-1: real final state renders photo, name, subtitle and trophy', () => {
  const state = playOut();
  const ctx = loadTv();
  ctx.sandbox.renderEndOverlay('kda', state, state.gewinner.name);
  const root = overlayOf(ctx);
  assert.equal(root.className, 'tv-end-overlay');
  const images = imgs(root);
  assert.equal(images.length, 1, 'exactly one IMG');
  assert.equal(images[0].src, '/uploads/profiles/' + state.gewinner.id + '.jpg');
  const nameEl = findByClass(root, 'tv-overlay-name')[0];
  assert.equal(nameEl.textContent, state.gewinner.name);
  const sub = findByClass(root, 'tv-overlay-subtitle')[0];
  assert.ok(sub.textContent.indexOf('Kegler des Abends') >= 0);
  assert.ok(walk(root).some(function (n) { return n.textContent === '🏆'; }), 'trophy present');
});

test('OVL-2: emoji layer sits before the photo; onerror hides only the photo', () => {
  const state = playOut();
  const ctx = loadTv();
  ctx.sandbox.renderEndOverlay('kda', state, state.gewinner.name);
  const root = overlayOf(ctx);
  const img = imgs(root)[0];
  const parent = parentOf(root, img);
  const idx = parent.children.indexOf(img);
  const before = parent.children.slice(0, idx);
  const emojiNode = before.find(function (n) { return n.textContent === state.gewinner.emoji; });
  assert.ok(emojiNode, 'emoji node before IMG in the same parent');
  assert.equal(typeof img.onerror, 'function');
  img.onerror.call(img);
  assert.equal(img.style.display, 'none');
  assert.equal(emojiNode.textContent, state.gewinner.emoji);
});

test('OVL-3: no winner object keeps the plain layout without IMG', () => {
  [{ done: true, gewinner: null }, {}].forEach(function (state) {
    const ctx = loadTv();
    assert.doesNotThrow(function () { ctx.sandbox.renderEndOverlay('kda', state, 'Tino'); });
    const root = overlayOf(ctx);
    assert.equal(imgs(root).length, 0);
    assert.equal(findByClass(root, 'tv-overlay-name')[0].textContent, 'Tino');
    assert.ok(walk(root).some(function (n) { return n.textContent === '🏆'; }));
    assert.ok(findByClass(root, 'tv-overlay-subtitle')[0].textContent.indexOf('Kegler des Abends') >= 0);
  });
});

test('OVL-4: malformed ids never create an IMG, emoji stays visible', () => {
  MALFORMED_IDS.forEach(function (pair) {
    const ctx = loadTv();
    const state = { done: true, gewinner: { id: pair[1], name: 'Tino', emoji: '🦊' } };
    ctx.sandbox.renderEndOverlay('kda', state, 'Tino');
    const root = overlayOf(ctx);
    assert.equal(imgs(root).length, 0, 'no IMG for id: ' + pair[0]);
    assert.ok(walk(root).some(function (n) { return n.textContent === '🦊'; }), 'emoji for id: ' + pair[0]);
  });
});

test('OVL-5: markup in name and emoji reaches the DOM as text only', () => {
  const ctx = loadTv();
  const evil = '<img src=x onerror=alert(1)>';
  const evilEmoji = '<b>x</b>';
  const state = { done: true, gewinner: { id: 5, name: evil, emoji: evilEmoji } };
  ctx.sandbox.renderEndOverlay('kda', state, evil);
  const root = overlayOf(ctx);
  assert.equal(findByClass(root, 'tv-overlay-name')[0].textContent, evil);
  assert.ok(walk(root).some(function (n) { return n.textContent === evilEmoji; }));
  assert.equal(ctx.counters.innerHTMLWrites, 0);
});

test('OVL-6: name falls back to winner name, then to a dash', () => {
  const ctx1 = loadTv();
  ctx1.sandbox.renderEndOverlay('kda', { done: true, gewinner: { id: 5, name: 'Uwe', emoji: '🐻' } }, null);
  assert.equal(findByClass(overlayOf(ctx1), 'tv-overlay-name')[0].textContent, 'Uwe');
  const ctx2 = loadTv();
  ctx2.sandbox.renderEndOverlay('kda', {}, null);
  assert.equal(findByClass(overlayOf(ctx2), 'tv-overlay-name')[0].textContent, '—');
});

test('OVL-7: other game types do not replace the game children', () => {
  const ctx = loadTv();
  const sentinel = ctx.sandbox.document.createElement('div');
  ctx.game.children = [sentinel];
  ctx.sandbox.renderEndOverlay('anker', {}, 'X');
  assert.equal(ctx.game.children.length, 1);
  assert.equal(ctx.game.children[0], sentinel);
});

// ---------------------------------------------------------------------------
// Tablet (public/index.html)
// ---------------------------------------------------------------------------

function inlineScript() {
  const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const m = re.exec(INDEX_SRC);
  assert.ok(m, 'inline script block must exist');
  return m[1];
}

function between(src, startAnchor, endAnchor) {
  const a = src.indexOf(startAnchor);
  assert.ok(a >= 0, 'anchor missing: ' + startAnchor);
  const b = src.indexOf(endAnchor, a + startAnchor.length);
  assert.ok(b >= 0, 'anchor missing after start: ' + endAnchor);
  return src.slice(a, b);
}

function loadHelper() {
  const src = inlineScript();
  const region = between(src, 'KDA-AVATAR-HELPER:START', 'KDA-AVATAR-HELPER:END');
  const ctx = makeSandbox();
  // region starts at the marker text itself, so prefix it to turn the marker line into a comment
  vm.runInContext('//' + region, ctx.sandbox, { filename: 'index.html#helper' });
  return ctx;
}

test('TAB-0: inline script of index.html still compiles', () => {
  assert.doesNotThrow(function () { new Function(inlineScript()); });
});

test('TAB-1: helper builds emoji layer then one photo IMG', () => {
  const ctx = loadHelper();
  const el = ctx.sandbox.kdaWinnerAvatarEl({ id: 7, name: 'Tino', emoji: '🦊' }, 96);
  const images = imgs(el);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, '/uploads/profiles/7.jpg');
  const parent = parentOf(el, images[0]);
  const idx = parent.children.indexOf(images[0]);
  assert.ok(parent.children.slice(0, idx).some(function (n) { return n.textContent === '🦊'; }));
});

test('TAB-2: onerror hides the photo', () => {
  const ctx = loadHelper();
  const el = ctx.sandbox.kdaWinnerAvatarEl({ id: 7, name: 'Tino', emoji: '🦊' }, 96);
  const img = imgs(el)[0];
  img.onerror.call(img);
  assert.equal(img.style.display, 'none');
});

test('TAB-3: falsy player yields null', () => {
  const ctx = loadHelper();
  assert.equal(ctx.sandbox.kdaWinnerAvatarEl(null, 96), null);
});

test('TAB-4: malformed ids create no IMG; missing emoji falls back', () => {
  const ctx = loadHelper();
  MALFORMED_IDS.forEach(function (pair) {
    const el = ctx.sandbox.kdaWinnerAvatarEl({ id: pair[1], name: 'T', emoji: '🦊' }, 96);
    assert.equal(imgs(el).length, 0, 'no IMG for id: ' + pair[0]);
    assert.ok(walk(el).some(function (n) { return n.textContent === '🦊'; }));
  });
  const el = ctx.sandbox.kdaWinnerAvatarEl({ id: 7, name: 'T' }, 96);
  assert.ok(walk(el).some(function (n) { return n.textContent === '🎳'; }));
});

test('TAB-5: markup in emoji is verbatim text, no innerHTML writes', () => {
  const ctx = loadHelper();
  const evil = '<img src=x onerror=alert(1)>';
  const el = ctx.sandbox.kdaWinnerAvatarEl({ id: 7, name: 'T', emoji: evil }, 96);
  assert.ok(walk(el).some(function (n) { return n.textContent === evil; }));
  assert.equal(ctx.counters.innerHTMLWrites, 0);
});

test('TAB-6: helper is wired into winner popup and bracket banner', () => {
  const src = inlineScript();
  assert.ok(between(src, 'function showWinnerBanner(', 'function playKDATone(').indexOf('kdaWinnerAvatarEl(') >= 0);
  assert.ok(between(src, 'function renderKDABracket(el, state)', 'var kdaWurfSlotId').indexOf('kdaWinnerAvatarEl(') >= 0);
});
