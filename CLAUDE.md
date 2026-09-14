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

- **Hero turn**: reset the shared pool to 2 Command. Each hero activates once with one
  splittable Movement and 2 Actions.
- **Skaven turn**: activate revealed Skaven with one Movement and 1 Action, activate each
  Noise token by moving it up to 5 toward the nearest hero, then reinforce with 2 new Noise.
  Noise that reveals during its activation becomes models that may each take 1 Action but
  cannot Move again that turn. Reinforcements do not activate until the next turn.

### Hero activation

| Action | Cost |
|--------|------|
| Fight | 1 |
| Door (open/close an adjacent door) | 1 |
| Guard (must be final) | 1 |
| Dash (once per activation) | 1 |

- **Movement / facing**: Movement equal to the hero's Move may be split before, between,
  and after Actions. Dash adds Move again. A hero may change facing once per activation,
  including across Dash movement and during a zero-square segment. Models do not auto-turn.
- **Command**: Push costs 1 Command for +1 Action once per activation. React costs 2 Command
  for one immediate eligible 1-Action action after an enemy completes Movement.
- **Fight**: both sides roll Fight dice, highest die wins, loser takes 1 Wound, tie =
  nothing.
- **Guard**: place a marker; the first enemy to enter an adjacent square in the hero's
  front arc triggers a free Fight, then the marker is discarded. Guard is also lost when
  the hero next activates.

### Noise

Face-down, hidden tokens with Move 5 and no facing. Noise follows a shortest legal route
toward the nearest hero and immediately reveals upon entering hero line of sight or an
adjacent square. There is no voluntary Reveal action. A revealed token resolves to its
Skaven group, or is removed if it is Nothing. Movement spent as Noise becomes the revealed
models' Movement; when revelation occurs during the Noise activation, each model may take
1 Action but cannot Move again that turn.

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
