'use strict';

// Mixed Partie — Mannschaftsspiel (2 Teams), 4 Runden
// R1: 3 Würfe Volle pro Spieler, Summe aller Spieler → Teambeitrag R1
// R2: 4 Würfe Abräumen pro Spieler, Summe aller Spieler → Teambeitrag R2
// R3: Große Hausnummer — 2 Würfe (Zehner + Einer) = 2-stellige Zahl, addiert
// R4: Kleine Hausnummer — 2 Würfe (Zehner + Einer) = 2-stellige Zahl, subtrahiert
// Teamergebnis = sum(R1) + sum(R2) + sum(R3) − sum(R4). Höchste Zahl gewinnt.

module.exports = {
  id: 'mixedPartie',
  name: 'Mixed Partie',

  initState(players, config) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null, r3:null, r4:null})),
      tB: players.filter(p => p.role === 'B').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null, r3:null, r4:null})),
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      runde: 1,
      throwBuf: [],
      remaining: 9,
      zehner: null,
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

    if (s.runde === 1) {
      s.throwBuf.push(value);
      if (s.throwBuf.length >= 3) {
        player.r1 = s.throwBuf.reduce((a, b) => a + b, 0);
        s.throwBuf = [];
        return _advance(s);
      }
      return s;
    }

    if (s.runde === 2) {
      const hit = Math.min(value, s.remaining);
      s.remaining -= hit;
      s.throwBuf.push(hit);
      if (s.remaining <= 0) s.remaining = 9;
      if (s.throwBuf.length >= 4) {
        player.r2 = s.throwBuf.reduce((a, b) => a + b, 0);
        s.throwBuf = [];
        s.remaining = 9;
        return _advance(s);
      }
      return s;
    }

    if (s.runde === 3) {
      if (s.zehner === null) { s.zehner = value; return s; }
      player.r3 = s.zehner * 10 + value;
      s.zehner = null;
      return _advance(s);
    }

    if (s.runde === 4) {
      if (s.zehner === null) { s.zehner = value; return s; }
      player.r4 = s.zehner * 10 + value;
      s.zehner = null;
      return _advance(s);
    }

    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    const sA = _teamTotal(state.tA), sB = _teamTotal(state.tB);
    return [
      ...state.tA.map(p => ({playerId:p.id, score:sA, pudel:p.pudel, winner:state.winner === 'A'})),
      ...state.tB.map(p => ({playerId:p.id, score:sB, pudel:p.pudel, winner:state.winner === 'B'})),
    ];
  }
};

function _teamTotal(arr) {
  return arr.reduce((sum, p) => sum + (p.r1||0) + (p.r2||0) + (p.r3||0) - (p.r4||0), 0);
}

function _advance(s) {
  // Increment current team's player index
  if (s.aktTeam === 'A') s.iA++;
  else                   s.iB++;

  const aDone = s.iA >= s.tA.length;
  const bDone = s.iB >= s.tB.length;

  if (aDone && bDone) {
    // Both teams finished this round → next round
    s.runde++;
    s.aktTeam = 'A'; s.iA = 0; s.iB = 0; s.remaining = 9;
    if (s.runde > 4) {
      s.done = true;
      const sA = _teamTotal(s.tA), sB = _teamTotal(s.tB);
      s.winner = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
    }
  } else if (aDone) {
    s.aktTeam = 'B'; // A finished, B still has players
  } else if (bDone) {
    s.aktTeam = 'A'; // B finished, A still has players
  } else {
    s.aktTeam = s.aktTeam === 'A' ? 'B' : 'A'; // Both still have players → interleave
  }
  return s;
}
