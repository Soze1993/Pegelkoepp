'use strict';

// ---------------------------------------------------------------------------
// Seifenkistenrennen — Mannschaftsspiel (2 Teams)
// Strecke: 8–15 Felder, bei jedem Spiel zufällig generiert.
// Jedes Feld hat 1 Holzzahl (normale Felder) oder 2 Holzzahlen (Abkürzungsfelder).
// Nur der exakte Treffer rückt vor. Abkürzungsfelder: Treffer → zusätzlicher Sprung.
// 2 Abkürzungen pro Strecke, zufällig platziert.
// ---------------------------------------------------------------------------

const VALS = [1,2,3,4,5,6,7,8];

function rnd(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function generateTrack(numFields) {
  // Place 2 shortcuts at ~25% and ~55% of track, each jumping 2-4 extra fields
  var pos1 = Math.floor(numFields * 0.2 + Math.random() * Math.floor(numFields * 0.1));
  var pos2 = Math.floor(numFields * 0.48 + Math.random() * Math.floor(numFields * 0.12));
  if (pos2 <= pos1 + 2) pos2 = pos1 + 3;

  var jump1 = 2 + Math.floor(Math.random() * 3);
  var jump2 = 2 + Math.floor(Math.random() * 3);
  var sc1to = Math.min(pos1 + 1 + jump1, numFields - 1);
  var sc2to = Math.min(pos2 + 1 + jump2, numFields - 1);

  var track = [];
  for (var i = 0; i < numFields; i++) {
    if (i === pos1) {
      var v1 = rnd(VALS), v2;
      do { v2 = rnd(VALS); } while (v2 === v1);
      track.push({ values: [v1, v2], shortcutTo: sc1to });
    } else if (i === pos2) {
      var w1 = rnd(VALS), w2;
      do { w2 = rnd(VALS); } while (w2 === w1);
      track.push({ values: [w1, w2], shortcutTo: sc2to });
    } else {
      track.push({ values: [rnd(VALS)] });
    }
  }
  return track;
}

module.exports = {
  id: 'seifenkistenrennen',
  name: 'Seifenkistenrennen',

  initState(players, config) {
    var numFields = 12;
    if (config && config.numFields) {
      numFields = Math.max(8, Math.min(15, parseInt(config.numFields) || 12));
    }
    return {
      track: generateTrack(numFields),
      tA: players.filter(function(p){ return p.role === 'A'; }).map(function(p){ return {id:p.id,name:p.name,emoji:p.emoji,pudel:0}; }),
      tB: players.filter(function(p){ return p.role === 'B'; }).map(function(p){ return {id:p.id,name:p.name,emoji:p.emoji,pudel:0}; }),
      posA: 0,
      posB: 0,
      aktTeam: 'A',
      iA: 0,
      iB: 0,
      done: false,
      winner: null
    };
  },

  applyThrow(state, playerId, value, meta) {
    var s = JSON.parse(JSON.stringify(state));
    if (s.done) return s;

    var team    = s.aktTeam;
    var teamArr = team === 'A' ? s.tA : s.tB;
    var idx     = team === 'A' ? s.iA  : s.iB;
    var player  = teamArr[idx];
    if (!player || player.id !== playerId) return s;

    if (value === 0 && !(meta && meta.keinPudel)) player.pudel++;

    var pos   = team === 'A' ? s.posA : s.posB;
    var field = s.track[pos];

    if (field && field.values.indexOf(value) >= 0) {
      var newPos = pos + 1;
      // Abkürzung nur bei der zweiten Zahl (values[1])
      if (field.shortcutTo !== undefined && field.values.length > 1 && value === field.values[1]) {
        newPos = field.shortcutTo;
      }
      if (team === 'A') s.posA = newPos;
      else              s.posB = newPos;

      if (newPos >= s.track.length) {
        s.done   = true;
        s.winner = team;
      }
    }

    if (!s.done) {
      if (team === 'A') { s.iA = (s.iA + 1) % s.tA.length; s.aktTeam = 'B'; }
      else              { s.iB = (s.iB + 1) % s.tB.length; s.aktTeam = 'A'; }
    }

    return s;
  },

  isFinished(state) { return state.done; },

  getFinalResults(state) {
    var all = state.tA.map(function(p){ return {id:p.id,pudel:p.pudel,team:'A'}; })
      .concat(state.tB.map(function(p){ return {id:p.id,pudel:p.pudel,team:'B'}; }));
    return all.map(function(p){ return {
      playerId: p.id,
      score:    p.team === 'A' ? state.posA : state.posB,
      pudel:    p.pudel,
      winner:   p.team === state.winner
    }; });
  }
};
