'use strict';

// Seeded LCG (linear congruential generator) shuffle
// Produces a deterministic Fisher-Yates shuffle from a string seed
function seededShuffle(arr, seed) {
  const a = arr.slice();
  // Convert seed string to a numeric seed
  let s = 0;
  for (let i = 0; i < String(seed).length; i++) {
    s = (s * 31 + String(seed).charCodeAt(i)) >>> 0;
  }
  if (s === 0) s = 1;

  // LCG parameters (same as Numerical Recipes)
  function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  }

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Random Fisher-Yates shuffle (used when no seed provided)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

module.exports = {
  id: 'kda',
  name: 'Kegler des Abends',

  initState(players, config = {}) {
    const seed = (config && config.seed != null) ? String(config.seed) : null;
    const sl = seed !== null
      ? seededShuffle(players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji })), seed)
      : shuffle(players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji })));

    const matches = [];
    let mid = 1;
    for (let i = 0; i < sl.length - 1; i += 2) {
      matches.push({
        id: mid++,
        p1: sl[i],
        p2: sl[i + 1],
        winner: null,
        loser: null,
        bracket: 'W',
        round: 1,
        done: false
      });
    }
    const bye = sl.length % 2 === 1 ? sl[sl.length - 1] : null;

    return {
      spieler: sl,
      matches,
      mid,
      wRound: 1,
      bye,
      gewinner: null,
      done: false,
      _seed: seed // preserve seed for deterministic subsequent rounds
    };
  },

  // applyThrow(state, matchId, winnerId)
  // matchId acts as "playerId" parameter; winnerId is the "value" parameter
  applyThrow(state, matchId, winnerId) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const m = s.matches.find(x => x.id === matchId);
    if (!m || m.done) return s;

    m.done = true;
    m.winner = m.p1.id === winnerId ? m.p1 : m.p2;
    m.loser = m.p1.id === winnerId ? m.p2 : m.p1;

    // Count losses per player
    const losses = {};
    s.spieler.forEach(p => { losses[p.id] = 0; });
    s.matches.forEach(mx => {
      if (mx.done && mx.loser) losses[mx.loser.id] = (losses[mx.loser.id] || 0) + 1;
    });

    // Find remaining players (< 2 losses)
    const remaining = s.spieler.filter(p => losses[p.id] < 2);

    if (remaining.length === 1) {
      s.done = true;
      s.gewinner = remaining[0];
    } else if (remaining.length > 1) {
      // If no pending matches, create new round matches
      const pending = s.matches.filter(mx => !mx.done);
      if (!pending.length) {
        // Use seeded shuffle if seed was preserved from initState, else random
        // Seed for round N is derived from initial seed + round number for determinism
        const roundSeed = s._seed !== null ? s._seed + '_r' + (s.wRound + 1) : null;
        const toMatch = roundSeed !== null ? seededShuffle(remaining, roundSeed) : shuffle(remaining);
        s.bye = toMatch.length % 2 === 1 ? toMatch[toMatch.length - 1] : null;
        for (let i = 0; i < toMatch.length - 1; i += 2) {
          const p1 = toMatch[i];
          const p2 = toMatch[i + 1];
          s.matches.push({
            id: s.mid++,
            p1,
            p2,
            winner: null,
            loser: null,
            bracket: (losses[p1.id] > 0 || losses[p2.id] > 0) ? 'L' : 'W',
            round: s.wRound + 1,
            done: false
          });
        }
        s.wRound++;
      }
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const losses = {};
    state.spieler.forEach(p => { losses[p.id] = 0; });
    state.matches.forEach(m => {
      if (m.done && m.loser) losses[m.loser.id] = (losses[m.loser.id] || 0) + 1;
    });

    return state.spieler.map(p => ({
      playerId: p.id,
      score: -(losses[p.id] || 0), // fewer losses = higher score
      winner: state.gewinner ? p.id === state.gewinner.id : false
    }));
  }
};
