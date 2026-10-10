'use strict';

// ---------------------------------------------------------------------------
// Steigrohr — Mannschaftsspiel, mehrere Paare
// Paare (je 2 Spieler) werfen reihum je 2 Würfe pro Runde (Volle).
// Jedes Paar muss seinen eigenen Vorrundenstand übertreffen — sonst ausgeschieden.
// Pudel = 5 Punkte (kein Nuller), Kranz (meta.kranz) = 12 Punkte.
// Sieger: letztes verbleibendes Paar, oder bei Gleichzeitiger Eliminierung
// das Paar mit dem höchsten Gesamtstand.
// ---------------------------------------------------------------------------

module.exports = {
  id: 'steigrohr',
  name: 'Steigrohr',

  initState(players) {
    // Group players by role ('1', '2', '3', ...)
    const paarMap = {};
    players.forEach(p => {
      const key = String(p.role || '1');
      if (!paarMap[key]) paarMap[key] = [];
      paarMap[key].push({ id: p.id, name: p.name, emoji: p.emoji, pudel: 0 });
    });

    const paare = Object.keys(paarMap).sort().map((key, idx) => ({
      idx,
      paarNr: Number(key),
      spieler: paarMap[key],
      runden: [],   // score per completed round
      gesamt: 0,
      aktiv: true
    }));

    const queue = paare.map(p => p.idx); // turn order this round
    return {
      paare,
      aktPaarIdx: queue[0],
      wuerfe: [],     // current pair's throws this round (values after special rules)
      runde: 1,
      queue,          // remaining pairs to throw in current round
      done: false,
      winner: null    // pair idx
    };
  },

  applyThrow(state, playerId, value, meta = {}) {
    const s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    const paar = s.paare[s.aktPaarIdx];
    if (!paar || !paar.aktiv) return s;
    if (!paar.spieler.some(sp => sp.id === playerId)) return s;

    // Track pudel on the player
    if (value === 0 && !meta.keinPudel) {
      const sp = paar.spieler.find(sp => sp.id === playerId);
      if (sp) sp.pudel++;
    }

    // Apply special scoring: Pudel=5, Kranz=12
    let score = value;
    if (meta.kranz)          score = 12;
    else if (value === 0 && !meta.keinPudel) score = 5;

    s.wuerfe.push(score);

    // After 2nd throw: evaluate this pair's round
    if (s.wuerfe.length >= 2) {
      const roundScore = s.wuerfe.reduce((a, b) => a + b, 0);
      const prev = paar.runden.length > 0 ? paar.runden[paar.runden.length - 1] : -1;

      if (roundScore > prev) {
        paar.runden.push(roundScore);
        paar.gesamt += roundScore;
      } else {
        paar.aktiv = false;
      }

      s.wuerfe = [];

      // Remove this pair from the queue
      s.queue = s.queue.filter(idx => idx !== s.aktPaarIdx);

      // Check win conditions
      const activePaare = s.paare.filter(p => p.aktiv);

      if (activePaare.length <= 1) {
        s.done = true;
        // Winner = highest gesamt overall
        const best = s.paare.reduce((a, b) => b.gesamt > a.gesamt ? b : a, s.paare[0]);
        s.winner = best.idx;
        return s;
      }

      // Start new round when queue is empty
      if (s.queue.length === 0) {
        s.runde++;
        s.queue = activePaare.map(p => p.idx);
      }

      // Next pair: first in queue
      s.aktPaarIdx = s.queue[0];
    }

    return s;
  },

  isFinished(state) {
    return state.done;
  },

  getFinalResults(state) {
    const sorted = state.paare.slice().sort((a, b) => b.gesamt - a.gesamt);
    return state.paare.map(paar => ({
      playerId: paar.spieler[0].id,   // primary player (for stats)
      extraPlayers: paar.spieler.slice(1).map(p => p.id),
      paarNr: paar.paarNr,
      score: paar.gesamt,
      pudel: paar.spieler.reduce((s, p) => s + p.pudel, 0),
      winner: paar.idx === state.winner
    }));
  }
};
