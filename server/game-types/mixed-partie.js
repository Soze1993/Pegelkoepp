'use strict';

// ---------------------------------------------------------------------------
// Mixed Partie — Einzelspiel
// 4 Runden mit unterschiedlichen Aufgaben:
//   R1 (Volle):         1 Wurf pro Spieler, Summe zählt
//   R2 (Abräumen):      1 Wurf pro Spieler, Summe zählt
//   R3 (Hohe Zahlen):   3 Würfe pro Spieler (H/Z/E-Slots), bildet 3-stellige Zahl → addieren
//                       Pudel = Stelle 0; meta.kranz → Stelle 8
//   R4 (Niedrige Zahl): 3 Würfe pro Spieler (H/Z/E-Slots), bildet 3-stellige Zahl → subtrahieren
//                       Pudel = Stelle 9
// Gesamtscore = R1 + R2 + R3-Zahl − R4-Zahl
// Höchste Zahl gewinnt.
// ---------------------------------------------------------------------------

function hn(slots) {
  if (slots.h === null || slots.z === null || slots.e === null) return null;
  return slots.h * 100 + slots.z * 10 + slots.e;
}

module.exports = {
  id: 'mixedPartie',
  name: 'Mixed Partie',

  initState(players) {
    return {
      players: players.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji,
        r1: null,
        r2: null,
        r3: { h: null, z: null, e: null },
        r4: { h: null, z: null, e: null },
        pudel: 0
      })),
      aktSpIdx: 0,
      runde: 1,   // 1, 2, 3, or 4
      done: false
    };
  },

  // meta for R3/R4: { slot: 'h'|'z'|'e', kranz: true (R3 only) }
  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const p = s.players[s.aktSpIdx];
    if (!p || p.id !== playerId) return s;

    const n = s.players.length;

    if (s.runde === 1) {
      if (value === 0 && !meta.keinPudel) p.pudel++;
      p.r1 = value;
      s.aktSpIdx = (s.aktSpIdx + 1) % n;
      if (s.aktSpIdx === 0) s.runde = 2;
      return s;
    }

    if (s.runde === 2) {
      if (value === 0 && !meta.keinPudel) p.pudel++;
      p.r2 = value;
      s.aktSpIdx = (s.aktSpIdx + 1) % n;
      if (s.aktSpIdx === 0) s.runde = 3;
      return s;
    }

    if (s.runde === 3) {
      if (!meta.slot) return s; // slot required
      let digit = value;
      if (meta.kranz) {
        digit = 8; // Kranz → 8
      } else if (value === 0 && !meta.keinPudel) {
        p.pudel++;
        digit = 0; // Pudel → 0
      }
      p.r3[meta.slot] = digit;
      s.aktSpIdx = (s.aktSpIdx + 1) % n;
      if (s.aktSpIdx === 0) {
        // Check if all players have all 3 R3 slots filled
        const allR3 = s.players.every(x => x.r3.h !== null && x.r3.z !== null && x.r3.e !== null);
        if (allR3) s.runde = 4;
      }
      return s;
    }

    if (s.runde === 4) {
      if (!meta.slot) return s; // slot required
      let digit = value;
      if (value === 0 && !meta.keinPudel) {
        p.pudel++;
        digit = 9; // Pudel in R4 → 9 (worst for subtraction)
      }
      p.r4[meta.slot] = digit;
      s.aktSpIdx = (s.aktSpIdx + 1) % n;
      if (s.aktSpIdx === 0) {
        const allR4 = s.players.every(x => x.r4.h !== null && x.r4.z !== null && x.r4.e !== null);
        if (allR4) s.done = true;
      }
      return s;
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const scores = state.players.map(p => {
      const r3 = hn(p.r3);
      const r4 = hn(p.r4);
      const score = (p.r1 || 0) + (p.r2 || 0) + (r3 !== null ? r3 : 0) - (r4 !== null ? r4 : 0);
      return { playerId: p.id, score, pudel: p.pudel };
    });
    const best = Math.max(...scores.map(x => x.score));
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
