'use strict';

// ---------------------------------------------------------------------------
// Seifenkistenrennen — Mannschaftsspiel (2 Teams), Rennen
// Zwei Teams rennen auf einer Strecke (Standard: 30 Felder).
// Reihum je 1 Wurf, die Mannschaft rückt um die geworfene Zahl vor.
// Teams wechseln nach jedem Wurf ab.
// Erste Mannschaft, die Streckenende erreicht oder überschreitet, gewinnt.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'seifenkistenrennen',
  name: 'Seifenkistenrennen',

  initState(players, config = {}) {
    const trackLength = (config && config.trackLength) ? config.trackLength : 30;
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      posA: 0,
      posB: 0,
      trackLength,
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      done: false,
      winner: null
    };
  },

  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team    = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;
    const idx     = team === 'A' ? s.iA  : s.iB;
    const player  = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    if (value === 0 && !(meta && meta.keinPudel)) player.pudel++;

    // Advance team's position
    if (team === 'A') {
      s.posA = Math.min(s.posA + value, s.trackLength);
      if (s.posA >= s.trackLength) { s.done = true; s.winner = 'A'; }
      s.iA = (s.iA + 1) % s.tA.length;
    } else {
      s.posB = Math.min(s.posB + value, s.trackLength);
      if (s.posB >= s.trackLength) { s.done = true; s.winner = 'B'; }
      s.iB = (s.iB + 1) % s.tB.length;
    }

    // Alternate teams
    if (!s.done) s.aktTeam = team === 'A' ? 'B' : 'A';

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
      score: p.team === 'A' ? state.posA : state.posB,
      pudel: p.pudel,
      winner: p.team === state.winner
    }));
  }
};
