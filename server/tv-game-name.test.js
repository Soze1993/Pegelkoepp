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

// ---- Task 2: B6-B14 ------------------------------------------------------

const ALL_KEYS = Object.keys(gameTypes);

function nameOf(registry) { return registry['tv-game-name'].textContent; }

test('B6: every game type has a non-empty TV display name', () => {
  const { sandbox } = boot();
  for (const key of ALL_KEYS) {
    const n = sandbox.GAME_NAMES[key];
    assert.equal(typeof n, 'string', key);
    assert.ok(n.length > 0, key);
  }
});

test('B7: game:started shows the name for each of the nine types', () => {
  for (const key of ALL_KEYS) {
    const { sandbox, handlers, registry } = boot();
    handlers['game:started']({ state: stateFor(key), gameId: 1, type_key: key });
    assert.equal(nameOf(registry), sandbox.GAME_NAMES[key], key);
  }
});

test('B8: live switch without idle; throw:applied keeps the name', () => {
  const { sandbox, handlers, registry } = boot();
  handlers['game:started']({ state: stateFor('fuchsjagd'), gameId: 1, type_key: 'fuchsjagd' });
  assert.equal(nameOf(registry), sandbox.GAME_NAMES.fuchsjagd);
  const kdaState = stateFor('kda');
  handlers['game:started']({ state: kdaState, gameId: 2, type_key: 'kda' });
  assert.equal(nameOf(registry), sandbox.GAME_NAMES.kda);
  handlers['throw:applied']({ state: kdaState });
  assert.equal(nameOf(registry), sandbox.GAME_NAMES.kda);
});

test('B9: reconnect via game:state shows the name', () => {
  const { sandbox, handlers, registry } = boot();
  handlers['game:state']({ idle: false, state: stateFor('anker'), gameId: 1, type_key: 'anker' });
  assert.equal(nameOf(registry), sandbox.GAME_NAMES.anker);
});

test('B10: name stays during end screen, cleared on idle', () => {
  const { sandbox, handlers, registry } = boot();
  const st = stateFor('kda');
  handlers['game:started']({ state: st, gameId: 1, type_key: 'kda' });
  handlers['game:finished']({ state: st, lastWinner: 'A', typeKey: 'kda' });
  assert.equal(nameOf(registry), sandbox.GAME_NAMES.kda);
  handlers['game:state']({ idle: true, state: null, gameId: null, lastWinner: 'A' });
  assert.equal(nameOf(registry), '');
});

test('B11: unknown type_key never shows the raw key', () => {
  const { handlers, registry } = boot();
  handlers['game:started']({ state: { players: players().map((p) => ({ ...p, score: 0 })) }, gameId: 1, type_key: 'does-not-exist' });
  assert.equal(nameOf(registry), '');
});

function walk(node, fn) {
  fn(node);
  for (const c of node.children || []) walk(c, fn);
}

test('B12: no legacy centered header anywhere, no factory global', () => {
  const LEGACY = 'tv-game-name-hdr';
  const cases = ALL_KEYS.map((k) => [k, stateFor(k)]);
  cases.push(['does-not-exist', { players: players().map((p) => ({ ...p, score: 0 })) }]);
  for (const [key, st] of cases) {
    const { sandbox, handlers, registry } = boot();
    handlers['game:started']({ state: st, gameId: 1, type_key: key });
    walk(registry.game, (n) => assert.notEqual(n.className, LEGACY, key));
    assert.equal(sandbox.makeGameNameHeader, undefined);
  }
});

function firstPadding(css) {
  const mm = /(?:^|;)padding:([^;]+)/.exec(css);
  return mm ? mm[1].trim().split(/\s+/) : null;
}

test('B13: fixed root containers reserve the 6.5% top band', () => {
  for (const [w, h] of [[1920, 1080], [960, 540]]) {
    for (const key of ALL_KEYS) {
      const { handlers, registry } = boot(w, h);
      handlers['game:started']({ state: stateFor(key), gameId: 1, type_key: key });
      const root = registry.game.children[0];
      assert.ok(root, key);
      if (!/position:fixed/.test(root.style.cssText)) continue;
      const pad = firstPadding(root.style.cssText);
      assert.ok(pad, key + ' has no padding');
      assert.ok(parseInt(pad[0], 10) >= Math.round(h * 0.065), key + ' @' + w + 'x' + h + ' top padding ' + pad[0]);
    }
  }
});

test('B14: KDA side/bottom padding unchanged', () => {
  for (const [w, h, p] of [[1920, 1080, 20], [960, 540, 12]]) {
    const { handlers, registry } = boot(w, h);
    handlers['game:started']({ state: stateFor('kda'), gameId: 1, type_key: 'kda' });
    const pad = firstPadding(registry.game.children[0].style.cssText);
    assert.equal(pad.length, 4);
    assert.deepEqual(pad.slice(1), [p + 'px', p + 'px', p + 'px']);
  }
});
