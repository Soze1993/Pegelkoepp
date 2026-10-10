'use strict';
// Quick 261010-j0y (Feedback ID 18): TV top bar shows the running game's name.
// Harness: node:vm + a hand-written fake DOM. Node built-ins only (no jsdom).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gameTypes = require('./game-types');

const TV_JS = path.join(__dirname, '..', 'public', 'tv.js');
const TV_HTML = path.join(__dirname, '..', 'public', 'tv.html');
const tvJsSrc = fs.readFileSync(TV_JS, 'utf8');
const tvHtmlSrc = fs.readFileSync(TV_HTML, 'utf8');

function makeEl(id) {
  const el = {
    id: id || '',
    className: '',
    textContent: '',
    innerHTML: '',
    style: { cssText: '' },
    children: [],
    classList: {
      add() {},
      remove() {},
    },
    appendChild(c) { el.children.push(c); return c; },
    insertBefore(c, ref) {
      const i = ref ? el.children.indexOf(ref) : -1;
      if (i < 0) el.children.push(c); else el.children.splice(i, 0, c);
      return c;
    },
    replaceChildren(...nodes) { el.children = nodes.slice(); },
    remove() {},
    querySelectorAll() { return []; },
    setAttribute() {},
    addEventListener() {},
    get firstChild() { return el.children[0] || null; },
  };
  return el;
}

function boot(width = 1920, height = 1080) {
  const registry = {};
  const idRe = /\sid="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(tvHtmlSrc)) !== null) registry[m[1]] = makeEl(m[1]);

  const handlers = {};
  const never = () => new Promise(() => {});
  const sandbox = {
    window: { innerWidth: width, innerHeight: height },
    document: {
      createElement: () => makeEl(),
      createElementNS: () => makeEl(),
      addEventListener() {},
      getElementById: (id) => registry[id] || null,
    },
    console,
    io: () => ({ on(ev, fn) { handlers[ev] = fn; }, emit() {} }),
    fetch: never,
    Audio: function () { this.play = never; },
    setTimeout: () => 1,
    setInterval: () => 1,
    clearTimeout() {},
    clearInterval() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(tvJsSrc, sandbox, { filename: 'tv.js' });
  return { sandbox, handlers, registry };
}

function players() {
  return [
    { id: 1, name: 'A', emoji: 'A', team: 'X', role: 'fuchs' },
    { id: 2, name: 'B', emoji: 'B', team: 'O', role: 'jaeger' },
    { id: 3, name: 'C', emoji: 'C', team: 'X', role: 'jaeger' },
    { id: 4, name: 'D', emoji: 'D', team: 'O', role: 'jaeger' },
  ];
}

function stateFor(key) {
  const cfg = key === 'kda' ? { seed: '1' } : {};
  return gameTypes[key].initState(players(), cfg);
}

// Strip whitespace so CSS assertions are formatting-insensitive.
function cssRule(selector) {
  const flat = tvHtmlSrc.replace(/\s+/g, ' ');
  const esc = selector.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
  const mm = new RegExp('(?:^|[ }])' + esc + ' ?\\{([^}]*)\\}').exec(flat);
  return mm ? mm[1].replace(/\s+/g, '') : null;
}

// ---- Task 1: B1-B5 -------------------------------------------------------

test('B1: #tv-top-bar contains #tv-game-name then #tv-highlights-hdr', () => {
  const bar = /<div[^>]*id="tv-top-bar"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/.exec(tvHtmlSrc);
  assert.ok(bar, '#tv-top-bar missing in tv.html');
  const inner = bar[1];
  const iName = inner.indexOf('id="tv-game-name"');
  const iHdr = inner.indexOf('id="tv-highlights-hdr"');
  assert.ok(iName >= 0, '#tv-game-name not inside #tv-top-bar');
  assert.ok(iHdr >= 0, '#tv-highlights-hdr not inside #tv-top-bar');
  assert.ok(iName < iHdr, 'game name must precede highlights (left to right)');
});

test('B2: game:started bilderkegel shows its display name', () => {
  const { sandbox, handlers, registry } = boot();
  handlers['game:started']({ state: stateFor('bilderkegel'), gameId: 1, type_key: 'bilderkegel' });
  assert.ok(registry['tv-game-name'], '#tv-game-name missing in markup');
  assert.equal(registry['tv-game-name'].textContent, sandbox.GAME_NAMES.bilderkegel);
});

test('B3: idle game:state clears the name', () => {
  const { handlers, registry } = boot();
  handlers['game:started']({ state: stateFor('bilderkegel'), gameId: 1, type_key: 'bilderkegel' });
  handlers['game:state']({ idle: true, state: null, gameId: null, lastWinner: null });
  assert.ok(registry['tv-game-name'], '#tv-game-name missing in markup');
  assert.equal(registry['tv-game-name'].textContent, '');
});

test('B4: highlights header still renders both entries', () => {
  const { sandbox, registry } = boot();
  sandbox.tvHighlights = { kda_champion: { name: 'Tul' }, bk_loser: { name: 'Andre' } };
  sandbox.renderHighlightsHdr();
  const t = registry['tv-highlights-hdr'].textContent;
  assert.ok(t.includes('KDA-Gewinner: Tul'), t);
  assert.ok(t.includes('BK-Verlierer: Andre'), t);
});

test('B5: top bar layout contract in tv.html', () => {
  const bar = cssRule('#tv-top-bar');
  assert.ok(bar, '#tv-top-bar rule missing');
  assert.match(bar, /position:fixed/);
  assert.match(bar, /display:flex/);
  const name = cssRule('#tv-game-name');
  assert.ok(name, '#tv-game-name rule missing');
  assert.match(name, /white-space:nowrap/);
  assert.match(name, /overflow:hidden/);
  assert.match(name, /text-overflow:ellipsis/);
  assert.match(name, /min-width:0/);
  assert.match(name, /font-size:[\d.]+vw/);
  const hdr = cssRule('#tv-highlights-hdr');
  assert.ok(hdr, '#tv-highlights-hdr rule missing');
  assert.match(hdr, /flex:0 0 auto|flex:00auto/);
  assert.doesNotMatch(hdr, /position:/);
});
