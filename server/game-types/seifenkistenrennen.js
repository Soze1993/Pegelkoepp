'use strict';

// ---------------------------------------------------------------------------
// Seifenkistenrennen — Mannschaftsspiel (2 Teams)
// Die Strecke hat 14 Felder mit festen Holzzahlen (keine 9).
// Ein Wurf rückt das Team NUR vor, wenn er exakt die Holzzahl des nächsten
// Feldes trifft. Sonst: kein Fortschritt.
// Abkürzungen: bestimmte Felder schicken das Team weiter nach vorne.
// Erstes Team hinter Feld 14 gewinnt.
// ---------------------------------------------------------------------------

const TRACK = [
  { values: [2] },                  // 0
  { values: [6] },                  // 1
  { values: [3] },                  // 2
  { values: [3], shortcutTo: 6 },  // 3 → ⚡ Abkürzung zu Position 6
  { values: [6] },                  // 4
  { values: [1] },                  // 5
  { values: [5] },                  // 6
  { values: [4] },                  // 7
  { values: [7], shortcutTo: 11 }, // 8 → ⚡ Abkürzung zu Position 11
  { values: [5] },                  // 9
  { values: [2] },                  // 10
  { values: [5, 8] },              // 11
  { values: [4] },                  // 12
  { values: [7] },                  // 13 → Position 14 = ZIEL
];

module.exports = {
  id: 'seifenkistenrennen',
  name: 'Seifenkistenrennen',
  TRACK,

  initState(players) {
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      posA: 0,   // Felder erfolgreich passiert (0 = Start, 14 = Ziel)
      posB: 0,
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

    const pos   = team === 'A' ? s.posA : s.posB;
    const field = TRACK[pos];

    if (field && field.values.includes(value)) {
      let newPos = pos + 1;
      // Abkürzung: wenn das gerade überquerte Feld eine shortcutTo hat, direkt springen
      if (field.shortcutTo !== undefined && field.shortcutTo > newPos) {
        newPos = field.shortcutTo;
      }
      if (team === 'A') s.posA = newPos;
      else              s.posB = newPos;

      if (newPos >= TRACK.length) {
        s.done   = true;
        s.winner = team;
      }
    }

    // Teams wechseln nach jedem Wurf
    if (!s.done) {
      if (team === 'A') { s.iA = (s.iA + 1) % s.tA.length; s.aktTeam = 'B'; }
      else              { s.iB = (s.iB + 1) % s.tB.length; s.aktTeam = 'A'; }
    }

    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    const all = [
      ...state.tA.map(p => ({ ...p, team: 'A' })),
      ...state.tB.map(p => ({ ...p, team: 'B' })),
    ];
    return all.map(p => ({
      playerId: p.id,
      score:    p.team === 'A' ? state.posA : state.posB,
      pudel:    p.pudel,
      winner:   p.team === state.winner,
    }));
  }
};
