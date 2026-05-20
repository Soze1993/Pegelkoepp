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
        const jG = s.jaeger.reduce((sum, jj) => sum + jj.w.length, 0);
        if (s.fp <= 0) {
          s.done = true;
          s.winner = 'jaeger';
          return s;
        }
        if (s.jIdx >= s.jaeger.length - 1 && jG >= 6) {
          s.done = true;
          s.winner = 'fuchs';
          return s;
        }
        s.jPhase = 'fuchs';
      } else {
        // jPhase === 'fuchs'
        s.fuchs.w.push(n);
        s.fp += n;
        if (n === 0) s.fuchs.pudel++;
        s.jIdx++;
        if (s.jIdx >= s.jaeger.length) {
          const tot = s.jaeger.reduce((sum, jj) => sum + jj.w.length, 0);
          if (tot >= 6) {
            s.done = true;
            s.winner = 'fuchs';
            return s;
          }
          s.jIdx = 0;
        }
        s.jPhase = 'jaeger';
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
