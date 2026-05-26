'use strict';

// Pudel substitution per round index (0-based):
// round 0 (W1): 0, round 1 (W2): 0, round 2 (W3): 9, round 3 (W4): 1, round 4 (W5): 1
const PUDEL_SUB = [0, 0, 9, 1, 1];

function pmCalc(w) {
  if (!w || !w.length) return 0;
  let r = w[0];
  if (w.length > 1) r += w[1];
  if (w.length > 2) r -= w[2];
  if (w.length > 2 && r < 1) r = 1;  // floor at 1 before × and ÷ to prevent 0 or negative results
  if (w.length > 3) r *= w[3];
  if (w.length > 4) r = w[4] !== 0 ? r / w[4] : r;
  return Math.round(r * 100) / 100;
}

module.exports = {
  id: 'plusMinus',
  name: 'Plus/Minus/Mal/Geteilt',

  initState(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0 })),
      aktSpIdx: 0,
      pmRunde: 1, // 1-5
      done: false
    };
  },

  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    const p = s.players.find(x => x.id === playerId);
    if (!p) return s;
    const roundIdx = s.pmRunde - 1; // 0-based index for PUDEL_SUB
    let storedVal = value;
    if (value === 0 && !(meta && meta.keinPudel)) {
      p.pudel++;
      storedVal = PUDEL_SUB[roundIdx];
    }
    // W3: cap so W1+W2-W3 cannot go below 1
    if (roundIdx === 2 && p.wuerfe.length >= 2) {
      const sumW1W2 = p.wuerfe[0] + p.wuerfe[1];
      storedVal = Math.min(storedVal, Math.max(sumW1W2 - 1, 0));
    }
    p.wuerfe.push(storedVal);
    s.aktSpIdx++;
    if (s.aktSpIdx >= s.players.length) {
      s.aktSpIdx = 0;
      s.pmRunde++;
      if (s.pmRunde > 5) s.done = true;
    }
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: pmCalc(p.wuerfe),
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
