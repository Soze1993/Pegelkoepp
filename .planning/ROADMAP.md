# Roadmap: Pegelköpp Kegelclub App

## Milestones

- ✅ **v1.0 MVP** — Phases 1–5 (shipped 2026-05-22) — [Archive](milestones/v1.0-ROADMAP.md)
- 🔄 **v2.0 Statistiken, Highlights & Turnierbaum** — Phases 6–9 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–5) — SHIPPED 2026-05-22</summary>

- [x] Phase 1: Backend Foundation (4/4 plans) — completed 2026-05-20
- [x] Phase 2: Real-Time & TV (4/4 plans) — completed 2026-05-20
- [x] Phase 3: Frontend Wiring (3/3 plans) — completed 2026-05-21
- [x] Phase 4: Club Features (2/2 plans) — completed 2026-05-22
- [x] Phase 5: Production Deployment (2/2 plans) — completed 2026-05-22

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### v2.0 Statistiken, Highlights & Turnierbaum

- [ ] **Phase 6: Turnierbaum** — Double-Elimination bracket engine for "Kegler des Abends" game type (4–12 players)
- [ ] **Phase 7: Highlights & TV-Layouts** — End-of-game winner/loser overlays on TV and symbols in player table, game-type-specific TV layouts
- [ ] **Phase 8: Statistiken & Rückblick** — Year leaderboard, streaks, head-to-head stats, historical award counts, last-evening recap on homepage
- [ ] **Phase 9: Polish** — WhatsApp share link and self-hosted fonts for offline venue operation

## Phase Details

### Phase 6: Turnierbaum
**Goal**: Users can run a "Kegler des Abends" tournament with a full Double-Elimination bracket (4–12 players) — live on TV
**Depends on**: Phase 5 (production environment)
**Requirements**: TOURNAMENT-01, TOURNAMENT-02, TOURNAMENT-03
**Success Criteria** (what must be TRUE):
  1. User can start a "Kegler des Abends" game and select between 4 and 12 players for a Double-Elimination tournament
  2. App displays the full Winner Bracket and Loser Bracket tree, updating after every completed match
  3. After entering a match result, the bracket advances automatically to the next correct match
  4. TV screen shows the live bracket state in real time via Socket.io without requiring a page reload
**Plans**: 4 plans
Plans:
- [x] 06-01-PLAN.md — Wave 0: Rewrite KDA test suite (RED state — DE engine contract)
- [x] 06-02-PLAN.md — Wave 1: Implement DE bracket engine (initState + applyThrow + getFinalResults)
- [ ] 06-03-PLAN.md — Wave 2: Tablet UI — bracket tree renderer + throw modal + start dialog validation
- [x] 06-04-PLAN.md — Wave 2: TV — renderKDABracket + renderGame KDA branch

### Phase 7: Highlights & TV-Layouts
**Goal**: The app and TV celebrate the winner and loser at game end with symbols and overlays, and the TV shows a layout tuned for each game type
**Depends on**: Phase 6 (tournament game type defines who wins "Kegler des Abends")
**Requirements**: HIGHLIGHT-01, HIGHLIGHT-02, HIGHLIGHT-03, HIGHLIGHT-04, TV-01
**Success Criteria** (what must be TRUE):
  1. After a "Kegler des Abends" game ends, the winning player's row in the player table shows the "Kegler des Abends" symbol
  2. After a "Kegler des Abends" game ends, the TV shows a full-screen end overlay naming the winner
  3. After a "Bilderkegeln" game ends, the player with the fewest points has a loser symbol in their table row
  4. After a "Bilderkegeln" game ends, the TV shows a full-screen end overlay naming the Bilderkegeln loser
  5. For each active game type, the TV displays a layout adapted to that game type's data (score display, bracket, etc.)
**Plans**: 4 plans
Plans:
- [ ] 07-01-PLAN.md — Wave 0: Test stubs (RED state — highlights.test.js + games.test.js typeKey extension)
- [ ] 07-02-PLAN.md — Wave 1: Backend — highlights.js route + app.js registration + typeKey in game:finished + type_key in game:state
- [ ] 07-03-PLAN.md — Wave 2: TV — renderEndOverlay + renderBilderkegelTV + renderFuchsjagdTV + renderViergewinntTV + currentTypeKey
- [ ] 07-04-PLAN.md — Wave 2: Tablet — symbol injection in all renderers + showWinnerBanner XSS fix + fetch-on-load

### Phase 8: Statistiken & Rückblick
**Goal**: Players can explore deep statistics — year leaderboard, streaks, head-to-head, historical award counts — and see a recap of the last club evening on the homepage
**Depends on**: Phase 7 (highlight events populate the historical award data that stats queries read)
**Requirements**: STATS-01, STATS-02, STATS-03, STATS-04, STATS-05, RECAP-01, RECAP-02
**Success Criteria** (what must be TRUE):
  1. User can open a year leaderboard and see each player ranked by wins for any calendar year
  2. User opens a player profile and sees their current win streak and longest-ever win streak
  3. User can select two players and see a head-to-head breakdown (wins/losses directly against each other)
  4. User sees in a player profile how many times that player has been "Kegler des Abends" across all evenings
  5. User sees in a player profile how many times that player lost the Bilderkegeln game across all evenings
  6. The homepage shows the date, "Kegler des Abends" winner, and Bilderkegeln loser for the most recent club evening
  7. User can browse all games played at the last club evening with their results and per-game winner
**Plans**: TBD
**UI hint**: yes

### Phase 9: Polish
**Goal**: Users can share a finished game result via WhatsApp, and the app runs fully without internet (fonts loaded locally)
**Depends on**: Phase 6 (share links reference game results; fonts needed throughout)
**Requirements**: SHARE-01, OFFLINE-01
**Success Criteria** (what must be TRUE):
  1. On a completed game's result screen, a button generates a WhatsApp share link with a readable summary of the result
  2. The app loads Bebas Neue and DM Sans from the local server — no request is made to Google Fonts or any external CDN
  3. All pages render with correct typography at the venue even when the router has no internet connection
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Foundation | v1.0 | 4/4 | Complete | 2026-05-20 |
| 2. Real-Time & TV | v1.0 | 4/4 | Complete | 2026-05-20 |
| 3. Frontend Wiring | v1.0 | 3/3 | Complete | 2026-05-21 |
| 4. Club Features | v1.0 | 2/2 | Complete | 2026-05-22 |
| 5. Production Deployment | v1.0 | 2/2 | Complete | 2026-05-22 |
| 6. Turnierbaum | v2.0 | 3/4 | In Progress|  |
| 7. Highlights & TV-Layouts | v2.0 | 0/4 | Planned | - |
| 8. Statistiken & Rückblick | v2.0 | 0/? | Not started | - |
| 9. Polish | v2.0 | 0/? | Not started | - |
