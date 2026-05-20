'use strict';

function hn(slots) {
  if (slots.h === null || slots.z === null || slots.e === null) return null;
  return (slots.h * 100) + (slots.z * 10) + slots.e;
}

module.exports = {
  id: 'grosseHaus',
  name: 'Grosse Hausnummer',

  initState(players) {
    return {
      players: players.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        slots: { h: null, z: null, e: null }, pudel: 0
      })),
      aktSpIdx: 0,
      done: false
    };
  },

  // meta: { slot: 'h'|'z'|'e' }
  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p || !meta.slot) return s;
    if (value === 0) p.pudel++;
    p.slots[meta.slot] = value; // Pudel=0 stored as 0 for grosseHaus
    // Rotate to next player
    s.aktSpIdx++;
    if (s.aktSpIdx >= s.players.length) {
      s.aktSpIdx = 0;
      // Check if all players have all 3 slots filled
      const allFilled = s.players.every(
        x => x.slots.h !== null && x.slots.z !== null && x.slots.e !== null
      );
      if (allFilled) s.done = true;
    }
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: hn(p.slots) !== null ? hn(p.slots) : 0,
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
