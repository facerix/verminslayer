# MVP Progress

Last updated: 2026-10-21

This is the handoff log for [`mvp-plan.md`](mvp-plan.md). Update it when a reviewable
slice starts or finishes so a future turn can resume without reconstructing project state
from Git history.

## Current status

The tenth reviewable slice, **Mission resolution and MVP hardening**, is complete in the
working tree. The Nest now resolves Nest destruction, the opened Watch Post, hero victory,
hero elimination, and the Hero Turn 8 timeout. The single-game persistence foundation saves
the terminal result and rejects further commands after the mission ends.

| Slice | Status | Outcome |
| --- | --- | --- |
| 1. Map foundation and board preview | Complete | Validated The Nest map and responsive Canvas rendering |
| 2. Game setup and hero deployment | Complete | Mode/roster selection, immutable initial state, legal Canvas deployment, and public projections |
| 3. Initial noise setup and privacy | Complete | Private draw/placement, solo setup AI, face-down tokens, LOS reveals, and Hero Turn 1 handoff |
| 4. Hero activation and movement | Complete | Split Movement, two Actions, Dash, Push, legal paths, facing, doors, and phase completion |
| 5. Revealed Skaven and core combat | Complete | Group placement, Fight actions, dice, wounds, and death |
| 6. Complete two-player Skaven turn | Complete | Revealed-model activation, React, shortest-route Noise movement, action-only revealed groups, reinforcement, and round transition |
| 7. Solo Skaven AI | Complete | Legal attack-maximizing placement, nearest-first activations, shortest paths, attacks, Noise, and reinforcement |
| Persistence foundation | Complete | One versioned local save, automatic resume, private-state-safe handoff, and confirmed quit/clear |
| 8. Reactive combat mechanics | Complete | Guard, rerolls, Ward, death prevention, dice modifiers, and Rat Ogor damage |
| 9. Active and movement abilities | Complete | Bonus attacks/movement, ranged abilities, charges, Skitter, and Smash |
| 10. Mission resolution and MVP hardening | Complete | Nest actions, exit, terminal victory/loss, 1–5 hero outcome regressions, privacy and offline checks |

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
- Accounted for walls, rubble, water, closed doors, the locked exit, heroes, Skaven
  destinations, and other noise during placement while allowing spawning groups to spill
  through occupied Skaven and occupy intact nests.
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

## Completed between slices 7 and 8: persistence foundation

- Replaced the legacy open-ended `DataRecord` shape with an explicit versioned record containing
  the complete immutable `GameState`; no board state rides on an index signature.
- Enforced one saved game at most. Every successful `GameSession` transaction replaces the saved
  snapshot, while rejected rules commands never notify or overwrite the store.
- Restored JSON-deserialized state through the engine's immutable boundary before rendering, so
  a reload resumes setup, Hero, Skaven, reaction, and pending private-draw state.
- Restarted the solo controller before the first render when a saved game contains unfinished
  automatic Skaven work.
- Kept resumed two-player initial Noise identities behind a fresh pass-device handoff instead of
  revealing a pending private result immediately after reload.
- Added a persistent **Quit game** affordance with explicit confirmation. Confirming clears the
  save before reloading into a fresh roster-selection screen.
- Made the entry point repair the new header control when a stale cached HTML shell briefly loads
  alongside the new script during a service-worker update.
- Added the storage and UUID modules to the offline application shell and bumped both service
  worker cache versions.

## Completed in slice 8

- Added Guard for 1 Action, ending the activation and forfeiting remaining Actions and
  Movement as agreed. Guard expires on the hero's next activation.
- Processed revealed Skaven Movement one square at a time. A front-arc entry consumes Guard
  and interrupts for a free Fight; a survivor resumes the submitted path, while a defeated
  mover ends safely without React. Side/rear movement and a zero-square hold do not trigger it.
- Added Guard on revealed Noise model placement, resolving simultaneous Guards in roster
  order. Placement Guards finish before React opens and before final reinforcement advances
  the round or resets Command / round-limited ability eligibility.
- Replaced duplicated Hero, Skaven, and React combat handlers with a shared immutable Fight
  resolution flow, using a separate combat-rules module for dice, arcs, and reroll eligibility.
- Applied Axe of Grimnir using printed maximum Wounds, capped Strength in Numbers while
  attacking or defending, and Backstab only on Gutter Runner attacks from the agreed
  three-square rear arc. Brute Strength deals and reports 2 Wounds, including while defending.
- Added optional Karaghul / Rememberer die choices, explicit once-per-round usage, Chebyshev
  support range, and the one-reroll-per-die restriction. Felix can support himself.
- Added Maximilian's Ward for 1 Action or through React for 2 Command, limited to one token
  per living hero within 3 squares. A loss consumes the Ward and rerolls only eligible dice
  before wounds; wins and ties retain it.
- Applied Snorri's automatic once-per-mission prevention of lethal damage, including two-Wound
  Rat Ogor hits, leaving him at 1 Wound.
- Saved pending Fight stages, old/new reroll results, ability usage, Guard / Ward markers, and
  remaining interrupted movement. Existing saves receive an explicit additive migration.
- Added Hero-only shared-device Fight handoffs and pass-back covers, semantic reroll / Ward
  choices, visible and accessible Guard / Ward markers, complete reroll history, and accurate
  damage highlights. Guard flows directly into React while the Hero player holds the device.
- Kept solo AI paused at pending Hero Fight choices and resumed it through ordinary validated
  commands after each choice.
- Made automatic placement transactional at the session boundary: later Guard randomness
  failures cannot partially commit an earlier movement or placement or overwrite the save.
- Cached the new module and advanced production / development service workers to `0.1.8`.
- Updated the tabletop rules with resolved timing and reroll conventions, and removed the
  obsolete plan default that claimed a refresh loses the saved game.

## Completed in slice 9

- Added saved follow-up choices for Slayer’s Fury, Two-Fisted, Hunter’s Step, Repeater
  Handgun, and Demolition Charge. Optional follow-ups can be declined; charge blast attacks
  must all resolve. The choice state survives reload and blocks unrelated commands.
- Added Kislevite Bow, Arcane Bolt, and Repeater Handgun attacks at their printed ranges,
  line-of-sight requirements, dice counts, and Action costs. Every shot uses the shared
  defender modifiers, reroll/Ward choices, wounds, and combat log.
- Added once-per-activation Slayer’s Fury and once-per-mission Demolition Charge usage to
  saved state. Existing once-per-round rerolls remain tracked separately. The charge can
  be placed beside an intact door or nest, then detonated with confirmation during a Hero
  turn; it destroys that feature and attacks each adjacent enemy with 3 dice.
- Added Gutter Runner Skitter through Clanrat-occupied intermediate squares, while still
  forbidding an occupied destination. Rat Ogors can cross and destroy closed doors during
  Movement. A Smash reveal interrupts the remaining path for Skaven placement, then
  resumes the saved Movement and React timing.
- Added semantic ability controls and charge/destroyed-nest board presentation, including
  accessible descriptions. Updated both service-worker cache versions to `0.1.9`.
- Regression tests cover ability costs, limits, pending save/resume, multiple attacks,
  special movement legality, forced reveal and continuation, and feature destruction.

## Verification baseline

For the completed Slice 7 plus the persistence foundation:

- `pnpm format` passed.
- `pnpm lint` passed with zero warnings and errors.
- `pnpm typecheck` passed.
- `pnpm test` passed all 129 tests.
- `pnpm build` completed successfully.
- A browser-started game resumed at the same Hero deployment state after a full reload, with
  the selected roster and Quit game control intact.
- Quit game opened an explicit destructive confirmation; save replacement and clearing are
  covered by the `DataStore` regression tests.
- A clean resumed browser load produced no console warnings or errors.
- The captured crowded-spawn save replayed through the solo controller into Hero Turn 2.
- A fresh one-hero solo desktop flow kept all three initial identities out of the public and
  accessible UI, completed every Noise activation and both reinforcements without exposing
  manual Skaven controls, and reached Hero Turn 2 with Command reset to 2.
- React pause-and-resume is covered by the complete-solo-turn module regression test; the
  browser's random flow did not open a React window.
- A 700 × 900 tablet viewport had no horizontal overflow; its document and body scroll widths
  both matched the 700-pixel viewport.
- The final refreshed flow produced no browser console errors. It produced only the known
  `Multiple service workers detected` development warning below.

## Noise door refinement

- Noise now plans shortest routes with closed doors treated as passable, even when an open
  detour exists, and stops movement before the first closed door on its chosen route.
- Noise beginning adjacent to that door spends its activation opening it for Clanrats /
  Gutter Runner, destroying it for Rat Ogor, or leaving it closed for Nothing. Arriving
  during movement requires waiting until the next activation to handle the door.
- Door changes immediately reveal every Noise newly in hero line of sight or adjacency.
  The active group retains its normal React window after placement, but gets no Movement
  or Actions. This timing survives save-and-resume during placement or React.
- Two-player controls resolve a single route directly or highlight distinct blocking doors
  among tied routes. Solo AI uses the same engine options and resumes into reinforcement
  after React. Door reactions also finish the spent Noise activation.
- Smashed doors have a broken board marker and are described as destroyed and impossible
  to close. Both service-worker cache versions advance to `0.1.7` for offline updates.
- Validation: changed sources formatted; lint, typecheck, all 160 tests, and build pass.
  Browser scenarios on an isolated local origin confirmed Rat Ogor revelation followed by
  React and reinforcement, a selected tied door being smashed while Noise stays hidden,
  and solo Clanrat opening/revelation followed by React and Hero Turn 2 without attacks.
  No console errors occurred; the existing development service-worker warnings remain
  tracked below.

## Slice 8 verification

- Formatting, lint (zero warnings/errors), source/test typecheck, all 193 tests, and the
  production build pass. The slice adds 33 regressions to the 160-test baseline.
- Disposable browser games on an isolated local preview origin verified Guard placement and
  activation completion, a Guard-interrupted Fight, reroll history, reload privacy, resumed
  remaining movement, and the Rat Ogor's two-Wound damage / defeat highlight.
- A browser Ward action spent one Action and appeared on Canvas and in the board description.
  A winning Fight retained it; a later loss paused without wounds. Reload resumed the Ward
  choice, its reroll produced a tie, its marker disappeared, and the combat log retained the
  original and rerolled die values.
- A 700 × 900 tablet viewport had no horizontal overflow (document and body widths both 700).
  The complete board and independently scrolling controls remained visible.
- Concealed Noise identities were absent from the Hero controls and board description; pending
  Fight projection privacy and solo AI pause/resume are also covered by regression tests.
- Isolated preview scenarios produced no console warnings or errors. The reused development
  origin reproduced the previously tracked stale-response / multiple-worker behavior; those
  service-worker follow-ups remain below.

## Slice 9 verification

- `pnpm format`, `pnpm lint` (zero warnings/errors), `pnpm typecheck`, all 208 tests,
  and `pnpm build` passed.
- A clean local browser preview verified Malakai’s charge control, Action cost,
  confirmation, door destruction, board description, and saved state through the UI.
  The preview reported no console warnings or errors.
- Ranged and bonus combat, Skitter, Smash interruption/resume, and charge blast ordering
  were exercised with deterministic engine tests. A full mission playthrough remains in
  Slice 10.

## Completed in slice 10

- Added a validated, adjacent 2-Action Nest interaction. Destroying the third Nest through
  that interaction or Demolition Charge opens the Watch Post; the public projection,
  controls, board marker, board description, and event highlight report the change.
- Added a saved terminal mission result. A surviving hero entering the opened exit wins
  immediately; the Skaven win as soon as all selected heroes die, or at the end of Hero
  Turn 8 before any Skaven turn begins. Later commands fail with `GAME_ENDED`.
- Added a terminal mission panel and result announcement. The solo controller stops on a
  terminal result, and both service-worker versions advance to `0.1.10`.
- Added regression scenarios for ordinary and charge-based Nest destruction, exit wins,
  hero elimination, timeout, and command rejection. Victory and loss scenarios cover
  rosters of one through five heroes. Existing module scenarios cover complete solo and
  two-player rounds, including React windows and reinforcement.
- Updated `AGENTS.md` and `CLAUDE.md` to describe the typed, versioned `GameState` save.

## Slice 10 verification

- Formatting, lint (zero warnings/errors), source/test typecheck, all 227 tests, and the
  production build pass.
- A clean local browser game verified setup, deployment, private Noise, saved-game resume,
  and the two-player pass-device cover. Reloading during a pending private draw restored
  the cover without exposing its identity in the Hero view or board description.
- The same preview fit a 700 × 900 tablet viewport without horizontal overflow. With its
  server stopped, a reload still showed the saved game from the offline application shell.
- Quit confirmation was tested on the disposable preview game: Cancel kept the game, and
  confirming cleared it back to roster selection. The preview reported no console warnings
  or errors.

## Known follow-up

- Define what happens to excess models when heroes or Noise completely seal a revealed
  group's placement area even after Skaven spillover is considered.
- The development browser still reports `Multiple service workers detected`. This is a
  warning rather than an error; inspect the service-worker lifecycle when that work is in
  scope.
- The existing development service worker can serve one stale cached response before its
  background refresh completes when files change without a cache-version bump. This revision
  bumps both cache versions; revisit the development cache strategy with the service-worker
  lifecycle work above.

## Next playtest

Run full human playthroughs in solo and two-player mode and record balance and usability
feedback. The automated scenarios cover the rules outcomes; the browser checks above cover
the critical setup, privacy, resume, responsive layout, and offline paths.
