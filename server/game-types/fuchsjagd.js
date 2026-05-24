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

  // Ported verbatim from HTML line 345 doFJWurf
  applyThrow(state, playerId, value) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const n = value;

    if (s.phase === 'start') {
      s.fuchs.w.push(n);
      s.fp += n;
      if (n === 0) s.fuchs.pudel++;
      s.startW++;
      if (s.startW >= 2) {
        s.phase = 'jagd';
        s.jPhase = 'jaeger';
        s.jIdx = 0;
      }
    } else {
      if (s.jPhase === 'jaeger') {
        const j = s.jaeger[s.jIdx];
        j.w.push(n);
        s.fp -= n;
        if (n === 0) j.pudel++;
        if (s.fp <= 0) {
          s.done = true;
          s.winner = 'jaeger';
          return s;
        }
        s.jIdx++;
        if (s.jIdx >= s.jaeger.length) {
          if (s.finalRound) {
            // All Jäger had their final throw — Fuchs wins
            s.done = true;
            s.winner = 'fuchs';
            return s;
          }
          s.jPhase = 'fuchs';
          s.jIdx = 0;
        }
      } else {
        // jPhase === 'fuchs'
        s.fuchs.w.push(n);
        s.fp += n;
        if (n === 0) s.fuchs.pudel++;
        s.jPhase = 'jaeger';
        s.jIdx = 0;
        // After Fuchs's 6th jagd throw, next Jäger round is the final one
        if (s.fuchs.w.length - 2 >= 6) {
          s.finalRound = true;
        }
      }
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const w = state.winner; // 'fuchs' | 'jaeger' | null
    const results = [];

    // Fox result
    results.push({
      playerId: state.fuchs.id,
      role: 'fuchs',
      score: state.fp,
      winner: w === 'fuchs'
    });

    // Hunter results
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
