'use strict';

module.exports = {
  id: 'fuchsjagd',
  name: 'Fuchsjagd',

  initState(players) {
    const fuchsPlayer = players.find(p => p.role === 'fuchs');
    const jaegerPlayers = players.filter(p => p.role === 'jaeger');
    return {
      fuchs: { id: fuchsPlayer.id, name: fuchsPlayer.name, emoji: fuchsPlayer.emoji, w: [], pudel: 0 },
      jaeger: jaegerPlayers.map(j => ({ id: j.id, name: j.name, emoji: j.emoji, w: [], pudel: 0 })),
      fp: 0,
      phase: 'start',
      startW: 0,
      jIdx: 0,
      jPhase: 'jaeger',
      finalRound: false,
      done: false,
      winner: null
    };
  },

  // Turn order: 2 Fuchs start throws, then J1→F→J2→F→J3→F repeating.
  // After Fuchs's 6th jagd throw (8 total), finalRound=true.
  // In finalRound: the NEXT Jäger in the sequence gets exactly ONE final throw, then game ends.
  applyThrow(state, playerId, value, meta) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const n = value;

    if (s.phase === 'start') {
      s.fuchs.w.push(n);
      s.fp += n;
      if (n === 0 && !(meta && meta.keinPudel)) s.fuchs.pudel++;
      s.startW++;
      if (s.startW >= 2) {
        s.phase = 'jagd';
        s.jPhase = 'jaeger';
        s.jIdx = 0;
      }
      return s;
    }

    // jagd phase: J1→F→J2→F→... (each Jäger immediately followed by Fuchs)
    if (s.jPhase === 'jaeger') {
      const j = s.jaeger[s.jIdx];
      j.w.push(n);
      s.fp -= n;
      if (n === 0 && !(meta && meta.keinPudel)) j.pudel++;
      if (s.fp <= 0) {
        s.done = true;
        s.winner = 'jaeger';
        return s;
      }
      if (s.finalRound) {
        // One Jäger throws after Fuchs's last jagd throw — game ends immediately
        s.done = true;
        s.winner = 'fuchs';
      } else {
        // Normal: Fuchs responds immediately after this Jäger
        s.jPhase = 'fuchs';
      }
    } else {
      // jPhase === 'fuchs': responds to jaeger[jIdx], then moves to next Jäger
      s.fuchs.w.push(n);
      s.fp += n;
      if (n === 0 && !(meta && meta.keinPudel)) s.fuchs.pudel++;
      s.jIdx++;
      if (s.jIdx >= s.jaeger.length) {
        s.jIdx = 0;
      }
      const fuchsJagdThrows = s.fuchs.w.length - 2;
      if (fuchsJagdThrows >= 6) {
        s.finalRound = true;
      }
      s.jPhase = 'jaeger';
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const w = state.winner; // 'fuchs' | 'jaeger' | null
    const results = [];

    results.push({
      playerId: state.fuchs.id,
      role: 'fuchs',
      score: state.fp,
      winner: w === 'fuchs'
    });

    for (const j of state.jaeger) {
      results.push({
        playerId: j.id,
        role: 'jaeger',
        score: 0,
        winner: w === 'jaeger'
      });
    }

    return results;
  }
};
