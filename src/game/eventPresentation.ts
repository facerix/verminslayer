import {
  getSkavenModelIdentifier,
  HERO_DEFINITIONS,
  SKAVEN_DEFINITIONS,
} from '/src/game/entities.js';
import type { GameEvent } from '/src/game/gameState.js';
import type { NoiseResultId } from '/src/game/missionDefinition.js';

export interface ImportantEventPresentation {
  readonly title: string;
  readonly detail: string;
}

const NOISE_NAMES: Readonly<Record<NoiseResultId, string>> = {
  'two-clanrats': 'Two Clanrats',
  'three-clanrats': 'Three Clanrats',
  'gutter-runner': 'Gutter Runner',
  'rat-ogor': 'Rat Ogor',
  nothing: 'Nothing',
};

// Routine bookkeeping must not overwrite the latest public result. Add new
// mission events (nest destruction, victory, etc.) here as they are implemented.
export const latestImportantEvent = (
  events: readonly GameEvent[]
): ImportantEventPresentation | null => {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]!;
    if (event.type === 'noise-revealed') {
      return {
        title: `Noise revealed: ${NOISE_NAMES[event.resultId]}`,
        detail: `At row ${event.position.row + 1}, column ${event.position.column + 1}.${event.resultId === 'nothing' ? ' The token is removed.' : ''}`,
      };
    }
    if (event.type !== 'fight-rolled') continue;
    const hero = HERO_DEFINITIONS[event.heroId].name;
    const skaven = `${SKAVEN_DEFINITIONS[event.skavenDefinitionId].name} #${getSkavenModelIdentifier(event.skavenId)}`;
    const loserId = event.outcome === 'hero-won' ? event.skavenId : event.heroId;
    const loserFaction = event.outcome === 'hero-won' ? 'skaven' : 'hero';
    // Only associate wounds/deaths up to the next fight in a batched AI turn.
    const following = events.slice(index + 1);
    const nextFight = following.findIndex(candidate => candidate.type === 'fight-rolled');
    const effects = nextFight < 0 ? following : following.slice(0, nextFight);
    const defeated = effects.some(
      candidate =>
        candidate.type === 'model-defeated' &&
        candidate.modelId === loserId &&
        candidate.faction === loserFaction
    );
    const loser = event.outcome === 'hero-won' ? skaven : hero;
    const outcome =
      event.outcome === 'tie'
        ? 'Tie; no Wound.'
        : `${loser} suffers 1 Wound.${defeated ? ` ${loser} is defeated.` : ''}`;
    return {
      title:
        event.outcome === 'tie'
          ? 'Fight tied'
          : `${event.outcome === 'hero-won' ? hero : skaven} wins`,
      detail: `${hero} [${event.heroRolls.join(', ')}] · ${skaven} [${event.skavenRolls.join(', ')}]. ${outcome}`,
    };
  }
  return null;
};
