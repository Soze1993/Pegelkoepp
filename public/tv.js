'use strict';

const connDot      = document.getElementById('connDot');
const idleEl       = document.getElementById('idle');
const gameEl       = document.getElementById('game');
const playerListEl = document.getElementById('playerList');
const lastWinnerEl = document.getElementById('lastWinnerText');

const socket = io();  // same-origin; socket.io.js auto-served at /socket.io/socket.io.js

// Connection indicator (RT-03)
socket.on('connect',    () => { connDot.className = 'conn-dot green'; });
socket.on('disconnect', () => { connDot.className = 'conn-dot red';   });

// State events (D-09, D-11)
socket.on('game:state',    ({ idle, state, gameId, lastWinner }) => {
  if (idle) renderIdle(lastWinner);
  else { socket.emit('join', gameId); renderGame(state); }
});
socket.on('throw:applied', ({ state }) => renderGame(state));
socket.on('undo:applied',  ({ state }) => renderGame(state));   // D-07: silent re-render
socket.on('game:started',  ({ state, gameId }) => { socket.emit('join', gameId); renderGame(state); });
socket.on('game:finished', function({ state, lastWinner }) {
  renderGame(state);
  setTimeout(function() { renderIdle(lastWinner || null); }, 3000);
});

function renderIdle(lastWinner) {
  gameEl.classList.remove('active');
  idleEl.style.display = 'flex';
  // textContent only — no innerHTML (XSS prevention T-02-02)
  lastWinnerEl.textContent = lastWinner
    ? 'Letzter Sieger: ' + lastWinner
    : 'Noch kein Spiel gespielt';
}

function renderGame(state) {
  if (state && state.bracket) { renderKDABracket(state); return; }  // KDA: before state.players guard
  if (!state || !state.players) return;
  idleEl.style.display = 'none';
  gameEl.classList.add('active');

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

  // Outer container: 2-column grid — W bracket left, L bracket + GF right
  var container = document.createElement('div');
  container.className = 'kda-tv-bracket';
  container.style.cssText = 'width:100vw;height:100vh;background:var(--bg);padding:20px 24px;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr;gap:24px;overflow:hidden';

  // --- W bracket (left column) ---
  var wSection = document.createElement('div');
  wSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:0';

  var wLabel = document.createElement('div');
  wLabel.textContent = 'Winner Bracket';
  wLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--ac);line-height:1';
  wSection.appendChild(wLabel);

  var wRoundsRow = document.createElement('div');
  wRoundsRow.style.cssText = 'display:flex;flex-direction:row;gap:12px;align-items:flex-start;flex:1';

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

    var roundMatches = wMatches.filter(function(m) { return m.round === round; });
    roundMatches.forEach(function(slot) {
      col.appendChild(buildTVSlotEl(slot, slotWidth, slotHeight));
    });

    wRoundsRow.appendChild(col);
  });
  wSection.appendChild(wRoundsRow);
  container.appendChild(wSection);

  // --- L bracket + GF (right column) ---
  var rightSection = document.createElement('div');
  rightSection.style.cssText = 'display:flex;flex-direction:column;gap:12px;min-width:0';

  var lMatches = state.bracket.filter(function(m) { return m.bracket === 'L'; });
  if (lMatches.length > 0) {
    var lSection = document.createElement('div');
    lSection.style.cssText = 'display:flex;flex-direction:column;gap:6px';

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

      var roundMatches = lMatches.filter(function(m) { return m.round === round; });
      roundMatches.forEach(function(slot) {
        col.appendChild(buildTVSlotEl(slot, slotWidth, slotHeight));
      });

      lRoundsRow.appendChild(col);
    });
    lSection.appendChild(lRoundsRow);
    rightSection.appendChild(lSection);
  }

  // --- Grand Final ---
  var gfSlot = state.bracket.find(function(m) { return m.bracket === 'GF'; });
  if (gfSlot) {
    var gfSection = document.createElement('div');
    gfSection.style.cssText = 'display:flex;flex-direction:column;gap:4px';

    var gfLabel = document.createElement('div');
    gfLabel.textContent = 'Großes Finale';
    gfLabel.style.cssText = 'font-family:var(--fh,"Bebas Neue",sans-serif);font-size:28px;color:var(--ac);line-height:1';
    gfSection.appendChild(gfLabel);

    gfSection.appendChild(buildTVSlotEl(gfSlot, slotWidth, Math.round(slotHeight * 1.25)));
    rightSection.appendChild(gfSection);
  }

  container.appendChild(rightSection);
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
