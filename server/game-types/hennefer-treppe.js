'use strict';

// ---------------------------------------------------------------------------
// Hennefer Treppe — Mannschaftsspiel (2 Teams)
// 10 Runden. Pro Runde wirft jede Mannschaft im Abräumen-Modus.
// Spieler der Mannschaft werfen reihum, je 1 Wurf.
// Wenn alle Kegel fallen (Abräumen): neu aufstellen, gleiche Mannschaft weiter.
// Fehlwurf (0 Kegel): Runde der Mannschaft endet.
// Punkte pro Runde = getroffene Kegel × Anzahl Würfe (Fehlwurf zählt nicht).
// Mannschaft mit den meisten Gesamtpunkten gewinnt.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'henneferTreppe',
  name: 'Hennefer Treppe',

  initState(players, config = {}) {
    const totalRunden = (config && config.totalRunden) ? config.totalRunden : 10;
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      totalRunden,
      aktRunde: 1,
      aktTeam: 'A',
      chainIdx: 0,       // current player index in the chain (cycles through team)
      chainThrows: [],   // throws in current chain (excluding miss)
      remaining: 9,      // pins remaining on current setup
      scoreA: 0,
      scoreB: 0,
      rndA: [],          // per-round scores for team A
      rndB: [],          // per-round scores for team B
      done: false,
      winner: null
    };
  },

  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team    = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;
    const player  = teamArr[s.chainIdx % teamArr.length];
    if (!player || player.id !== playerId) return s;

    if (value === 0 || (meta && meta.keinPudel && value === 0)) {
      // Miss (Fehlwurf) — end this team's round
      if (!(meta && meta.keinPudel)) player.pudel++;
      const chainSum   = s.chainThrows.reduce((a, b) => a + b, 0);
      const chainCount = s.chainThrows.length;
      const roundScore = chainCount > 0 ? chainSum * chainCount : 0;

      if (team === 'A') {
        s.scoreA += roundScore;
        s.rndA.push(roundScore);
        // Switch to Team B for this round
        s.aktTeam = 'B';
        s.chainIdx = 0;
        s.chainThrows = [];
        s.remaining = 9;
      } else {
        s.scoreB += roundScore;
        s.rndB.push(roundScore);
        // End of full round
        s.aktRunde++;
        s.aktTeam = 'A';
        s.chainIdx = 0;
        s.chainThrows = [];
        s.remaining = 9;
        if (s.aktRunde > s.totalRunden) {
          s.done = true;
          if (s.scoreA > s.scoreB)      s.winner = 'A';
          else if (s.scoreB > s.scoreA) s.winner = 'B';
          else                          s.winner = 'draw';
        }
      }
      return s;
    }

    // Successful throw (value > 0)
    s.chainThrows.push(value);
    s.remaining -= value;
    if (s.remaining <= 0) {
      // Abräumen — reset pins, same team continues
      s.remaining = 9;
    }
    // Advance to next player in team (cycling)
    s.chainIdx = (s.chainIdx + 1) % teamArr.length;

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
