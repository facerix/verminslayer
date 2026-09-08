# MVP Progress

Last updated: 2026-09-08

This is the handoff log for [`mvp-plan.md`](mvp-plan.md). Update it when a reviewable
slice starts or finishes so a future turn can resume without reconstructing project state
from Git history.

## Current status

The third reviewable slice, **initial noise setup and privacy**, is complete in the working
tree. The engine draws and places three noise results without replacement, preserves their
identities across the hero/Skaven projection boundary, handles blocked draws and immediate
LOS reveals, and begins Hero Turn 1 with 3 Command. Solo and shared-device two-player setup
both work through the responsive Canvas.

| Slice | Status | Outcome |
| --- | --- | --- |
| 1. Map foundation and board preview | Complete | Validated The Nest map and responsive Canvas rendering |
| 2. Game setup and hero deployment | Complete | Mode/roster selection, immutable initial state, legal Canvas deployment, and public projections |
| 3. Initial noise setup and privacy | Complete | Private draw/placement, solo setup AI, face-down tokens, LOS reveals, and Hero Turn 1 handoff |
| 4. Hero activation and movement | Proposed next | Activation order, Action spending, legal paths, facing, doors, and phase completion |
| 5+. Rules-enforced play | Not started | Combat, abilities, Skaven AI, noise movement, and mission resolution |

## Completed in slice 1

- Added an immutable ASCII map parser with typed errors for invalid height, width,
  symbols, and required feature counts.
- Encoded The Nest as a 13-column by 19-row mission map and validated its three nests,
  three Skaven spawns, deployment point, and exit at module startup.
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

## Completed in slice 3

- Added square-center supercover line tracing that includes both orthogonal squares at an
  exact corner, with walls, rubble, the locked exit, and closed doors blocking LOS while
  water and open doors do not.
- Added immutable pending, concealed, and revealed noise state plus three setup draws
  without replacement through the injected `RandomSource`.
- Rejected invalid draw/placement sequencing, invalid randomness, non-spawn placement,
  occupied spawns, and post-setup commands without partially changing state.
- Kept pending and concealed identities absent from hero projections while exposing them
  to the Skaven projection; even a drawn `Nothing` remains an ordinary face-down token
  until it is revealed.
- Added a full-screen two-player handoff cover and one-result-at-a-time private Skaven
  placement. The previous private identity leaves the DOM before the next is shown.
- Added solo setup placement through the same ordinary draw/place command validation path,
  without putting concealed identities in the hero DOM, Canvas model, or accessible board
  description.
- Rendered face-down noise tokens and legal spawn highlights on the Canvas, recorded
  immediate LOS reveals publicly, and consumed draws when every spawn is occupied.
- Transitioned the immutable engine to Round 1, Hero phase, with 3 Command after all three
  setup draws resolve.
- Removed the brittle exact-door-count invariant after the map gained a recent additional
  door; nests, spawns, deployment, and exit remain validated gameplay invariants.

## Verification baseline

At the end of slice 3:

- `pnpm format` passed.
- `pnpm lint` passed with zero warnings and errors.
- `pnpm typecheck` passed.
- `pnpm test` passed all 66 tests.
- `pnpm build` completed successfully.
- A two-player desktop flow deployed a hero, covered the screen for role handoff, privately
  drew and placed all three results, rendered three face-down Canvas tokens, and reached
  Hero Turn 1 without identities appearing in the public board description.
- A solo 700 × 900 tablet flow stacked the board above reachable controls without
  horizontal overflow, accepted Canvas deployment after scrolling, privately placed all
  three tokens through the AI path, and reached Hero Turn 1.
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

Implement the Hero-turn activation and movement foundation:

1. Track living, non-exited hero activation status and 4 Actions per activation.
2. Let the Hero player choose activation order and require confirmation before ending an
   activation early or ending the phase.
3. Add orthogonal pathfinding with terrain, doors, model occupancy, and Move allowance.
4. Apply movement one square at a time, allow one facing change including a zero-square
   Move, and expose legal paths/targets through public projections.
5. Add closed-door open/close interactions and their immediate movement/LOS effects.
6. Transition to the first Skaven turn after every eligible hero has activated.

Do not add combat, Guard, hero abilities, general noise movement, or Skaven AI in this
slice.
