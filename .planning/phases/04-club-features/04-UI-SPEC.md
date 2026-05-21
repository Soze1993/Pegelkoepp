---
phase: 4
slug: club-features
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-21
reviewed_at: 2026-05-21
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for Phase 4: Club Features.
> Authored inline during gsd-autonomous --interactive discuss step.
> Consumed by gsd-planner, gsd-executor, gsd-ui-auditor.
>
> **Scope:** Three additive UI changes to `public/index.html` — Kegelabend session controls
> in the Spiele tab, real statistics in the Stats tab, and custom game type docs in the
> Bibliothek tab. All existing HTML structure, CSS classes, and design tokens are locked
> and must not change. This spec defines contracts only for the NEW UI elements.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — vanilla JS + hand-rolled CSS |
| Icon library | none — Unicode emoji only |
| Font | Bebas Neue (`--fh`) + DM Sans (`--fb`) — Google Fonts |

No new CSS classes introduced where existing classes cover the need.
All new CSS additions go inside the existing `<style>` block in `public/index.html`.

---

## Design Token Reference

All tokens already defined in `public/index.html` `:root`. No new tokens needed.

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| `--ac` | `#e8b84b` | Abend active banner border, custom type accent, gold chip values |
| `--bg2` | `#17171f` | Abend banner background |
| `--bg3` | `#1e1e28` | Chip backgrounds |
| `--card` | `#22222e` | Player stat cards |
| `--red` | `#e05252` | Pudel% chip (`.chip.pc .v`) |
| `--grn` | `#4caf7d` | Wins chip value |
| `--mut` | `#8884a0` | Muted labels, empty states |
| `--brd` | `#2e2e3e` | Card borders |
| `--txt` | `#f0ede6` | Primary text |

---

## Component Contracts

### 1. Kegelabend Session Controls (Spiele tab)

**Location:** Top of `#pg-spiele`, above game list `#r-spiele`.

#### 1a. Idle state (no active Abend)

```
[ ▶ Abend starten ]       ← .btn .bp button
```

- Button class: `btn bp` (gold filled, existing style)
- Label: "▶ Abend starten"
- On click: opens modal `#m-start-abend`

#### 1b. Active Abend banner

```
┌─────────────────────────────────────────┐
│ 📍 Abend läuft                          │
│    Freitagsrunde                   [■ Beenden] │
└─────────────────────────────────────────┘
```

- Container: new class `.abend-banner` — amber left-border card style
- CSS: `background: var(--bg2); border: 1px solid var(--ac); border-left: 3px solid var(--ac); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;`
- Left: icon `📍` + label "Abend läuft:" (muted, 11px) + name in `--txt` bold below
- Right: button `btn bd sm` "■ Beenden" (destructive outline style)
- On Beenden click: confirm dialog ("Abend '{name}' beenden?") → `POST /api/abende/:id/end`

#### 1c. Start Abend modal (`#m-start-abend`)

```
┌─────────────────────────────┐
│ Abend starten               │
│                             │
│ Name (optional)             │
│ [________________________]  │
│ Leer lassen für Datum-Name  │
│                             │
│ [Starten]   [Abbrechen]     │
└─────────────────────────────┘
```

- Modal: `.mo` / `.md` pattern (same as `#m-neu-sp`)
- Heading: "Abend starten" (`.md h2`)
- Input `#m-abend-name` — placeholder "z.B. Freitagsrunde (optional)"
- Helper text: 11px muted "Leer lassen für automatischen Namen"
- Buttons: `btn bp` "Starten" + `btn bg` "Abbrechen"

#### 1d. Game history grouping

Games in `#r-spiele` rendered as before, but grouped under Abend headers:

```
── Freitagsrunde (Fr. 23.05.) ─────────────
  [game card] [game card]

── Ohne Abend ──────────────────────────────
  [game card]
```

- Group header: `<div class="stitle" style="font-size:13px;color:var(--mut);...">` 
- Abend name + date in muted text
- Games without abend_id grouped under "Ohne Abend" separator at the bottom

---

### 2. Statistics Tab (`#pg-stats`)

Replaces the current empty `<div id="r-stats">` with real data rendered by `renderStats()`.

#### 2a. Player stat card

```
┌─────────────────────────────────────────────────────┐
│ 🎳  Max                                             │
│                                                     │
│   [12]      [34]      [8.3%]                       │
│   Siege   Niederlagen  Pudel%                      │
│                                                     │
│ ▼ Bestleistungen                                   │
└─────────────────────────────────────────────────────┘
```

- Container: `.uc` (same player-card style used in game-setup player list)
- Avatar `.uav`: emoji in circle (existing pattern)
- Name `.uinfo .nm`: player name
- Chips row: 3x `.chip` inline — Siege (gold `.v`), Niederlagen (muted `.v`), Pudel% (`.chip.pc` red)
- Chip labels `.l`: "Siege", "Niederl.", "Pudel%"
- Expandable bests: toggle `▼/▶ Bestleistungen` below chips

#### 2b. Personal bests (expanded)

```
  Spieltyp              Bestleistung
  Drei in die Vollen    42
  Vier Gewinnt          Sieg
  Fuchsjagd             Sieg (Fuchs)
```

- Table: `.stbl` (existing stats table style)
- Columns: "Spieltyp" (left) | "Bestleistung" (right, `.snum` font)
- One row per game type where player has completed games
- Hidden by default; toggle via click on "Bestleistungen" row

#### 2c. Empty state

When no finished games exist:
```
        🎳
  Noch keine Spiele gespielt.
  Spielt ein Spiel zu Ende, um
  Statistiken zu sehen.
```
- `.empty` pattern (same as empty Spiele list)

#### 2d. Loading state

While `GET /api/stats` is in-flight: show `<div class="empty"><p>Laden…</p></div>`

---

### 3. Bibliothek Tab — Custom Game Types

Additive section below the existing built-in game type list.

#### 3a. Section header

```
── Eigene Spieltypen ───────────────────
                            [+ Hinzufügen]
```

- `.stitle` label "Eigene Spieltypen" (same heading style)
- `btn bp sm` button "+ Hinzufügen" right-aligned
- Only shown when authenticated

#### 3b. Custom type card

```
┌ ─────────────────────────────────────────┐
│ Mein Spiel                      [Löschen]│
│ Beschreibung des Spiels...               │
└──────────────────────────────────────────┘
```

- Container: `.stc.cu` (gold left border — existing class)
- Title: bold `--txt` 15px
- Description: muted 13px, multi-line
- Delete button: `.btn .bd .sm` "Löschen" (destructive outline, right-aligned)
- Delete: confirm dialog → `DELETE /api/game-types/:id`

#### 3c. Empty state (no custom types yet)

```
  Noch keine eigenen Spieltypen.
  Füge einen hinzu, um ihn später
  im Code zu implementieren.
```
- `.empty` pattern, shown inside the "Eigene Spieltypen" section

#### 3d. Add custom type modal (`#m-neu-typ`)

```
┌─────────────────────────────┐
│ Neuer Spieltyp              │
│                             │
│ Name                        │
│ [________________________]  │
│                             │
│ Regeln / Beschreibung       │
│ [                        ]  │
│ [                        ]  │
│                             │
│ [Hinzufügen]  [Abbrechen]   │
└─────────────────────────────┘
```

- Modal: `.mo` / `.md` pattern
- Name input `#m-typ-name` — required
- Description `<textarea>` `#m-typ-desc` — placeholder "Wie wird gespielt? Wann endet das Spiel?..."
- Buttons: `btn bp` "Hinzufügen" + `btn bg` "Abbrechen"
- On submit: `POST /api/game-types` → re-render custom types list

---

## Interaction Patterns

| Trigger | Action |
|---------|--------|
| "▶ Abend starten" click | Open `#m-start-abend` modal |
| Start modal "Starten" | POST /api/abende → close modal → render active banner |
| "■ Beenden" click | `confirm()` dialog → POST /api/abende/:id/end → hide banner → show start button |
| Stats tab activation | `renderStats()` → GET /api/stats → render player cards |
| Bestleistungen toggle | Toggle hidden bests table, flip arrow character |
| "+ Hinzufügen" (Bib) | Open `#m-neu-typ` modal |
| Add type "Hinzufügen" | POST /api/game-types → close modal → re-render custom types list |
| Custom type "Löschen" | `confirm()` → DELETE /api/game-types/:id → re-render |

---

## Accessibility & Safety

- `textContent` only — no `innerHTML` for user-supplied values (name, description)
- `confirm()` for all destructive actions (Abend beenden, Typ löschen)
- All new buttons follow existing `.btn` focus/hover patterns
- No new `localStorage` usage — state lives in `S.*` global object and server

---

## New CSS additions (minimal)

Only one new class needed:

```css
.abend-banner{background:var(--bg2);border:1px solid var(--ac);border-left:3px solid var(--ac);border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
```

All other elements use existing classes: `.uc`, `.uav`, `.uinfo`, `.chip`, `.chip.pc`, `.stbl`, `.stc.cu`, `.btn.bp`, `.btn.bg`, `.btn.bd`, `.btn.sm`, `.mo`, `.md`, `.stitle`, `.empty`, `.badge`.

---

*Phase: 04-club-features*
*UI contract authored: 2026-05-21*
