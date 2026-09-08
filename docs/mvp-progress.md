# MVP Progress

Last updated: 2026-09-08

This is the handoff log for [`mvp-plan.md`](mvp-plan.md). Update it when a reviewable
slice starts or finishes so a future turn can resume without reconstructing project state
from Git history.

## Current status

The second reviewable slice, **game setup and hero deployment**, is complete in the
working tree. Players can configure solo or two-player mode, select 1–5 heroes, and deploy
them with facing through the responsive Canvas. The immutable engine advances to the
initial-noise boundary after the final hero is placed. Noise placement, turns, combat, AI,
abilities, and victory resolution remain to be implemented.

| Slice | Status | Outcome |
| --- | --- | --- |
| 1. Map foundation and board preview | Complete | Validated The Nest map and responsive Canvas rendering |
| 2. Game setup and hero deployment | Complete | Mode/roster selection, immutable initial state, legal Canvas deployment, and public projections |
| 3. Initial noise setup and privacy | Proposed next | Draw/place three concealed results and hand off to the first Hero turn |
| 4+. Rules-enforced play | Not started | Movement, combat, turns, abilities, AI, and mission resolution |

## Completed in slice 1

- Added an immutable ASCII map parser with typed errors for invalid height, width,
  symbols, and required feature counts.
- Encoded The Nest as a 13-column by 19-row mission map and validated its six doors,
  three nests, three Skaven spawns, deployment point, and exit at module startup.
- Replaced the south-wall square at rules coordinate row 19, column 2 with the locked
  Watch Post exit (`E`).
- Added pure Canvas geometry for board fitting and point-to-square hit mapping.
- Added a responsive, device-pixel-ratio-aware `<game-board>` Web Component and a
  separate Canvas renderer.
- Added a semantic mission summary and accessible board description.
- Added every new runtime module to the service-worker core resource list.
- Updated [`rules.md`](rules.md) with the 1–5 hero roster, revised Skaven victory,
  coordinate conventions, deployment, terrain, distance, line-of-sight, noise, and exit
  rules agreed in the MVP plan.

## Important decisions

- Engine positions are zero-based `{ row, column }`; player-facing rules coordinates are
  one-based from the northwest corner.
- The exit is explicit map data rather than a special case inferred from a wall square.
  It renders as locked; future game state will determine when it becomes passable.
- The Canvas preview consumes parsed mission data but owns no rules or mutable game
  state.
- V1 game state remains in memory. Slice 1 did not change `DataStore` or persistence.
- The page describes the current boundary as mission setup and explicitly says that
  private noise placement begins in the next slice, so it cannot be mistaken for a
  complete game.

## Completed in slice 2

- Defined all six heroes and three Skaven, including printed stats, ability metadata, and
  The Nest's complete 20-result noise bag.
- Added an immutable setup `GameState`, mission registry, setup `GameCommand` union,
  setup `GameEvent` union, injected browser/test randomness boundary, and typed command
  rejection through the three-argument `resolveCommand(state, command, randomSource)`
  transaction.
- Added hero and Skaven projections. Hero projections retain face-down token positions but
  omit concealed result identities entirely.
- Added solo/two-player mode and 1–5 unique hero selection, defaulting to Gotrek and Felix.
- Enforced deployment on the marker or an empty, passable adjacent square, including
  runtime facing validation, occupancy, selected-roster membership, and one placement per
  hero.
- Added Canvas legal-square highlighting, pointer hit-testing, labeled hero discs, facing
  indicators, and an updated accessible board description.
- Added a semantic setup/deployment panel with mode, roster, hero and facing controls,
  deployment status, visible rules errors, and polite announcements.
- Kept the browser entry point as a composition root: a shared `GameSession` owns the
  current immutable engine state, while a phase-oriented setup module renders projections
  and handles its declared game and board events through a strict event delegate.
- Kept the v1 session in memory and left `DataStore` unchanged.
- Cached every new compiled module through `sw-resources.js` and corrected app-shell
  scrolling so controls remain reachable at the tablet breakpoint.

## Verification baseline

At the end of slice 2:

- `pnpm format` passed.
- `pnpm lint` passed with zero warnings and errors.
- `pnpm typecheck` passed.
- `pnpm test` passed all 50 tests.
- `pnpm build` completed successfully.
- A two-player desktop flow selected the default roster, deployed both heroes through
  Canvas clicks with different facings, and reached the initial-noise boundary.
- A 700 × 900 tablet flow stacked the board above reachable controls without horizontal
  overflow and accepted Canvas deployment after scrolling.
- Canvas backing dimensions matched its CSS dimensions at the browser's device pixel
  ratio.
- The application produced no browser console errors.

## Known follow-up

- The development browser reported `Multiple service workers detected`. This was a
  warning rather than an error and was not changed during the map slice. Inspect the
  service-worker lifecycle when that work is in scope.
- The existing development service worker can serve one stale cached response before its
  background refresh completes when files change without a cache-version bump. Manual
  verification used a fresh local origin; revisit development cache strategy with the
  service-worker lifecycle work above.

## Proposed next slice

Implement initial noise setup and its privacy boundary:

1. Add square-center supercover line of sight with strict blocking corners, plus focused
   terrain/LOS tests needed for immediate noise reveals.
2. Draw three results without replacement through the injected `RandomSource`.
3. In two-player mode, show a role-handoff cover, reveal one result only to the Skaven
   player, and let them choose an empty spawn for it before drawing the next.
4. In solo mode, choose spawn squares without exposing identities in the hero DOM or
   Canvas.
5. Render placed tokens face down, resolve immediate reveal when a spawn is in hero LOS,
   and consume draws when every spawn is occupied.
6. Transition cleanly to the first Hero turn after all three setup draws are resolved.

Do not add general Skaven noise movement, hero activation actions, or combat in this slice.
