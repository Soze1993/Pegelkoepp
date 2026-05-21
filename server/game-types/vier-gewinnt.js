'use strict';

// check4: returns true if team `t` has 4 in a row on the grid
// Ported verbatim from HTML line 330
function check4(grid, t) {
  const N = 9;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] !== t) continue;
      // Horizontal
      if (c + 3 < N && grid[r][c + 1] === t && grid[r][c + 2] === t && grid[r][c + 3] === t) return true;
      // Vertical
      if (r + 3 < N && grid[r + 1][c] === t && grid[r + 2][c] === t && grid[r + 3][c] === t) return true;
      // Diagonal down-right
      if (r + 3 < N && c + 3 < N && grid[r + 1][c + 1] === t && grid[r + 2][c + 2] === t && grid[r + 3][c + 3] === t) return true;
      // Diagonal down-left
      if (r + 3 < N && c - 3 >= 0 && grid[r + 1][c - 1] === t && grid[r + 2][c - 2] === t && grid[r + 3][c - 3] === t) return true;
    }
  }
  return false;
}

module.exports = {
  id: 'viergewinnt',
  name: 'Vier Gewinnt',

  initState(players) {
    return {
      grid: Array.from({ length: 9 }, () => Array(9).fill(null)),
      nr: Array(9).fill(8), // next available row per column (8=bottom, decrements upward)
      tX: players.filter(p => p.role === 'X').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'X' })),
      tO: players.filter(p => p.role === 'O').map(p => ({ id: p.id, name: p.name, emoji: p.emoji, team: 'O' })),
      aktT: 'X',
      iX: 0,
      iO: 0,
      done: false,
      winner: null
    };
  },

  // value = column index 0..8; meta.pudel === true for Pudel turn
  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team = s.aktT;

    if (meta && meta.pudel) {
      // Pudel: no piece placed, turn advances
      if (team === 'X') { s.iX++; s.aktT = 'O'; }
      else { s.iO++; s.aktT = 'X'; }
      return s;
    }

    const col = value;
    if (col < 0 || col > 8) return s;
    if (s.nr[col] < 0) return s; // column full — return unchanged

    s.grid[s.nr[col]][col] = team;
    s.nr[col]--;

    if (team === 'X') { s.iX++; s.aktT = 'O'; }
    else { s.iO++; s.aktT = 'X'; }

    if (check4(s.grid, 'X')) {
      s.done = true;
      s.winner = 'X';
    } else if (check4(s.grid, 'O')) {
      s.done = true;
      s.winner = 'O';
    } else if (s.grid.every(row => row.every(c => c !== null))) {
      s.done = true;
      s.winner = 'draw';
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const w = state.winner;
    const allPlayers = [...state.tX, ...state.tO];
    return allPlayers.map(p => ({
      playerId: p.id,
      team: p.team,
      score: 0,
      winner: w !== 'draw' && w !== null && p.team === w
    }));
  }
};
