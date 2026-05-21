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
socket.on('game:finished', function({ state }) {
  renderGame(state);
  setTimeout(function() { renderIdle(null); }, 3000);
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
