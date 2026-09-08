import { parseMap } from '/src/game/map.js';
import { ALL_HERO_IDS } from '/src/game/entities.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';

export const THE_NEST_MAP = `##########S##
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
#E###########`;

const board = parseMap(THE_NEST_MAP, {
  width: 13,
  height: 19,
  required: {
    door: 7,
    nest: 3,
    spawn: 3,
    deployment: 1,
    exit: 1,
  },
});

const repeat = (id: NoiseResultId, count: number): readonly NoiseResultId[] =>
  Object.freeze(Array<NoiseResultId>(count).fill(id));

export const THE_NEST: MissionDefinition = Object.freeze({
  id: 'the-nest',
  name: 'The Nest',
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
    ...repeat('two-clanrats', 8),
    ...repeat('three-clanrats', 4),
    ...repeat('gutter-runner', 2),
    ...repeat('rat-ogor', 1),
    ...repeat('nothing', 5),
  ]),
});
