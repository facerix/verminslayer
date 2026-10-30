import { parseMap } from '/src/game/map.js';
import { THE_UNDERBURROW } from '/src/game/missions/theUnderburrow.js';
import type { MissionDefinition, NoiseResultId } from '/src/game/missionDefinition.js';
import { repeat } from '/src/utils.js';

// Four compact rooms: the heroes enter in the southwest and clear one nest in the northwest.
export const THE_NEST_MAP = `##########S##
#.....#.....#
#.....+.....#
S.....#..N..#
#.....#.....#
#.....#.....#
##+####+#####
#.....#.....#
#.....+.....#
#..@..#.....#
#.....#.....#
#.....#.....#
#########E###`;

const board = parseMap(THE_NEST_MAP, {
  width: 13,
  height: 13,
  required: { nest: 1, spawn: 2, deployment: 1, exit: 1 },
});

export const THE_NEST: MissionDefinition = Object.freeze({
  id: 'the-nest',
  name: 'The Nest',
  board,
  roundLimit: 6,
  firstPhase: 'hero',
  allowedHeroes: Object.freeze(['gotrek', 'felix'] as const),
  fixedHeroes: Object.freeze(['gotrek', 'felix'] as const),
  skavenTypes: Object.freeze(['clanrat'] as const),
  initialNoiseCount: 2,
  noisePerTurn: 1,
  noiseResults: THE_UNDERBURROW.noiseResults,
  noiseBag: Object.freeze([
    ...repeat<NoiseResultId>('three-clanrats', 1),
    ...repeat<NoiseResultId>('two-clanrats', 5),
    ...repeat<NoiseResultId>('nothing', 2),
  ]),
});
