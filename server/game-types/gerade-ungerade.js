'use strict';

// ---------------------------------------------------------------------------
// Gerade & Ungerade — Mannschaftsspiel (2 teams)
// Team A wirft in Runde 1 gerade Zahlen, in Runde 2 ungerade Zahlen.
// Team B wirft in Runde 1 ungerade, in Runde 2 gerade.
// Nur Würfe mit der richtigen Parität werden gewertet.
// 2 Runden, 1 Wurf pro Spieler pro Runde.
// Sieger: das Team mit den meisten Gesamtpunkten.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'geradeUngerade',
  name: 'Gerade & Ungerade',

  initState(players) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        wuerfe: [], pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        wuerfe: [], pudel: 0
      })),
      aktTeam: 'A',  // whose turn
      iA: 0,         // current player index in team A
      iB: 0,         // current player index in team B
      runde: 1,      // 1 or 2
      scoreA: 0,
      scoreB: 0,
      done: false,
      winner: null   // 'A', 'B', or 'draw'
    };
  },

  // Each throw: 1 player from aktTeam throws.
  // Points counted only if parity matches team's requirement for this round.
  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;
    const idx     = team === 'A' ? s.iA  : s.iB;
    const player  = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    // Pudel tracking
    if (value === 0 && !(meta && meta.keinPudel)) player.pudel++;
    player.wuerfe.push(value);

    // Determine if throw scores: R1 A=even, B=odd; R2 A=odd, B=even
    const needsEven = (s.runde === 1 && team === 'A') || (s.runde === 2 && team === 'B');
    const isEven = value % 2 === 0;
    if (needsEven === isEven) {
      if (team === 'A') s.scoreA += value;
      else              s.scoreB += value;
    }

    // Advance player index
    if (team === 'A') {
      s.iA++;
      if (s.iA >= s.tA.length) {
        // Team A done for this round — switch to Team B
        s.iA = 0;
        s.aktTeam = 'B';
      }
    } else {
      s.iB++;
      if (s.iB >= s.tB.length) {
        // Team B done for this round — end of round
        s.iB = 0;
        s.runde++;
        s.aktTeam = 'A';
        if (s.runde > 2) {
          s.done = true;
          if (s.scoreA > s.scoreB)      s.winner = 'A';
          else if (s.scoreB > s.scoreA) s.winner = 'B';
          else                          s.winner = 'draw';
        }
      }
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const allPlayers = [
      ...state.tA.map(p => ({ ...p, team: 'A' })),
      ...state.tB.map(p => ({ ...p, team: 'B' }))
    ];
    return allPlayers.map(p => ({
      playerId: p.id,
      score: p.team === 'A' ? state.scoreA : state.scoreB,
      pudel: p.pudel,
      winner: state.winner !== 'draw' && p.team === state.winner
    }));
  }
};
