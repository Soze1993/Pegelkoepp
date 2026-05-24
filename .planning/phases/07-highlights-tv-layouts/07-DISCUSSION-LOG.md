# Phase 7: Highlights & TV-Layouts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 7-Highlights & TV-Layouts
**Areas discussed:** TV Overlay, Player Table Symbols, TV Layout Variants

---

## TV Overlay

### Q1: KDA winner overlay content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + title only | "🏆 Tobias — Kegler des Abends!" — clean, big, focused | ✓ |
| Name + score/result summary | Name + final bracket result (who beat whom in Grand Final) | |
| Full bracket frozen + winner highlight | Completed bracket tree with winner highlighted | |

**User's choice:** Name + title only  
**Notes:** Clean and focused — matches existing tablet banner style.

---

### Q2: Bilderkegeln loser overlay content

| Option | Description | Selected |
|--------|-------------|----------|
| Name + loser title, different style | Same format as KDA but different color/icon for loser vibe | ✓ |
| Name + loser title, same style as winner | Consistent format, just different label text | |

**User's choice:** Name + loser title, different style  
**Notes:** Distinct visual treatment to distinguish winner vs loser celebration.

---

### Q3: Overlay duration

| Option | Description | Selected |
|--------|-------------|----------|
| 5 seconds | Long enough to be seen, then auto-dismiss | |
| 10 seconds | More time for celebration, photo, reactions | ✓ |
| Until next game starts | No auto-dismiss — manual by starting next game | |

**User's choice:** 10 seconds  

---

### Q4: Overlay placement

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen takeover (replace game) | Fills entire screen, dark background, max impact | ✓ |
| Overlay on top of final game state | Bracket/player list stays in background, centered card on top | |

**User's choice:** Full-screen takeover  

---

## Player Table Symbols

### Q1: Where symbols appear

| Option | Description | Selected |
|--------|-------------|----------|
| Tablet only (game view) | Symbols in Spielen tab player table rows on tablet/phone | ✓ |
| Both tablet and TV | Symbols on tablet AND in TV player list rows | |
| TV only | Symbols on TV player list rows only | |

**User's choice:** Tablet only  
**Notes:** TV overlay already handles the celebration; no need for TV row symbols.

---

### Q2: KDA winner symbol

| Option | Description | Selected |
|--------|-------------|----------|
| 🏆 (trophy) | Classic winner symbol, matches existing tablet winner banner | ✓ |
| 👑 (crown) | Royal, fits "Kegler des Abends" as evening champion | |
| 🎳 (bowling) | Domain-specific, unique to bowling context | |
| You decide | Claude picks | |

**User's choice:** 🏆 (trophy)  

---

### Q3: Bilderkegeln loser symbol

| Option | Description | Selected |
|--------|-------------|----------|
| 🙈 (see-no-evil monkey) | Playful, embarrassed | |
| 💩 (poop) | Unmistakably the loser, funny for club night | ✓ |
| 😬 (grimacing face) | Classic loser face, lighthearted | |
| You decide | Claude picks | |

**User's choice:** 💩 (poop)  

---

### Q4: Symbol persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Until next game starts | Symbol for session duration, cleared on new game | |
| Only during winner banner | Same duration as banner display | |

**User's choice (freeform):** "These Symbols Shall be visible until a new winner (KDA) or a new loser (Bilderkegeln) is set"  
**Notes:** Persistent — symbol stays until replaced by the next KDA/Bilderkegeln result.

---

### Q5: Scope of persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Per evening only | Reset when new Kegelabend is started | |
| Persistent across evenings | Last-ever winner/loser marked until next result, survives server restart | ✓ |

**User's choice:** Persistent across evenings  

---

## TV Layout Variants

### Q1: Which game types need distinct TV layouts

| Option | Description | Selected |
|--------|-------------|----------|
| Bilderkegeln | Lowest score = loser; highlight last-place player | ✓ |
| Fuchsjagd | Two roles: Fuchs vs Jäger — role-split layout | ✓ |
| Viergewinnt | Team X vs Team O — team format | ✓ |
| Score-based games only need minor tweaks | Generic list fine for all except KDA | |

**User's choice:** Bilderkegeln, Fuchsjagd, Viergewinnt  

---

### Q2: Bilderkegeln TV layout

| Option | Description | Selected |
|--------|-------------|----------|
| Same list, loser row highlighted in red | Keep player list; lowest score row in red | ✓ |
| Reverse sorted list + loser marker | Sort ascending (fewest first), loser at top highlighted | |
| You decide | Claude picks | |

**User's choice:** Same list, loser row highlighted in red  

---

### Q3: Fuchsjagd TV layout

| Option | Description | Selected |
|--------|-------------|----------|
| Role labels (Fuchs / Jäger) next to player names | Keep player list, add role badge | |
| Split layout: Fuchs side vs Jäger side | Two panels, visual role separation | ✓ |
| You decide | Claude picks | |

**User's choice:** Split layout: Fuchs side vs Jäger side  

---

### Q4: Viergewinnt TV layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two team panels side by side (Team X vs Team O) | Split screen, Team X left / Team O right | |
| Player list with team color coding (X = green, O = red) | Keep list, color by team | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide (Claude's discretion)  
**Notes:** Recommendation captured in CONTEXT.md: two team panels side by side.

---

## Claude's Discretion

- Viergewinnt TV layout exact design (two team panels recommended)
- Exact CSS for TV overlay (animation, font sizes, padding)
- Color accent for Bilderkegeln loser overlay (red `--red` vs amber `--ac`)
- How persistent champion/loser is stored (recommend: last finished game query from DB on startup)
- Symbol placement in player row (before name, after name, badge suffix)
- Whether to refactor `showWinnerBanner` innerHTML to use textContent (XSS fix recommended)

## Deferred Ideas

None — discussion stayed within phase scope.
