# Verminslayer: Current Playtest Rules

This document is the current rules specification implemented by the digital prototype.
Use it to playtest the game, identify problems, and iterate on the rules before they are
translated into the physical Verminslayer board game. It is deliberately a living document;
the digital implementation may change as playtesting reveals better choices.

### HERO TURN
-   Gain 3 Command.
-   Each hero activates once with 4 Actions.
    

### SKAVEN TURN
-   Optionally reveal any noise tokens already in play. Those Skaven can act this turn.
-   Activate every revealed Skaven once, in any order: move, then optionally fight
-   Move noise 5

### NOISE
-   Face-down and hidden.
-   Cannot enter hero LOS.
-   Reveal when seen.

### ACTIONS
-   Move — 1A
-   Fight — 1A
-   Interact (e.g. open/close a door) — 1A
-   Guard — 2A
    

### MOVE / FACING
-   When a model takes a Move action, it may move up to its Move allowance. Once during that movement, it may change its facing to any direction. It may move 0.
-   Models do not turn automatically when attacking or defending.

### FIGHT
-   Roll Fight dice: Highest die wins.
-   Tie = nothing. Loser suffers 1 Wound.
    

### GUARD
-   Place a Guard marker beside the hero.
-   The first time an enemy enters an adjacent square in the hero’s Front Arc, the hero immediately makes a free Fight against that enemy, before it continues its activation.
-   Then discard the Guard marker.
-   Guard is also lost if the hero performs another action, or when that hero next activates.
    

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

**Rememberer** — Once per round, Felix may spend 1 Command to let a hero within 4 squares reroll one die.

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

**Heroes**: 2 characters only: Gotrek and Felix
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

The Skaven win if all five heroes are slain, or if the heroes have not fulfilled their victory condition by the end of Hero Turn 8.

#### Map

2x3 tiles, 5x5 squares each:

```
##########S##
#..#..#.....#
#.N#..+.....#
#..#..#..N:.#
#.....#...:.#
#.##..#.:...#
#######+#####
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
#############
```

##### Key to symbols:

- `#` – wall
- `+` – door
- `~` – water
- `:` – rubble
- `@` – Player starting position
- `S` – Skaven spawn point
- `N` – Skaven nest

#### Noise bag

| Model(s)    | Quantity |
|---------------|----|
| 2 Clanrats    | x8 |
| 3 Clanrats    | x4 |
| Gutter Runner | x2 |
| Rat Ogor      | x1 |
| Nothing       | x5 |
