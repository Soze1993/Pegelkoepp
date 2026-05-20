'use strict';

function hn(slots) {
  if (slots.h === null || slots.z === null || slots.e === null) return null;
  return (slots.h * 100) + (slots.z * 10) + slots.e;
}

module.exports = {
  id: 'kleineHaus',
  name: 'Kleine Hausnummer',

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
  // Key difference from grosseHaus: Pudel=0 substitutes 9 in the slot
  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p || !meta.slot) return s;
    let storedVal = value;
    if (value === 0) {
      p.pudel++;
      storedVal = 9; // Pudel substitutes 9 for kleineHaus
    }
    p.slots[meta.slot] = storedVal;
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
    // Winner = lowest valid score (pts > 0)
    const valid = scores.map(x => x.score).filter(v => v > 0);
    const best = valid.length ? Math.min(...valid) : 0;
    return scores.map(x => ({ ...x, winner: x.score === best && x.score > 0 }));
  }
};
