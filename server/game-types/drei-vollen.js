'use strict';

module.exports = {
  id: 'dreiVollen',
  name: 'Drei in die Vollen',
  canSkipStechen: true,

  initState(players) {
    return {
      players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, wuerfe: [], pudel: 0, stechenWuerfe: [] })),
      aktSpIdx: 0,
      done: false,
      stechen: false,
      stechenPlayers: [],
      stechenSkipped: false
    };
  },

  applyThrow(state, playerId, value) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    if (s.stechen) {
      // Stechen phase: each stechenPlayer gets one throw
      const sp = s.players.find(x => x.id === playerId && s.stechenPlayers.includes(x.id));
      if (!sp) return s;
      if (sp.stechenWuerfe.length >= 1) return s; // already threw in this round
      if (value === 0) sp.pudel++;
      sp.stechenWuerfe.push(value);
      // Check if all stechen players have thrown
      const allThrown = s.stechenPlayers.every(id => {
        const p = s.players.find(x => x.id === id);
        return p && p.stechenWuerfe.length >= 1;
      });
      if (allThrown) {
        const stechenScores = s.stechenPlayers.map(id => {
          const p = s.players.find(x => x.id === id);
          return { id, score: p.stechenWuerfe[p.stechenWuerfe.length - 1] };
        });
        const best = Math.max(...stechenScores.map(x => x.score));
        const winners = stechenScores.filter(x => x.score === best);
        if (winners.length === 1) {
          // One winner — done
          s.done = true;
          s.stechen = false;
          s.stechenPlayers = [winners[0].id];
        } else {
          // Still tied — new stechen round
          s.stechenPlayers = winners.map(x => x.id);
          s.players.forEach(p => { if (s.stechenPlayers.includes(p.id)) p.stechenWuerfe = []; });
        }
      }
      return s;
    }

    const p = s.players.find(x => x.id === playerId);
    if (!p) return s;
    if (value === 0) p.pudel++;
    p.wuerfe.push(value);
    if (p.wuerfe.length >= 3) {
      s.aktSpIdx++;
      if (s.aktSpIdx >= s.players.length) {
        // Check for tie
        const scores = s.players.map(p => p.wuerfe.reduce((a, b) => a + b, 0));
        const best = Math.max(...scores);
        const tiedIds = s.players.filter(p => p.wuerfe.reduce((a, b) => a + b, 0) === best).map(p => p.id);
        if (tiedIds.length > 1) {
          s.stechen = true;
          s.stechenPlayers = tiedIds;
          s.players.forEach(p => { p.stechenWuerfe = []; });
        } else {
          s.done = true;
        }
      }
    }
    return s;
  },

  skipStechen(state) {
    const s = JSON.parse(JSON.stringify(state));
    if (!s.stechen) return s;
    s.stechen = false;
    s.stechenSkipped = true;
    s.done = true;
    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    if (state.stechenSkipped) {
      // No winner declared
      const scores = state.players.map(p => ({
        playerId: p.id,
        score: p.wuerfe.reduce((a, b) => a + b, 0),
        pudel: p.pudel,
        winner: false
      }));
      return scores;
    }
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: p.wuerfe.reduce((a, b) => a + b, 0),
      pudel: p.pudel
    }));
    const best = Math.max(...scores.map(x => x.score));
    // If stechen was played, stechenPlayers has the actual winner(s)
    if (state.stechenPlayers && state.stechenPlayers.length === 1) {
      return scores.map(x => ({ ...x, winner: x.playerId === state.stechenPlayers[0] }));
    }
    return scores.map(x => ({ ...x, winner: x.score === best }));
  }
};
