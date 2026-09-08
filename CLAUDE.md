# CLAUDE.md

Verminslayer is an offline-first PWA and the playable digital prototype of a future
Verminslayer tabletop dungeon-crawl (a co-op game where a band of Slayer heroes fights
a Skaven horde through a tiled map). The app exists to make the game easy to playtest and
to let us tune the rules before producing the physical board game.

See [AGENTS.md](AGENTS.md) for the full coding-pattern reference and [README.md](README.md)
for architecture and build details. This file is the domain brief plus the short-form
standards.

## Dev server

`pnpm start` — tsc watch + asset-copy watcher + live-server on port 8140, serving `dist/`.

## Domain

Current playtest rules specification: [`docs/rules.md`](docs/rules.md). Key concepts an agent needs:

### Turn structure

- **Hero turn**: heroes gain 3 Command (a shared pool). Each hero activates once with 4
  Actions.
- **Skaven turn**: optionally reveal noise tokens in play (those Skaven may act), then
  activate every revealed Skaven once — move, then optionally fight. Noise tokens move 5
  toward the nearest hero.

### Actions (per hero, 4 per activation)

| Action | Cost |
|--------|------|
| Move | 1 |
| Fight | 1 |
| Interact (open/close a door, etc.) | 1 |
| Guard | 2 |

- **Move / facing**: move up to the Move allowance; once during the move, may change
  facing to any direction; may move 0. Models do not auto-turn when attacking or
  defending.
- **Fight**: both sides roll Fight dice, highest die wins, loser takes 1 Wound, tie =
  nothing.
- **Guard**: place a marker; the first enemy to enter an adjacent square in the hero's
  front arc triggers a free Fight, then the marker is discarded. Guard is also lost if
  the hero takes another action or when the hero next activates.

### Noise

Face-down, hidden tokens. Cannot enter a hero's line of sight. Revealed when seen; a
revealed token resolves to a Skaven group (or nothing) from the mission's noise bag.

### Entities

- **Heroes** (card stats: Move / Fight / Wounds): Gotrek Gurnisson (3/3/3), Felix Jaeger
  (5/2/2), Snorri Nosebiter (3/2/3), Ulrika Magdova (5/2/2), Maximilian Schreiber
  (4/1/2), Malakai Makaisson (3/2/2). Each has two special abilities; some are
  once-per-round, once-per-activation, or once-per-mission.
- **Skaven**: Clanrat (4/1/1), Gutter Runner (6/2/1), Rat Ogor (3/3/2). Clanrats get
  +1 Fight die per adjacent Clanrat on the same hero (max 3 dice).
- **Missions** (e.g. "THE NEST"): define hero roster, Skaven types, starting/per-turn
  noise, round limit, first turn, map (tiles of 5×5 squares), victory conditions, and a
  noise bag.

### Map symbols

`#` wall · `+` door · `~` water · `:` rubble · `@` player start · `S` Skaven spawn ·
`N` Skaven nest.

### Data model

`DataStore` persists saved games under the localStorage key `games`. The `DataRecord`
interface in `src/DataStore.ts` carries `mission`, `round`, `phase`, `command`,
`nestsDestroyed`, `heroes[]`, and `notes`. Board-level state (positions, door state,
token placement) is not modelled yet — extend the interface rather than leaning on its
index signature.

## Coding standards

- **No frameworks, no bundler.** Vanilla TypeScript compiled with `tsc` to `dist/`.
  `strict: true`, `verbatimModuleSyntax: true`, `moduleResolution: "bundler"`.
- **Import specifiers use `.js`** (compiled output), absolute from root:
  `import { h } from '/src/domUtils.js'`. Tests are the exception — they import `.ts`
  relatively.
- **DOM creation**: always use `h()` from `/src/domUtils.js`, never `createElement`.
- **Data**: go through the `DataStore` singleton (an `EventTarget`); listen for its
  `change` event (`changeType: "init" | "add" | "update" | "delete"`). Never touch
  localStorage directly for app data.
- **Web Components**: live in `/components/`, use Shadow DOM and a `<style>` tag,
  kebab-case tags. Pair each `customElements.define()` with a `declare global { interface
  HTMLElementTagNameMap { ... } }` block in the same file.
- **Private fields** use `#`. Prefer `const`. Arrow functions for callbacks.
- **CSS utility classes** use the `u-` prefix. Prefer modern CSS over any framework.
- **Service workers** (`sw*.js`) are hand-authored classic JS, not compiled — edit
  directly. Add app cache entries to `sw-resources.js`, not `sw-core.js`.
- Don't add dependencies without approval.

## Checklist

**After changes:** `pnpm format` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → fix
issues → manual browser check at `http://localhost:8140`.
