import { h } from '/src/domUtils.js';
import {
  ALL_HERO_IDS,
  getSkavenModelIdentifier,
  HERO_DEFINITIONS,
  SKAVEN_DEFINITIONS,
} from '/src/game/entities.js';
import type { HeroId } from '/src/game/entities.js';
import type {
  Facing,
  GameCommand,
  GameEvent,
  GameMode,
  HeroGameView,
  SkavenGameView,
} from '/src/game/gameState.js';
import type { Position } from '/src/game/map.js';
import type { NoiseResultId } from '/src/game/missionDefinition.js';

const STYLES = `
  :host {
    display: block;
  }

  h2,
  h3,
  p {
    margin-top: 0;
  }

  h2,
  h3,
  legend {
    font-family: 'Arial Black', 'Arial Bold', Gadget, sans-serif;
    font-variant: common-ligatures small-caps;
  }

  p,
  .help,
  .hero-stats {
    color: var(--muted-color, #b9aa98);
    line-height: 1.45;
  }

  .eyebrow {
    margin-bottom: 0.45rem;
    color: var(--accent-color, #d4552e);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  form,
  .deployment,
  .complete {
    display: grid;
    gap: 1.15rem;
  }

  fieldset {
    display: grid;
    gap: 0.65rem;
    padding: 0;
    border: 0;
    margin: 0;
  }

  legend {
    margin-bottom: 0.65rem;
    font-size: 1rem;
  }

  label {
    cursor: pointer;
  }

  .mode-option,
  .hero-option {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.65rem;
    align-items: start;
    padding: 0.55rem 0.65rem;
    border: 1px solid #4f4135;
    border-radius: 0.35rem;
    background: #231d19;
  }

  .mode-option input,
  .hero-option input {
    grid-row: 1 / 3;
    margin-top: 0.2rem;
    accent-color: var(--accent-color, #d4552e);
  }

  .hero-name {
    font-weight: 700;
  }

  .hero-stats {
    font-size: 0.76rem;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.55rem;
  }

  button,
  select {
    min-height: 2.6rem;
    border: 1px solid #7a6552;
    border-radius: 0.35rem;
    color: #e6ddce;
    background: #231d19;
    font: inherit;
  }

  button {
    padding: 0.55rem 1rem;
    border-color: var(--accent-color, #d4552e);
    cursor: pointer;
    font-weight: 700;
  }

  button:hover,
  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent-color, #d4552e);
    outline-offset: 2px;
  }

  .deployment-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .deployment-controls label {
    display: grid;
    gap: 0.35rem;
    color: var(--muted-color, #b9aa98);
    font-size: 0.78rem;
  }

  .roster {
    display: grid;
    gap: 0.4rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .roster li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid #4f4135;
  }

  .placed {
    color: #9dc58c;
  }

  .waiting {
    color: var(--muted-color, #b9aa98);
  }

  .callout {
    padding: 0.9rem;
    border-left: 3px solid #d9a849;
    background: #231d19;
  }

  .turn-status,
  .activation-card {
    display: grid;
    gap: 0.75rem;
  }

  .turn-facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    margin: 0;
  }

  .turn-facts div {
    padding: 0.65rem;
    border-left: 2px solid var(--accent-color, #d4552e);
    background: #231d19;
  }

  .turn-facts dt {
    color: var(--muted-color, #b9aa98);
    font-size: 0.72rem;
  }

  .turn-facts dd {
    margin: 0.15rem 0 0;
    font-weight: 700;
  }

  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  .action-grid label {
    display: grid;
    grid-column: 1 / -1;
    gap: 0.35rem;
    color: var(--muted-color, #b9aa98);
    font-size: 0.78rem;
  }

  .combat-log {
    display: grid;
    gap: 0.45rem;
    padding-left: 1.25rem;
    color: var(--muted-color, #b9aa98);
    font-size: 0.82rem;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  confirmation-modal {
    --confirmation-primary: #d4552e;
    --confirmation-border: #7a6552;
    --confirmation-focus: #f08a63;
    --confirmation-bg: #e6ddce;
    --confirmation-header-bg: #d8c7a8;
  }

  .handoff {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-content: center;
    justify-items: center;
    padding: 2rem;
    background: #171310;
    text-align: center;
  }

  .handoff > * {
    width: min(100%, 32rem);
  }

  .private-result {
    padding: 1rem;
    border: 2px solid #d9a849;
    border-radius: 0.35rem;
    background: #171310;
    color: #f3d38b;
    font-size: 1.35rem;
    font-weight: 700;
    text-align: center;
  }

  .error {
    min-height: 1.4em;
    margin: 0;
    color: #ffab91;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 420px) {
    .hero-grid,
    .deployment-controls {
      grid-template-columns: 1fr;
    }
  }
`;

const modeOption = (value: GameMode, title: string, detail: string, checked: boolean) => {
  const input = h('input', { type: 'radio', name: 'mode', value, checked, required: true });
  return h('label', { className: 'mode-option' }, [
    input,
    h('span', { className: 'hero-name', textContent: title }),
    h('span', { className: 'hero-stats', textContent: detail }),
  ]);
};

const facingLabel = (facing: Facing) => facing[0]!.toUpperCase() + facing.slice(1);

type MoveSelection =
  | { readonly stage: 'destination'; readonly faction: 'hero' | 'skaven' }
  | {
      readonly stage: 'facing';
      readonly faction: 'hero' | 'skaven';
      readonly destination: Position;
    };

const NOISE_RESULT_NAMES: Readonly<Record<NoiseResultId, string>> = Object.freeze({
  'two-clanrats': 'Two Clanrats',
  'three-clanrats': 'Three Clanrats',
  'gutter-runner': 'Gutter Runner',
  'rat-ogor': 'Rat Ogor',
  nothing: 'Nothing',
});

export class GameSetup extends HTMLElement {
  #view: HeroGameView | null = null;
  #privateNoiseView: SkavenGameView | null = null;
  #error = '';
  #announcement = '';
  #moveSelection: MoveSelection | null = null;
  #skavenHandoffComplete = false;
  #reactHandoffComplete = false;
  #reactHandoffKey: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set view(view: HeroGameView) {
    if (this.#view?.phase !== 'skaven' && view.phase === 'skaven') {
      this.#skavenHandoffComplete = false;
    }
    const reactKey = view.pendingReact
      ? `${view.pendingReact.source}:${view.pendingReact.sourceId}`
      : null;
    if (reactKey !== this.#reactHandoffKey) {
      if (this.#reactHandoffKey && !reactKey && view.mode === 'two-player') {
        this.#skavenHandoffComplete = false;
      }
      this.#reactHandoffKey = reactKey;
      this.#reactHandoffComplete = false;
    }
    this.#view = view;
    this.#privateNoiseView = null;
    this.#error = '';
    this.#moveSelection = null;
    this.#render();
  }

  set privateNoiseView(view: SkavenGameView | null) {
    this.#privateNoiseView = view;
    this.#error = '';
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  deployAt(position: Position) {
    if (this.#view?.setupStep !== 'deploy-heroes') return;
    const heroSelect = this.shadowRoot?.querySelector<HTMLSelectElement>('#deploy-hero');
    const facingSelect = this.shadowRoot?.querySelector<HTMLSelectElement>('#deploy-facing');
    if (!heroSelect || !facingSelect) return;

    this.#dispatchCommand({
      type: 'deploy-hero',
      heroId: heroSelect.value as HeroId,
      position,
      facing: facingSelect.value as Facing,
    });
  }

  chooseMoveDestination() {
    this.#moveSelection = { stage: 'destination', faction: 'hero' };
    this.#render();
  }

  chooseMoveFacing(destination: Position) {
    this.#moveSelection = { stage: 'facing', faction: 'hero', destination };
    this.#render();
  }

  chooseSkavenMoveDestination() {
    this.#moveSelection = { stage: 'destination', faction: 'skaven' };
    this.#render();
  }

  chooseSkavenMoveFacing(destination: Position) {
    this.#moveSelection = { stage: 'facing', faction: 'skaven', destination };
    this.#render();
  }

  clearMoveSelection() {
    if (!this.#moveSelection) return;
    this.#moveSelection = null;
    this.#render();
  }

  showError(message: string) {
    this.#error = message;
    const error = this.shadowRoot?.querySelector('.error');
    if (error) error.textContent = message;
  }

  announce(events: readonly GameEvent[]) {
    const latest = events.at(-1);
    const reversedEvents = [...events].reverse();
    const reveal = reversedEvents.find(event => event.type === 'noise-revealed');
    const door = reversedEvents.find(
      event => event.type === 'door-opened' || event.type === 'door-closed'
    );
    const fight = reversedEvents.find(event => event.type === 'fight-rolled');
    const placement = reversedEvents.find(event => event.type === 'skaven-placed');
    if (fight?.type === 'fight-rolled') {
      const heroName = HERO_DEFINITIONS[fight.heroId].name;
      const outcome =
        fight.outcome === 'tie'
          ? 'The Fight was tied.'
          : fight.outcome === 'hero-won'
            ? `${heroName} won the Fight.`
            : 'The Skaven won the Fight.';
      this.#announcement = `${heroName} rolled ${fight.heroRolls.join(', ')}. The Skaven rolled ${fight.skavenRolls.join(', ')}. ${outcome}`;
    } else if (placement?.type === 'skaven-placed') {
      this.#announcement = `${SKAVEN_DEFINITIONS[placement.definitionId].name} placed at row ${placement.position.row + 1}, column ${placement.position.column + 1}, facing ${placement.facing}.`;
    } else if (reveal?.type === 'noise-revealed') {
      this.#announcement = `${NOISE_RESULT_NAMES[reveal.resultId]} revealed at row ${reveal.position.row + 1}, column ${reveal.position.column + 1}.`;
    } else if (door?.type === 'door-opened') {
      this.#announcement = `Door opened at row ${door.position.row + 1}, column ${door.position.column + 1}.`;
    } else if (door?.type === 'door-closed') {
      this.#announcement = `Door closed at row ${door.position.row + 1}, column ${door.position.column + 1}.`;
    } else if (latest?.type === 'hero-deployed') {
      const heroName = HERO_DEFINITIONS[latest.heroId].name;
      this.#announcement = `${heroName} deployed at row ${latest.position.row + 1}, column ${latest.position.column + 1}, facing ${latest.facing}.`;
    } else if (latest?.type === 'deployment-complete') {
      this.#announcement = 'Hero deployment complete. Initial noise setup is next.';
    } else if (latest?.type === 'hero-turn-started') {
      this.#announcement = `${latest.round === 1 ? 'Initial noise setup complete. ' : ''}Hero Turn ${latest.round} begins with ${latest.command} Command.`;
    } else if (latest?.type === 'noise-drawn') {
      this.#announcement = 'A private noise result was drawn.';
    } else if (latest?.type === 'noise-placed') {
      this.#announcement = `Noise placed at row ${latest.position.row + 1}, column ${latest.position.column + 1}.`;
    } else if (latest?.type === 'noise-revealed') {
      this.#announcement = `${NOISE_RESULT_NAMES[latest.resultId]} revealed at row ${latest.position.row + 1}, column ${latest.position.column + 1}.`;
    } else if (latest?.type === 'noise-draw-consumed') {
      this.#announcement = 'The noise draw was consumed because no spawn was available.';
    } else if (latest?.type === 'hero-activation-started') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} begins an activation with ${latest.movement} Movement and ${latest.actions} Actions.`;
    } else if (latest?.type === 'movement-spent') {
      const spaces = `${String(latest.spaces)} space${latest.spaces === 1 ? '' : 's'}`;
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} moved ${spaces}; ${latest.movementRemaining} Movement remains.`;
    } else if (latest?.type === 'hero-pushed') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} was Pushed and gains 1 Action; ${latest.commandRemaining} Command remains.`;
    } else if (latest?.type === 'action-spent') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} spent 1 Action to ${latest.action}; ${latest.actionsRemaining} Actions remain.`;
    } else if (latest?.type === 'hero-activation-ended') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} ended their activation.`;
    } else if (latest?.type === 'skaven-turn-started') {
      this.#announcement = `Hero phase complete. Skaven Turn ${latest.round} begins.`;
    } else if (latest?.type === 'skaven-activation-started') {
      const skaven = this.#view?.skaven.find(candidate => candidate.id === latest.skavenId);
      this.#announcement = `${skaven ? `${SKAVEN_DEFINITIONS[skaven.definitionId].name} #${getSkavenModelIdentifier(skaven.id)}` : 'Skaven'} begins an activation with ${latest.movement} Movement and ${latest.actions} Action.`;
    } else if (latest?.type === 'skaven-movement-completed') {
      this.#announcement = `${latest.skavenId} completed Movement after ${latest.spaces} space${latest.spaces === 1 ? '' : 's'}.`;
    } else if (latest?.type === 'skaven-action-spent') {
      this.#announcement = `${latest.skavenId} spent 1 Action to ${latest.action}.`;
    } else if (latest?.type === 'skaven-activation-ended') {
      this.#announcement = `${latest.skavenId} ended its activation.`;
    } else if (latest?.type === 'revealed-skaven-activations-complete') {
      this.#announcement = 'Every Skaven that began the turn revealed has activated.';
    } else if (latest?.type === 'react-window-opened') {
      this.#announcement = 'Enemy Movement complete. The Hero player may React.';
    } else if (latest?.type === 'react-skipped') {
      this.#announcement = 'The Hero player declined to React.';
    } else if (latest?.type === 'hero-reacted') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} Reacted with ${latest.action}; ${latest.commandRemaining} Command remains.`;
    } else if (latest?.type === 'noise-activation-started') {
      this.#announcement = 'A Noise token begins its activation.';
    } else if (latest?.type === 'noise-activation-ended') {
      this.#announcement = 'Noise activation complete.';
    } else if (latest?.type === 'reinforcement-started') {
      this.#announcement = 'Noise activation complete. Reinforcement begins.';
    } else if (latest?.type === 'reinforcement-complete') {
      this.#announcement = 'Reinforcement complete.';
    }
  }

  #dispatchCommand(command: GameCommand) {
    this.dispatchEvent(
      new CustomEvent<GameCommand>('game-command', {
        detail: command,
        bubbles: true,
        composed: true,
      })
    );
  }

  #dispatchUiEvent<T>(type: string, detail?: T) {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  #confirmCommand(message: string, command: GameCommand) {
    const modal = document.querySelector('confirmation-modal');
    if (!modal) throw new Error('The confirmation modal is required');
    const cleanup = () => {
      modal.removeEventListener('confirm', confirm);
      modal.removeEventListener('cancel', cancel);
    };
    const confirm = () => {
      cleanup();
      this.#dispatchCommand(command);
    };
    const cancel = () => cleanup();
    modal.addEventListener('confirm', confirm);
    modal.addEventListener('cancel', cancel);
    modal.showModal(message);
  }

  #renderSelection(): HTMLElement {
    const intro = h('div', {}, [
      h('p', { className: 'eyebrow', textContent: 'Game setup' }),
      h('h2', { textContent: 'Choose your company' }),
      h('p', {
        textContent:
          'Choose a play mode and 1–5 unique heroes. Gotrek and Felix are selected by default.',
      }),
    ]);
    const modeFieldset = h('fieldset', {}, [
      h('legend', { textContent: 'Play mode' }),
      modeOption('solo', 'Solo', 'Face an aggressive automated Skaven horde.', true),
      modeOption(
        'two-player',
        'Two player',
        'Share this device and keep Skaven choices private.',
        false
      ),
    ]);
    const heroOptions = ALL_HERO_IDS.map(id => {
      const definition = HERO_DEFINITIONS[id];
      const selected = this.#view?.selectedHeroIds.includes(id) ?? false;
      return h('label', { className: 'hero-option' }, [
        h('input', { type: 'checkbox', name: 'hero', value: id, checked: selected }),
        h('span', { className: 'hero-name', textContent: definition.name }),
        h('span', {
          className: 'hero-stats',
          textContent: `Move ${definition.stats.move} · Fight ${definition.stats.fight} · Wounds ${definition.stats.wounds}`,
        }),
      ]);
    });
    const heroFieldset = h('fieldset', {}, [
      h('legend', { textContent: 'Heroes' }),
      h('div', { className: 'hero-grid' }, heroOptions),
    ]);
    const submit = h('button', { type: 'submit', textContent: 'Begin deployment' });
    const form = h('form', {}, [intro, modeFieldset, heroFieldset, submit]);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const mode = form.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value as
        | GameMode
        | undefined;
      const heroIds = [
        ...form.querySelectorAll<HTMLInputElement>('input[name="hero"]:checked'),
      ].map(input => input.value as HeroId);
      if (!mode) {
        this.showError('Choose solo or two-player mode.');
        return;
      }
      if (heroIds.length < 1 || heroIds.length > 5) {
        this.showError('Choose between 1 and 5 heroes.');
        return;
      }
      this.#dispatchCommand({ type: 'configure-game', mode, heroIds });
    });
    return form;
  }

  #renderDeployment(): HTMLElement {
    const undeployed = this.#view?.heroes.filter(hero => !hero.position) ?? [];
    const heroSelect = h('select', { id: 'deploy-hero', name: 'deploy-hero' });
    for (const hero of undeployed) {
      heroSelect.append(
        h('option', { value: hero.id, textContent: HERO_DEFINITIONS[hero.id].name })
      );
    }
    const facingSelect = h('select', { id: 'deploy-facing', name: 'deploy-facing' });
    for (const facing of ['north', 'east', 'south', 'west'] as const) {
      facingSelect.append(h('option', { value: facing, textContent: facingLabel(facing) }));
    }
    const roster = h(
      'ul',
      { className: 'roster', ariaLabel: 'Deployment status' },
      (this.#view?.heroes ?? []).map(hero =>
        h('li', {}, [
          h('span', { textContent: HERO_DEFINITIONS[hero.id].name }),
          h('span', {
            className: hero.position ? 'placed' : 'waiting',
            textContent: hero.position
              ? `Row ${hero.position.row + 1}, column ${hero.position.column + 1} · ${facingLabel(hero.facing!)}`
              : 'Waiting',
          }),
        ])
      )
    );

    return h('div', { className: 'deployment' }, [
      h('div', {}, [
        h('p', { className: 'eyebrow', textContent: 'Hero deployment' }),
        h('h2', { textContent: 'Enter the undercity' }),
        h('p', {
          textContent: 'Choose a hero and facing, then select a highlighted square on the board.',
        }),
      ]),
      h('div', { className: 'deployment-controls' }, [
        h('label', {}, [h('span', { textContent: 'Hero' }), heroSelect]),
        h('label', {}, [h('span', { textContent: 'Facing' }), facingSelect]),
      ]),
      roster,
    ]);
  }

  #renderInitialNoise(): HTMLElement {
    if (this.#privateNoiseView?.pendingNoise) {
      const result = this.#privateNoiseView.pendingNoise;
      return h('div', { className: 'complete' }, [
        h('div', {}, [
          h('p', { className: 'eyebrow', textContent: 'Skaven setup · private' }),
          h('h2', {
            textContent: `Place noise ${this.#privateNoiseView.initialNoiseDrawsResolved + 1} of ${this.#privateNoiseView.initialNoiseCount}`,
          }),
          h('p', {
            textContent:
              'Keep this result hidden from the Hero player. Select a highlighted Skaven spawn on the board.',
          }),
        ]),
        h('p', {
          className: 'private-result',
          textContent: NOISE_RESULT_NAMES[result.resultId],
        }),
      ]);
    }

    if (this.#view?.mode === 'two-player') {
      const button = h('button', {
        type: 'button',
        textContent: 'I am the Skaven player',
      });
      button.addEventListener('click', () => this.#dispatchCommand({ type: 'draw-initial-noise' }));
      return h('div', { className: 'handoff' }, [
        h('p', { className: 'eyebrow', textContent: 'Pass the device' }),
        h('h2', { textContent: 'Skaven player only' }),
        h('p', {
          textContent:
            'The next screen contains concealed noise identities. Hand the device to the Skaven player before continuing.',
        }),
        button,
      ]);
    }

    const button = h('button', {
      type: 'button',
      textContent: 'Place initial noise',
    });
    button.addEventListener('click', () => this.#dispatchCommand({ type: 'draw-initial-noise' }));
    return h('div', { className: 'complete' }, [
      h('div', {}, [
        h('p', { className: 'eyebrow', textContent: 'Deployment complete' }),
        h('h2', { textContent: 'Ready for the horde' }),
        h('p', {
          textContent:
            'The Skaven AI will privately draw three results and place their face-down noise tokens.',
        }),
      ]),
      button,
    ]);
  }

  #renderHeroTurn(): HTMLElement {
    if (this.#view?.revealedNoise[0]) {
      const noise = this.#view.revealedNoise[0];
      const definitionId = noise.remainingModels[0];
      if (!definitionId) throw new Error('Revealed noise must contain a model to place');
      const facingSelect = h('select', { id: 'skaven-facing', name: 'skaven-facing' });
      for (const facing of ['north', 'east', 'south', 'west'] as const) {
        facingSelect.append(h('option', { value: facing, textContent: facingLabel(facing) }));
      }
      const chooseSquare = h('button', {
        type: 'button',
        textContent: `Place ${SKAVEN_DEFINITIONS[definitionId].name}`,
      });
      chooseSquare.addEventListener('click', () =>
        this.#dispatchUiEvent('skaven-placement-requested', facingSelect.value as Facing)
      );
      return h('div', { className: 'activation-card' }, [
        h('div', {}, [
          h('p', { className: 'eyebrow', textContent: 'Revealed Skaven' }),
          h('h2', { textContent: NOISE_RESULT_NAMES[noise.resultId] }),
          h('p', {
            className: 'help',
            textContent:
              'Place each model in order. The token square is first; after that, the board highlights every tied nearest legal square.',
          }),
        ]),
        h('div', { className: 'action-grid' }, [
          h('label', {}, [h('span', { textContent: 'Facing' }), facingSelect]),
          chooseSquare,
        ]),
      ]);
    }

    if (this.#view?.phase === 'skaven') return this.#renderSkavenTurn();

    const activeHero = this.#view?.heroes.find(hero => hero.id === this.#view?.activeHeroId);
    const header = h('div', {}, [
      h('p', { className: 'eyebrow', textContent: `Round ${this.#view?.round ?? 1}` }),
      h('h2', { textContent: 'Hero turn' }),
      h('dl', { className: 'turn-facts' }, [
        h('div', {}, [
          h('dt', { textContent: 'Command' }),
          h('dd', { textContent: String(this.#view?.command ?? 0) }),
        ]),
        h('div', {}, [
          h('dt', { textContent: 'Actions' }),
          h('dd', {
            textContent:
              this.#view?.actionsRemaining === null
                ? '—'
                : String(this.#view?.actionsRemaining ?? 0),
          }),
        ]),
        h('div', {}, [
          h('dt', { textContent: 'Movement' }),
          h('dd', {
            textContent:
              this.#view?.movementRemaining === null
                ? '—'
                : String(this.#view?.movementRemaining ?? 0),
          }),
        ]),
      ]),
    ]);

    if (activeHero?.facing) {
      const cancelMove = h('button', { type: 'button', textContent: 'Cancel move' });
      cancelMove.addEventListener('click', () => this.#dispatchUiEvent('hero-move-cancelled'));

      if (this.#moveSelection?.stage === 'facing' && this.#moveSelection.faction === 'hero') {
        const { destination } = this.#moveSelection;
        const facingSelect = h('select', { id: 'move-facing', name: 'move-facing' });
        const facings = this.#view?.facingChangeAvailable
          ? (['north', 'east', 'south', 'west'] as const)
          : ([activeHero.facing] as const);
        for (const facing of facings) {
          facingSelect.append(
            h('option', {
              value: facing,
              textContent: facingLabel(facing),
              selected: facing === activeHero.facing,
            })
          );
        }
        const completeMove = h('button', {
          type: 'button',
          textContent: 'Complete Movement',
        });
        completeMove.addEventListener('click', () =>
          this.#dispatchUiEvent('hero-move-facing-selected', facingSelect.value as Facing)
        );

        return h('div', { className: 'activation-card' }, [
          header,
          h('h3', { textContent: HERO_DEFINITIONS[activeHero.id].name }),
          h('p', {
            className: 'help',
            textContent: this.#view?.facingChangeAvailable
              ? `Destination: row ${destination.row + 1}, column ${destination.column + 1}. Choose the hero’s facing to complete this part of their Movement.`
              : `Destination: row ${destination.row + 1}, column ${destination.column + 1}. This hero has already changed facing this activation.`,
          }),
          h('div', { className: 'action-grid' }, [
            h('label', {}, [h('span', { textContent: 'Final facing' }), facingSelect]),
            completeMove,
            cancelMove,
          ]),
        ]);
      }

      const choosingDestination =
        this.#moveSelection?.stage === 'destination' && this.#moveSelection.faction === 'hero';
      const move = h('button', {
        type: 'button',
        textContent: choosingDestination
          ? 'Choosing destination…'
          : `Movement · ${String(this.#view?.movementRemaining ?? 0)} left`,
        disabled: choosingDestination || (this.#view?.legalMovePaths.length ?? 0) === 0,
      });
      move.addEventListener('click', () => this.#dispatchUiEvent('hero-move-requested'));
      const interact = h('button', {
        type: 'button',
        textContent: 'Door · 1 Action',
        disabled:
          (this.#view?.actionsRemaining ?? 0) < 1 ||
          (this.#view?.legalDoorInteractions.length ?? 0) === 0,
      });
      interact.addEventListener('click', () => this.#dispatchUiEvent('hero-door-requested'));
      const fight = h('button', {
        type: 'button',
        textContent: 'Fight · 1 Action',
        disabled:
          (this.#view?.actionsRemaining ?? 0) < 1 ||
          (this.#view?.legalFightTargetIds.length ?? 0) === 0,
      });
      fight.addEventListener('click', () => this.#dispatchUiEvent('hero-fight-requested'));
      const dash = h('button', {
        type: 'button',
        textContent: this.#view?.dashUsed ? 'Dash used' : 'Dash · 1 Action',
        disabled: this.#view?.dashUsed || (this.#view?.actionsRemaining ?? 0) < 1,
      });
      dash.addEventListener('click', () =>
        this.#dispatchCommand({ type: 'dash-hero', heroId: activeHero.id })
      );
      const push = h('button', {
        type: 'button',
        textContent: this.#view?.pushUsed ? 'Push used' : 'Push · 1 Command',
        disabled: this.#view?.pushUsed || (this.#view?.command ?? 0) < 1,
      });
      push.addEventListener('click', () =>
        this.#dispatchCommand({ type: 'push-hero', heroId: activeHero.id })
      );
      const end = h('button', { type: 'button', textContent: 'End activation' });
      end.addEventListener('click', () => {
        const command: GameCommand = {
          type: 'end-hero-activation',
          heroId: activeHero.id,
          confirmed: true,
        };
        if ((this.#view?.actionsRemaining ?? 0) > 0) {
          this.#confirmCommand(
            `End ${HERO_DEFINITIONS[activeHero.id].name}’s activation with ${this.#view?.actionsRemaining ?? 0} Actions remaining?`,
            command
          );
        } else {
          this.#dispatchCommand(command);
        }
      });

      return h('div', { className: 'activation-card' }, [
        header,
        h('h3', { textContent: HERO_DEFINITIONS[activeHero.id].name }),
        h('p', {
          className: 'help',
          textContent: choosingDestination
            ? 'Select a highlighted destination on the board. The current square is legal while a facing change remains.'
            : 'Movement is free and may be split before, between, and after Actions. Dash adds the hero’s Move again.',
        }),
        h(
          'div',
          { className: 'action-grid' },
          choosingDestination ? [move, cancelMove] : [move, fight, interact, dash, push]
        ),
        ...(choosingDestination ? [] : [this.#renderCombatLog(), end]),
      ]);
    }

    const eligible =
      this.#view?.heroes.filter(
        hero =>
          hero.woundsRemaining > 0 &&
          hero.position !== null &&
          !this.#view?.exitedHeroIds.includes(hero.id)
      ) ?? [];
    const everyActivated = eligible.every(hero => this.#view?.activatedHeroIds.includes(hero.id));
    const roster = h(
      'ul',
      { className: 'roster', ariaLabel: 'Hero activation status' },
      eligible.map(hero => {
        const activated = this.#view?.activatedHeroIds.includes(hero.id) ?? false;
        const button = h('button', {
          type: 'button',
          textContent: activated ? 'Activated' : 'Activate',
          disabled: activated,
        });
        button.addEventListener('click', () =>
          this.#dispatchCommand({ type: 'start-hero-activation', heroId: hero.id })
        );
        return h('li', {}, [h('span', { textContent: HERO_DEFINITIONS[hero.id].name }), button]);
      })
    );
    const endPhase = h('button', {
      type: 'button',
      textContent: 'End Hero phase',
      disabled: !everyActivated,
    });
    endPhase.addEventListener('click', () =>
      this.#confirmCommand('End the Hero phase and begin the Skaven turn?', {
        type: 'end-hero-phase',
        confirmed: true,
      })
    );

    return h('div', { className: 'turn-status' }, [
      header,
      h('p', {
        className: 'help',
        textContent: everyActivated
          ? 'Every eligible hero has activated.'
          : 'Choose the next living, non-exited hero to activate.',
      }),
      roster,
      this.#renderCombatLog(),
      endPhase,
    ]);
  }

  #renderSkavenTurn(): HTMLElement {
    const view = this.#view;
    if (!view) return h('div');
    if (view.mode === 'two-player' && !this.#skavenHandoffComplete) {
      const button = h('button', { type: 'button', textContent: 'I am the Skaven player' });
      button.addEventListener('click', () => {
        this.#skavenHandoffComplete = true;
        this.#render();
      });
      return h('div', { className: 'handoff' }, [
        h('p', { className: 'eyebrow', textContent: 'Pass the device' }),
        h('h2', { textContent: `Skaven Turn ${view.round}` }),
        h('p', {
          textContent: 'Hand the device to the Skaven player before revealing their turn controls.',
        }),
        button,
      ]);
    }

    if (view.pendingReact) return this.#renderReactWindow();
    if (view.skavenTurnStep === 'activate-noise' && view.noiseActionIds.length === 0) {
      return this.#renderNoiseActivation();
    }
    if (view.skavenTurnStep === 'reinforce') return this.#renderReinforcement();

    const active = view.skaven.find(skaven => skaven.id === view.activeSkavenId);
    const header = h('div', {}, [
      h('p', { className: 'eyebrow', textContent: `Round ${view.round}` }),
      h('h2', { textContent: 'Skaven turn' }),
      h('dl', { className: 'turn-facts' }, [
        h('div', {}, [
          h('dt', { textContent: 'Command' }),
          h('dd', { textContent: String(view.command) }),
        ]),
        h('div', {}, [
          h('dt', { textContent: 'Actions' }),
          h('dd', {
            textContent:
              view.skavenActionsRemaining === null ? '—' : String(view.skavenActionsRemaining),
          }),
        ]),
        h('div', {}, [
          h('dt', { textContent: 'Movement' }),
          h('dd', {
            textContent:
              view.skavenMovementRemaining === null ? '—' : String(view.skavenMovementRemaining),
          }),
        ]),
      ]),
    ]);

    if (!active) {
      const activationIds =
        view.skavenTurnStep === 'activate-noise' ? view.noiseActionIds : view.skavenActivationIds;
      const roster = h(
        'ul',
        { className: 'roster', ariaLabel: 'Skaven activation status' },
        activationIds.flatMap(id => {
          const skaven = this.#view?.skaven.find(candidate => candidate.id === id);
          if (!skaven) return [];
          const activated = this.#view?.activatedSkavenIds.includes(id) ?? false;
          const button = h('button', {
            type: 'button',
            textContent: activated ? 'Activated' : 'Activate',
            disabled: activated,
          });
          button.addEventListener('click', () =>
            this.#dispatchCommand({ type: 'start-skaven-activation', skavenId: id })
          );
          return [
            h('li', {}, [
              h('span', {
                textContent: `${SKAVEN_DEFINITIONS[skaven.definitionId].name} · #${getSkavenModelIdentifier(id)}`,
              }),
              button,
            ]),
          ];
        })
      );
      return h('div', { className: 'turn-status' }, [
        header,
        h('p', {
          className: 'help',
          textContent:
            view.skavenTurnStep === 'activate-noise'
              ? 'Choose the next newly revealed Skaven to take its one Action. It cannot Move again.'
              : 'Choose the next revealed Skaven to activate.',
        }),
        roster,
        this.#renderCombatLog(),
      ]);
    }

    if (this.#moveSelection?.stage === 'facing' && this.#moveSelection.faction === 'skaven') {
      const facingSelect = h('select', { id: 'skaven-move-facing', name: 'skaven-move-facing' });
      for (const facing of ['north', 'east', 'south', 'west'] as const) {
        facingSelect.append(
          h('option', {
            value: facing,
            textContent: facingLabel(facing),
            selected: facing === active.facing,
          })
        );
      }
      const complete = h('button', { type: 'button', textContent: 'Complete Movement' });
      complete.addEventListener('click', () =>
        this.#dispatchUiEvent('skaven-move-facing-selected', facingSelect.value as Facing)
      );
      const cancel = h('button', { type: 'button', textContent: 'Cancel move' });
      cancel.addEventListener('click', () => this.#dispatchUiEvent('skaven-move-cancelled'));
      const destination = this.#moveSelection.destination;
      return h('div', { className: 'activation-card' }, [
        header,
        h('h3', {
          textContent: `${SKAVEN_DEFINITIONS[active.definitionId].name} · #${getSkavenModelIdentifier(active.id)}`,
        }),
        h('p', {
          className: 'help',
          textContent: `Destination: row ${destination.row + 1}, column ${destination.column + 1}. Choose final facing.`,
        }),
        h('div', { className: 'action-grid' }, [
          h('label', {}, [h('span', { textContent: 'Final facing' }), facingSelect]),
          complete,
          cancel,
        ]),
      ]);
    }

    const choosingDestination =
      this.#moveSelection?.stage === 'destination' && this.#moveSelection.faction === 'skaven';
    const hasOpenMovementPath = view.legalSkavenMovePaths.some(path => path.steps.length > 0);
    const move = h('button', {
      type: 'button',
      textContent: choosingDestination
        ? 'Choosing destination…'
        : view.skavenMovementRemaining === 0
          ? 'Movement Complete'
          : hasOpenMovementPath
            ? 'Choose Movement'
            : 'Hold Position',
      disabled: choosingDestination || view.skavenMovementRemaining === 0,
    });
    move.addEventListener('click', () => this.#dispatchUiEvent('skaven-move-requested'));
    const fight = h('button', {
      type: 'button',
      textContent: 'Fight · 1 Action',
      disabled: view.legalSkavenFightTargetIds.length === 0,
    });
    fight.addEventListener('click', () => this.#dispatchUiEvent('skaven-fight-requested'));
    const door = h('button', {
      type: 'button',
      textContent: 'Door · 1 Action',
      disabled: view.legalSkavenDoorInteractions.length === 0,
    });
    door.addEventListener('click', () => this.#dispatchUiEvent('skaven-door-requested'));
    const end = h('button', { type: 'button', textContent: 'End activation' });
    end.addEventListener('click', () => {
      const command: GameCommand = {
        type: 'end-skaven-activation',
        skavenId: active.id,
        confirmed: true,
      };
      if (
        (this.#view?.skavenMovementRemaining ?? 0) > 0 ||
        (this.#view?.skavenActionsRemaining ?? 0) > 0
      ) {
        this.#confirmCommand(
          `End ${SKAVEN_DEFINITIONS[active.definitionId].name} #${getSkavenModelIdentifier(active.id)}’s activation early?`,
          command
        );
      } else {
        this.#dispatchCommand(command);
      }
    });
    const cancel = h('button', { type: 'button', textContent: 'Cancel move' });
    cancel.addEventListener('click', () => this.#dispatchUiEvent('skaven-move-cancelled'));

    return h('div', { className: 'activation-card' }, [
      header,
      h('h3', {
        textContent: `${SKAVEN_DEFINITIONS[active.definitionId].name} · #${getSkavenModelIdentifier(active.id)}`,
      }),
      h('p', {
        className: 'help',
        textContent: choosingDestination
          ? 'Select a highlighted destination, including the current square to hold position.'
          : view.skavenMovementRemaining === 0
            ? 'Movement is complete. Take one Action or end the activation.'
            : hasOpenMovementPath
              ? 'Complete this model’s Movement before taking its Action.'
              : 'This model is blocked by terrain or other models. Hold position to complete Movement.',
      }),
      h(
        'div',
        { className: 'action-grid' },
        choosingDestination ? [move, cancel] : [move, fight, door]
      ),
      ...(choosingDestination ? [] : [this.#renderCombatLog(), end]),
    ]);
  }

  #renderReactWindow(): HTMLElement {
    if (!this.#view?.pendingReact) return h('div');
    if (this.#view.mode === 'two-player' && !this.#reactHandoffComplete) {
      const ready = h('button', { type: 'button', textContent: 'I am the Hero player' });
      ready.addEventListener('click', () => {
        this.#reactHandoffComplete = true;
        this.#render();
      });
      return h('div', { className: 'handoff' }, [
        h('p', { className: 'eyebrow', textContent: 'React window' }),
        h('h2', { textContent: 'Pass the device' }),
        h('p', {
          textContent:
            'The enemy completed Movement. Hand the device to the Hero player before continuing.',
        }),
        ready,
      ]);
    }

    const actions: HTMLElement[] = [];
    for (const option of this.#view.legalReactFightOptions) {
      const skaven = this.#view.skaven.find(candidate => candidate.id === option.skavenId);
      const button = h('button', {
        type: 'button',
        textContent: `${HERO_DEFINITIONS[option.heroId].name}: Fight ${skaven ? SKAVEN_DEFINITIONS[skaven.definitionId].name : 'Skaven'}`,
      });
      button.addEventListener('click', () =>
        this.#dispatchCommand({ type: 'react-fight-skaven', ...option })
      );
      actions.push(button);
    }
    for (const option of this.#view.legalReactDoorOptions) {
      const button = h('button', {
        type: 'button',
        textContent: `${HERO_DEFINITIONS[option.heroId].name}: Door at ${option.position.row + 1}, ${option.position.column + 1}`,
      });
      button.addEventListener('click', () =>
        this.#dispatchCommand({ type: 'react-interact-door', ...option })
      );
      actions.push(button);
    }
    const skip = h('button', { type: 'button', textContent: 'Do not React' });
    skip.addEventListener('click', () => this.#dispatchCommand({ type: 'skip-react' }));
    return h('div', { className: 'activation-card' }, [
      h('p', {
        className: 'eyebrow',
        textContent: `Round ${this.#view.round} · Hero interruption`,
      }),
      h('h2', { textContent: 'React · 2 Command' }),
      h('p', {
        className: 'help',
        textContent:
          actions.length > 0
            ? 'One hero may immediately take one eligible Fight or Door action.'
            : 'No hero has an eligible implemented 1-Action response. Continue the Skaven turn.',
      }),
      h('div', { className: 'action-grid' }, [...actions, skip]),
      this.#renderCombatLog(),
    ]);
  }

  #renderNoiseActivation(): HTMLElement {
    if (!this.#view) return h('div');
    const active = this.#view.noiseTokens.find(noise => noise.id === this.#view?.activeNoiseId);
    if (active) {
      const choosing =
        this.#moveSelection?.stage === 'destination' && this.#moveSelection.faction === 'skaven';
      const move = h('button', {
        type: 'button',
        textContent: choosing ? 'Choosing route…' : 'Move Noise toward nearest hero',
        disabled: choosing,
      });
      move.addEventListener('click', () => this.#dispatchUiEvent('noise-move-requested'));
      return h('div', { className: 'activation-card' }, [
        h('p', { className: 'eyebrow', textContent: `Round ${this.#view.round} · Activate Noise` }),
        h('h2', { textContent: 'Noise movement' }),
        h('p', {
          className: 'help',
          textContent: choosing
            ? 'Choose one highlighted shortest-route destination.'
            : `Noise at row ${active.position.row + 1}, column ${active.position.column + 1} must move up to 5 toward the nearest hero.`,
        }),
        move,
      ]);
    }
    const roster = h(
      'ul',
      { className: 'roster', ariaLabel: 'Noise activation status' },
      this.#view.noiseActivationIds.flatMap(id => {
        const noise = this.#view?.noiseTokens.find(candidate => candidate.id === id);
        if (!noise) return [];
        const activated = this.#view?.activatedNoiseIds.includes(id) ?? false;
        const button = h('button', {
          type: 'button',
          textContent: activated ? 'Activated' : 'Activate',
          disabled: activated,
        });
        button.addEventListener('click', () =>
          this.#dispatchCommand({ type: 'start-noise-activation', noiseId: id })
        );
        return h('li', {}, [
          h('span', {
            textContent: `Noise at row ${noise.position.row + 1}, column ${noise.position.column + 1}`,
          }),
          button,
        ]);
      })
    );
    return h('div', { className: 'turn-status' }, [
      h('p', { className: 'eyebrow', textContent: `Round ${this.#view.round}` }),
      h('h2', { textContent: 'Activate Noise' }),
      h('p', { className: 'help', textContent: 'Choose the next face-down Noise token.' }),
      roster,
      this.#renderCombatLog(),
    ]);
  }

  #renderReinforcement(): HTMLElement {
    if (!this.#view) return h('div');
    const pending = this.#privateNoiseView?.pendingNoise;
    if (pending) {
      const place = h('button', { type: 'button', textContent: 'Choose a Skaven entry' });
      place.addEventListener('click', () =>
        this.#dispatchUiEvent('reinforcement-placement-requested')
      );
      return h('div', { className: 'activation-card' }, [
        h('p', { className: 'eyebrow', textContent: 'Reinforcement · private' }),
        h('h2', { textContent: NOISE_RESULT_NAMES[pending.resultId] }),
        h('p', {
          className: 'help',
          textContent:
            'Keep this result hidden from the Hero player and place it at an empty entry.',
        }),
        place,
      ]);
    }
    const draw = h('button', {
      type: 'button',
      textContent: `Draw reinforcement ${this.#view.reinforcementDrawsResolved + 1} of ${this.#view.reinforcementDrawCount}`,
    });
    draw.addEventListener('click', () =>
      this.#dispatchCommand({ type: 'draw-reinforcement-noise' })
    );
    return h('div', { className: 'turn-status' }, [
      h('p', { className: 'eyebrow', textContent: `Round ${this.#view.round}` }),
      h('h2', { textContent: 'Reinforce' }),
      h('p', {
        className: 'help',
        textContent: 'Draw and privately place two Noise results. They do not activate this turn.',
      }),
      draw,
      this.#renderCombatLog(),
    ]);
  }

  #renderCombatLog(): HTMLElement {
    const entries = this.#view?.combatLog ?? [];
    if (entries.length === 0) {
      return h('p', { className: 'help', textContent: 'No Fights resolved yet.' });
    }
    return h(
      'ol',
      { className: 'combat-log', ariaLabel: 'Fight results' },
      entries.map(result => {
        const heroHigh = Math.max(...result.heroRolls);
        const skavenHigh = Math.max(...result.skavenRolls);
        const outcome =
          result.outcome === 'tie'
            ? 'tie; no Wound'
            : result.outcome === 'hero-won'
              ? 'hero wins; Skaven suffers 1 Wound'
              : 'Skaven wins; hero suffers 1 Wound';
        return h('li', {
          textContent: `${HERO_DEFINITIONS[result.heroId].name} [${result.heroRolls.join(', ')}], high ${heroHigh}; ${SKAVEN_DEFINITIONS[result.skavenDefinitionId].name} [${result.skavenRolls.join(', ')}], high ${skavenHigh}: ${outcome}.`,
        });
      })
    );
  }

  #render() {
    const shadow = this.shadowRoot;
    if (!shadow) return;
    const content =
      this.#view?.setupStep === 'deploy-heroes'
        ? this.#renderDeployment()
        : this.#view?.setupStep === 'initial-noise'
          ? this.#renderInitialNoise()
          : this.#view?.setupStep === 'complete'
            ? this.#renderHeroTurn()
            : this.#renderSelection();
    shadow.replaceChildren(
      h('style', { textContent: STYLES }),
      content,
      h('p', { className: 'error', role: 'alert', textContent: this.#error }),
      h('p', {
        className: 'visually-hidden',
        ariaLive: 'polite',
        textContent: this.#announcement,
      })
    );
  }
}

customElements.define('game-setup', GameSetup);

declare global {
  interface HTMLElementTagNameMap {
    'game-setup': GameSetup;
  }
}
