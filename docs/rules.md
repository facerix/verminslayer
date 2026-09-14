# Verminslayer: Current Playtest Rules

This document is the authoritative current playtest rules specification. Use it to playtest
the game, identify problems, and iterate on the rules before they are translated into the
physical Verminslayer board game. It is deliberately a living document; see
[`mvp-progress.md`](mvp-progress.md) for the subset currently enforced by the digital prototype.

### HERO TURN

- Set the shared pool to 2 Command. Unused Command from the previous round is lost.
- Each hero activates once, in any order. An activation provides one Movement and 2 Actions.
- A hero may split its Movement before, between, and after its Actions.

### SKAVEN TURN

- Optionally reveal any noise tokens already in play. Those Skaven can act this turn.
- Activate every revealed Skaven once, in any order. Each gets one Movement and 1 Action.
- A Skaven Action is normally Fight. A Clanrat may instead use it to open or close an
  adjacent door. A Rat Ogor's Smash lets it destroy a closed door during movement.
- Move each noise token up to 5 spaces. Noise receives Movement only and no Action.

### NOISE

- Face-down and hidden from the Hero player.
- A noise token cannot enter a square in any hero's line of sight and reveals when seen.
- Noise tokens cannot share a square. A drawn result is consumed without placing a token
  when every spawn square is occupied.

During setup, after every hero is deployed, draw three noise results without replacement.
Place each result face down on an empty Skaven spawn before drawing the next. In a
two-player game, only the Skaven player sees each identity; in a solo game, the Skaven AI
chooses the spawn without showing the identity. A token placed in a hero's line of sight
reveals immediately. After all three draws are resolved, Hero Turn 1 begins and the heroes
set the shared pool to 2 Command.

### COMMAND

Command is a shared reserve. Unused Command remains available through the Skaven turn, then
disappears when the next Hero turn resets the pool to 2.

- **Push — 1 Command:** The currently active hero gains 1 additional Action. A hero may only
  be Pushed once per activation.
- **React — 2 Command:** During the Skaven turn, after a revealed enemy completes its
  Movement, one hero may immediately perform one action that normally costs exactly 1 Action.
  React cannot be used for Dash, Guard, or a mission action.

### ACTIONS

| Action         |       Cost | Effect                                                                    |
| -------------- | ---------: | ------------------------------------------------------------------------- |
| Fight          |   1 Action | Make a melee attack.                                                      |
| Door           |   1 Action | Open or close an adjacent door.                                           |
| Guard          |   1 Action | Enter Guard; this must be the hero's final Action.                        |
| Dash           |   1 Action | Add the hero's Move value to its remaining Movement; once per activation. |
| Hero ability   |    As card | Use the named ability.                                                    |
| Mission action | As mission | Resolve the named mission effect.                                         |

### MOVE / FACING

- Models move orthogonally and cannot move through or finish on another model's square.
  Gutter Runners are the exception described by Skitter.
- Heroes cannot move through or finish on an intact nest. Skaven can move through and finish
  on nests. Once destroyed, a nest no longer blocks hero movement.
- A hero receives Movement equal to its Move value when it activates. It may spend that
  allowance in any number of segments before, between, and after Actions. Dash adds its Move
  value to the same remaining allowance.
- Once per activation, including across Dash movement, a hero may change facing to any
  direction during a Movement segment. Moving 0 and changing facing is legal.
- A Skaven may follow any legal path up to its Move value and change facing once during that
  Movement. Moving 0 and changing facing is legal.
- Facing is north, east, south, or west. A model's Front Arc is the three adjacent squares
  on its facing side.
- Models do not turn automatically when attacking or defending.

### DISTANCE / ADJACENCY / LINE OF SIGHT

- Adjacency, melee, Front Arcs, and deployment proximity include diagonals.
- Ranged and proximity distances use the greater of the horizontal and vertical distance
  between two squares (Chebyshev distance).
- Line of sight is traced between square centers using every square touched by the ray.
  Walls, rubble, and closed doors block line of sight, including when the ray touches the
  corner between blocking terrain. Models, nests, water, and open or destroyed doors do
  not block line of sight.

### TERRAIN

- Walls and rubble block movement and line of sight.
- Water blocks movement but not line of sight.
- Closed doors block movement and line of sight. Open or destroyed doors block neither.
- Intact nests block hero movement but not Skaven movement or line of sight. Destroyed nests
  do not block movement or line of sight.

### FIGHT

- Roll Fight dice: Highest die wins.
- Tie = nothing. Loser suffers 1 Wound.

### GUARD

- Guard costs 1 Action and must be the hero's final Action.
- Place a Guard marker beside the hero.
- The first time an enemy enters an adjacent square in the hero's Front Arc, the hero
  immediately makes a free Fight against that enemy before it continues its activation.
- Then discard the Guard marker. Guard is also lost when that hero next activates.

## Hero Cards

----------
### GOTREK GURNISSON

**Move 3 · Fight 3 · Wounds 3**

**Axe of Grimnir** — Gotrek rolls +1 Fight die against an enemy with 2+ Wounds.

**Slayer’s Fury** — Once per activation, after Gotrek defeats an enemy, he may immediately move 1 square or attack another adjacent enemy.

----------
### FELIX JAEGER

**Move 5 · Fight 2 · Wounds 2**

**Karaghul** — Once per round, Felix may reroll one of his Fight dice.

**Rememberer** — Once per round, a hero within 4 squares of Felix may reroll one Fight die.

----------
### SNORRI NOSEBITER

**Move 3 · Fight 2 · Wounds 3**

**Two-Fisted** — When Snorri defeats a Clanrat, he may immediately attack one other adjacent Clanrat.

**Snorri’s Not Dead! [Once per mission]** — When Snorri would suffer his last Wound, leave him with 1 Wound instead.

----------
### ULRIKA MAGDOVA

**Move 5 · Fight 2 · Wounds 2**

**Kislevite Bow  [1 Action]** — Attack an enemy in line of sight within 5 squares. Roll 2 dice; the target rolls its normal Fight dice.

**Hunter’s Step** — After making a ranged attack, Ulrika may move 1 square for free.

----------
### MAXIMILIAN SCHREIBER

**Move 4 · Fight 1 · Wounds 2**

**Arcane Bolt [2 Actions]** — Choose an enemy within 5 squares and line of sight. Roll 3 Fight dice against it.

**Ward [1 Action]** — Place a Ward token on a hero within 3 squares. The next time that hero loses a Fight, discard the Ward to reroll their Fight dice.

  

----------
### MALAKAI MAKAISSON

**Move 3 · Fight 2 · Wounds 2**

**Repeater Handgun [2 Actions]** — Choose up to 3 different enemies in line of sight within 5 squares. Roll 1 Fight die against each.

**Demolition Charge [Once per mission]** — Spend 1 Action while adjacent to a door or objective feature to place a Charge. Malakai may detonate it at any time during a Hero turn. Destroy the feature and make a 3-die attack against every enemy adjacent to it.

----------

  

## Skaven Cards

----------
### CLANRAT

**Move 4 · Fight 1 · Wounds 1**

**Strength in Numbers** — Roll +1 Fight die for each other Clanrat adjacent to the same hero, to a maximum of 3 Fight dice.

----------
### GUTTER RUNNER

**Move 6 · Fight 2 · Wounds 1**

**Skitter** — May move through spaces occupied by Clanrats, but may not end its move there.

**Backstab** — When attacking a hero from the rear, roll +1 Fight die.

----------
### RAT OGOR

**Move 3 · Fight 3 · Wounds 2**

**Brute Strength** — When a Rat Ogor wins a Fight, the hero suffers 2 Wounds instead of 1.

**Smash** — A Rat Ogor may move through a closed door; destroy the door as it does so.

----------
### NOISE

Move 5 toward the nearest hero; cannot enter hero LOS.

----------

  

## Missions

### THE NEST

**Heroes**: 1–5 unique heroes selected from all six; Gotrek and Felix are selected by default
**Skaven**: Clanrats, Gutter Runners, Rat Ogor (starting noise: 3, +2 each turn)  
**Length**: maximum 8 rounds  
**First turn**: Heroes

The heroes have discovered a breeding complex beneath the city. There are three Nest markers. Destroy them, then get somebody out alive.

Destroy a Nest by having a hero adjacent to it spend 2 Actions.

#### Hero victory

The heroes win if, before the end of Hero Turn 8:
1.  all three Nests have been destroyed, and
2.  at least one surviving hero exits through the Watch Post after the third Nest is destroyed.
    

#### Skaven victory

The Skaven win if all selected heroes are slain, or if the heroes have not fulfilled their victory condition by the end of Hero Turn 8.

#### Board conventions

- Map coordinates are written as row, column, starting at 1 in the northwest corner. The
  map is 19 rows by 13 columns.
- During setup, place each selected hero on `@` or an empty, passable adjacent square, with
  a chosen facing.
- `E` at row 19, column 2 is the Watch Post exit. It behaves as a wall until all three
  nests are destroyed. A surviving hero who moves onto the opened exit wins immediately.

#### Map

2x3 tiles, 5x5 squares each:

```
##########S##
#..#..#.....#
#.N#..+.....#
#..#..#..N:.#
#.....#...:.#
#.##..#.:...#
####+##+#####
#.....#.~~~~#
#.~~~.#.....S
#.~~~.#.~...#
S.~~~.+.~...#
#.N...#.~...#
#####+####+##
#.....#~~...#
#.::..+....~#
#.:...#.~~.~#
#..@..#....~#
#.....#~~~~~#
#E###########
```

##### Key to symbols:

- `#` – wall
- `+` – door
- `~` – water
- `:` – rubble
- `@` – Player starting position
- `S` – Skaven spawn point
- `N` – Skaven nest
- `E` – Watch Post exit (locked until all three nests are destroyed)

#### Noise bag

| Model(s)      | Quantity |
| ------------- | -------- |
| 2 Clanrats    | x8       |
| 3 Clanrats    | x4       |
| Gutter Runner | x2       |
| Rat Ogor      | x1       |
| Nothing       | x5       |
