'use strict';

module.exports = {
  id: 'anker',
  name: 'Anker',

  initState(players, config = {}) {
    const maxRunden = (config && config.maxRunden) ? config.maxRunden : 3;
    return {
      players: players.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        runden: [], pudel: 0
      })),
      maxRunden,
      aktSpIdx: 0,
      aktRunde: 1,
      wurfNr: 0,
      done: false
    };
  },

  // value is 0, 1, 2, 3, 4, 5, or 10 (Anker point values)
  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players[s.aktSpIdx];
    // Guard: if wrong player or already done
    if (!p || p.id !== playerId) return s;
    // meta.finishRound: end player's turn early, jump to next player
    // Push a 0 to runden to keep p.runden.length in sync with DB throw_index,
    // otherwise the next round would reuse the same throw_index → UNIQUE violation.
    if (meta && meta.finishRound) {
      if (!p.runden[s.aktRunde - 1]) p.runden[s.aktRunde - 1] = [];
      p.runden[s.aktRunde - 1].push(0);
      s.wurfNr = 0;
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) {
        s.aktSpIdx = 0;
        s.aktRunde++;
        if (s.aktRunde > s.maxRunden) s.done = true;
      }
      return s;
    }
    // Ensure current round array exists
    if (!p.runden[s.aktRunde - 1]) p.runden[s.aktRunde - 1] = [];
    p.runden[s.aktRunde - 1].push(value);
    if (value === 0 && !(meta && meta.keinPudel)) p.pudel++;
    s.wurfNr++;
    const rPts = p.runden[s.aktRunde - 1].reduce((a, b) => a + b, 0);
    // Round ends: 5 throws OR cumulative >= 40
    if (s.wurfNr >= 5 || rPts >= 40) {
      s.wurfNr = 0;
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) {
        s.aktSpIdx = 0;
        s.aktRunde++;
        if (s.aktRunde > s.maxRunden) {
          s.done = true;
        }
      }
    }
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: p.runden.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0),
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
