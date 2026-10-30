import type { MissionDefinition } from '/src/game/missionDefinition.js';
import { RulesError } from '/src/game/rulesError.js';
import { THE_NEST } from '/src/game/missions/theNest.js';
import { THE_UNDERBURROW } from '/src/game/missions/theUnderburrow.js';

export const MISSIONS: Readonly<Record<string, MissionDefinition>> = Object.freeze({
  [THE_NEST.id]: THE_NEST,
  [THE_UNDERBURROW.id]: THE_UNDERBURROW,
});

export const getMissionDefinition = (missionId: string): MissionDefinition => {
  const mission = MISSIONS[missionId];
  if (!mission) {
    throw new RulesError('UNKNOWN_MISSION', `Unknown mission ${missionId}`);
  }
  return mission;
};
