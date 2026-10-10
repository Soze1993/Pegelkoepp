'use strict';

// ---------------------------------------------------------------------------
// Gerade & Ungerade — Mannschaftsspiel (2 teams)
// R1: A=Gerade, B=Ungerade. R2: getauscht.
// Nur Würfe mit der richtigen Parität zählen.
// Bei Gleichstand nach 2 Runden: Stechen (je 1 Wurf), A=Gerade, B=Ungerade.
// Höherer gültiger Wert gewinnt. Noch mal unentschieden → nächste Spieler.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'geradeUngerade',
  name: 'Gerade & Ungerade',

  initState(players) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0
      })),
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      runde: 1,
      scoreA: 0,
      scoreB: 0,
      stechen: false,
      stechenRunde: 0,
      stechenWurfA: null,
      stechenWurfB: null,
      done: false,
      winner: null
    };
  },

  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    // ── Stechen ──────────────────────────────────────────────────────────
    if (s.stechen) {
      const team    = s.aktTeam;
      const teamArr = team === 'A' ? s.tA : s.tB;
      const idx     = team === 'A' ? s.iA  : s.iB;
      const player  = teamArr[idx];
      if (!player || player.id !== playerId) return s;

      if (value === 0 && !(meta && meta.keinPudel)) player.pudel++;

      // Stechen rule: A=Gerade, B=Ungerade (same as Round 1)
      const needsEven = team === 'A';
      const isEven    = value % 2 === 0;
      const score     = (needsEven === isEven) ? value : 0;

      if (team === 'A') {
        s.stechenWurfA = score;
        s.aktTeam = 'B';
      } else {
        s.stechenWurfB = score;
        if (s.stechenWurfA > s.stechenWurfB) {
          s.done = true; s.stechen = false; s.winner = 'A';
        } else if (s.stechenWurfB > s.stechenWurfA) {
          s.done = true; s.stechen = false; s.winner = 'B';
        } else {
          // Noch unentschieden → nächste Spieler, neue Stechen-Runde
          s.stechenRunde++;
          s.stechenWurfA = null;
          s.stechenWurfB = null;
          s.iA = (s.iA + 1) % s.tA.length;
          s.iB = (s.iB + 1) % s.tB.length;
          s.aktTeam = 'A';
        }
      }
      return s;
    }

    // ── Normales Spiel ───────────────────────────────────────────────────
    const team    = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;
    const idx     = team === 'A' ? s.iA  : s.iB;
    const player  = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    if (value === 0 && !(meta && meta.keinPudel)) player.pudel++;
    player.wuerfe.push(value);

    const needsEven = (s.runde === 1 && team === 'A') || (s.runde === 2 && team === 'B');
    const isEven    = value % 2 === 0;
    if (needsEven === isEven) {
      if (team === 'A') s.scoreA += value;
      else              s.scoreB += value;
    }

    if (team === 'A') {
      s.iA++;
      if (s.iA >= s.tA.length) { s.iA = 0; s.aktTeam = 'B'; }
    } else {
      s.iB++;
      if (s.iB >= s.tB.length) {
        s.iB = 0;
        s.runde++;
        s.aktTeam = 'A';
        if (s.runde > 2) {
          if (s.scoreA > s.scoreB) {
            s.done = true; s.winner = 'A';
          } else if (s.scoreB > s.scoreA) {
            s.done = true; s.winner = 'B';
          } else {
            // Gleichstand → Stechen
            s.stechen = true;
            s.stechenRunde = 1;
            s.stechenWurfA = null;
            s.stechenWurfB = null;
            s.iA = 0;
            s.iB = 0;
            s.aktTeam = 'A';
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
