import { parseMap } from '/src/game/map.js';

export const THE_NEST_MAP = `##########S##
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
#E###########`;

const board = parseMap(THE_NEST_MAP, {
  width: 13,
  height: 19,
  required: {
    door: 6,
    nest: 3,
    spawn: 3,
    deployment: 1,
    exit: 1,
  },
});

export const THE_NEST = Object.freeze({
  id: 'the-nest',
  name: 'The Nest',
  board,
  roundLimit: 8,
});
