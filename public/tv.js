'use strict';

const connDot      = document.getElementById('connDot');
const idleEl       = document.getElementById('idle');
const gameEl       = document.getElementById('game');
const playerListEl = document.getElementById('playerList');
const lastWinnerEl = document.getElementById('lastWinnerText');

var currentTypeKey = null;  // set on game:started and game:state — used by renderGame dispatcher
var overlayTimeoutId = null;

function playKDAToneTV() {
  new Audio('/sounds/kda-end.mp3').play().catch(function(){});
}
var tvHighlights = null;
var tvPlayers = null;
var currentIdleLastWinner = null;

var GAME_NAMES = {
  'bilderkegel': 'Bilderkegel',
  'fuchsjagd': 'Fuchsjagd',
  'viergewinnt': 'Vier Gewinnt',
  'kda': 'Kegler des Abends',
  'dreiVollen': 'Drei in die Vollen',
  'anker': 'Anker',
  'grosseHaus': 'Große Hausnummer',
  'kleineHaus': 'Kleine Hausnummer',
  'plusMinus': 'Plus Minus Mal'
};

function makeGameNameHeader() {
  var el = document.createElement('div');
  el.className = 'tv-game-name-hdr';
  el.textContent = (currentTypeKey && GAME_NAMES[currentTypeKey]) || '';
  el.style.cssText = 'font-family:var(--fb,"DM Sans",sans-serif);font-size:2.5vw;color:var(--mut);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;text-align:center';
  return el;
}

function kegelSVGtv(activePins, w, h) {
  var px = {1:[40,88],2:[24,68],3:[56,68],4:[8,48],5:[40,48],6:[72,48],7:[24,28],8:[56,28],9:[40,8]};
  var circles = '';
  for (var pin = 1; pin <= 9; pin++) {
    var xy = px[pin], act = activePins.indexOf(pin) >= 0;
    circles += '<circle cx="'+xy[0]+'" cy="'+xy[1]+'" r="11" fill="'+(act?'#fff':'#333')+'" stroke="'+(act?'var(--ac)':'#555')+'" stroke-width="2"/>';
  }
  return '<svg viewBox="-6 -6 92 112" width="'+w+'" height="'+h+'" xmlns="http://www.w3.org/2000/svg">'+circles+'</svg>';
}

function renderHighlightsHdr() {
  var hdr = document.getElementById('tv-highlights-hdr');
  if (!hdr || !tvHighlights) return;
  var hasKda = tvHighlights.kda_champion && tvHighlights.kda_champion.name;
  var hasBk  = tvHighlights.bk_loser  && tvHighlights.bk_loser.name;
  hdr.textContent = '';
  if (!hasKda && !hasBk) return;
  var parts = [];
  if (hasKda) parts.push('🏆 KDA-Gewinner: ' + tvHighlights.kda_champion.name);
  if (hasBk)  parts.push('💩 BK-Verlierer: ' + tvHighlights.bk_loser.name);
  hdr.textContent = parts.join('  |  ');
}

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/highlights/current')
    .then(function(r){ return r.json(); })
    .then(function(d){ tvHighlights = d; renderHighlightsHdr(); })
    .catch(function(){});
  fetch('/api/players')
    .then(function(r) { return r.json(); })
    .then(function(d) { tvPlayers = d; })
    .catch(function() {});
});

const socket = io();  // same-origin; socket.io.js auto-served at /socket.io/socket.io.js

// Connection indicator (RT-03)
socket.on('connect',    () => { connDot.className = 'conn-dot green'; });
socket.on('disconnect', () => { connDot.className = 'conn-dot red';   });

// State events (D-09, D-11)
socket.on('game:state', function({ idle, state, gameId, lastWinner, type_key }) {
  if (type_key) currentTypeKey = type_key;
  if (idle) renderIdle(lastWinner);
  else { socket.emit('join', gameId); renderGame(state); }
});
socket.on('throw:applied', ({ state }) => renderGame(state));
socket.on('undo:applied',  ({ state }) => renderGame(state));   // D-07: silent re-render
socket.on('game:started', function({ state, gameId, type_key }) {
  currentTypeKey = type_key;
  socket.emit('join', gameId);
  renderGame(state);
});
socket.on('game:finished', function({ state, lastWinner, typeKey }) {
  renderEndOverlay(typeKey, state, lastWinner);
  fetch('/api/highlights/current').then(function(r){ return r.json(); }).then(function(d){ tvHighlights = d; renderHighlightsHdr(); }).catch(function(){});
});

function renderIdle(lastWinner) {
  currentIdleLastWinner = lastWinner || null;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  // Restore #playerList to #game (may have been displaced by overlay replaceChildren)
  gameEl.replaceChildren(playerListEl);
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  // textContent only — no innerHTML (XSS prevention T-02-02)
  lastWinnerEl.textContent = lastWinner
    ? 'Letzter Sieger: ' + lastWinner
    : 'Noch kein Spiel gespielt';
  renderHighlightsHdr();
  renderPlayerGrid();
}

function renderPlayerGrid() {
  var gridEl = document.getElementById('player-grid');
  if (!gridEl) return;
  if (!tvPlayers || !tvPlayers.length) {
    // Race condition: renderIdle fired before DOMContentLoaded fetch completed (RESEARCH.md Pitfall 6)
    fetch('/api/players')
      .then(function(r) { return r.json(); })
      .then(function(d) { tvPlayers = d; renderPlayerGrid(); })
      .catch(function() {});
    return;
  }
  gridEl.replaceChildren();
  for (var i = 0; i < tvPlayers.length; i++) {
    var p = tvPlayers[i];
    if (p.is_guest) continue;  // guests have no photos and no persistent profile

    var cell = document.createElement('div');
    cell.style.cssText = 'text-align:center';

    // Avatar wrapper: emoji underneath, img on top (overlay pattern, D-10/D-11)
    var avWrap = document.createElement('div');
    avWrap.style.cssText = 'position:relative;width:100px;height:100px;margin:0 auto 6px';

    var emojiEl = document.createElement('div');
    emojiEl.textContent = p.emoji;  // textContent — T-02-02 compliant
    emojiEl.style.cssText = 'display:flex;align-items:center;justify-content:center;' +
      'width:100%;height:100%;font-size:44px;border-radius:50%;background:var(--card2)';

    var imgEl = document.createElement('img');
    imgEl.src = '/uploads/profiles/' + p.id + '.jpg';  // numeric id — safe (T-02-02)
    imgEl.alt = '';
    imgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover';
    imgEl.onerror = function() { this.style.display = 'none'; };  // reveals emoji on 404

    avWrap.appendChild(emojiEl);
    avWrap.appendChild(imgEl);

    var nameEl = document.createElement('div');
    nameEl.textContent = p.name;  // textContent — T-02-02
    nameEl.style.cssText = 'font-size:1.4vw;color:var(--txt);margin-top:4px';

    cell.appendChild(avWrap);
    cell.appendChild(nameEl);
    gridEl.appendChild(cell);
  }
}

function renderGame(state) {
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  // Remove any stale game name headers from previous renders
  gameEl.querySelectorAll('.tv-game-name-hdr').forEach(function(e) { e.remove(); });
  if (state && state.bracket) { renderKDABracket(state); return; }  // KDA: before state.players guard
  if (currentTypeKey === 'bilderkegel') { renderBilderkegelTV(state); return; }
  if (currentTypeKey === 'fuchsjagd')   { renderFuchsjagdTV(state); return; }
  if (currentTypeKey === 'viergewinnt') { renderViergewinntTV(state); return; }
  if (currentTypeKey === 'grosseHaus' || currentTypeKey === 'kleineHaus') { renderHausnummerTV(state); return; }
  if (currentTypeKey === 'plusMinus') { renderPlusMinusTV(state); return; }
  if (currentTypeKey === 'anker')     { renderAnkerTV(state); return; }
  if (currentTypeKey === 'dreiVollen') { renderDreiVollenTV(state); return; }
  if (!state || !state.players) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  // Add game name header for generic renderer
  var gnEl = makeGameNameHeader();
  gameEl.insertBefore(gnEl, gameEl.firstChild);

  // Re-render player list (D-01 full-width rows)
  playerListEl.replaceChildren();  // clear safely without innerHTML

  for (const player of state.players) {
    const li = document.createElement('li');
    li.className = 'player-row' + (isActivePlayer(state, player.id) ? ' active-player' : '');

    // 40px circle avatar (D-19) — emoji underneath, img on top
    var avEl = document.createElement('div');
    avEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:10px';

    var avEmoji = document.createElement('span');
    avEmoji.textContent = (player.emoji != null ? player.emoji : '');  // textContent — T-02-02
    avEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;' +
      'width:100%;height:100%;font-size:38px';

    var avImg = document.createElement('img');
    avImg.src = '/uploads/profiles/' + player.id + '.jpg';  // numeric id — safe
    avImg.alt = '';
    avImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    avImg.onerror = function() { this.style.display = 'none'; };

    avEl.appendChild(avEmoji);
    avEl.appendChild(avImg);

    // Name span — emoji removed from textContent (avatar carries it now)
    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = player.name;  // textContent only — T-02-02

    // Last throw column (D-03 permanent column)
    const throwEl = document.createElement('div');
    throwEl.className = 'last-throw';

    const throwLabel = document.createElement('div');
    throwLabel.className = 'label';
    throwLabel.textContent = 'Letzter Wurf';  // textContent — safe

    const throwValue = document.createElement('div');
    throwValue.className = 'value';
    const lastThrow = player.wuerfe && player.wuerfe.length > 0
      ? player.wuerfe[player.wuerfe.length - 1]
      : '—';  // em dash
    throwValue.textContent = lastThrow;  // textContent — safe (T-02-02)

    throwEl.appendChild(throwLabel);
    throwEl.appendChild(throwValue);

    // Score span — min 72px via CSS class (TV-03)
    const scoreEl = document.createElement('span');
    scoreEl.className = 'player-score';
    scoreEl.textContent = getScore(player);  // textContent — safe (T-02-02)

    li.appendChild(avEl);
    li.appendChild(nameEl);
    li.appendChild(throwEl);
    li.appendChild(scoreEl);
    playerListEl.appendChild(li);
  }

}

function isActivePlayer(state, playerId) {
  // state.aktSpIdx points to current player index; players array is ordered by seat
  if (state.aktSpIdx === undefined) return false;
  return state.players[state.aktSpIdx] != null && state.players[state.aktSpIdx].id === playerId;
}

function getScore(player) {
  // Use explicit score field if present; otherwise sum numeric wuerfe values as fallback
  if (player.score !== undefined) return player.score;
  if (player.wuerfe) {
    return player.wuerfe.reduce(function(a, b) {
      return a + (typeof b === 'number' ? b : 0);
    }, 0);
  }
  return 0;
}

// KDA bracket TV renderer — W top, L below, GF only when both finalists ready (TVFIX-02)
function renderKDABracket(state) {
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var vw = (typeof window !== 'undefined' && window.innerWidth)  ? window.innerWidth  : 1920;
  var vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080;

  var wR1Count = state.bracket.filter(function(m) { return m.bracket === 'W' && m.round === 1; }).length;
  var wColCount = (new Set(state.bracket.filter(function(m){return m.bracket==='W';}).map(function(m){return m.round;}))).size;
  var lColCount = (new Set(state.bracket.filter(function(m){return m.bracket==='L';}).map(function(m){return m.round;}))).size;
  var colGap = 12;

  // GF: only show when both finalists are determined
  var gfSlot = state.bracket.find(function(m) { return m.bracket === 'GF'; });
  var gfVisible = !!(gfSlot && gfSlot.p1 && gfSlot.p2);
  var gfH = gfVisible ? 160 : 0;

  // Slot widths: each section spans full viewport width independently
  var availW = vw - 48;
  var wSlotWidth = Math.max(80, Math.min(220, Math.floor((availW - colGap * Math.max(0, wColCount - 1)) / Math.max(1, wColCount))));
  var lSlotWidth = Math.max(80, Math.min(220, Math.floor((availW - colGap * Math.max(0, lColCount - 1)) / Math.max(1, lColCount))));

  // Slot heights: stacked sections share available vertical space
  var lMatches = state.bracket.filter(function(m) { return m.bracket === 'L'; });
  var lRoundsArr = Array.from(new Set(lMatches.map(function(m) { return m.round; }))).sort(function(a, b) { return a - b; });
  var maxLColRows = lRoundsArr.length > 0 ? Math.max.apply(null, lRoundsArr.map(function(r) { return lMatches.filter(function(m) { return m.round === r; }).length; })) : 1;
  var availH = vh - 40 - 12 - gfH; // container padding(20×2) + section gap + GF
  var wH = Math.floor(availH * 0.45);
  var lH = availH - wH - 12;
  var wSlotHeight = Math.max(52, Math.min(110, Math.floor((wH - 44) / Math.max(1, wR1Count))));
  var lSlotHeight = Math.max(52, Math.min(110, Math.floor((lH - 44) / Math.max(1, maxLColRows))));

  // Outer container
  var container = document.createElement('div');
  container.className = 'kda-tv-bracket';
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:20px 24px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;overflow:hidden';

  // --- Winner Bracket (top) ---
  var wSection = document.createElement('div');
  wSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:0 0 ' + wH + 'px;overflow:hidden';

  var wLabel = document.createElement('div');
  wLabel.textContent = 'Winner Bracket';
  wLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--ac);line-height:1';
  wSection.appendChild(wLabel);

  var wRoundsRow = document.createElement('div');
  wRoundsRow.style.cssText = 'display:flex;flex-direction:row;gap:' + colGap + 'px;align-items:flex-start;flex:1;min-height:0';

  var wMatches = state.bracket.filter(function(m) { return m.bracket === 'W'; });
  var wRounds = Array.from(new Set(wMatches.map(function(m) { return m.round; }))).sort(function(a, b) { return a - b; });
  var wTotalRounds = wRounds.length;

  wRounds.forEach(function(round) {
    var col = document.createElement('div');
    col.className = 'tv-bracket-col';
    col.style.cssText = 'display:flex;flex-direction:column;justify-content:space-around;gap:6px';
    var roundLabel = document.createElement('div');
    roundLabel.textContent = kdaTVRoundLabel('W', round, wTotalRounds);
    roundLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);text-transform:uppercase;margin-bottom:2px;white-space:nowrap';
    col.appendChild(roundLabel);
    wMatches.filter(function(m) { return m.round === round; }).forEach(function(slot) {
      col.appendChild(buildTVSlotEl(slot, wSlotWidth, wSlotHeight));
    });
    wRoundsRow.appendChild(col);
  });
  wSection.appendChild(wRoundsRow);
  container.appendChild(wSection);

  // --- Loser Bracket (below Winner) ---
  if (lMatches.length > 0) {
    var lSection = document.createElement('div');
    lSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:0 0 ' + lH + 'px;overflow:hidden;border-top:1px solid var(--brd);padding-top:4px';

    var lLabel = document.createElement('div');
    lLabel.textContent = 'Loser Bracket';
    lLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--red);line-height:1';
    lSection.appendChild(lLabel);

    var lRoundsRow = document.createElement('div');
    lRoundsRow.style.cssText = 'display:flex;flex-direction:row;gap:' + colGap + 'px;align-items:flex-start;flex:1;min-height:0';

    var lTotalRounds = lRoundsArr.length;
    lRoundsArr.forEach(function(round) {
      var col = document.createElement('div');
      col.className = 'tv-bracket-col';
      col.style.cssText = 'display:flex;flex-direction:column;justify-content:space-around;gap:6px';
      var roundLabel = document.createElement('div');
      roundLabel.textContent = kdaTVRoundLabel('L', round, lTotalRounds);
      roundLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);text-transform:uppercase;margin-bottom:2px;white-space:nowrap';
      col.appendChild(roundLabel);
      lMatches.filter(function(m) { return m.round === round; }).forEach(function(slot) {
        col.appendChild(buildTVSlotEl(slot, lSlotWidth, lSlotHeight));
      });
      lRoundsRow.appendChild(col);
    });
    lSection.appendChild(lRoundsRow);
    container.appendChild(lSection);
  }

  // --- Grand Final: only when both finalists are determined ---
  if (gfVisible) {
    var gfStage = document.createElement('div');
    gfStage.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding-top:12px;border-top:2px solid var(--ac);width:100%;flex:0 0 ' + (gfH - 12) + 'px';
    var gfLabel = document.createElement('div');
    gfLabel.textContent = 'Großes Finale';
    gfLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:32px;color:var(--ac);line-height:1;letter-spacing:0.06em;text-transform:uppercase';
    gfStage.appendChild(gfLabel);
    var gfSlotEl = buildTVSlotEl(gfSlot, Math.min(availW, Math.round(wSlotWidth * 2.5)), Math.round(wSlotHeight * 1.3));
    gfSlotEl.style.boxShadow = (gfSlotEl.style.boxShadow || '') + ';0 0 32px #e8b84b44';
    gfStage.appendChild(gfSlotEl);
    container.appendChild(gfStage);
  }

  gameEl.replaceChildren(container);
}

// Build a single TV bracket slot element — textContent only (T-06-04-01, no innerHTML)
function buildTVSlotEl(slot, w, h) {
  var el = document.createElement('div');
  el.className = 'tv-bracket-slot';

  var isActive = !slot.done && !slot.isBye && slot.p1 && slot.p2;
  // Bye slots: single-player, compact height
  var byeH = Math.round(h * 0.55);
  var elH = slot.isBye ? byeH : h;

  // Scale padding for narrow slots (< 160px) to give names more room
  var padH = w >= 160 ? 12 : 8;

  if (isActive) {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:8px;display:flex;flex-direction:column;justify-content:space-around;padding:6px ' + padH + 'px;box-sizing:border-box;border:2px solid var(--ac);box-shadow:0 0 16px #e8b84b33';
  } else if (slot.isBye) {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:6px;display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:4px ' + padH + 'px;box-sizing:border-box;border:1px dashed var(--brd);opacity:0.5';
  } else {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:8px;display:flex;flex-direction:column;justify-content:space-around;padding:6px ' + padH + 'px;box-sizing:border-box;border:1px solid var(--brd)';
  }

  // --- Bye slot: single row with name + BYE badge ---
  if (slot.isBye) {
    var p = slot.winner || slot.p1;
    var byeName = document.createElement('span');
    byeName.textContent = p ? ((p.emoji != null ? p.emoji : '') + ' ' + p.name) : '—';  // textContent — XSS safe (T-06-04-01)
    var byeNameFontSize = w >= 160 ? 18 : w >= 120 ? 15 : 12;
    byeName.style.cssText = 'font-size:' + byeNameFontSize + 'px;font-weight:600;color:var(--mut);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    el.appendChild(byeName);

    var byeBadge = document.createElement('span');
    byeBadge.textContent = 'BYE';
    byeBadge.style.cssText = 'font-size:11px;font-weight:700;color:var(--mut);background:var(--brd);border-radius:4px;padding:2px 5px;flex-shrink:0;margin-left:6px;letter-spacing:0.05em';
    el.appendChild(byeBadge);
    return el;
  }

  // --- Normal slot: two player rows ---
  var players = [slot.p1, slot.p2];

  players.forEach(function(p) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;min-width:0';

    var nameSpan = document.createElement('span');
    if (p) {
      nameSpan.textContent = (p.emoji != null ? p.emoji : '') + ' ' + p.name;  // textContent — XSS safe (T-06-04-01)
      var nameFontSize = w >= 160 ? 20 : w >= 120 ? 16 : 13;
      nameSpan.style.cssText = 'font-size:' + nameFontSize + 'px;font-weight:600;color:var(--txt);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    } else {
      // Empty: waiting for player to arrive
      nameSpan.textContent = '·  ·  ·';
      nameSpan.style.cssText = 'font-size:14px;font-weight:400;color:var(--mut);flex:1;min-width:0;letter-spacing:4px';
    }

    var scoreFontSize = w >= 160 ? 26 : w >= 120 ? 20 : 16;
    var scoreSpan = document.createElement('span');
    scoreSpan.style.cssText = 'font-size:' + scoreFontSize + 'px;font-family:var(--fh,"Bebas Neue",sans-serif);flex-shrink:0;margin-left:6px';

    if (p && slot.throws) {
      var playerThrows = slot.throws.filter(function(t) { return t.playerId === p.id; });
      if (playerThrows.length === 0) {
        scoreSpan.textContent = '—';
        scoreSpan.style.color = 'var(--mut)';
      } else {
        var sum = playerThrows.reduce(function(acc, t) { return acc + (typeof t.value === 'number' ? t.value : 0); }, 0);
        if (!slot.done) {
          scoreSpan.textContent = String(sum) + ' ⚫';
          scoreSpan.style.color = 'var(--ac)';
        } else if (slot.winner && slot.winner.id === p.id) {
          scoreSpan.textContent = String(sum);
          scoreSpan.style.color = 'var(--grn)';
        } else {
          scoreSpan.textContent = String(sum);
          scoreSpan.style.color = 'var(--red)';
          scoreSpan.style.opacity = '0.6';
        }
      }
    } else {
      scoreSpan.textContent = p ? '—' : '';
      scoreSpan.style.color = 'var(--mut)';
    }

    row.appendChild(nameSpan);
    row.appendChild(scoreSpan);
    el.appendChild(row);
  });

  return el;
}

// BK score helper — sum bildPts, null entries count as 0
function bkTotal(p) {
  return (p.bildPts || []).reduce(function(a, b) { return a + (b !== null ? b : 0); }, 0);
}

// BK loser detection — player with the minimum bkTotal, excluding außer-Konkurrenz
function getBKLoserName(state) {
  if (!state || !state.players || !state.players.length) return '—';
  var eligible = state.players.filter(function(p) { return p.id !== state.exemptPlayerId; });
  var pool = eligible.length > 0 ? eligible : state.players;
  var withTotals = pool.map(function(p) { return { name: p.name, total: bkTotal(p) }; });
  withTotals.sort(function(a, b) { return a.total - b.total; });
  return withTotals[0].name;
}

// End-of-game full-screen overlay (UI-SPEC: tv-end-overlay)
function renderEndOverlay(typeKey, state, lastWinner) {
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  // Unknown game type: skip overlay, go idle after short delay
  if (typeKey !== 'kda' && typeKey !== 'bilderkegel') {
    overlayTimeoutId = setTimeout(function() { overlayTimeoutId = null; renderIdle(lastWinner || null); }, 90000);
    return;
  }

  var overlayEl = document.createElement('div');
  overlayEl.className = 'tv-end-overlay';
  overlayEl.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:var(--bg);padding:32px 48px;box-sizing:border-box;text-align:center';

  var emojiEl = document.createElement('div');
  emojiEl.className = 'tv-overlay-emoji';
  emojiEl.style.cssText = 'font-size:10vw;line-height:1';

  var nameEl = document.createElement('div');
  nameEl.className = 'tv-overlay-name';
  nameEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:15vw;line-height:1;font-weight:400';

  var subtitleEl = document.createElement('div');
  subtitleEl.className = 'tv-overlay-subtitle';
  subtitleEl.style.cssText = 'font-family:var(--fb,"DM Sans",sans-serif);font-size:4vw;font-weight:600;line-height:1.2;color:var(--txt)';

  if (typeKey === 'kda') {
    emojiEl.textContent = '🏆';
    nameEl.textContent = lastWinner || '—';  // textContent — XSS safe (T-07-03-01)
    nameEl.style.color = 'var(--ac)';
    subtitleEl.textContent = '— Kegler des Abends!';
    playKDAToneTV();
  } else {
    // typeKey === 'bilderkegel'
    emojiEl.textContent = '💩';
    nameEl.textContent = getBKLoserName(state);  // textContent — XSS safe (T-07-03-01)
    nameEl.style.color = 'var(--red)';
    subtitleEl.textContent = '— Bilderkegeln-Verlierer!';
  }

  overlayEl.appendChild(emojiEl);
  overlayEl.appendChild(nameEl);
  overlayEl.appendChild(subtitleEl);

  idleEl.style.display = 'none';
  gameEl.classList.add('active');
  gameEl.replaceChildren(overlayEl);

  overlayTimeoutId = setTimeout(function() { overlayTimeoutId = null; renderIdle(lastWinner || null); }, 90000);
}

// Bilderkegeln TV layout — scales for 4–12 players; bild section + row fonts shrink with player count
function renderBilderkegelTV(state) {
  if (!state || !state.players) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var n = state.players.length;

  var BK_BILDER_TV = [
    {id:'volle',name:'Volle',pins:[1,2,3,4,5,6,7,8,9]},
    {id:'kleeblatt',name:'Kleeblatt',pins:[2,3,4,6,7,8]},
    {id:'hint_kranz',name:'Hint. Kranz',pins:[4,6,7,8,9]},
    {id:'damen',name:'Damen',pins:[2,3,7,8]},
    {id:'bauern',name:'Bauern',pins:[4,6]}
  ];

  // Bild section sizing — compress SVG and font for large player counts
  var svgW, svgH, bildNameVw, bildNumVw;
  if (n <= 6)      { svgW = 120; svgH = 150; bildNameVw = 8;   bildNumVw = 2;   }
  else if (n <= 8) { svgW = 88;  svgH = 110; bildNameVw = 6;   bildNumVw = 1.5; }
  else             { svgW = 64;  svgH = 80;  bildNameVw = 4.5; bildNumVw = 1.2; }

  // Player row sizing — fonts shrink so all rows fit in remaining height
  var namePx, scorePx, rowPad;
  if (n <= 4)       { namePx = 36; scorePx = 72; rowPad = '1.5vw 2vw'; }
  else if (n <= 6)  { namePx = 32; scorePx = 60; rowPad = '1vw 2vw';   }
  else if (n <= 8)  { namePx = 26; scorePx = 48; rowPad = '0.6vw 2vw'; }
  else if (n <= 10) { namePx = 22; scorePx = 40; rowPad = '0.4vw 2vw'; }
  else              { namePx = 18; scorePx = 32; rowPad = '0.2vw 2vw'; }

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:2vw;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden';

  container.appendChild(makeGameNameHeader());

  if (!state.done && state.aktBildIdx >= 0 && state.aktBildIdx < BK_BILDER_TV.length) {
    var bildInfo = BK_BILDER_TV[state.aktBildIdx];

    var bildSection = document.createElement('div');
    bildSection.style.cssText = 'text-align:center;flex-shrink:0;margin-bottom:8px';

    var bildNameEl = document.createElement('div');
    bildNameEl.textContent = bildInfo.name;  // textContent — safe (static data)
    bildNameEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:' + bildNameVw + 'vw;color:var(--ac);line-height:1';

    var svgEl = document.createElement('div');
    svgEl.innerHTML = kegelSVGtv(bildInfo.pins, svgW, svgH);  // SVG built from static pin data — no user input
    svgEl.style.cssText = 'margin:4px auto';

    var bildNumEl = document.createElement('div');
    bildNumEl.textContent = 'Bild ' + (state.aktBildIdx + 1) + '/5';  // textContent — safe
    bildNumEl.style.cssText = 'font-size:' + bildNumVw + 'vw;color:var(--mut);margin-top:2px';

    bildSection.appendChild(bildNameEl);
    bildSection.appendChild(svgEl);
    bildSection.appendChild(bildNumEl);
    container.appendChild(bildSection);
  }

  // Determine if game has started (any bildPts entry is non-null or aktBildIdx > 0)
  var gameStarted = (state.aktBildIdx > 0) ||
    state.players.some(function(p) {
      return (p.bildPts || []).some(function(v) { return v !== null; });
    });

  // Find loser (player with minimum bkTotal) — only highlight after game has started
  var minTotal = null;
  var loserIdx  = -1;
  if (gameStarted) {
    state.players.forEach(function(p, idx) {
      if (p.id === state.exemptPlayerId) return;  // außer Konkurrenz — excluded from loser
      var tot = bkTotal(p);
      if (minTotal === null || tot < minTotal) {
        minTotal = tot;
        loserIdx  = idx;
      }
    });
  }

  var aktId = (!state.done && state.players[state.aktSpIdx]) ? state.players[state.aktSpIdx].id : null;

  // Player list fills remaining height; rows share space equally via flex
  var ul = document.createElement('ul');
  ul.style.cssText = 'list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden';

  state.players.forEach(function(player, idx) {
    var li = document.createElement('li');
    var isLoser = idx === loserIdx;
    var isActive = player.id === aktId;
    // Active takes visual priority over loser; transparent border keeps padding consistent across all rows
    var borderColor = isActive ? 'var(--ac)' : (isLoser ? 'var(--red)' : 'transparent');
    var bgExtra = isActive ? ';background:color-mix(in srgb,var(--ac) 8%,transparent)'
                : (isLoser  ? ';background:rgba(224,82,82,0.07)' : '');
    li.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;padding:' + rowPad
      + ';border-radius:8px;border-left:4px solid ' + borderColor + ';padding-left:calc(2vw - 4px)' + bgExtra;

    // 40px avatar — emoji underneath, photo on top (T-02-02)
    var bkAvEl = document.createElement('div');
    bkAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:10px';
    var bkAvEmoji = document.createElement('span');
    bkAvEmoji.textContent = player.emoji != null ? player.emoji : '';  // textContent — T-02-02
    bkAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
    var bkAvImg = document.createElement('img');
    bkAvImg.src = '/uploads/profiles/' + player.id + '.jpg';  // numeric id — safe
    bkAvImg.alt = '';
    bkAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    bkAvImg.onerror = function() { this.style.display = 'none'; };
    bkAvEl.appendChild(bkAvEmoji);
    bkAvEl.appendChild(bkAvImg);

    var nameEl = document.createElement('span');
    nameEl.style.cssText = 'flex:1;font-size:' + namePx + 'px;font-family:var(--fh,"Bebas Neue",sans-serif);letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
    nameEl.textContent = player.name;  // textContent — XSS safe (T-07-03-04); emoji in avatar

    var scoreEl = document.createElement('span');
    scoreEl.style.cssText = 'width:12vw;text-align:right;font-family:var(--fh,"Bebas Neue",sans-serif);font-size:' + scorePx + 'px;color:var(--ac);flex-shrink:0';
    scoreEl.textContent = bkTotal(player);  // textContent — safe

    li.appendChild(bkAvEl);
    li.appendChild(nameEl);
    li.appendChild(scoreEl);
    ul.appendChild(li);
  });

  container.appendChild(ul);
  gameEl.replaceChildren(container);
}

// Fuchsjagd TV layout — split Fuchs/Jäger panels with active highlighting + throw countdown
function renderFuchsjagdTV(state) {
  if (!state) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  // Determine who is active
  var isFuchsTurn  = !state.done && (state.phase === 'start' || state.jPhase === 'fuchs');
  var activeJIdx   = (!state.done && state.jPhase === 'jaeger') ? (state.jIdx || 0) : -1;

  // Remaining throws until game ends (jagd phase only)
  var remainingThrows = null;
  if (!state.done && state.phase === 'jagd') {
    if (state.finalRound) {
      remainingThrows = 1;
    } else {
      var fuchsJagdLeft = Math.max(0, 6 - Math.max(0, (state.fuchs.w.length || 0) - 2));
      remainingThrows = (state.jPhase === 'jaeger') ? 2 * fuchsJagdLeft + 1 : 2 * fuchsJagdLeft;
    }
  }

  // Fuchs jagd progress (e.g. "2/6")
  var fuchsJagdDone = Math.max(0, (state.fuchs.w.length || 0) - 2);

  var container = document.createElement('div');
  container.className = 'fj-tv-layout';
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);display:flex;flex-direction:column;padding:2vw;box-sizing:border-box;gap:12px';

  // Panels row
  var panelsRow = document.createElement('div');
  panelsRow.style.cssText = 'flex:1;display:flex;flex-direction:row;align-items:stretch;gap:0;min-height:0';

  // --- LEFT PANEL: Fuchs ---
  var fuchsPanel = document.createElement('div');
  fuchsPanel.className = 'fj-fuchs-panel';
  fuchsPanel.style.cssText = 'flex:1;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;transition:all .3s;'
    + (isFuchsTurn
      ? 'background:rgba(232,184,75,0.15);border:2px solid var(--ac);box-shadow:0 0 32px #e8b84b44'
      : 'background:var(--card);border:2px solid transparent');

  var fuchsLabel = document.createElement('div');
  fuchsLabel.textContent = 'FUCHS';
  fuchsLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;letter-spacing:2px;color:'
    + (isFuchsTurn ? 'var(--ac)' : 'var(--mut)');

  // Fuchs avatar
  var fjFuchsAvEl = document.createElement('div');
  fjFuchsAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0';
  var fjFuchsAvEmoji = document.createElement('span');
  fjFuchsAvEmoji.textContent = state.fuchs.emoji != null ? state.fuchs.emoji : '';  // textContent — T-02-02
  fjFuchsAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
  var fjFuchsAvImg = document.createElement('img');
  fjFuchsAvImg.src = '/uploads/profiles/' + state.fuchs.id + '.jpg';  // numeric id — safe
  fjFuchsAvImg.alt = '';
  fjFuchsAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
  fjFuchsAvImg.onerror = function() { this.style.display = 'none'; };
  fjFuchsAvEl.appendChild(fjFuchsAvEmoji);
  fjFuchsAvEl.appendChild(fjFuchsAvImg);
  fuchsPanel.appendChild(fjFuchsAvEl);

  var fuchsName = document.createElement('div');
  fuchsName.textContent = (isFuchsTurn ? '▶ ' : '') + state.fuchs.name;  // textContent — XSS safe; emoji in avatar
  fuchsName.style.cssText = 'font-size:36px;font-family:var(--fh,"Bebas Neue",sans-serif);line-height:1;color:'
    + (isFuchsTurn ? 'var(--ac)' : 'var(--txt)');

  var fuchsThrows = document.createElement('div');
  fuchsThrows.textContent = state.fuchs.w && state.fuchs.w.length > 0 ? state.fuchs.w.join(', ') : '—';
  fuchsThrows.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);color:var(--mut)';

  var fuchsScore = document.createElement('div');
  fuchsScore.textContent = 'Noch: ' + String(state.fp != null ? state.fp : '—');  // textContent — safe
  fuchsScore.style.cssText = 'font-size:72px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--ac);line-height:1';

  // Jagd progress indicator (only during jagd phase)
  var fuchsProgress = document.createElement('div');
  if (state.phase === 'jagd') {
    fuchsProgress.textContent = 'Jagd-Würfe: ' + fuchsJagdDone + ' / 6';  // textContent — safe
    fuchsProgress.style.cssText = 'font-size:16px;font-family:var(--fb,"DM Sans",sans-serif);color:var(--mut)';
  }

  fuchsPanel.appendChild(fuchsLabel);
  fuchsPanel.appendChild(fuchsName);
  fuchsPanel.appendChild(fuchsThrows);
  fuchsPanel.appendChild(fuchsScore);
  if (state.phase === 'jagd') fuchsPanel.appendChild(fuchsProgress);

  // --- VERTICAL DIVIDER ---
  var divider = document.createElement('div');
  divider.style.cssText = 'width:1px;background:var(--brd);align-self:center;height:80%;margin:0 24px;flex-shrink:0';

  // --- RIGHT PANEL: Jäger — adaptive sizing based on count (TVFIX-01) ---
  var jaeger = state.jaeger || [];
  var jCount = jaeger.length;
  var fjAvSize   = jCount >= 10 ? 40 : jCount >= 7 ? 56 : 80;
  var fjNameSz   = jCount >= 10 ? 18 : jCount >= 7 ? 22 : 28;
  var fjRowPadV  = jCount >= 10 ?  3 : jCount >= 7 ?  5 : 10;
  var fjRowPadH  = jCount >= 10 ?  8 : jCount >= 7 ? 10 : 12;
  var fjPanelGap = jCount >= 10 ?  4 : jCount >= 7 ?  8 : 16;
  var fjPanelPad = jCount >= 10 ? 12 : 24;
  var fjEmoSz    = Math.round(fjAvSize * 0.47);

  var jaegerActive = activeJIdx >= 0;
  var jaegerPanel = document.createElement('div');
  jaegerPanel.className = 'fj-jaeger-panel';
  jaegerPanel.style.cssText = 'flex:1;border-radius:12px;padding:' + fjPanelPad + 'px;display:flex;flex-direction:column;align-items:center;gap:' + fjPanelGap + 'px;'
    + (jaegerActive
      ? 'background:rgba(232,184,75,0.08);border:2px solid var(--brd)'
      : 'background:var(--card);border:2px solid transparent');

  var jaegerLabel = document.createElement('div');
  jaegerLabel.textContent = 'JÄGER';
  jaegerLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);letter-spacing:2px';
  jaegerPanel.appendChild(jaegerLabel);

  jaeger.forEach(function(j, idx) {
    var isActive = idx === activeJIdx;
    var row = document.createElement('div');
    row.className = 'fj-jaeger-row';
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;padding:' + fjRowPadV + 'px ' + fjRowPadH + 'px;border-radius:8px;'
      + (isActive
        ? 'background:rgba(232,184,75,0.2);border:1px solid var(--ac)'
        : 'background:transparent;border:1px solid transparent');

    // Jäger avatar — size scales with Jäger count
    var fjJAvEl = document.createElement('div');
    fjJAvEl.style.cssText = 'position:relative;width:' + fjAvSize + 'px;height:' + fjAvSize + 'px;flex-shrink:0;margin-right:8px';
    var fjJAvEmoji = document.createElement('span');
    fjJAvEmoji.textContent = j.emoji != null ? j.emoji : '';  // textContent — T-02-02
    fjJAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:' + fjEmoSz + 'px';
    var fjJAvImg = document.createElement('img');
    fjJAvImg.src = '/uploads/profiles/' + j.id + '.jpg';  // numeric id — safe
    fjJAvImg.alt = '';
    fjJAvImg.style.cssText = 'position:absolute;inset:0;width:' + fjAvSize + 'px;height:' + fjAvSize + 'px;border-radius:50%;object-fit:cover';
    fjJAvImg.onerror = function() { this.style.display = 'none'; };
    fjJAvEl.appendChild(fjJAvEmoji);
    fjJAvEl.appendChild(fjJAvImg);

    var nameSpan = document.createElement('span');
    nameSpan.textContent = (isActive ? '▶ ' : '') + j.name;  // textContent — XSS safe; emoji in avatar
    nameSpan.style.cssText = 'font-size:' + fjNameSz + 'px;font-family:var(--fh,"Bebas Neue",sans-serif);color:'
      + (isActive ? 'var(--ac)' : 'var(--txt)');

    var contribSpan = document.createElement('span');
    contribSpan.textContent = String((j.w || []).reduce(function(a, b) { return a + b; }, 0));  // textContent — safe
    contribSpan.style.cssText = 'font-size:' + fjNameSz + 'px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--mut)';

    row.appendChild(fjJAvEl);
    row.appendChild(nameSpan);
    row.appendChild(contribSpan);
    jaegerPanel.appendChild(row);
  });

  panelsRow.appendChild(fuchsPanel);
  panelsRow.appendChild(divider);
  panelsRow.appendChild(jaegerPanel);

  container.insertBefore(makeGameNameHeader(), container.firstChild);
  container.appendChild(panelsRow);

  // --- FOOTER: remaining throws countdown ---
  if (remainingThrows !== null) {
    var footer = document.createElement('div');
    if (state.finalRound) {
      footer.textContent = 'Letzter Jäger-Wurf!';
      footer.style.cssText = 'text-align:center;font-size:2.8vw;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--ac);letter-spacing:0.06em;flex-shrink:0';
    } else {
      footer.textContent = 'Noch ' + remainingThrows + (remainingThrows === 1 ? ' Wurf' : ' Würfe') + ' bis Spielende';
      footer.style.cssText = 'text-align:center;font-size:2vw;font-family:var(--fb,"DM Sans",sans-serif);color:var(--mut);flex-shrink:0';
    }
    container.appendChild(footer);
  }

  gameEl.replaceChildren(container);
}

// Große/Kleine Hausnummer TV layout — 2-column player grid, H/Z/E slots per player
function renderHausnummerTV(state) {
  if (!state) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var isKleine = currentTypeKey === 'kleineHaus';
  var players = state.players || [];
  var aktId = players[state.aktSpIdx] ? players[state.aktSpIdx].id : null;

  function score(p) {
    var sl = p.slots;
    if (sl.h === null || sl.z === null || sl.e === null) return null;
    return (sl.h * 100) + (sl.z * 10) + sl.e;
  }

  var sorted = players.slice().sort(function(a, b) {
    var va = score(a), vb = score(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return isKleine ? va - vb : vb - va;
  });

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--bg);box-sizing:border-box;overflow:hidden;padding:1vw 2vw';
  container.appendChild(makeGameNameHeader());

  var sub = document.createElement('div');
  sub.style.cssText = 'text-align:center;font-size:1.2vw;color:var(--mut);margin-bottom:0.8vw';
  sub.textContent = isKleine ? 'Niedrigste Zahl gewinnt · Pudel = 9' : 'Höchste Zahl gewinnt · Pudel = 0';
  container.appendChild(sub);

  var grid = document.createElement('div');
  grid.style.cssText = 'flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.6vw;align-content:start;overflow:hidden';

  sorted.forEach(function(p, i) {
    var isActive = p.id === aktId && !state.done;
    var sl = p.slots;
    var sc = score(p);
    var isLeader = i === 0 && sc !== null;

    var row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:0.8vw;padding:0.7vw 1vw',
      'border-radius:10px;border:2px solid ' + (isActive ? 'var(--ac)' : 'var(--brd)'),
      'background:' + (isActive ? 'color-mix(in srgb, var(--ac) 10%, var(--card))' : 'var(--card)'),
      'box-shadow:' + (isActive ? '0 0 14px color-mix(in srgb, var(--ac) 30%, transparent)' : 'none')
    ].join(';');

    var rank = document.createElement('div');
    rank.textContent = String(i + 1);
    rank.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2vw;color:' + (isLeader && state.done ? 'gold' : 'var(--mut)') + ';min-width:1.8vw;text-align:center';
    row.appendChild(rank);

    // 40px avatar
    var hnAvEl = document.createElement('div');
    hnAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:6px';
    var hnAvEmoji = document.createElement('span');
    hnAvEmoji.textContent = p.emoji != null ? p.emoji : '';  // textContent — T-02-02
    hnAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
    var hnAvImg = document.createElement('img');
    hnAvImg.src = '/uploads/profiles/' + p.id + '.jpg';
    hnAvImg.alt = '';
    hnAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    hnAvImg.onerror = function() { this.style.display = 'none'; };
    hnAvEl.appendChild(hnAvEmoji);
    hnAvEl.appendChild(hnAvImg);

    var name = document.createElement('div');
    name.textContent = p.name;  // textContent — XSS safe; emoji in avatar
    name.style.cssText = 'flex:1;font-size:2.5vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    row.appendChild(hnAvEl);
    row.appendChild(name);

    [['h','H'],['z','Z'],['e','E']].forEach(function(pair) {
      var slot = pair[0], lbl = pair[1];
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.5vw';
      var lEl = document.createElement('div');
      lEl.textContent = lbl;
      lEl.style.cssText = 'font-size:1.2vw;color:var(--mut);line-height:1';
      var vEl = document.createElement('div');
      vEl.textContent = sl[slot] !== null ? String(sl[slot]) : '—';
      vEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.8vw;color:' + (sl[slot] !== null ? 'var(--txt)' : 'var(--brd)') + ';line-height:1.1';
      wrap.appendChild(lEl);
      wrap.appendChild(vEl);
      row.appendChild(wrap);
    });

    var total = document.createElement('div');
    total.textContent = sc !== null ? String(sc) : '·';
    total.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.8vw;min-width:4.5vw;text-align:right;color:' + (sc !== null ? (isLeader ? 'var(--ac)' : 'var(--txt)') : 'var(--brd)');
    row.appendChild(total);

    grid.appendChild(row);
  });

  container.appendChild(grid);
  gameEl.replaceChildren(container);
}

// Anker TV layout — player grid with round scores, scoring chips, pin diagram
function renderAnkerTV(state) {
  if (!state || !state.players) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var players = state.players || [];
  var aktId = (players[state.aktSpIdx] && !state.done) ? players[state.aktSpIdx].id : null;

  function rundTotal(p) {
    return p.runden.reduce(function(t, r) { return t + r.reduce(function(a, b) { return a + b; }, 0); }, 0);
  }

  var sorted = players.slice().sort(function(a, b) { return rundTotal(b) - rundTotal(a); });

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--bg);box-sizing:border-box;overflow:hidden;padding:1vw 2vw';
  container.appendChild(makeGameNameHeader());

  // Round + active player indicator
  var rndEl = document.createElement('div');
  rndEl.style.cssText = 'text-align:center;font-size:1.2vw;color:var(--mut);margin-bottom:0.5vw;flex-shrink:0';
  if (state.done) {
    rndEl.textContent = 'Spiel beendet';
  } else {
    var aktP = players[state.aktSpIdx];
    rndEl.textContent = 'Runde ' + state.aktRunde + '/' + state.maxRunden
      + ' · Wurf ' + (state.wurfNr + 1) + '/5'
      + (aktP ? ' · ' + (aktP.emoji || '') + ' ' + aktP.name : '');
  }
  container.appendChild(rndEl);

  // Scoring legend row: chips + pin diagram
  var legendRow = document.createElement('div');
  legendRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:1.5vw;margin-bottom:0.7vw;flex-shrink:0';

  var chips = document.createElement('div');
  chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4vw;justify-content:center;align-content:center';
  [
    { label: 'Bauer (4, 6) einzeln = 10', col: 'var(--ac)' },
    { label: 'Dame (7, 8) einzeln = 5',   col: '#5b8dee' },
    { label: 'Bärbel (1+5+9) zusammen = 10', col: '#4caf7d' },
    { label: 'Pudel = 0 · Sonst 1/Kegel', col: 'var(--mut)' }
  ].forEach(function(chip) {
    var s = document.createElement('span');
    s.textContent = chip.label;  // textContent — safe
    s.style.cssText = 'border:1px solid ' + chip.col + ';border-radius:5px;padding:0.15vw 0.5vw;font-size:0.9vw;font-weight:600;color:' + chip.col;
    chips.appendChild(s);
  });
  legendRow.appendChild(chips);

  // SVG pin diagram — coloured by role
  (function() {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '-14 -5 108 130');
    svg.setAttribute('width', '6vw');
    svg.setAttribute('height', '7vw');
    var pinColors = { 4:'var(--ac)', 6:'var(--ac)', 7:'#5b8dee', 8:'#5b8dee', 1:'#4caf7d', 5:'#4caf7d', 9:'#4caf7d' };
    var pins = [
      {n:9,x:40,y:10},{n:7,x:22,y:35},{n:8,x:58,y:35},
      {n:4,x:5,y:60},{n:5,x:40,y:60},{n:6,x:75,y:60},
      {n:2,x:22,y:85,inactive:true},{n:3,x:58,y:85,inactive:true},{n:1,x:40,y:110}
    ];
    pins.forEach(function(p) {
      var col = p.inactive ? 'none' : (pinColors[p.n] || '#555');
      var stroke = p.inactive ? '#e05252' : col;
      var c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', '9');
      c.setAttribute('fill', p.inactive ? 'none' : '#1a1a2e');
      c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', '2');
      if (p.inactive) c.setAttribute('stroke-dasharray', '3 2');
      var t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', p.x); t.setAttribute('y', p.y + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
      t.setAttribute('font-weight', 'bold'); t.setAttribute('font-family', 'sans-serif');
      t.setAttribute('fill', p.inactive ? '#e05252' : (pinColors[p.n] || 'var(--txt)'));
      t.textContent = String(p.n);
      svg.appendChild(c); svg.appendChild(t);
    });
    legendRow.appendChild(svg);
  })();

  container.appendChild(legendRow);

  // Player grid
  var grid = document.createElement('div');
  grid.style.cssText = 'flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5vw;align-content:start;overflow:hidden';

  sorted.forEach(function(p, i) {
    var isActive = p.id === aktId;
    var total = rundTotal(p);
    var isLeader = i === 0 && state.done;

    var row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:0.5vw;padding:0.55vw 0.8vw',
      'border-radius:10px;border:2px solid ' + (isActive ? 'var(--ac)' : 'var(--brd)'),
      'background:' + (isActive ? 'color-mix(in srgb, var(--ac) 10%, var(--card))' : 'var(--card)'),
      'box-shadow:' + (isActive ? '0 0 14px color-mix(in srgb, var(--ac) 30%, transparent)' : 'none')
    ].join(';');

    var rank = document.createElement('div');
    rank.textContent = String(i + 1);
    rank.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.5vw;color:' + (isLeader ? 'gold' : 'var(--mut)') + ';min-width:1.4vw;text-align:center;flex-shrink:0';
    row.appendChild(rank);

    // 40px avatar
    var anAvEl = document.createElement('div');
    anAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:6px';
    var anAvEmoji = document.createElement('span');
    anAvEmoji.textContent = p.emoji != null ? p.emoji : '';  // textContent — T-02-02
    anAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
    var anAvImg = document.createElement('img');
    anAvImg.src = '/uploads/profiles/' + p.id + '.jpg';
    anAvImg.alt = '';
    anAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    anAvImg.onerror = function() { this.style.display = 'none'; };
    anAvEl.appendChild(anAvEmoji);
    anAvEl.appendChild(anAvImg);

    var name = document.createElement('div');
    name.textContent = p.name;  // textContent — XSS safe; emoji in avatar
    name.style.cssText = 'flex:1;font-size:1.35vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
    row.appendChild(anAvEl);
    row.appendChild(name);

    // Round score columns
    for (var ri = 0; ri < state.maxRunden; ri++) {
      var r = p.runden[ri];
      var rPts = r ? r.reduce(function(a, b) { return a + b; }, 0) : null;
      var cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.2vw;flex-shrink:0';
      var lbl = document.createElement('div');
      lbl.textContent = 'R' + (ri + 1);
      lbl.style.cssText = 'font-size:0.75vw;color:var(--mut);line-height:1';
      var val = document.createElement('div');
      val.textContent = rPts !== null ? String(rPts) : '—';
      val.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.7vw;color:' + (rPts !== null ? 'var(--txt)' : 'var(--brd)') + ';line-height:1.1';
      cell.appendChild(lbl);
      cell.appendChild(val);
      row.appendChild(cell);
    }

    // Total
    var totCell = document.createElement('div');
    totCell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.8vw;flex-shrink:0';
    var totLbl = document.createElement('div');
    totLbl.textContent = 'Ges.';
    totLbl.style.cssText = 'font-size:0.75vw;color:var(--mut);line-height:1';
    var totVal = document.createElement('div');
    totVal.textContent = String(total);  // textContent — safe (numeric)
    totVal.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.7vw;color:' + (isLeader ? 'var(--ac)' : 'var(--txt)') + ';line-height:1.1';
    totCell.appendChild(totLbl);
    totCell.appendChild(totVal);
    row.appendChild(totCell);

    grid.appendChild(row);
  });

  container.appendChild(grid);
  gameEl.replaceChildren(container);
}

// Plus-Minus-Mal TV layout — 2-column formula grid, W1+W2-W3×W4÷W5
function renderPlusMinusTV(state) {
  if (!state || !state.players) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var players = state.players || [];
  var aktId = (players[state.aktSpIdx] && !state.done) ? players[state.aktSpIdx].id : null;

  function pmCalcTV(w) {
    if (!w || !w.length) return null;
    var r = w[0];
    if (w.length > 1) r += w[1];
    if (w.length > 2) r -= w[2];
    if (w.length > 2 && r < 1) r = 1;
    if (w.length > 3) r *= w[3];
    if (w.length > 4) r = w[4] !== 0 ? r / w[4] : r;
    return Math.round(r * 100) / 100;
  }

  var sorted = players.slice().sort(function(a, b) {
    var wa = a.wuerfe || [], wb = b.wuerfe || [];
    var va = wa.length > 0 ? pmCalcTV(wa) : null;
    var vb = wb.length > 0 ? pmCalcTV(wb) : null;
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });

  var OP_COLS = [
    { label: ' ', color: 'var(--mut)' },  // W1 — no operator
    { label: '+',      color: '#4caf7d' },       // W2 — green
    { label: '−', color: '#e05252' },       // W3 — red (−)
    { label: '×', color: '#f59e0b' },       // W4 — orange (×)
    { label: '÷', color: '#5b8dee' }        // W5 — blue (÷)
  ];

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--bg);box-sizing:border-box;overflow:hidden;padding:1vw 2vw';
  container.appendChild(makeGameNameHeader());

  var rndEl = document.createElement('div');
  rndEl.style.cssText = 'text-align:center;font-size:1.2vw;color:var(--mut);margin-bottom:0.8vw';
  rndEl.textContent = state.done ? 'Spiel beendet' : 'Runde ' + (state.pmRunde || 1) + ' / 5';
  container.appendChild(rndEl);

  var grid = document.createElement('div');
  grid.style.cssText = 'flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5vw;align-content:start;overflow:hidden';

  sorted.forEach(function(p, i) {
    var isActive = p.id === aktId;
    var w = p.wuerfe || [];
    var result = w.length > 0 ? pmCalcTV(w) : null;
    var isLeader = i === 0 && state.done && result !== null;

    var row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:0.5vw;padding:0.6vw 0.8vw',
      'border-radius:10px;border:2px solid ' + (isActive ? 'var(--ac)' : 'var(--brd)'),
      'background:' + (isActive ? 'color-mix(in srgb, var(--ac) 10%, var(--card))' : 'var(--card)'),
      'box-shadow:' + (isActive ? '0 0 14px color-mix(in srgb, var(--ac) 30%, transparent)' : 'none')
    ].join(';');

    var rank = document.createElement('div');
    rank.textContent = String(i + 1);
    rank.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.5vw;color:' + (isLeader ? 'gold' : 'var(--mut)') + ';min-width:1.5vw;text-align:center;flex-shrink:0';
    row.appendChild(rank);

    // 40px avatar
    var pmAvEl = document.createElement('div');
    pmAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:6px';
    var pmAvEmoji = document.createElement('span');
    pmAvEmoji.textContent = p.emoji != null ? p.emoji : '';  // textContent — T-02-02
    pmAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
    var pmAvImg = document.createElement('img');
    pmAvImg.src = '/uploads/profiles/' + p.id + '.jpg';
    pmAvImg.alt = '';
    pmAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    pmAvImg.onerror = function() { this.style.display = 'none'; };
    pmAvEl.appendChild(pmAvEmoji);
    pmAvEl.appendChild(pmAvImg);

    var name = document.createElement('div');
    name.textContent = p.name;  // textContent — XSS safe; emoji in avatar
    name.style.cssText = 'flex:1;font-size:1.4vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
    row.appendChild(pmAvEl);
    row.appendChild(name);

    OP_COLS.forEach(function(op, idx) {
      var cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.2vw;flex-shrink:0';

      var opEl = document.createElement('div');
      opEl.textContent = op.label;
      opEl.style.cssText = 'font-size:0.9vw;font-weight:700;color:' + op.color + ';line-height:1';

      var valEl = document.createElement('div');
      valEl.textContent = w.length > idx ? String(w[idx]) : '—';  // em dash for empty
      valEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.8vw;color:' + (w.length > idx ? 'var(--txt)' : 'var(--brd)') + ';line-height:1.1';

      cell.appendChild(opEl);
      cell.appendChild(valEl);
      row.appendChild(cell);
    });

    var eqCell = document.createElement('div');
    eqCell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:3.5vw;flex-shrink:0';

    var eqOp = document.createElement('div');
    eqOp.textContent = '=';
    eqOp.style.cssText = 'font-size:0.9vw;font-weight:700;color:var(--mut);line-height:1';

    var eqVal = document.createElement('div');
    var resultStr = result !== null ? String(result) : '·';  // middle dot for no result yet
    eqVal.textContent = resultStr;  // textContent — safe (numeric output)
    eqVal.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.8vw;color:' + (result !== null ? (isLeader ? 'var(--ac)' : 'var(--txt)') : 'var(--brd)') + ';line-height:1.1';

    eqCell.appendChild(eqOp);
    eqCell.appendChild(eqVal);
    row.appendChild(eqCell);

    grid.appendChild(row);
  });

  container.appendChild(grid);
  gameEl.replaceChildren(container);
}

// Drei in die Vollen TV layout — 2-column grid, W1/W2/W3/∑ per player, scales to 12 players
function renderDreiVollenTV(state) {
  if (!state || !state.players) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var players = state.players || [];
  var n = players.length;
  var aktId = (!state.done && !state.stechen && players[state.aktSpIdx])
    ? players[state.aktSpIdx].id : null;

  // Stechen players still needing to throw in current round
  var stechenPendingIds = [];
  if (state.stechen && state.stechenPlayers) {
    stechenPendingIds = state.stechenPlayers.filter(function(id) {
      var p = players.find(function(pl) { return pl.id === id; });
      return p && (!p.stechenWuerfe || p.stechenWuerfe.length === 0);
    });
  }

  // Sort: players with at least one throw by score desc; untouched players at bottom
  var sorted = players.slice().sort(function(a, b) {
    var aHas = (a.wuerfe || []).length > 0;
    var bHas = (b.wuerfe || []).length > 0;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    var aScore = (a.wuerfe || []).reduce(function(s, v) { return s + v; }, 0);
    var bScore = (b.wuerfe || []).reduce(function(s, v) { return s + v; }, 0);
    return bScore - aScore;
  });

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:1.5vw 2vw;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden';
  container.appendChild(makeGameNameHeader());

  var statusEl = document.createElement('div');
  statusEl.style.cssText = 'text-align:center;margin-bottom:0.6vw;flex-shrink:0';
  if (state.done) {
    statusEl.textContent = 'Spiel beendet';
    statusEl.style.cssText += ';font-size:1.2vw;color:var(--mut)';
  } else if (state.stechen) {
    statusEl.textContent = 'Stechen!';
    statusEl.style.cssText += ';font-size:1.8vw;color:var(--ac);font-family:var(--fh,"Bebas Neue",sans-serif)';
  } else {
    statusEl.textContent = 'Spieler ' + (state.aktSpIdx + 1) + ' / ' + n;
    statusEl.style.cssText += ';font-size:1.2vw;color:var(--mut)';
  }
  container.appendChild(statusEl);

  var grid = document.createElement('div');
  grid.style.cssText = 'flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5vw;align-content:start;overflow:hidden';

  sorted.forEach(function(p, i) {
    var wuerfe = p.wuerfe || [];
    var total = wuerfe.reduce(function(s, v) { return s + v; }, 0);
    var isActive = p.id === aktId;
    var isStechenPending = stechenPendingIds.indexOf(p.id) >= 0;
    var isStechenPlayer = !!(state.stechen && state.stechenPlayers && state.stechenPlayers.indexOf(p.id) >= 0);
    var isLeader = i === 0 && state.done && wuerfe.length >= 3;
    var highlight = isActive || isStechenPending;

    var row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:0.5vw;padding:0.8vw 0.9vw',
      'border-radius:10px;border:2px solid ' + (highlight ? 'var(--ac)' : 'var(--brd)'),
      'background:' + (highlight ? 'color-mix(in srgb, var(--ac) 10%, var(--card))' : 'var(--card)'),
      'box-shadow:' + (highlight ? '0 0 14px color-mix(in srgb, var(--ac) 30%, transparent)' : 'none')
    ].join(';');

    var rank = document.createElement('div');
    rank.textContent = String(i + 1);
    rank.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2vw;color:' + (isLeader ? 'gold' : 'var(--mut)') + ';min-width:1.8vw;text-align:center;flex-shrink:0';
    row.appendChild(rank);

    // 40px avatar
    var dvAvEl = document.createElement('div');
    dvAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0;margin-right:6px';
    var dvAvEmoji = document.createElement('span');
    dvAvEmoji.textContent = p.emoji != null ? p.emoji : '';  // textContent — T-02-02
    dvAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
    var dvAvImg = document.createElement('img');
    dvAvImg.src = '/uploads/profiles/' + p.id + '.jpg';
    dvAvImg.alt = '';
    dvAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
    dvAvImg.onerror = function() { this.style.display = 'none'; };
    dvAvEl.appendChild(dvAvEmoji);
    dvAvEl.appendChild(dvAvImg);

    var name = document.createElement('div');
    name.textContent = p.name;  // textContent — XSS safe; emoji in avatar
    name.style.cssText = 'flex:1;font-size:2.5vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
    row.appendChild(dvAvEl);
    row.appendChild(name);

    // Stechen badge — sword icon when pending, green score when thrown
    if (isStechenPlayer) {
      var threw = p.stechenWuerfe && p.stechenWuerfe.length > 0;
      var badge = document.createElement('div');
      badge.textContent = threw ? 'S:' + String(p.stechenWuerfe[p.stechenWuerfe.length - 1]) : '⚔';  // ⚔ — textContent safe
      badge.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.8vw;color:' + (threw ? 'var(--grn)' : 'var(--ac)') + ';flex-shrink:0;letter-spacing:.03em';
      row.appendChild(badge);
    }

    // W1, W2, W3
    for (var wi = 0; wi < 3; wi++) {
      var cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2vw;flex-shrink:0';
      var wLbl = document.createElement('div');
      wLbl.textContent = 'W' + (wi + 1);
      wLbl.style.cssText = 'font-size:1.2vw;color:var(--mut);line-height:1';
      var wVal = document.createElement('div');
      wVal.textContent = wuerfe.length > wi ? String(wuerfe[wi]) : '—';  // — em dash
      wVal.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.8vw;color:' + (wuerfe.length > wi ? 'var(--txt)' : 'var(--brd)') + ';line-height:1.1';
      cell.appendChild(wLbl);
      cell.appendChild(wVal);
      row.appendChild(cell);
    }

    // Total ∑
    var totCell = document.createElement('div');
    totCell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.6vw;flex-shrink:0';
    var totLbl = document.createElement('div');
    totLbl.textContent = '∑';  // ∑
    totLbl.style.cssText = 'font-size:1.2vw;color:var(--mut);line-height:1';
    var totVal = document.createElement('div');
    totVal.textContent = wuerfe.length > 0 ? String(total) : '·';  // · middle dot
    totVal.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.8vw;color:' + (wuerfe.length > 0 ? (isLeader ? 'var(--ac)' : 'var(--txt)') : 'var(--brd)') + ';line-height:1';
    totCell.appendChild(totLbl);
    totCell.appendChild(totVal);
    row.appendChild(totCell);

    grid.appendChild(row);
  });

  container.appendChild(grid);

  // Turnierergebnis — top-6 sum shown when done and >=6 players
  if (state.done && n >= 6) {
    var top6Sum = players.slice()
      .sort(function(a, b) {
        return (b.wuerfe || []).reduce(function(s, v) { return s + v; }, 0)
             - (a.wuerfe || []).reduce(function(s, v) { return s + v; }, 0);
      })
      .slice(0, 6)
      .reduce(function(acc, q) { return acc + (q.wuerfe || []).reduce(function(s, v) { return s + v; }, 0); }, 0);
    var turEl = document.createElement('div');
    turEl.textContent = 'Turnierergebnis: ' + top6Sum + ' Volle';  // textContent — safe (numeric)
    turEl.style.cssText = 'text-align:center;font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.2vw;color:var(--ac);margin-top:8px;padding-top:8px;border-top:1px solid var(--brd);flex-shrink:0';
    container.appendChild(turEl);
  }

  gameEl.replaceChildren(container);
}

// Viergewinnt TV layout — 3-column: Team X | Board | Team O
function renderViergewinntTV(state) {
  if (!state) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var VG_X = '#e05252';
  var VG_O = '#5b8dee';
  var tX = state.tX || [];
  var tO = state.tO || [];
  var xWon = state.done && state.winner === 'X';
  var oWon = state.done && state.winner === 'O';
  var xDim = state.done && state.winner === 'O';
  var oDim = state.done && state.winner === 'X';

  // Cell size: /9 for width (9 cols), /10 for height (9 rows + col-numbers row); 0.78 leaves room for header+padding
  var cellPx = Math.floor(Math.min(
    (window.innerWidth * 0.55 - 36) / 9,
    (window.innerHeight * 0.78 - 36) / 10
  ));
  var cs = cellPx + 'px';

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;padding:1.5vw 2vw';

  container.appendChild(makeGameNameHeader());

  // Main row: Team X | Board | Team O
  var mainRow = document.createElement('div');
  mainRow.style.cssText = 'flex:1;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:2vw;min-height:0';

  function makeTeamPanel(players, color, label, dim, won, teamKey, aktIdx) {
    var isActiveTeam = !state.done && state.aktT === teamKey;
    var opacity = dim ? '0.45' : (!state.done && !isActiveTeam ? '0.6' : '1');
    var panel = document.createElement('div');
    panel.style.cssText = 'flex:0 0 20vw;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:' + opacity + ';transition:opacity .8s'
      + (isActiveTeam ? ';border:2px solid ' + color + '88;border-radius:12px;padding:8px 12px;box-shadow:0 0 18px ' + color + '33' : '');

    var lbl = document.createElement('div');
    lbl.textContent = label + (won ? ' 🏆' : '');  // textContent — safe (fixed string)
    lbl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:3.5vw;color:' + color + ';letter-spacing:.06em;text-align:center';
    panel.appendChild(lbl);

    players.forEach(function(p, idx) {
      var isAkt = isActiveTeam && idx === (aktIdx % players.length);

      // Player row: avatar + name
      var pRow = document.createElement('div');
      pRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px';

      var vgAvEl = document.createElement('div');
      vgAvEl.style.cssText = 'position:relative;width:80px;height:80px;flex-shrink:0';
      var vgAvEmoji = document.createElement('span');
      vgAvEmoji.textContent = p.emoji != null ? p.emoji : '';  // textContent — T-02-02
      vgAvEmoji.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:38px';
      var vgAvImg = document.createElement('img');
      vgAvImg.src = '/uploads/profiles/' + p.id + '.jpg';
      vgAvImg.alt = '';
      vgAvImg.style.cssText = 'position:absolute;inset:0;width:80px;height:80px;border-radius:50%;object-fit:cover';
      vgAvImg.onerror = function() { this.style.display = 'none'; };
      vgAvEl.appendChild(vgAvEmoji);
      vgAvEl.appendChild(vgAvImg);

      var n = document.createElement('div');
      n.textContent = (isAkt ? '▶ ' : '') + p.name;  // textContent — XSS safe; emoji in avatar
      n.style.cssText = 'font-size:2.5vw;font-family:' + (isAkt ? 'var(--fh,"Bebas Neue",sans-serif)' : 'inherit') + ';color:' + (isAkt ? 'var(--ac)' : 'var(--txt)') + ';text-align:center;line-height:1.5';

      pRow.appendChild(vgAvEl);
      pRow.appendChild(n);
      panel.appendChild(pRow);
    });
    return panel;
  }

  mainRow.appendChild(makeTeamPanel(tX, VG_X, 'TEAM X', xDim, xWon, 'X', state.iX || 0));

  // Board center column
  var boardCol = document.createElement('div');
  boardCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px';

  for (var row = 0; row < 9; row++) {
    var rowEl = document.createElement('div');
    rowEl.style.cssText = 'display:flex;gap:4px';
    for (var col = 0; col < 9; col++) {
      var cell = document.createElement('div');
      var val = state.grid && state.grid[row] ? state.grid[row][col] : null;
      var bg = val === 'X' ? VG_X + '99' : val === 'O' ? VG_O + '99' : '#333';
      var border = val === 'X' ? VG_X : val === 'O' ? VG_O : '#555';
      cell.style.cssText = 'width:' + cs + ';height:' + cs + ';border-radius:50%;background:' + bg + ';border:2px solid ' + border + ';box-sizing:border-box';
      rowEl.appendChild(cell);
    }
    boardCol.appendChild(rowEl);
  }

  var colNums = document.createElement('div');
  colNums.style.cssText = 'display:flex;gap:4px;margin-top:4px';
  for (var c = 1; c <= 9; c++) {
    var num = document.createElement('div');
    num.textContent = String(c);  // textContent — safe (loop counter)
    num.style.cssText = 'width:' + cs + ';text-align:center;font-size:1.8vw;color:var(--mut);font-family:var(--fb,"DM Sans",sans-serif)';
    colNums.appendChild(num);
  }
  boardCol.appendChild(colNums);

  if (state.done && state.winner === 'draw') {
    var drawBanner = document.createElement('div');
    drawBanner.textContent = 'UNENTSCHIEDEN';  // textContent — safe (fixed string)
    drawBanner.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2vw;color:var(--mut);text-align:center;margin-top:8px';
    boardCol.appendChild(drawBanner);
  }

  mainRow.appendChild(boardCol);
  mainRow.appendChild(makeTeamPanel(tO, VG_O, 'TEAM O', oDim, oWon, 'O', state.iO || 0));
  container.appendChild(mainRow);

  gameEl.replaceChildren(container);
}

// Round label copywriting (06-UI-SPEC.md lines 340–368)
function kdaTVRoundLabel(bracket, round, totalRounds) {
  if (bracket === 'W') {
    if (round === totalRounds) return 'W · Finale';
    if (round === totalRounds - 1) return 'W · Halbfinale';
    return 'W · Runde ' + round;
  }
  if (bracket === 'L') {
    if (round === totalRounds) return 'L · Finale';
    if (round === totalRounds - 1) return 'L · Halbfinale';
    return 'L · Runde ' + round;
  }
  return bracket + ' · Runde ' + round;
}
