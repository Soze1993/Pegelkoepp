'use strict';

// BK_BILDER — ported verbatim from HTML line 303
const BK_BILDER = [
  { id: 'volle', name: 'Volle', pins: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'kleeblatt', name: 'Kleeblatt', pins: [2, 3, 4, 6, 7, 8, 9] },
  { id: 'hint_kranz', name: 'Hint. Kranz', pins: [4, 6, 7, 8, 9] },
  { id: 'damen', name: 'Damen', pins: [2, 3, 7, 8] },
  { id: 'bauern', name: 'Bauern', pins: [4, 6] }
];

function bkTotal(p) {
  return p.bildPts.reduce((a, b) => a + (b !== null ? b : 0), 0);
}

module.exports = {
  id: 'bilderkegel',
  name: 'Bilderkegel',

  initState(players) {
    return {
      players: players.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        bildPts: [null, null, null, null, null],
        wuerfe: [[], [], [], [], []],
        pudel: 0
      })),
      aktSpIdx: 0,
      aktBildIdx: 0,
      aktWurfNr: 0,
      done: false
    };
  },

  // value: raw pin count 0..9 (0 = Pudel)
  applyThrow(state, playerId, value) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;
    const p = s.players[s.aktSpIdx];
    if (!p || p.id !== playerId) return s;

    if (value === 0) p.pudel++;
    p.wuerfe[s.aktBildIdx].push(value);
    s.aktWurfNr++;

    if (s.aktWurfNr >= 2) {
      // Compute bildPts after 2 throws
      p.bildPts[s.aktBildIdx] = p.wuerfe[s.aktBildIdx].reduce((a, b) => a + b, 0);
      s.aktWurfNr = 0;
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) {
        s.aktSpIdx = 0;
        s.aktBildIdx++;
        if (s.aktBildIdx >= BK_BILDER.length) {
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
    const tots = state.players.map(p => bkTotal(p));
    const maxP = Math.max(...tots);
    const minP = Math.min(...tots);
    return state.players.map(p => {
      const tot = bkTotal(p);
      return {
        playerId: p.id,
        score: tot,
        winner: tot === maxP,
        payer: tot === minP
      };
    });
  }
};
