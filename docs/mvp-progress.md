# MVP Progress

Last updated: 2026-09-15

This is the handoff log for [`mvp-plan.md`](mvp-plan.md). Update it when a reviewable
slice starts or finishes so a future turn can resume without reconstructing project state
from Git history.

## Current status

The seventh reviewable slice, **Solo Skaven AI**, is complete in the working tree. Solo
Skaven now choose and dispatch ordinary rules-validated commands for revealed placement,
activation order, shortest-path Movement, facing, attacks, Noise, and reinforcement, pausing
only when the Hero player must resolve React.

| Slice | Status | Outcome |
| --- | --- | --- |
| 1. Map foundation and board preview | Complete | Validated The Nest map and responsive Canvas rendering |
| 2. Game setup and hero deployment | Complete | Mode/roster selection, immutable initial state, legal Canvas deployment, and public projections |
| 3. Initial noise setup and privacy | Complete | Private draw/placement, solo setup AI, face-down tokens, LOS reveals, and Hero Turn 1 handoff |
| 4. Hero activation and movement | Complete | Split Movement, two Actions, Dash, Push, legal paths, facing, doors, and phase completion |
| 5. Revealed Skaven and core combat | Complete | Group placement, Fight actions, dice, wounds, and death |
| 6. Complete two-player Skaven turn | Complete | Revealed-model activation, React, shortest-route Noise movement, action-only revealed groups, reinforcement, and round transition |
| 7. Solo Skaven AI | Complete | Legal attack-maximizing placement, nearest-first activations, shortest paths, attacks, Noise, and reinforcement |
| 8. Reactive combat mechanics | Not started | Guard, rerolls, Ward, death prevention, dice modifiers, and Rat Ogor damage |
| 9. Active and movement abilities | Not started | Bonus attacks/movement, ranged abilities, charges, Skitter, and Smash |
| 10. Mission resolution and MVP hardening | Not started | Nests, exit, victory and loss, complete-game scenarios, privacy, UI, and offline verification |

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
- Transitioned the immutable engine to Round 1, Hero phase, with 2 Command after all three
  setup draws resolve.
- Removed the brittle exact-door-count invariant after the map gained a recent additional
  door; nests, spawns, deployment, and exit remain validated gameplay invariants.

## Completed in slice 4

- Added immutable Hero-turn state for the active hero, remaining Movement and Actions,
  facing-change availability, Dash/Push usage, activated heroes, and exited heroes, with
  eligibility restricted to living, deployed, non-exited models.
- Added explicit commands and typed rule failures for starting and ending activations,
  moving, changing facing, interacting with doors, and ending the Hero phase.
- Added deterministic orthogonal breadth-first pathfinding in a separate rules module. It
  accounts for impassable terrain, the locked exit, closed doors, heroes, and both concealed
  and revealed noise, plus intact nests for heroes while leaving nests passable to Skaven,
  and retains the submitted path for one-square-at-a-time effects.
- Enforced one splittable Movement equal to the printed Move allowance, one facing change per
  activation, and a legal zero-square facing change without spending an Action.
- Reduced a hero activation to 2 Actions, added once-per-activation Dash for one additional
  printed Move allowance, and added once-per-activation Push for 1 shared Command and +1 Action.
- Reset the starting shared Command reserve from 3 to 2 instead of accumulating it.
- Re-evaluated concealed noise after every movement step and immediately after a door opens,
  preserving private identities until an actual reveal event.
- Added adjacent door open/close interactions, prevented an occupied doorway from closing,
  and updated movement and LOS as soon as its state changes.
- Exposed legal movement paths, movement targets, door targets, action state, and activation
  state through the public projection without exposing concealed noise identities.
- Added a phase-oriented Hero-turn UI module, Canvas legal-target selection, active/finished
  hero styling, dynamic open-door rendering, semantic action controls, live announcements,
  and explicit confirmation dialogs for unused Actions and phase completion.
- Bumped the production and development service-worker cache versions so existing offline
  clients fetch the revised rules engine and controls.
- Transitioned to Skaven Turn 1 only after every eligible hero has completed an activation.
- Cached the new compiled pathfinding and Hero-turn modules for offline use.

## Completed in slice 5

- Added immutable Skaven model state with stable IDs, definition references, positions,
  facing, remaining Wounds, and a monotonic ID sequence that does not reuse defeated IDs.
- Converted revealed noise into an interrupting placement queue. The first model occupies
  the token square and each later model uses the nearest reachable empty distance tier, with
  every equal-distance choice exposed to the controller in two-player mode and resolved with
  injected randomness in solo mode.
- Accounted for walls, rubble, water, closed doors, the locked exit, heroes, Skaven, and
  other noise during placement while allowing Skaven to occupy intact nests.
- Added adjacent hero Fight actions through a separate opposed-roll module. Every printed
  Fight die uses the injected random source; highest dice determine a hero win, Skaven win,
  or no-effect tie.
- Applied one Wound to the loser, removed defeated Skaven, removed defeated heroes from the
  board, and ended a defeated active hero's activation safely.
- Exposed individual Skaven, legal Fight targets, pending revealed groups, and an immutable
  full combat log through public projections without exposing concealed noise identities.
- Rendered Skaven discs with facing and Wounds, highlighted placement and Fight targets,
  added semantic placement/Fight controls, retained visible dice history, and announced
  rolls and outcomes through the live region.
- Split nearest-group placement and opposed dice into focused rules modules and cached both
  compiled modules for offline use.

## Completed in slice 6

- Reconciled every current reveal site with forced contact: setup placement, hero movement,
  and opening a door now reveal Noise through hero line of sight or adjacency.
- Snapshotted the revealed Skaven eligible at the start of the turn so a group revealed later
  cannot accidentally activate immediately.
- Added manual Skaven activation order, one non-splittable Movement with an optional facing
  change, one Action, early-end confirmation, and transition to the Noise-activation step.
- Added ordinary adjacent Fight actions and Clanrat-only adjacent Door actions, including
  wounds, defeat, occupied-door validation, and reveal checks after opening a door.
- Added two-player handoff and semantic Skaven activation controls, Canvas target selection,
  active/finished model styling, announcements, and public combat history.
- Updated the rules map and terrain assertions to preserve the intentionally relocated third
  Nest at rules coordinate row 10, column 2.
- Added the Skaven-turn UI module to the offline application shell and bumped both service
  worker cache versions.
- Added explicit React windows after revealed Skaven Movement and after complete placement of
  a group revealed by its own Noise activation. Fight and Door reactions cost 2 Command,
  block the enemy Action until resolved, and use Hero/Skaven pass-back covers on a shared
  device.
- Added all-shortest-route Noise movement toward the nearest reachable hero, forced reveal at
  the first line-of-sight or adjacency contact, turn-start Noise snapshots, and action-only
  activations for each model in a group revealed during its own movement.
- Added two private reinforcement draws without replacement, occupied-entry consumption,
  immediate reveal and placement, and explicit exclusion of reinforcement models from the
  current turn's activations.
- Completed the round transition to the next Hero turn, clearing Skaven-turn interruption
  state and resetting the shared Command reserve to 2.
- Added semantic Noise activation, React, private reinforcement, and round-transition controls,
  including shortest-route board highlighting and shared-device handoffs.

## Completed in slice 7

- Added a solo Skaven command generator that advances the Skaven turn through the same
  `GameCommand` and `resolveCommand` validation path used by the two-player controller.
- Ranked revealed-model placements by whether they enable an immediate attack, using fresh
  randomness only among equally scored legal squares, and centralized solo reveal placement
  so the policy applies during Hero movement, Noise activation, and reinforcement.
- Added board-path distance and shortest-approach queries. Revealed models activate nearest to
  a reachable hero first, follow a randomly selected equally short legal path, face a living
  target, attack whenever possible, and otherwise open an adjacent closed door or end safely.
- Automated forced shortest-route Noise movement and private reinforcement draws and placement.
  The controller never evaluates whether a Noise reveal is advantageous.
- Kept Hero React as an explicit interruption: the AI stops at each React window and resumes
  after the Hero player reacts or declines, then runs until the next interruption or Hero turn.
- Added deterministic tests for attack-maximizing placement, invalid randomness, tied activation
  order, path-distance approach, and a complete solo Skaven turn across React interruptions.
- Cached the new compiled AI module and bumped production and development service-worker cache
  versions.

## Verification baseline

For the completed Slice 7:

- `pnpm format` passed.
- `pnpm lint` passed with zero warnings and errors.
- `pnpm typecheck` passed.
- `pnpm test` passed all 125 tests.
- `pnpm build` completed successfully.
- A fresh one-hero solo desktop flow kept all three initial identities out of the public and
  accessible UI, completed every Noise activation and both reinforcements without exposing
  manual Skaven controls, and reached Hero Turn 2 with Command reset to 2.
- React pause-and-resume is covered by the complete-solo-turn module regression test; the
  browser's random flow did not open a React window.
- A 700 × 900 tablet viewport had no horizontal overflow; its document and body scroll widths
  both matched the 700-pixel viewport.
- The final refreshed flow produced no browser console errors. It produced only the known
  `Multiple service workers detected` development warning below.

## Known follow-up

- The development browser still reports `Multiple service workers detected`. This is a
  warning rather than an error; inspect the service-worker lifecycle when that work is in
  scope.
- The existing development service worker can serve one stale cached response before its
  background refresh completes when files change without a cache-version bump. This revision
  bumps both cache versions; revisit the development cache strategy with the service-worker
  lifecycle work above.

## Proposed next slice

Build Slice 8, **Reactive combat mechanics**, beginning with Guard interruption and then
modelling rerolls, Ward, Snorri's death prevention, contextual Fight modifiers, and Rat Ogor
damage as explicit immutable choices.

## Remaining slice breakdown

### Slice 8: Reactive combat mechanics

- Add Guard placement, step-by-step movement interruption, marker consumption, and expiry.
- Add optional Fight-die rerolls from Karaghul and Rememberer, including the rule that each
  die can be rerolled at most once.
- Add Ward resolution and Snorri's once-per-mission death prevention.
- Apply contextual combat effects: Axe of Grimnir, Strength in Numbers, Backstab, and Brute
  Strength.
- Model pending choices explicitly so interrupted combat remains immutable, transactional,
  and visible to the correct player.

### Slice 9: Active and movement abilities

- Add Slayer's Fury and Two-Fisted bonus attacks or movement.
- Add Kislevite Bow and Hunter's Step, Arcane Bolt, and Repeater Handgun.
- Add Demolition Charge placement, confirmed detonation, feature destruction, and adjacent
  attacks.
- Add Skitter movement through Clanrats and Rat Ogor Smash through closed doors.
- Track once-per-activation, once-per-round, and once-per-mission usage explicitly.

### Slice 10: Mission resolution and MVP hardening

- Destroy nests through the normal 2-Action mission interaction or Demolition Charge and
  open the Watch Post exit only after all three are destroyed.
- Resolve immediate hero victory on exit, immediate Skaven victory when all selected heroes
  die, and the Hero Turn 8 timeout without another Skaven turn.
- Add complete solo and two-player round scenarios plus hero elimination, timeout, and
  successful nest-destruction-and-exit scenarios for rosters of 1 through 5 heroes.
- Complete desktop/tablet, pass-device privacy, reaction handoff, restart confirmation,
  offline startup, and console-error verification.
