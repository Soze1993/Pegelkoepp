'use strict';

// BK_BILDER — ported verbatim from HTML line 303
const BK_BILDER = [
  { id: 'volle', name: 'Volle', pins: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'kleeblatt', name: 'Kleeblatt', pins: [2, 3, 4, 6, 7, 8] },
  { id: 'hint_kranz', name: 'Hint. Kranz', pins: [4, 6, 7, 8, 9] },
  { id: 'damen', name: 'Damen', pins: [2, 3, 7, 8] },
  { id: 'bauern', name: 'Bauern', pins: [4, 6] }
];
const BK_MAX = [12, 6, 5, 4, 2]; // max score per Bild index

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
        pudel: 0,
        stechenWuerfe: []
      })),
      aktSpIdx: 0,
      aktBildIdx: 0,
      aktWurfNr: 0,
      done: false,
      stechen: false,
      stechenPlayers: []
    };
  },

  // value: raw pin count 0..9 (0 = Pudel, unless meta.keinPudel=true)
  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    // Stechen phase: resolve the loser tie
    if (s.stechen) {
      const sp = s.players.find(x => x.id === playerId && s.stechenPlayers.includes(x.id) && x.stechenWuerfe.length === 0);
      if (!sp) return s;
      if (value === 0 && !(meta && meta.keinPudel)) sp.pudel++;
      sp.stechenWuerfe.push(value);
      const allThrown = s.stechenPlayers.every(id => {
        const p = s.players.find(x => x.id === id);
        return p && p.stechenWuerfe.length >= 1;
      });
      if (allThrown) {
        const scores = s.stechenPlayers.map(id => {
          const p = s.players.find(x => x.id === id);
          return { id, score: p.stechenWuerfe[p.stechenWuerfe.length - 1] };
        });
        const minScore = Math.min(...scores.map(x => x.score));
        const payers = scores.filter(x => x.score === minScore);
        if (payers.length === 1) {
          s.done = true;
          s.stechen = false;
          s.stechenPlayers = [payers[0].id];
        } else {
          // Still tied — new stechen round with only the tied players
          s.stechenPlayers = payers.map(x => x.id);
          s.players.forEach(p => { if (s.stechenPlayers.includes(p.id)) p.stechenWuerfe = []; });
        }
      }
      return s;
    }

    const p = s.players[s.aktSpIdx];
    if (!p || p.id !== playerId) return s;

    if (value === 0 && !(meta && meta.keinPudel)) p.pudel++;
    p.wuerfe[s.aktBildIdx].push(value);
    s.aktWurfNr++;

    // After push and aktWurfNr++: aktWurfNr===1 means first throw just recorded
    const maxReachedEarly = s.aktWurfNr === 1 && s.aktBildIdx > 0 && value >= BK_MAX[s.aktBildIdx];
    if (s.aktWurfNr >= 2 || maxReachedEarly) {
      p.bildPts[s.aktBildIdx] = p.wuerfe[s.aktBildIdx].reduce((a, b) => a + b, 0);
      s.aktWurfNr = 0;
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) {
        s.aktSpIdx = 0;
        s.aktBildIdx++;
        if (s.aktBildIdx >= BK_BILDER.length) {
          // All 5 Bilder done — check for loser tie
          const tots = s.players.map(p => bkTotal(p));
          const minTot = Math.min(...tots);
          const tiedIds = s.players.filter(p => bkTotal(p) === minTot).map(p => p.id);
          if (tiedIds.length > 1) {
            s.stechen = true;
            s.stechenPlayers = tiedIds;
          } else {
            s.done = true;
          }
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
    // If stechen resolved to one player, that player is the definitive payer
    const stechenPayer = state.stechenPlayers && state.stechenPlayers.length === 1
      ? state.stechenPlayers[0] : null;
    return state.players.map(p => {
      const tot = bkTotal(p);
      return {
        playerId: p.id,
        score: tot,
        winner: tot === maxP,
        payer: stechenPayer ? p.id === stechenPayer : tot === minP
      };
    });
  }
};
