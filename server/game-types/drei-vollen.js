'use strict';

module.exports = {
  id: 'dreiVollen',
  name: 'Drei in die Vollen',

  initState(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0 })),
      aktSpIdx: 0,
      done: false
    };
  },

  applyThrow(state, playerId, value) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p) return s;
    if (value === 0) p.pudel++;
    p.wuerfe.push(value);
    if (p.wuerfe.length >= 3) {
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) s.done = true;
    }
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: p.wuerfe.reduce((a, b) => a + b, 0),
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
