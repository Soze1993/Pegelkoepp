'use strict';

// ---------------------------------------------------------------------------
// Fußball — Mannschaftsspiel (2 Teams), Abräumen-Modus
// Tore erzielen durch Abräumen (alle Kegel fällen).
// Teams wechseln nach jedem Wurf — wer die restlichen Kegel räumt, erzielt ein Tor.
// Pudel (0 Kegel) = Elfmeter für das gegnerische Team.
//   Elfmeter: Sonderaufstellung (4 Kegel). Wert > 0 = Tor.
// Sieg: mindestens 5 Tore UND 2 Tore Vorsprung.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'fussball',
  name: 'Fußball',

  initState(players, config = {}) {
    const targetGoals = (config && config.targetGoals) ? config.targetGoals : 5;
    return {
      tA: players.filter(p => p.role === 'A').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      tB: players.filter(p => p.role === 'B').map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, pudel: 0
      })),
      toreA: 0,
      toreB: 0,
      targetGoals,
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      remaining: 9,    // pins still standing
      phase: 'normal', // 'normal' or 'elfmeter'
      elfmeterTeam: null,  // 'A' or 'B' — team TAKING the Elfmeter
      done: false,
      winner: null
    };
  },

  // Teams alternate after EVERY throw.
  // If all pins fall: Tor for throwing team, switch teams, reset pins.
  // If Pudel (0): Elfmeter for the other team next throw.
  // After elfmeter throw: reset pins (9), normal play continues.
  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const team    = s.aktTeam;
    const teamArr = team === 'A' ? s.tA : s.tB;
    const idx     = team === 'A' ? s.iA  : s.iB;
    const player  = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    if (s.phase === 'elfmeter') {
      // Gasse = Tor; Pudel = kein Gegenelfmeter; alles andere = kein Tor
      if (meta && meta.gasse) {
        if (s.elfmeterTeam === 'A') s.toreA++;
        else                        s.toreB++;
      } else if (value === 0 && !(meta && meta.keinPudel)) {
        player.pudel++; // Pudel beim Elfmeter zählt als Pudel, aber KEIN Gegenelfmeter
      }
      // Elfmeter-Team darf danach auf die Vollen
      const em = s.elfmeterTeam;
      s.phase = 'normal';
      s.elfmeterTeam = null;
      s.remaining = 9;
      s.aktTeam = em; // Elfmeter-Team ist dran
      if (team === 'A') s.iA = (s.iA + 1) % s.tA.length;
      else              s.iB = (s.iB + 1) % s.tB.length;
      return _checkWin(s);
    }

    // Normal phase
    if (value === 0) {
      if (meta && meta.keinPudel) {
        // Aus (kein Pudel) — kein Elfmeter, aber Teamwechsel + Volle neu
        if (team === 'A') s.iA = (s.iA + 1) % s.tA.length;
        else              s.iB = (s.iB + 1) % s.tB.length;
        s.remaining = 9;
        s.aktTeam = team === 'A' ? 'B' : 'A';
        return s;
      }
      // Pudel → Elfmeter for the other team
      player.pudel++;
      const otherTeam = team === 'A' ? 'B' : 'A';
      s.phase = 'elfmeter';
      s.elfmeterTeam = otherTeam;
      if (team === 'A') s.iA = (s.iA + 1) % s.tA.length;
      else              s.iB = (s.iB + 1) % s.tB.length;
      s.aktTeam = otherTeam;
      return s;
    }

    // Regular throw (value > 0)
    s.remaining -= value;

    // Advance player within throwing team (cycles regardless of outcome)
    if (team === 'A') s.iA = (s.iA + 1) % s.tA.length;
    else              s.iB = (s.iB + 1) % s.tB.length;

    if (s.remaining <= 0) {
      // Tor! All pins cleared — goal for this team, reset, switch teams
      if (team === 'A') s.toreA++;
      else              s.toreB++;
      s.remaining = 9;
      s.aktTeam = team === 'A' ? 'B' : 'A';
    }
    // else: partial hit — same team continues (aktTeam unchanged)

    return _checkWin(s);
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
      score: p.team === 'A' ? state.toreA : state.toreB,
      pudel: p.pudel,
      winner: p.team === state.winner
    }));
  }
};

function _checkWin(s) {
  const diff = Math.abs(s.toreA - s.toreB);
  if (s.toreA >= s.targetGoals && diff >= 2) { s.done = true; s.winner = 'A'; }
  else if (s.toreB >= s.targetGoals && diff >= 2) { s.done = true; s.winner = 'B'; }
  return s;
}
