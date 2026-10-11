'use strict';

// Mixed Partie — Mannschaftsspiel (2 Teams), 4 Runden
// R1: 3 Würfe Volle pro Spieler, Summe → R1-Beitrag
// R2: 4 Würfe Abräumen pro Spieler, Summe → R2-Beitrag
// R3: Große Hausnummer — 2 Würfe (Zehner+Einer) pro Spieler, addiert
//     Ablauf: A0-Zehner → B0-Zehner → A0-Einer → B0-Einer → A1-Zehner → …
// R4: Kleine Hausnummer — wie R3, aber subtrahiert
//     Pudel in R4 → Digit 9 (ungünstigste Stelle) — zählt NICHT als Pudel-Stat
// Teamergebnis = sum(R1) + sum(R2) + sum(R3) − sum(R4)

module.exports = {
  id: 'mixedPartie',
  name: 'Mixed Partie',

  initState(players, config) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null, r3:null, r4:null, zehner:null})),
      tB: players.filter(p => p.role === 'B').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null, r3:null, r4:null, zehner:null})),
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      runde: 1,
      throwBuf: [],
      remaining: 9,
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

    // Pudel-Statistik: R4 zählt nie (Pudel → Digit 9 ist Spielregel, kein Stat-Pudel)
    if (s.runde !== 4 && value === 0 && !(meta && meta.keinPudel)) player.pudel++;

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
      // Teamweiser Wechsel nach JEDEM Einzelwurf (Zehner/Einer)
      // Zehner wird pro Spieler gespeichert, damit B seinen Zehner werfen kann
      // bevor A seinen Einer wirft
      if (player.zehner === null) {
        player.zehner = value; // Pudel → digit 0
        _interleaveSwitch(s);
        return s;
      }
      player.r3 = player.zehner * 10 + value;
      player.zehner = null;
      return _advance(s);
    }

    if (s.runde === 4) {
      // Pudel → Digit 9 (ungünstigste Stelle beim Subtrahieren)
      const digit = (value === 0 && !(meta && meta.keinPudel)) ? 9 : value;
      if (player.zehner === null) {
        player.zehner = digit;
        _interleaveSwitch(s);
        return s;
      }
      player.r4 = player.zehner * 10 + digit;
      player.zehner = null;
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

// Wechselt das aktive Team nach einem Einzelwurf (für R3/R4 Zehner)
// Falls das andere Team schon alle Spieler für diese Runde abgeschlossen hat, bleibt das aktuelle Team dran
function _interleaveSwitch(s) {
  const other    = s.aktTeam === 'A' ? 'B' : 'A';
  const otherIdx = other === 'A' ? s.iA : s.iB;
  const otherLen = other === 'A' ? s.tA.length : s.tB.length;
  if (otherIdx < otherLen) s.aktTeam = other;
}

// Spieler innerhalb der Runde weiterschieben (nach Abschluss eines kompletten Spieler-Turns)
// Interleave: A0→B0→A1→B1 usw.
function _advance(s) {
  if (s.aktTeam === 'A') s.iA++;
  else                   s.iB++;

  const aDone = s.iA >= s.tA.length;
  const bDone = s.iB >= s.tB.length;

  if (aDone && bDone) {
    s.runde++;
    s.aktTeam = 'A'; s.iA = 0; s.iB = 0; s.remaining = 9;
    if (s.runde > 4) {
      s.done = true;
      const sA = _teamTotal(s.tA), sB = _teamTotal(s.tB);
      s.winner = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
    }
  } else if (aDone) {
    s.aktTeam = 'B';
  } else if (bDone) {
    s.aktTeam = 'A';
  } else {
    s.aktTeam = s.aktTeam === 'A' ? 'B' : 'A';
  }
  return s;
}
