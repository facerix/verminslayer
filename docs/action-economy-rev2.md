## Decision: change a hero activation to: Movement + 2 Actions

**Accepted for the current rules and prototype on 2026-09-13.** The playable Hero-turn
slice enforces split Movement, two Actions, Dash, and Push. React, Guard, card abilities,
mission actions, and the matching Skaven economy remain rules-specified until their owning
prototype slices are implemented.

Every hero gets **one Movement** and **two Actions** when activated.

**Movement:** Move up to your Move value. You may split this movement before, between, and after your Actions. Once during that movement, you may change facing to any direction. Moving 0 and changing facing is legal.

Then the action menu becomes:

| Action             |        Cost | Effect                                          |
| ------------------ | ----------: | ----------------------------------------------- |
| **Fight**          |    1 Action | Make a melee attack                             |
| **Door**           |    1 Action | Open or close an adjacent door                  |
| **Guard**          |    1 Action | Enter Guard; must be your final Action          |
| **Dash**           |    1 Action | Move up to your Move again; once per activation |
| **Hero ability**   |     As card | Bow, spell, repeater, Ward, etc.                |
| **Mission action** | As scenario | e.g. Burn Nest = 2 Actions                      |

That immediately feels more like the game we've been converging on.

Felix could move 2 spaces to a door, spend an Action to open it, use his remaining 3 movement to go through, then Fight. Gotrek could lumber 3 spaces and Fight twice. Max could move 4 and spend both Actions casting Arcane Bolt. A hero who absolutely needs to get somewhere can **Dash**, but even Felix tops out at 10 spaces rather than 20.

And Dash now means exactly what you suggested: *I sacrifice something useful this turn in order to double my movement.*

I particularly like what it does to **Burn Nest — 2 Actions**. A hero can move up to the Nest and destroy it in the same activation, but that's *all they're doing*. They can't Fight or Guard afterward. That produces the decision we wanted without having to count AP spent walking there.

It also makes our Move stats much more meaningful. Gotrek/Snorri at 3 genuinely feel slow; Max/Clanrats at 4 are normal; Felix/Ulrika at 5 are agile; the Gutter Runner at 6 is alarmingly quick.

### Skaven can use the same grammar, only simpler

In fact, we'd already halfway invented this system for them.

A revealed Skaven gets:

**one Movement + one Action.**

Its Action is usually Fight. A Clanrat can instead spend it opening a Door. A Rat Ogor doesn't even need that because Smash lets it burst through one.

Noise normally has **Movement only**. It moves up to 5 by a shortest legal route toward the
nearest hero and reveals when it enters hero line of sight or adjacency. If it reveals during
that activation, the movement already spent becomes the revealed models' Movement; each may
then take one Action but cannot Move again that turn. Noise never reveals voluntarily.

The door exception is specified in [`rules.md`](rules.md): plan routes through closed doors
even when an open detour exists, but stop before the first closed door. If Noise begins
adjacent to that blocking door, Clanrats / Gutter Runner open it, Rat Ogor Noise destroys it,
and Nothing cannot open it. This ends the activation, even if the door change forces that
Noise to reveal; those models get no Movement or Actions that turn.

So both players understand the same basic concept:

> **Movement tells you how far the model can go. Actions tell you what it can accomplish when it gets there.**

Heroes simply have two Actions because they're protagonists with interesting options; ordinary Skaven have one.

That's significantly easier to teach than two completely different action economies.

## And I think this tells us what Command should be

I wouldn't eliminate Command *yet*. But I agree that our previous implementation was vestigial: “you get 3 Command because Space Hulk has Command Points” isn't sufficient reason for a resource to exist.

In actual *Space Hulk*, Command Points do two particularly interesting things: they let Marines exceed their normal action allowance, **and they let Marines act out of sequence during the Genestealer turn**. ([RulesPal][2]) That's the part worth stealing.

I'd reduce ours to **2 Command per Hero turn**, and give Command exactly two uses:

> **1 Command — PUSH**
> The currently active hero gains **1 additional Action**. A hero may only be Pushed once per activation.
>
> **2 Command — REACT**
> During the Skaven turn, after a revealed enemy completes its movement, one hero may immediately perform **one 1-Action action**.

Unused Command disappears when the next Hero turn begins.

That's the entire subsystem.

And those two choices genuinely compete.

Suppose you've got your two Command tokens. You can spend them during your turn to let Max cast **Arcane Bolt + Ward**, let Felix **Fight + Fight + Guard**, or let someone open a door without sacrificing one of their other two actions.

Or you keep both tokens.

Now, during the Skaven turn, a Gutter Runner comes tearing around the corner toward Ulrika. You can cash in the whole reserve and let her immediately fire her bow. Or Valius can Fight. Or Toll can slam shut an adjacent door before the next rats arrive.

**That's why the resource exists.**

I'd prohibit React from being used for Dash, Guard, or mission actions. It's for immediate one-action things—Fight, Door, a 1-Action shot, and similar card abilities.

And notice the lovely tension: **spending Command aggressively on your own turn means giving up your emergency button during the Skaven turn.**

That's much more interesting than “here are three extra AP.”

It also gives Toll an extremely obvious leadership ability:

> **MASTER OF THE HUNT —** Begin each Hero turn with **3 Command instead of 2**.

Now Toll isn't merely carrying a legacy Space Hulk rule around on his card. His extra point matters. His party can Push someone *and* retain enough Command for a reaction.

Felix's old **Rememberer** ability is the one card I'd rewrite, since it currently spends Command to grant a reroll and we've now found a more important job for the resource. I'd simply make it:

> **REMEMBERER —** Once per round, a hero within 4 spaces may reroll one Fight die.

No Command cost.

### This also cleans up Guard

Our previous Guard cost 2 AP out of a 4-AP budget: half an activation. In the new system, **1 of 2 Actions** is also half an activation.

So we haven't really changed its price.

A standard activation can now look like:

> Move → Fight → **Guard**

or

> Move → Door → **Guard**

or

> Move → Fight → Fight

or

> **Dash** → Move some more → Fight

or, for the mission,

> Move → **Burn Nest (2 Actions)**

Those are immediately comprehensible little turns. I like that much better than deciding whether each of four AP becomes a Move/Fight/Door/Guard and then multiplying each Move by the character's movement stat.

There is also a subtle benefit to **Guard being an Action rather than a stance purchased with arbitrary AP**: ending an activation on Guard now becomes a very natural thing to do. You don't need the old wording about Guard disappearing if you perform another action. Just say:

> **GUARD — 1 Action. This must be your final Action.**

Then use the reaction rule we've already written.

### My prototype recommendation

I'd make this change now, rather than testing the 4-AP version first. The four-AP/full-Move combination has a structural problem we already understand; we don't need a playtest to tell us Felix shouldn't sprint the length of the whole Nest four times in six seconds.

The resulting economy has a nice three-layer structure:

**Movement** is predictable and personal to the model.
**Actions** are the two meaningful things a hero accomplishes.
**Command** is a tiny shared reserve for breaking the normal rules when something goes wrong.

And importantly, each layer answers a different question:

**Move:** *Where can I get?*
**Actions:** *What can I do there?*
**Command:** *Where do we desperately need a little more than we're normally allowed?*

That last sentence is, for me, the test of whether Command has earned its place. With **2 Command and the Push-vs-React decision**, I think it finally has. If playtesting shows that players always just spend both points on Push and never seriously consider holding them for React, *then* I'd cut Command entirely rather than adding more uses to prop it up.

[1]: https://www.scribd.com/doc/85876529/Space-Hulk-3rd-Edition-Rulebook?utm_source=chatgpt.com "Space Hulk Board Game Overview | PDF | Cannon | United States Marine Corps"
[2]: https://www.rulespal.com/space-hulk-third-edition/rulebook?utm_source=chatgpt.com "Space Hulk (Third Edition) Rulebook | RulesPal"
