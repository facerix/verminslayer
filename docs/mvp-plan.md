# Verminslayer Playable Canvas Game v1

## Summary

Build a complete, rules-enforced implementation of **The Nest** using vanilla TypeScript, Web Components, and an HTML Canvas board.

V1 is complete when players can:

- Start a solo or shared-device two-player game.
- Select 1–5 unique heroes from all six; default to Gotrek and Felix.
- Deploy heroes, complete turns, move, change facing, fight, interact, guard, and use every listed ability.
- Control Skaven manually in two-player mode or face simple aggressive AI in solo mode.
- Resolve noise, doors, nests, wounds, death, the round limit, and both victory conditions.
- Play on desktop or tablet with mouse or touch, including offline after the application has loaded once.

V1 deliberately excludes saved games, persistence, undo, phone-specific pan/zoom, additional missions, and permissive state-editing tools.

## Gameplay and Rules

- Update `docs/rules.md` alongside implementation so the application and tabletop specification agree:
  - The Nest permits 1–5 selected heroes instead of requiring Gotrek and Felix.
  - Skaven victory occurs when all selected heroes die.
  - Replace the south-wall square at row 19, column 2 with an exit.
  - Record the agreed grid, terrain, noise, deployment, and exit rules below.
- Parse the existing 13×19 ASCII mission map and validate its dimensions and required features at startup.
- Use these board conventions:
  - Models move orthogonally and may not share squares.
  - Melee, adjacency, deployment proximity, and front arcs include diagonals.
  - Facing is north/east/south/west; the front arc is the three adjacent squares on the facing side.
  - A Move may follow any legal orthogonal path up to the model’s allowance and permits one facing change, including during a zero-square Move.
  - Ranged and proximity ranges use Chebyshev distance.
  - Walls and rubble block movement and LOS. Water blocks movement but not LOS.
  - Closed doors block movement and LOS; open or destroyed doors block neither.
  - Intact nests block heroes but not Skaven; destroyed nests block neither side.
  - LOS uses square-center supercover rays, is blocked at touching terrain corners, and is not blocked by models, nests, water, or open doors.
- Setup sequence:
  - Choose mode and 1–5 unique heroes, preselecting Gotrek and Felix.
  - Deploy them with chosen facing on `@` or any empty passable adjacent square.
  - Draw three noise results without replacement. In two-player mode, use a pass-device cover while the Skaven player privately sees each result and chooses an empty `S` square. In solo mode, the AI does this without exposing identities.
- Hero turns:
  - Add 3 Command at the start of every Hero turn; unused Command carries forward without a cap.
  - Let the Hero player choose activation order. Each living, non-exited hero activates once with 4 Actions.
  - Enforce Move, Fight, Interact, Guard, nest destruction, doors, and all six heroes’ special abilities.
  - Roll dice in the application, display every result, and pause for optional rerolls, bonus attacks, or bonus movement.
  - Track once-per-activation, once-per-round, and once-per-mission usage explicitly.
  - Process movement one square at a time so LOS reveals and Guard attacks interrupt at the correct moment. If the moving model survives a Guard attack, it continues its submitted path.
- Skaven turns:
  - In two-player mode, the Skaven player chooses optional reveals, activation order, movement, facing, targets, and optional attacks.
  - A revealed result places its models on the token square and then the nearest empty reachable passable squares by movement distance; the Skaven controller chooses among equal candidates. “Nothing” removes the token.
  - Activate every revealed Skaven once: move up to its allowance, change facing at most once, then optionally fight.
  - Move each remaining hidden noise token five steps where legal along a shortest route toward a nearest hero, truncating before the first square in any hero’s LOS or when blocked.
  - Draw and place two new noise results after movement and activations. Noise cannot stack in v1; draws are consumed and lost when every spawn square is occupied.
  - A noise token placed or exposed in hero LOS reveals immediately. Models revealed during the end-of-turn replenishment cannot activate until the next Skaven turn.
- Solo AI:
  - Privately knows noise identities.
  - Reveals a token at the opening of the Skaven turn when at least one resulting model can move into melee and attack that turn.
  - Places models to maximize immediate attacks, activates models nearest to a reachable hero first, follows shortest legal paths, turns toward a target, and attacks whenever possible.
  - Uses Rat Ogor door-smashing and Gutter Runner movement rules where advantageous.
  - Uses fresh randomness for equally scored placements, paths, activation order, and targets; production games are intentionally not replayable.
- Mission resolution:
  - Destroy nests through the normal 2-Action interaction or Malakai’s charge.
  - The south exit behaves as a wall until all three nests are destroyed.
  - Moving a surviving hero onto the opened exit immediately wins.
  - All selected heroes dying immediately wins for Skaven.
  - If victory has not occurred when Hero Turn 8 ends, Skaven win immediately without another Skaven turn.

## Architecture and Interfaces

- Implement a framework-free, immutable game engine independent of Canvas and DOM:
  - `MissionDefinition` and `EntityDefinition` contain static map, roster, stats, abilities, noise bag, and victory configuration.
  - `GameState` contains setup status, mode, round/phase, Command, map feature state, entities, concealed noise, remaining bag, activations, ability usage, charge/ward/guard markers, and any pending player choice.
  - `GameCommand` is a discriminated union for deployment, activation, movement paths, facing, attacks, interactions, abilities, reactions, noise operations, and phase completion.
  - `GameEvent` reports rolls, movement, wounds, reveals, deaths, rule effects, and victory for the UI log.
  - `resolveCommand(state, command, randomSource)` returns the next state and events without mutating the input.
  - Invalid commands throw a typed rules error and never partially update state.
- Inject `RandomSource` into combat, bag draws, and AI choices. Production uses browser randomness; tests use fixed sequences.
- Expose separate hero/public and Skaven views of internal state. Concealed identities must be absent—not merely visually hidden—from hero-side Canvas and DOM view models.
- Have solo AI generate ordinary `GameCommand` values through the same validation path as human input.
- Keep the v1 session in memory. Do not write game state to `DataStore` or `localStorage`; leave `DataRecord` unchanged until persistence is intentionally designed.
- Keep mission rules, pathfinding, LOS, combat, abilities, AI, Canvas geometry, and UI orchestration separated so later missions and persistence do not require rewriting the engine.

## Canvas and HTML Experience

- Render the map at device-pixel-ratio resolution with simple colored tiles, doors, nests, spawn/exit markers, face-down noise tokens, and labeled model discs with facing arrows, wounds, Guard, Ward, and activation status.
- Scale the whole 13×19 board to the available desktop/tablet area. Use a side control panel on wide screens and a bottom panel on narrower tablet layouts.
- Use Canvas for rendering, selection, legal-square highlighting, paths, and hit-testing; use semantic HTML for setup, action buttons, ability choices, dice results, phase status, and an `aria-live` event log.
- Require explicit confirmation for ending an activation early, ending a phase, detonating a charge, restarting, or abandoning a game. Do not provide undo.
- Add full-screen role-handoff covers before private Skaven setup, each side change, and any mid-turn hero-only reaction. Never reveal concealed token identities in hero-side status text or accessibility output.
- Cache every new compiled module through the existing service-worker resource configuration. Use no new runtime dependencies or image assets.

## Test Plan and Acceptance

- Write failing tests before each rules slice, covering:
  - Map parsing, exit insertion, feature counts, deployment, terrain, occupancy, pathfinding, strict-corner LOS, range, facing, and front arcs.
  - Legal and illegal action costs, activation order, Guard interruption, doors, nest destruction, Command accumulation, and phase/round transitions.
  - Fight outcomes, wounds/death, every hero and Skaven ability, reroll timing, Ward, charge placement/detonation, and Rat Ogor damage.
  - Noise bag depletion, private identity projection, spawn loss, nearest-square group placement, forced/optional reveal, LOS avoidance, and replenishment timing.
  - Every victory/loss condition for rosters of 1 through 5 heroes.
  - AI commands remaining legal under blocked paths and crowded boards, with deterministic test randomness despite fresh production randomness.
  - Transactionality: rejected commands leave the prior state unchanged and produce visible errors.
- Add engine-level integration scenarios for a complete solo round, complete two-player round, Hero Turn 8 timeout, hero elimination, and successful nest destruction plus exit.
- Manually verify at `http://localhost:8140`:
  - Mouse and touch interactions at desktop and tablet widths.
  - Pass-device privacy and absence of concealed identities from hero-side DOM.
  - Canvas sharpness, legal-target highlighting, reaction prompts, restart confirmations, and complete games in both modes.
  - Offline startup after initial caching and no console errors.
- Finish with `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and a production build.

### Explicit Defaults

- Gotrek’s Axe checks the target’s printed maximum Wounds, not its current remaining Wounds.
- Models and noise cannot pass through occupied squares except for the Gutter Runner’s stated Clanrat exception.
- Each die may be rerolled at most once; multiple valid reroll abilities may affect different dice in the same fight.
- A blocked or exhausted draw creates no replacement token.
- Refreshing or closing the page loses the v1 game.
