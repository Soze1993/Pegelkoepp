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
      var tot = bkTotal(p);
      if (minTotal === null || tot < minTotal) {
        minTotal = tot;
        loserIdx  = idx;
      }
    });
  }

  // Player list fills remaining height; rows share space equally via flex
  var ul = document.createElement('ul');
  ul.style.cssText = 'list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden';

  state.players.forEach(function(player, idx) {
    var li = document.createElement('li');
    var isLoser = idx === loserIdx;
    li.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;padding:' + rowPad + ';border-radius:8px;'
      + (isLoser ? 'border-left:4px solid var(--red);background:rgba(224,82,82,0.07);padding-left:calc(2vw - 4px)' : '');

    var nameEl = document.createElement('span');
    nameEl.style.cssText = 'flex:1;font-size:' + namePx + 'px;font-family:var(--fh,"Bebas Neue",sans-serif);letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
    nameEl.textContent = (player.emoji != null ? player.emoji : '') + ' ' + player.name;  // textContent — XSS safe (T-07-03-04)

    var scoreEl = document.createElement('span');
    scoreEl.style.cssText = 'width:12vw;text-align:right;font-family:var(--fh,"Bebas Neue",sans-serif);font-size:' + scorePx + 'px;color:var(--ac);flex-shrink:0';
    scoreEl.textContent = bkTotal(player);  // textContent — safe

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

  var fuchsName = document.createElement('div');
  fuchsName.textContent = (isFuchsTurn ? '▶ ' : '') + (state.fuchs.emoji != null ? state.fuchs.emoji : '') + ' ' + state.fuchs.name;  // textContent — XSS safe
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

  // --- RIGHT PANEL: Jäger ---
  var jaegerActive = activeJIdx >= 0;
  var jaegerPanel = document.createElement('div');
  jaegerPanel.className = 'fj-jaeger-panel';
  jaegerPanel.style.cssText = 'flex:1;border-radius:12px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;'
    + (jaegerActive
      ? 'background:rgba(232,184,75,0.08);border:2px solid var(--brd)'
      : 'background:var(--card);border:2px solid transparent');

  var jaegerLabel = document.createElement('div');
  jaegerLabel.textContent = 'JÄGER';
  jaegerLabel.style.cssText = 'font-size:13px;font-family:var(--fb,"DM Sans",sans-serif);font-weight:600;color:var(--mut);letter-spacing:2px';
  jaegerPanel.appendChild(jaegerLabel);

  var jaeger = state.jaeger || [];
  jaeger.forEach(function(j, idx) {
    var isActive = idx === activeJIdx;
    var row = document.createElement('div');
    row.className = 'fj-jaeger-row';
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 12px;border-radius:8px;'
      + (isActive
        ? 'background:rgba(232,184,75,0.2);border:1px solid var(--ac)'
        : 'background:transparent;border:1px solid transparent');

    var nameSpan = document.createElement('span');
    nameSpan.textContent = (isActive ? '▶ ' : '') + (j.emoji != null ? j.emoji : '') + ' ' + j.name;  // textContent — XSS safe
    nameSpan.style.cssText = 'font-size:28px;font-family:var(--fh,"Bebas Neue",sans-serif);color:'
      + (isActive ? 'var(--ac)' : 'var(--txt)');

    var contribSpan = document.createElement('span');
    contribSpan.textContent = String((j.w || []).reduce(function(a, b) { return a + b; }, 0));  // textContent — safe
    contribSpan.style.cssText = 'font-size:28px;font-family:var(--fh,"Bebas Neue",sans-serif);color:var(--mut)';

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
    rank.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:1.8vw;color:' + (isLeader && state.done ? 'gold' : 'var(--mut)') + ';min-width:1.8vw;text-align:center';
    row.appendChild(rank);

    var name = document.createElement('div');
    name.textContent = (p.emoji || '') + ' ' + p.name;
    name.style.cssText = 'flex:1;font-size:1.5vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    row.appendChild(name);

    [['h','H'],['z','Z'],['e','E']].forEach(function(pair) {
      var slot = pair[0], lbl = pair[1];
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:2.5vw';
      var lEl = document.createElement('div');
      lEl.textContent = lbl;
      lEl.style.cssText = 'font-size:0.8vw;color:var(--mut);line-height:1';
      var vEl = document.createElement('div');
      vEl.textContent = sl[slot] !== null ? String(sl[slot]) : '—';
      vEl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2vw;color:' + (sl[slot] !== null ? 'var(--txt)' : 'var(--brd)') + ';line-height:1.1';
      wrap.appendChild(lEl);
      wrap.appendChild(vEl);
      row.appendChild(wrap);
    });

    var total = document.createElement('div');
    total.textContent = sc !== null ? String(sc) : '·';
    total.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.4vw;min-width:4.5vw;text-align:right;color:' + (sc !== null ? (isLeader ? 'var(--ac)' : 'var(--txt)') : 'var(--brd)');
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

  // Scoring chips
  var chips = document.createElement('div');
  chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4vw;justify-content:center;margin-bottom:0.7vw;flex-shrink:0';
  [
    { label: 'Bauer 4+6 = 10', col: 'var(--ac)' },
    { label: 'Dame 7+8 = 5',   col: '#5b8dee' },
    { label: 'Barbel 1+5+9 = 10', col: '#4caf7d' },
    { label: 'P = 0 · Sonst 1/Kegel', col: 'var(--mut)' }
  ].forEach(function(chip) {
    var s = document.createElement('span');
    s.textContent = chip.label;  // textContent — safe
    s.style.cssText = 'border:1px solid ' + chip.col + ';border-radius:5px;padding:0.15vw 0.5vw;font-size:0.9vw;font-weight:600;color:' + chip.col;
    chips.appendChild(s);
  });
  container.appendChild(chips);

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

    var name = document.createElement('div');
    name.textContent = (p.emoji != null ? p.emoji : '') + ' ' + p.name;  // textContent — XSS safe
    name.style.cssText = 'flex:1;font-size:1.35vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
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

    var name = document.createElement('div');
    name.textContent = (p.emoji != null ? p.emoji : '') + ' ' + p.name;  // textContent — XSS safe
    name.style.cssText = 'flex:1;font-size:1.4vw;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
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

// Viergewinnt TV layout — teams row at top, 9x9 grid below
function renderViergewinntTV(state) {
  if (!state) return;
  if (overlayTimeoutId) { clearTimeout(overlayTimeoutId); overlayTimeoutId = null; }
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

  var VG_X = '#e05252';
  var VG_O = '#5b8dee';
  var tX = state.tX || [];
  var tO = state.tO || [];
  var aktT = state.aktT || 'X';
  var xWon = state.done && state.winner === 'X';
  var oWon = state.done && state.winner === 'O';
  var xDim = state.done && !xWon && state.winner !== 'draw';
  var oDim = state.done && !oWon && state.winner !== 'draw';

  var container = document.createElement('div');
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;padding:1vw 2vw';

  container.appendChild(makeGameNameHeader());

  var teamsRow = document.createElement('div');
  teamsRow.style.cssText = 'display:flex;gap:2vw;margin-bottom:1.2vw';

  function makeTeamPanel(players, color, label, active, dim, won) {
    var panel = document.createElement('div');
    panel.style.cssText = [
      'flex:1;border-radius:12px;padding:1vw 1.5vw;border:2px solid ' + (active ? color : 'var(--brd)'),
      'background:' + (active ? color + '18' : 'var(--card)'),
      'opacity:' + (dim ? '0.35' : '1') + ';transition:opacity .8s',
      'box-shadow:' + (active && !state.done ? '0 0 18px ' + color + '44' : 'none')
    ].join(';');

    var headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';

    var lbl = document.createElement('div');
    lbl.textContent = label;  // textContent — safe (fixed string)
    lbl.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.8vw;color:' + color + ';letter-spacing:.08em';
    headerRow.appendChild(lbl);

    if (won) {
      var winEl = document.createElement('div');
      winEl.textContent = '🏆';
      winEl.style.cssText = 'font-size:2.2vw';
      headerRow.appendChild(winEl);
    }
    panel.appendChild(headerRow);

    players.forEach(function(p) {
      var playerEl = document.createElement('div');
      playerEl.textContent = (p.emoji != null ? p.emoji : '') + ' ' + p.name;  // textContent — XSS safe
      playerEl.style.cssText = 'font-size:1.4vw;color:var(--txt);line-height:1.6';
      panel.appendChild(playerEl);
    });

    return panel;
  }

  teamsRow.appendChild(makeTeamPanel(tX, VG_X, 'TEAM X', aktT === 'X' && !state.done, xDim, xWon));
  teamsRow.appendChild(makeTeamPanel(tO, VG_O, 'TEAM O', aktT === 'O' && !state.done, oDim, oWon));
  container.appendChild(teamsRow);

  if (state.done && state.winner === 'draw') {
    var drawBanner = document.createElement('div');
    drawBanner.textContent = 'UNENTSCHIEDEN';  // textContent — safe (fixed string)
    drawBanner.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.5vw;color:var(--mut);text-align:center;margin-bottom:8px';
    container.appendChild(drawBanner);
  }

  var gridSection = document.createElement('div');
  gridSection.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0';

  var boardWrap = document.createElement('div');
  boardWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';

  var colNums = document.createElement('div');
  colNums.style.cssText = 'display:flex;gap:2px;margin-bottom:3px';

  var cellSize = 'calc((min(100vw - 4vw, 85vh) - 24px) / 9)';

  for (var c = 1; c <= 9; c++) {
    var num = document.createElement('div');
    num.textContent = String(c);  // textContent — safe (loop counter)
    num.style.cssText = 'width:' + cellSize + ';text-align:center;font-size:1.2vw;color:var(--mut);font-family:var(--fb,"DM Sans",sans-serif)';
    colNums.appendChild(num);
  }
  boardWrap.appendChild(colNums);

  for (var row = 0; row < 9; row++) {
    var rowEl = document.createElement('div');
    rowEl.style.cssText = 'display:flex;gap:2px';
    for (var col = 0; col < 9; col++) {
      var cell = document.createElement('div');
      var val = state.grid && state.grid[row] ? state.grid[row][col] : null;
      var bg = val === 'X' ? VG_X + '99' : val === 'O' ? VG_O + '99' : 'var(--bg3)';
      var border = val === 'X' ? VG_X : val === 'O' ? VG_O : 'var(--brd)';
      cell.style.cssText = 'width:' + cellSize + ';height:' + cellSize + ';border-radius:50%;background:' + bg + ';border:2px solid ' + border + ';box-sizing:border-box';
      rowEl.appendChild(cell);
    }
    boardWrap.appendChild(rowEl);
  }

  gridSection.appendChild(boardWrap);
  container.appendChild(gridSection);

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
