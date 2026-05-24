'use strict';

const connDot      = document.getElementById('connDot');
const idleEl       = document.getElementById('idle');
const gameEl       = document.getElementById('game');
const playerListEl = document.getElementById('playerList');
const lastWinnerEl = document.getElementById('lastWinnerText');

var currentTypeKey = null;  // set on game:started and game:state — used by renderGame dispatcher
var overlayTimeoutId = null;
var tvHighlights = null;
var currentIdleLastWinner = null;

var GAME_NAMES = {
  'bilderkegel': 'Bilderkegel',
  'fuchsjagd': 'Fuchsjagd',
  'viergewinnt': 'Vier Gewinnt',
  'kda': 'Kegler des Abends',
  'dreiVollen': 'Drei in die Vollen',
  'anker': 'Anker',
  'grosseHausnummer': 'Große Hausnummer',
  'kleineHausnummer': 'Kleine Hausnummer',
  'plusMinusMal': 'Plus Minus Mal'
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
  return '<svg viewBox="0 0 80 100" width="'+w+'" height="'+h+'" xmlns="http://www.w3.org/2000/svg">'+circles+'</svg>';
}

function renderHighlightsHdr() {
  var hdr = document.getElementById('tv-highlights-hdr');
  if (!hdr || !tvHighlights) return;
  var hasKda = tvHighlights.kda_champion && tvHighlights.kda_champion.name;
  var hasBk  = tvHighlights.bk_loser  && tvHighlights.bk_loser.name;
  hdr.textContent = '';
  if (!hasKda && !hasBk) return;
  var parts = [];
  if (hasKda) parts.push('🏆 ' + tvHighlights.kda_champion.name);
  if (hasBk)  parts.push('💩 ' + tvHighlights.bk_loser.name);
  hdr.textContent = parts.join('  |  ');
}

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/highlights/current')
    .then(function(r){ return r.json(); })
    .then(function(d){ tvHighlights = d; renderHighlightsHdr(); })
    .catch(function(){});
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
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  // textContent only — no innerHTML (XSS prevention T-02-02)
  lastWinnerEl.textContent = lastWinner
    ? 'Letzter Sieger: ' + lastWinner
    : 'Noch kein Spiel gespielt';

}

function renderGame(state) {
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  // Remove any stale game name headers from previous renders
  gameEl.querySelectorAll('.tv-game-name-hdr').forEach(function(e) { e.remove(); });
  if (state && state.bracket) { renderKDABracket(state); return; }  // KDA: before state.players guard
  if (currentTypeKey === 'bilderkegel') { renderBilderkegelTV(state); return; }  // BK layout (must precede !players guard)
  if (currentTypeKey === 'fuchsjagd')   { renderFuchsjagdTV(state); return; }   // FJ layout
  if (currentTypeKey === 'viergewinnt') { renderViergewinntTV(state); return; } // VG layout
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

    // Name span — min 36px via CSS class (TV-03)
    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = (player.emoji != null ? player.emoji : '') + ' ' + player.name;  // textContent — safe (T-02-02)

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

// KDA bracket TV renderer (TOURNAMENT-03, D-13, D-14, D-15)
function renderKDABracket(state) {
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var wR1Count = state.bracket.filter(function(m) { return m.bracket === 'W' && m.round === 1; }).length;
  var slotWidth  = wR1Count <= 2 ? 200 : wR1Count <= 4 ? 160 : 140;
  var slotHeight = wR1Count <= 2 ?  80 : wR1Count <= 4 ?  72 :  64;

  // Outer container: flex column — top row (W + L side by side), GF centered at bottom
  var container = document.createElement('div');
  container.className = 'kda-tv-bracket';
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:20px 24px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden';

  // --- Top row: W bracket (left) + L bracket (right) — shrinks to content ---
  var topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;flex-direction:row;gap:24px;align-items:flex-start;flex-shrink:0';

  // W bracket
  var wSection = document.createElement('div');
  wSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0';

  var wLabel = document.createElement('div');
  wLabel.textContent = 'Winner Bracket';
  wLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--ac);line-height:1';
  wSection.appendChild(wLabel);

  var wRoundsRow = document.createElement('div');
  wRoundsRow.style.cssText = 'display:flex;flex-direction:row;gap:12px;align-items:flex-start';

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
      col.appendChild(buildTVSlotEl(slot, slotWidth, slotHeight));
    });
    wRoundsRow.appendChild(col);
  });
  wSection.appendChild(wRoundsRow);
  topRow.appendChild(wSection);

  // L bracket
  var lMatches = state.bracket.filter(function(m) { return m.bracket === 'L'; });
  if (lMatches.length > 0) {
    var lSection = document.createElement('div');
    lSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-width:0';

    var lLabel = document.createElement('div');
    lLabel.textContent = 'Loser Bracket';
    lLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--ac);line-height:1';
    lSection.appendChild(lLabel);

    var lRoundsRow = document.createElement('div');
    lRoundsRow.style.cssText = 'display:flex;flex-direction:row;gap:12px;align-items:flex-start';

    var lRounds = Array.from(new Set(lMatches.map(function(m) { return m.round; }))).sort(function(a, b) { return a - b; });
    var lTotalRounds = lRounds.length;

    lRounds.forEach(function(round) {
      var col = document.createElement('div');
      col.className = 'tv-bracket-col';
      col.style.cssText = 'display:flex;flex-direction:column;justify-content:space-around;gap:6px';

      var roundLabel = document.createElement('div');
      roundLabel.textContent = kdaTVRoundLabel('L', round, lTotalRounds);
      roundLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);text-transform:uppercase;margin-bottom:2px;white-space:nowrap';
      col.appendChild(roundLabel);

      lMatches.filter(function(m) { return m.round === round; }).forEach(function(slot) {
        col.appendChild(buildTVSlotEl(slot, slotWidth, slotHeight));
      });
      lRoundsRow.appendChild(col);
    });
    lSection.appendChild(lRoundsRow);
    topRow.appendChild(lSection);
  }

  container.appendChild(topRow);

  // --- Grand Final: full-width stage at bottom ---
  var gfSlot = state.bracket.find(function(m) { return m.bracket === 'GF'; });
  if (gfSlot) {
    var gfStage = document.createElement('div');
    gfStage.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding-top:12px;border-top:2px solid var(--ac);width:100%;flex:1';

    var gfLabel = document.createElement('div');
    gfLabel.textContent = 'Großes Finale';
    gfLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:32px;color:var(--ac);line-height:1;letter-spacing:0.06em;text-transform:uppercase';
    gfStage.appendChild(gfLabel);

    var gfSlotEl = buildTVSlotEl(gfSlot, Math.round(slotWidth * 2), Math.round(slotHeight * 1.3));
    // Extra glow for the finale slot
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

  if (isActive) {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:8px;display:flex;flex-direction:column;justify-content:space-around;padding:6px 12px;box-sizing:border-box;border:2px solid var(--ac);box-shadow:0 0 16px #e8b84b33';
  } else if (slot.isBye) {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:6px;display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:4px 12px;box-sizing:border-box;border:1px dashed var(--brd);opacity:0.5';
  } else {
    el.style.cssText = 'width:' + w + 'px;height:' + elH + 'px;background:var(--card);border-radius:8px;display:flex;flex-direction:column;justify-content:space-around;padding:6px 12px;box-sizing:border-box;border:1px solid var(--brd)';
  }

  // --- Bye slot: single row with name + BYE badge ---
  if (slot.isBye) {
    var p = slot.winner || slot.p1;
    var byeName = document.createElement('span');
    byeName.textContent = p ? ((p.emoji != null ? p.emoji : '') + ' ' + p.name) : '—';  // textContent — XSS safe (T-06-04-01)
    byeName.style.cssText = 'font-size:18px;font-weight:600;color:var(--mut);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
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
      nameSpan.style.cssText = 'font-size:20px;font-weight:600;color:var(--txt);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    } else {
      // Empty: waiting for player to arrive
      nameSpan.textContent = '·  ·  ·';
      nameSpan.style.cssText = 'font-size:14px;font-weight:400;color:var(--mut);flex:1;min-width:0;letter-spacing:4px';
    }

    var scoreSpan = document.createElement('span');
    scoreSpan.style.cssText = 'font-size:26px;font-family:var(--fh,"Bebas Neue",sans-serif);flex-shrink:0;margin-left:6px';

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

// BK loser detection — player with the minimum bkTotal
function getBKLoserName(state) {
  if (!state || !state.players || !state.players.length) return '—';
  var withTotals = state.players.map(function(p) {
    return { name: p.name, total: bkTotal(p) };
  });
  withTotals.sort(function(a, b) { return a.total - b.total; });
  return withTotals[0].name;
}

// End-of-game full-screen overlay (UI-SPEC: tv-end-overlay)
function renderEndOverlay(typeKey, state, lastWinner) {
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  // Unknown game type: skip overlay, go idle after short delay
  if (typeKey !== 'kda' && typeKey !== 'bilderkegel') {
    overlayTimeoutId = setTimeout(function() { overlayTimeoutId = null; renderIdle(lastWinner || null); }, 3000);
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

  overlayTimeoutId = setTimeout(function() { overlayTimeoutId = null; renderIdle(lastWinner || null); }, 10000);
}

// Bilderkegeln TV layout — player list with loser row highlighted in red
function renderBilderkegelTV(state) {
  if (!state || !state.players) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:2vw;box-sizing:border-box';

  // Current Bild display
  var BK_BILDER_TV = [
    {id:'volle',name:'Volle',pins:[1,2,3,4,5,6,7,8,9]},
    {id:'kleeblatt',name:'Kleeblatt',pins:[2,3,4,6,7,8]},
    {id:'hint_kranz',name:'Hint. Kranz',pins:[4,6,7,8,9]},
    {id:'damen',name:'Damen',pins:[2,3,7,8]},
    {id:'bauern',name:'Bauern',pins:[4,6]}
  ];

  if (!state.done && state.aktBildIdx >= 0 && state.aktBildIdx < BK_BILDER_TV.length) {
    var bildInfo = BK_BILDER_TV[state.aktBildIdx];

    var bildSection = document.createElement('div');
    bildSection.style.cssText = 'text-align:center;margin-bottom:16px';

    var bildNameEl = document.createElement('div');
    bildNameEl.textContent = bildInfo.name;  // textContent — safe (static data)
    bildNameEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:8vw;color:var(--ac);line-height:1';

    var bildNumEl = document.createElement('div');
    bildNumEl.textContent = 'Bild ' + (state.aktBildIdx + 1) + '/5';  // textContent — safe
    bildNumEl.style.cssText = 'font-size:2vw;color:var(--mut);margin-top:4px';

    // Pin SVG for TV (white pins on dark)
    var svgEl = document.createElement('div');
    svgEl.innerHTML = kegelSVGtv(bildInfo.pins, 120, 150);  // SVG built from static pin data — no user input
    svgEl.style.cssText = 'margin:8px auto';

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
      var tot = bkTotal(p);
      if (minTotal === null || tot < minTotal) {
        minTotal = tot;
        loserIdx  = idx;
      }
    });
  }

  var ul = document.createElement('ul');
  ul.style.cssText = 'list-style:none;margin:0;padding:0;width:100%';

  state.players.forEach(function(player, idx) {
    var li = document.createElement('li');
    li.className = 'player-row';

    if (idx === loserIdx) {
      // Loser row highlight (UI-SPEC BK loser row)
      li.style.cssText = 'border-left:4px solid var(--red);background:rgba(224,82,82,0.07);padding-left:calc(2vw - 4px)';
    }

    var nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = (player.emoji != null ? player.emoji : '') + ' ' + player.name;  // textContent — XSS safe (T-07-03-04)

    var scoreEl = document.createElement('span');
    scoreEl.className = 'player-score';
    scoreEl.textContent = bkTotal(player);  // textContent — safe

    li.appendChild(nameEl);
    li.appendChild(scoreEl);
    ul.appendChild(li);
  });

  container.appendChild(ul);
  container.insertBefore(makeGameNameHeader(), container.firstChild);
  gameEl.replaceChildren(container);
}

// Fuchsjagd TV layout — split Fuchs/Jäger panels
function renderFuchsjagdTV(state) {
  if (!state) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var container = document.createElement('div');
  container.className = 'fj-tv-layout';
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);display:flex;flex-direction:row;align-items:center;padding:2vw;box-sizing:border-box;gap:0';

  // --- LEFT PANEL: Fuchs ---
  var fuchsPanel = document.createElement('div');
  fuchsPanel.className = 'fj-fuchs-panel';
  fuchsPanel.style.cssText = 'flex:1;background:var(--card);border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px';

  var fuchsLabel = document.createElement('div');
  fuchsLabel.className = 'fj-role-label';
  fuchsLabel.textContent = 'FUCHS';
  fuchsLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);letter-spacing:2px';

  var fuchsName = document.createElement('div');
  fuchsName.className = 'fj-player-name';
  fuchsName.textContent = (state.fuchs.emoji != null ? state.fuchs.emoji : '') + ' ' + state.fuchs.name;  // textContent — XSS safe (T-07-03-02)
  fuchsName.style.cssText = 'font-size:36px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--txt);line-height:1';

  var fuchsThrows = document.createElement('div');
  fuchsThrows.className = 'fj-throw-list';
  fuchsThrows.textContent = state.fuchs.w && state.fuchs.w.length > 0 ? state.fuchs.w.join(', ') : '—';
  fuchsThrows.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);color:var(--mut)';

  var fuchsScore = document.createElement('div');
  fuchsScore.className = 'fj-score';
  fuchsScore.textContent = 'Noch: ' + String(state.fp != null ? state.fp : '—');  // textContent — safe
  fuchsScore.style.cssText = 'font-size:72px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--ac);line-height:1';

  fuchsPanel.appendChild(fuchsLabel);
  fuchsPanel.appendChild(fuchsName);
  fuchsPanel.appendChild(fuchsThrows);
  fuchsPanel.appendChild(fuchsScore);

  // --- VERTICAL DIVIDER ---
  var divider = document.createElement('div');
  divider.className = 'fj-vs-divider';
  divider.style.cssText = 'width:1px;background:var(--brd);height:80vh;align-self:center;margin:0 24px;flex-shrink:0';

  // --- RIGHT PANEL: Jäger ---
  var jaegerPanel = document.createElement('div');
  jaegerPanel.className = 'fj-jaeger-panel';
  jaegerPanel.style.cssText = 'flex:1;background:var(--card);border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px';

  var jaegerLabel = document.createElement('div');
  jaegerLabel.className = 'fj-role-label';
  jaegerLabel.textContent = 'JÄGER';
  jaegerLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);letter-spacing:2px';

  jaegerPanel.appendChild(jaegerLabel);

  var jaeger = state.jaeger || [];
  jaeger.forEach(function(j) {
    var row = document.createElement('div');
    row.className = 'fj-jaeger-row';
    row.style.cssText = 'display:flex;justify-content:space-between;width:100%;padding:8px 0';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'fj-jaeger-name';
    nameSpan.textContent = (j.emoji != null ? j.emoji : '') + ' ' + j.name;  // textContent — XSS safe (T-07-03-02)
    nameSpan.style.cssText = 'font-size:28px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--txt)';

    var contribSpan = document.createElement('span');
    contribSpan.className = 'fj-jaeger-contrib';
    contribSpan.textContent = String((j.w || []).reduce(function(a, b) { return a + b; }, 0));  // textContent — safe
    contribSpan.style.cssText = 'font-size:28px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--mut)';

    row.appendChild(nameSpan);
    row.appendChild(contribSpan);
    jaegerPanel.appendChild(row);
  });

  container.appendChild(fuchsPanel);
  container.appendChild(divider);
  container.appendChild(jaegerPanel);
  container.insertBefore(makeGameNameHeader(), container.firstChild);
  gameEl.replaceChildren(container);
}

// Viergewinnt TV layout — 9x9 board with team headers
function renderViergewinntTV(state) {
  if (!state) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var container = document.createElement('div');
  container.className = 'vg-tv-layout';
  container.style.cssText = 'width:100vw;min-height:100vh;background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:2vw;box-sizing:border-box;gap:16px';

  // Team header
  var headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;width:100%;align-items:center;justify-content:space-between;gap:16px';

  function makeTeamHeader(players, color, label, dim) {
    var el = document.createElement('div');
    el.style.cssText = 'flex:1;text-align:center;opacity:' + (dim ? '0.5' : '1');
    var lbl = document.createElement('div');
    lbl.textContent = label;  // textContent — safe (fixed string)
    lbl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:5vw;color:' + color;
    el.appendChild(lbl);
    (players || []).forEach(function(p) {
      var n = document.createElement('div');
      n.textContent = (p.emoji != null ? p.emoji : '') + ' ' + p.name;  // textContent — XSS safe
      n.style.cssText = 'font-size:2.5vw;color:var(--txt)';
      el.appendChild(n);
    });
    return el;
  }

  var xDim = state.done && state.winner === 'O';
  var oDim = state.done && state.winner === 'X';
  headerRow.appendChild(makeTeamHeader(state.tX, 'var(--ac)', 'TEAM X', xDim));

  var vsEl = document.createElement('div');
  vsEl.textContent = 'VS';  // textContent — safe (fixed string)
  vsEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:4vw;color:var(--mut);flex-shrink:0';
  headerRow.appendChild(vsEl);

  headerRow.appendChild(makeTeamHeader(state.tO, '#4da6ff', 'TEAM O', oDim));
  container.appendChild(headerRow);

  // 9x9 Board grid
  var boardContainer = document.createElement('div');
  boardContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px';

  for (var row = 0; row < 9; row++) {
    var rowEl = document.createElement('div');
    rowEl.style.cssText = 'display:flex;gap:4px';
    for (var col = 0; col < 9; col++) {
      var cell = document.createElement('div');
      var val = state.grid[row][col];
      var bg = val === 'X' ? 'var(--ac)' : val === 'O' ? '#4da6ff' : '#333';
      cell.style.cssText = 'width:4.5vw;height:4.5vw;border-radius:50%;background:' + bg + ';border:1px solid ' + (val ? bg : '#555') + ';box-sizing:border-box';
      rowEl.appendChild(cell);
    }
    boardContainer.appendChild(rowEl);
  }

  // Column numbers
  var colNums = document.createElement('div');
  colNums.style.cssText = 'display:flex;gap:4px;margin-top:4px';
  for (var c = 1; c <= 9; c++) {
    var num = document.createElement('div');
    num.textContent = String(c);  // textContent — safe (loop counter)
    num.style.cssText = 'width:4.5vw;text-align:center;font-size:1.5vw;color:var(--mut);font-family:var(--fb,"DM Sans",sans-serif)';
    colNums.appendChild(num);
  }
  boardContainer.appendChild(colNums);
  container.appendChild(boardContainer);

  // Winner banner
  if (state.done && state.winner && state.winner !== 'draw') {
    var winBanner = document.createElement('div');
    winBanner.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:5vw;text-align:center';
    var winColor = state.winner === 'X' ? 'var(--ac)' : '#4da6ff';
    var winLabel = state.winner === 'X' ? 'TEAM X' : 'TEAM O';
    winBanner.textContent = winLabel + ' GEWINNT!';  // textContent — safe (no user data)
    winBanner.style.color = winColor;
    container.appendChild(winBanner);
  } else if (state.done && state.winner === 'draw') {
    var drawBanner = document.createElement('div');
    drawBanner.textContent = 'UNENTSCHIEDEN';  // textContent — safe (fixed string)
    drawBanner.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:5vw;color:var(--mut);text-align:center';
    container.appendChild(drawBanner);
  }

  container.insertBefore(makeGameNameHeader(), container.firstChild);
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
