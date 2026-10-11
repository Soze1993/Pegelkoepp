'use strict';

// Mixed Partie — Mannschaftsspiel (2 Teams), 4 Runden
// R1: 3 Würfe Volle pro Spieler → Summe je Team
// R2: 4 Würfe Abräumen pro Spieler → Summe je Team
// R3: Große Hausnummer — IMMER genau 2 zweistellige Zahlen pro Team
//     4 Slots: [Z1, E1, Z2, E2]. Slot 0→Player[0%N], Slot 1→Player[1%N], …
//     Interleave: Team A füllt Slot X, dann Team B Slot X, dann nächster Slot.
//     Ergebnis: (Z1*10+E1) + (Z2*10+E2) wird addiert
// R4: Kleine Hausnummer — gleicher Aufbau, wird subtrahiert
//     Pudel → Digit 9 (kein Pudel-Stat)
// Teamergebnis = R1 + R2 + R3 − R4

module.exports = {
  id: 'mixedPartie',
  name: 'Mixed Partie',

  initState(players, config) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null})),
      tB: players.filter(p => p.role === 'B').map(p => ({id:p.id, name:p.name, emoji:p.emoji, pudel:0, r1:null, r2:null})),
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      runde: 1,
      throwBuf: [],
      remaining: 9,
      // R3/R4: je 4 Slots [Zehner1, Einer1, Zehner2, Einer2]
      hnA3: [null, null, null, null],
      hnB3: [null, null, null, null],
      hnA4: [null, null, null, null],
      hnB4: [null, null, null, null],
      hnSlot: 0,  // 0-3, aktueller Slot in R3/R4
      done: false,
      winner: null
    };
  },

  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team    = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;

    // Spieler ermitteln: R1/R2 per iA/iB, R3/R4 per hnSlot % teamSize
    const idx    = s.runde >= 3 ? s.hnSlot % teamArr.length
                                : (team === 'A' ? s.iA : s.iB);
    const player = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    // Pudel-Statistik: R4 zählt nie (Digit 9 = Spielregel)
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
      const hn = team === 'A' ? s.hnA3 : s.hnB3;
      hn[s.hnSlot] = value;
      return _advanceHN(s);
    }

    if (s.runde === 4) {
      const digit = (value === 0 && !(meta && meta.keinPudel)) ? 9 : value;
      const hn = team === 'A' ? s.hnA4 : s.hnB4;
      hn[s.hnSlot] = digit;
      return _advanceHN(s);
    }

    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    const sA = _teamTotal(state.tA, state.hnA3, state.hnA4);
    const sB = _teamTotal(state.tB, state.hnB3, state.hnB4);
    return [
      ...state.tA.map(p => ({playerId:p.id, score:sA, pudel:p.pudel, winner:state.winner === 'A'})),
      ...state.tB.map(p => ({playerId:p.id, score:sB, pudel:p.pudel, winner:state.winner === 'B'})),
    ];
  }
};

function _hnTotal(hn) {
  return ((hn[0]||0)*10 + (hn[1]||0)) + ((hn[2]||0)*10 + (hn[3]||0));
}

function _teamTotal(arr, hn3, hn4) {
  const r1 = arr.reduce((s, p) => s + (p.r1||0), 0);
  const r2 = arr.reduce((s, p) => s + (p.r2||0), 0);
  return r1 + r2 + _hnTotal(hn3) - _hnTotal(hn4);
}

// R1/R2: Interleave A0→B0→A1→B1 usw.
function _advance(s) {
  if (s.aktTeam === 'A') s.iA++;
  else                   s.iB++;
  const aDone = s.iA >= s.tA.length;
  const bDone = s.iB >= s.tB.length;
  if (aDone && bDone) {
    s.runde++; s.aktTeam = 'A'; s.iA = 0; s.iB = 0; s.remaining = 9;
    if (s.runde > 4) _finish(s);
  } else if (aDone) { s.aktTeam = 'B'; }
  else if (bDone)   { s.aktTeam = 'A'; }
  else              { s.aktTeam = s.aktTeam === 'A' ? 'B' : 'A'; }
  return s;
}

// R3/R4: Team A füllt Slot → Team B füllt Slot → nächster Slot
function _advanceHN(s) {
  if (s.aktTeam === 'A') {
    s.aktTeam = 'B'; // B füllt jetzt denselben Slot
  } else {
    s.aktTeam = 'A';
    s.hnSlot++;
    if (s.hnSlot >= 4) {
      s.hnSlot = 0;
      s.runde++;
      if (s.runde > 4) _finish(s);
    }
  }
  return s;
}

function _finish(s) {
  s.done = true;
  const sA = _teamTotal(s.tA, s.hnA3, s.hnA4);
  const sB = _teamTotal(s.tB, s.hnB3, s.hnB4);
  s.winner = sA > sB ? 'A' : sB > sA ? 'B' : 'draw';
}
