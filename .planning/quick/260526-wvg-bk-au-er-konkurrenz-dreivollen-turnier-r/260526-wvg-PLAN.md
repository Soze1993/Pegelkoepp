---
phase: quick-260526-wvg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/game-types/bilderkegel.js
  - server/game-types/drei-vollen.js
  - server/game-types/bilderkegel.test.js
  - server/game-types/drei-vollen.test.js
  - server/routes/games.js
  - server/routes/highlights.js
  - server/routes/stats.js
  - public/tv.js
  - public/index.html
autonomous: true
requirements: [QUICK-WVG-01, QUICK-WVG-02]

must_haves:
  truths:
    - "BK exempt player (last loser) cannot be the payer again even with lowest total"
    - "BK loser (non-exempt lowest scorer) is correctly identified in highlights endpoint"
    - "DreiVollen with >=6 players computes top6Sum as sum of top 6 scores"
    - "DreiVollen with <6 players produces no top6Sum field"
    - "Stats endpoint returns tournament_records.dreiVollen with best_sum and game_id"
    - "TV and tablet display 'Turnierergebnis: X Volle' when top6Sum is present and players >= 6"
  artifacts:
    - path: "server/game-types/bilderkegel.js"
      provides: "exemptPlayerId in initState, eligible-player filtering in applyThrow and getFinalResults"
    - path: "server/game-types/drei-vollen.js"
      provides: "top6Sum in getFinalResults when players.length >= 6"
    - path: "server/routes/games.js"
      provides: "POST /api/games queries last BK loser and passes as config.exemptPlayerId for bilderkegel"
    - path: "server/routes/highlights.js"
      provides: "getBKLoserId filters exemptPlayerId before finding minimum"
    - path: "server/routes/stats.js"
      provides: "tournament_records.dreiVollen in stats response"
    - path: "public/tv.js"
      provides: "Turnierergebnis line in generic dreiVollen done-state render"
    - path: "public/index.html"
      provides: "Turnierergebnis line in renderNSpiel dreiVollen done-state render"
  key_links:
    - from: "server/routes/games.js POST /"
      to: "bilderkegel.initState"
      via: "config.exemptPlayerId passed from last-BK-loser query"
    - from: "server/game-types/bilderkegel.js applyThrow / getFinalResults"
      to: "state.exemptPlayerId"
      via: "eligible = players.filter(p => p.id !== s.exemptPlayerId)"
    - from: "server/routes/stats.js"
      to: "dreiVollen.getFinalResults"
      via: "second pass over finished dreiVollen games checks results[0].top6Sum"
---

<objective>
Implement two independent game rule additions:

1. BK Außer Konkurrenz — the loser of the most recent finished BK game plays exempt in the next game; they cannot be payer again even if they score lowest.
2. Drei in die Vollen Turnier-Rekord — when >=6 players, sum of top 6 scores is the "Turnierergebnis"; tracked as all-time record in stats.

Purpose: Club house rules that require system enforcement.
Output: Modified game-type modules, route changes, updated tests, frontend display.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Claude/.planning/PROJECT.md
@Claude/.planning/ROADMAP.md
@Claude/.planning/STATE.md
</context>

<interfaces>
<!-- Key interfaces the executor needs. No codebase exploration required. -->

From server/game-types/bilderkegel.js:
- initState(players) — currently no config param; returns state with players, aktSpIdx, aktBildIdx, aktWurfNr, done, stechen, stechenPlayers
- applyThrow(state, playerId, value, meta) — at end of 5 Bilder (aktBildIdx >= BK_BILDER.length), computes tots/minTot/tiedIds from s.players
- getFinalResults(state) — stechenPayer from state.stechenPlayers[0]; payer: stechenPayer ? p.id === stechenPayer : tot === minP
- bkTotal(p) helper at top: p.bildPts.reduce((a,b) => a + (b !== null ? b : 0), 0)

From server/game-types/drei-vollen.js:
- getFinalResults(state) — returns array of {playerId, score, pudel, winner}; score = p.wuerfe.reduce sum

From server/routes/games.js POST /:
- Already accepts config from req.body (line ~33: const { type_key, player_ids, config, roles } = req.body)
- Already calls gameModule.initState(playersWithRole, configWithSeed) (line ~85)
- reconstructState is exported from this file: module.exports = { router, activeGames, reconstructState }
- For KDA the config gets seed injected; bilderkegel would similarly get exemptPlayerId

From server/routes/highlights.js:
- getBKLoserId(state) at line ~15: maps players to {id, total}, finds min, returns id
- Uses state.players with bildPts — same bkTotal logic as game-type module

From server/routes/stats.js:
- res.json(response) at line ~141; response is the player stats array
- Can append tournament_records to a wrapper or extend the response object
- Already imports: gameTypes, reconstructState
- Finished games loop already iterates all games calling getFinalResults

From public/index.html renderNSpiel (line 1040, minified):
- dreiVollen done-state branch: `if(sp.done){var sortedD=...; var w=sortedD[0]; el.innerHTML='<div>'+w.emoji+'</div><div>'+w.name+' gewinnt!</div>'+stbl+'<button ...>Zurueck</button>';return;}`
- stbl for dreiVollen is built just before; its closing is `'</tbody></table></div>'`
- The Turnierergebnis line should appear between the winner header div and stbl, or appended after stbl, before the Zurueck button
- All DOM is built as innerHTML strings in this function

From public/tv.js renderGame (line 102):
- dreiVollen uses the generic renderer (no dedicated branch before line 113)
- Generic renderer iterates state.players — does NOT have a done-state banner
- For the done state in TV, add a Turnierergebnis banner element appended to gameEl after playerListEl when: state.done && currentTypeKey === 'dreiVollen' && state.players.length >= 6
- top6Sum must be computed client-side from state.players (same formula as server): sort players by wuerfe sum descending, take first 6, sum their totals
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: BK exempt player — game-type module + tests</name>
  <files>server/game-types/bilderkegel.js, server/game-types/bilderkegel.test.js</files>
  <behavior>
    - EX-1: initState with config={exemptPlayerId:2} stores state.exemptPlayerId===2
    - EX-2: initState with no config stores state.exemptPlayerId===null
    - EX-3: Exempt player (id=3) has lowest total; eligible = players excluding id=3; payer = eligible player with second-lowest total (not id=3)
    - EX-4: Exempt player does NOT have lowest total; normal lowest-scoring player is payer (exempt has no effect)
    - EX-5: Stechen triggered among eligible players only (exempt player excluded from tiedIds computation in applyThrow)
  </behavior>
  <action>
    Modify server/game-types/bilderkegel.js:

    initState: Change signature to initState(players, config). Add exemptPlayerId field to returned state: `exemptPlayerId: (config && config.exemptPlayerId) || null`.

    applyThrow: In the "All 5 Bilder done" block (after aktBildIdx >= BK_BILDER.length), replace the current `s.players` with an eligible array before computing tots/minTot/tiedIds:
    - `const eligible = s.players.filter(p => p.id !== s.exemptPlayerId);`
    - Use `eligible` for Math.min and .filter to find tiedIds
    - stechenPlayers will only contain eligible player ids

    getFinalResults: Determine eligible players = state.players.filter(p => p.id !== state.exemptPlayerId). When stechenPayer is null (no stechen), find payer by: eligible player with minimum bkTotal. A player is payer if: stechenPayer ? p.id === stechenPayer : (eligible.some(e => e.id === p.id) && tot === minEligibleTot). The exempt player always has payer:false. When stechenPayer is set, stechenPayer is already an eligible player (stechen only happened among eligible), so no change needed for that branch.

    Add tests in bilderkegel.test.js under a "// Exempt player (Außer Konkurrenz)" section:
    - Use 3 players for EX-3 scenario so exempt=p3 has lowest, second-lowest=p2 is payer
    - Use helper that drives a full game (2 throws per player per pic, 5 pics) with specified scores
    - For EX-5 stechen test: 3 players, exempt=p3, p1 and p2 tie for lowest among eligible, stechen starts with only p1+p2
  </action>
  <verify>
    <automated>cd C:/Users/tobia/Claude && node --test server/game-types/bilderkegel.test.js 2>&1 | tail -20</automated>
  </verify>
  <done>All existing BK tests still pass; EX-1 through EX-5 new tests pass; exempt player is never assigned payer:true</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DreiVollen top6Sum — game-type module + tests</name>
  <files>server/game-types/drei-vollen.js, server/game-types/drei-vollen.test.js</files>
  <behavior>
    - T6-1: getFinalResults with 6 players each throwing 3 distinct values — results[0].top6Sum equals sum of all 6 players' scores (since there are exactly 6), and all entries have the same top6Sum value
    - T6-2: getFinalResults with 7 players — top6Sum equals sum of the top 6 scores only (not all 7)
    - T6-3: getFinalResults with 5 players — results[0].top6Sum is undefined (field absent)
    - T6-4: getFinalResults with 6 players, stechenSkipped=true — top6Sum still present (computed from wuerfe, not winner status)
  </behavior>
  <action>
    Modify server/game-types/drei-vollen.js getFinalResults:

    After computing `scores` array (the existing map of {playerId, score, pudel}), add:
    ```
    if (state.players.length >= 6) {
      const sorted = scores.slice().sort((a, b) => b.score - a.score);
      const top6Sum = sorted.slice(0, 6).reduce((s, r) => s + r.score, 0);
      scores.forEach(r => { r.top6Sum = top6Sum; });  // same value on all entries
    }
    ```
    Apply this block in BOTH code paths: the stechenSkipped path and the normal path. The scores array is built before the winner/stechenPlayers logic in the normal path, so insert after the scores map but before the winner assignment. For stechenSkipped path, insert after `const scores = ...` and before `return scores`.

    Add tests in drei-vollen.test.js under "// DreiVollen Turnier-Rekord top6Sum":

    For T6-1: build state manually with 6 players each having wuerfe=[a,b,c] giving distinct totals; call getFinalResults directly on a done state; assert results[0].top6Sum is defined and equals sum of all 6.

    Shortcut: use dreiVollen.initState(players6) to get a state template, then drive throws (6 players × 3 throws each = 18 applyThrow calls), then check getFinalResults.

    For T6-3 (5 players): drive 5×3=15 throws, check top6Sum is undefined on all results.
  </action>
  <verify>
    <automated>cd C:/Users/tobia/Claude && node --test server/game-types/drei-vollen.test.js 2>&1 | tail -20</automated>
  </verify>
  <done>All existing DV tests pass; T6-1 through T6-4 pass; top6Sum absent for <6 players, present and correct for >=6</done>
</task>

<task type="auto">
  <name>Task 3: BK exempt routing — games.js + highlights.js</name>
  <files>server/routes/games.js, server/routes/highlights.js</files>
  <action>
    In server/routes/games.js POST /, inside the `if (type_key === 'bilderkegel')` detection (add after the existing KDA seed injection block, before initState is called):

    When type_key === 'bilderkegel':
    1. Query the last finished BK game: `const lastBK = db.prepare("SELECT * FROM games WHERE type_key = 'bilderkegel' AND status = 'finished' ORDER BY finished_at DESC LIMIT 1").get();`
    2. If lastBK exists, reconstruct its state with `reconstructState(lastBK)` (already imported in scope).
    3. Call `const bkModule = gameTypes['bilderkegel']; const lastResults = bkModule.getFinalResults(lastState);`
    4. Find the payer from results: `const payerResult = lastResults.find(r => r.payer);`
    5. If payerResult, set `config = Object.assign({}, config, { exemptPlayerId: payerResult.playerId });`
    6. Wrap steps 2-5 in a try/catch — on any error, log and continue without exemptPlayerId (graceful degradation).

    The reconstructState function is already defined in games.js and exported. Use it directly (it is in scope as a named function in the same file).

    In server/routes/highlights.js getBKLoserId(state):

    After getting tots array (the existing `const tots = state.players.map(...)`), filter eligible:
    ```
    const eligible = tots.filter(x => x.id !== (state.exemptPlayerId || null));
    const effTots = eligible.length > 0 ? eligible : tots;  // fallback: all players if somehow all exempt
    const minTot = Math.min(...effTots.map(t => t.total));
    const loser = effTots.find(t => t.total === minTot);
    return loser ? loser.id : null;
    ```
    Replace the existing minTot/loser lines with this eligible-filtered version.
  </action>
  <verify>
    <automated>cd C:/Users/tobia/Claude && node --test server/routes/games.test.js 2>&1 | tail -20</automated>
  </verify>
  <done>games.test.js passes; POST /api/games for bilderkegel passes exemptPlayerId from last BK loser; highlights getBKLoserId skips exempt player</done>
</task>

<task type="auto">
  <name>Task 4: Stats tournament record + frontend Turnierergebnis display</name>
  <files>server/routes/stats.js, public/tv.js, public/index.html</files>
  <action>
    In server/routes/stats.js, after `res.json(response)` (currently line 141), insert a second pass BEFORE the res.json call:

    Add before `res.json(response)`:
    ```javascript
    // Tournament record: Drei in die Vollen top6Sum
    let dvBestSum = null;
    let dvBestGameId = null;
    const dvGames = finishedGames.filter(g => g.type_key === 'dreiVollen');
    for (const g of dvGames) {
      try {
        const dvState = reconstructState(g);
        const dvResults = gameTypes['dreiVollen'].getFinalResults(dvState);
        if (dvResults.length > 0 && dvResults[0].top6Sum != null) {
          if (dvBestSum === null || dvResults[0].top6Sum > dvBestSum) {
            dvBestSum = dvResults[0].top6Sum;
            dvBestGameId = g.id;
          }
        }
      } catch(e) { continue; }
    }
    const tournament_records = {
      dreiVollen: dvBestSum !== null ? { best_sum: dvBestSum, game_id: dvBestGameId } : null
    };
    ```

    Change `res.json(response)` to `res.json({ players: response, tournament_records })`.

    Note: this changes the stats response shape from an array to `{ players: [...], tournament_records: {...} }`. Check server/routes/stats.test.js and public/index.html for how stats are consumed and update the consumption point in public/index.html (renderStats function) to use `data.players` instead of `data` directly. Also update stats.test.js expectations if they check the top-level shape.

    In public/tv.js renderGame function, after the playerListEl.appendChild loop (after line ~160), add:
    ```javascript
    // Drei in die Vollen Turnierergebnis (top 6 players)
    if (currentTypeKey === 'dreiVollen' && state.done && state.players.length >= 6) {
      var sorted6 = state.players.slice().sort(function(a, b) {
        var sa = a.wuerfe ? a.wuerfe.reduce(function(x,y){return x+y;},0) : 0;
        var sb = b.wuerfe ? b.wuerfe.reduce(function(x,y){return x+y;},0) : 0;
        return sb - sa;
      });
      var top6Sum = sorted6.slice(0, 6).reduce(function(acc, p) {
        return acc + (p.wuerfe ? p.wuerfe.reduce(function(x,y){return x+y;},0) : 0);
      }, 0);
      var turEl = document.createElement('div');
      turEl.style.cssText = 'text-align:center;font-family:var(--fh,"Bebas Neue",sans-serif);font-size:2.2vw;color:var(--ac);margin-top:12px';
      turEl.textContent = 'Turnierergebnis: ' + top6Sum + ' Volle';  // textContent — safe
      gameEl.appendChild(turEl);
    }
    ```
    Insert this block after the closing `}` of the `for (const player of state.players)` loop (before line 162's closing brace of renderGame).

    In public/index.html renderNSpiel (minified line 1040), in the dreiVollen done-state branch, locate where `el.innerHTML` is set when `sp.done` is true. The current structure is:
    `el.innerHTML = '<div>'+w.emoji+'</div><div>'+w.name+' gewinnt!</div>' + stbl + '<button ...>Zurueck</button>'`

    Add a Turnierergebnis line between the winner div and stbl. The insertion is:
    - After the `stbl` variable is built and before the `if(sp.done)` block renders, compute:
      `var turHtml='';if(stid==='dreiVollen'&&sp.players.length>=6){var s6=sp.players.slice().sort(function(a,b){return totPts(b,stid)-totPts(a,stid);});var t6=s6.slice(0,6).reduce(function(acc,p){return acc+totPts(p,stid);},0);turHtml='<div style="text-align:center;font-size:13px;color:var(--mut);margin:4px 0">Turnierergebnis: <strong>'+t6+' Volle</strong></div>';}`
    - In the `el.innerHTML` assignment, insert `turHtml` between the winner header div and `stbl`.

    Since renderNSpiel is one long minified line, use the Edit tool to make a surgical replacement. Find the exact substring in the dreiVollen done-state render and insert the turHtml variable declaration and usage. Be careful not to break the surrounding minified code.
  </action>
  <verify>
    <automated>cd C:/Users/tobia/Claude && npm test 2>&1 | tail -30</automated>
  </verify>
  <done>npm test passes (408+ tests); GET /api/stats returns { players: [...], tournament_records: { dreiVollen: {...} | null } }; TV shows "Turnierergebnis: X Volle" when dreiVollen done with >=6 players; tablet renderNSpiel shows same</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→POST /api/games | config.exemptPlayerId could be spoofed by client; server MUST derive it from DB, not trust client input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-WVG-01 | Tampering | POST /api/games config.exemptPlayerId | mitigate | Server derives exemptPlayerId from DB query of last finished BK game; any client-supplied config.exemptPlayerId is overwritten for bilderkegel type |
| T-WVG-02 | Denial of Service | stats dreiVollen second pass | accept | Club-scale data (<100 games); try/catch per game prevents crash on corrupt state |
| T-WVG-03 | Information Disclosure | tournament_records in stats response | accept | Stats are already public (no auth on GET /api/stats); no new disclosure surface |
</threat_model>

<verification>
Run full test suite: `cd C:/Users/tobia/Claude && npm test`

Expected: all existing 408+ tests pass plus new exempt-player and top6Sum tests.

Spot-check stat response shape:
`curl -s http://localhost:3000/api/stats | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log(Object.keys(j))"`
Expect keys: `players`, `tournament_records`
</verification>

<success_criteria>
- bilderkegel.initState(players, { exemptPlayerId: N }) stores exemptPlayerId N in state
- When N plays a BK game and scores lowest, getFinalResults assigns payer to the eligible player with second-lowest score (not N)
- POST /api/games with type_key=bilderkegel queries last finished BK game, extracts the payer, passes as config.exemptPlayerId
- highlights getBKLoserId excludes exemptPlayerId from minimum computation
- dreiVollen getFinalResults with >=6 players returns top6Sum on all result entries
- GET /api/stats returns { players: [...], tournament_records: { dreiVollen: { best_sum, game_id } | null } }
- TV shows "Turnierergebnis: X Volle" on dreiVollen done-state with >=6 players
- Tablet renderNSpiel shows same line for dreiVollen >=6 players done-state
- npm test passes
</success_criteria>

<output>
Create `.planning/quick/260526-wvg-bk-au-er-konkurrenz-dreivollen-turnier-r/260526-wvg-SUMMARY.md` when done
</output>
