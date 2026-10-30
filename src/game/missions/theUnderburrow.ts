import { parseMap } from '/src/game/map.js';
import { ALL_HERO_IDS } from '/src/game/entities.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { repeat } from '/src/utils.js';

export const THE_UNDERBURROW_MAP = `##########S##
#..#..#.....#
#.N#..+.....#
#..#..#..N:.#
#.....#...:.#
#.##..#.:...#
####+##+#####
#.....#.~~~~#
#.~~~.#.....S
#N~~~.#.~...#
S.~~~.+.~...#
#.....#.~...#
#####+####+##
#.....#~~...#
#.::..+....~#
#.:...#.~~.~#
#..@..#....~#
#.....#~~~~~#
#E###########`;

const board = parseMap(THE_UNDERBURROW_MAP, {
  width: 13,
  height: 19,
  required: {
    nest: 3,
    spawn: 3,
    deployment: 1,
    exit: 1,
  },
});

export const THE_UNDERBURROW: MissionDefinition = Object.freeze({
  id: 'the-underburrow',
  name: 'The Underburrow',
  board,
  roundLimit: 8,
  firstPhase: 'hero',
  allowedHeroes: ALL_HERO_IDS,
  skavenTypes: Object.freeze(['clanrat', 'gutter-runner', 'rat-ogor'] as const),
  initialNoiseCount: 3,
  noisePerTurn: 2,
  noiseResults: Object.freeze({
    'two-clanrats': Object.freeze({
      id: 'two-clanrats',
      models: Object.freeze(['clanrat', 'clanrat'] as const),
    }),
    'three-clanrats': Object.freeze({
      id: 'three-clanrats',
      models: Object.freeze(['clanrat', 'clanrat', 'clanrat'] as const),
    }),
    'gutter-runner': Object.freeze({
      id: 'gutter-runner',
      models: Object.freeze(['gutter-runner'] as const),
    }),
    'rat-ogor': Object.freeze({
      id: 'rat-ogor',
      models: Object.freeze(['rat-ogor'] as const),
    }),
    nothing: Object.freeze({ id: 'nothing', models: Object.freeze([]) }),
  }),
  noiseBag: Object.freeze([
    ...repeat<NoiseResultId>('two-clanrats', 8),
    ...repeat<NoiseResultId>('three-clanrats', 4),
    ...repeat<NoiseResultId>('gutter-runner', 2),
    ...repeat<NoiseResultId>('rat-ogor', 1),
    ...repeat<NoiseResultId>('nothing', 5),
  ]),
});
