import { h } from '/src/domUtils.js';
import { ALL_HERO_IDS, HERO_DEFINITIONS } from '/src/game/entities.js';
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
  | { readonly stage: 'destination' }
  | { readonly stage: 'facing'; readonly destination: Position };

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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set view(view: HeroGameView) {
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
    this.#moveSelection = { stage: 'destination' };
    this.#render();
  }

  chooseMoveFacing(destination: Position) {
    this.#moveSelection = { stage: 'facing', destination };
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
    if (reveal?.type === 'noise-revealed') {
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
      this.#announcement = `Initial noise setup complete. Hero Turn ${latest.round} begins with ${latest.command} Command.`;
    } else if (latest?.type === 'noise-drawn') {
      this.#announcement = 'A private noise result was drawn.';
    } else if (latest?.type === 'noise-placed') {
      this.#announcement = `Noise placed at row ${latest.position.row + 1}, column ${latest.position.column + 1}.`;
    } else if (latest?.type === 'noise-revealed') {
      this.#announcement = `${NOISE_RESULT_NAMES[latest.resultId]} revealed at row ${latest.position.row + 1}, column ${latest.position.column + 1}.`;
    } else if (latest?.type === 'noise-draw-consumed') {
      this.#announcement = 'The noise draw was consumed because no spawn was available.';
    } else if (latest?.type === 'hero-activation-started') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} begins an activation with ${latest.actions} Actions.`;
    } else if (latest?.type === 'action-spent') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} spent 1 Action to ${latest.action}; ${latest.actionsRemaining} Actions remain.`;
    } else if (latest?.type === 'hero-activation-ended') {
      this.#announcement = `${HERO_DEFINITIONS[latest.heroId].name} ended their activation.`;
    } else if (latest?.type === 'skaven-turn-started') {
      this.#announcement = `Hero phase complete. Skaven Turn ${latest.round} begins.`;
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
    if (this.#view?.phase === 'skaven') {
      return h('div', { className: 'complete' }, [
        h('div', {}, [
          h('p', { className: 'eyebrow', textContent: `Round ${this.#view.round}` }),
          h('h2', { textContent: 'Skaven turn' }),
          h('p', {
            textContent:
              'Every eligible hero has activated. Skaven activation and noise movement arrive in the next reviewable slice.',
          }),
        ]),
      ]);
    }

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
      ]),
    ]);

    if (activeHero?.facing) {
      const cancelMove = h('button', { type: 'button', textContent: 'Cancel move' });
      cancelMove.addEventListener('click', () => this.#dispatchUiEvent('hero-move-cancelled'));

      if (this.#moveSelection?.stage === 'facing') {
        const { destination } = this.#moveSelection;
        const facingSelect = h('select', { id: 'move-facing', name: 'move-facing' });
        for (const facing of ['north', 'east', 'south', 'west'] as const) {
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
          textContent: 'Complete move · 1 Action',
        });
        completeMove.addEventListener('click', () =>
          this.#dispatchUiEvent('hero-move-facing-selected', facingSelect.value as Facing)
        );

        return h('div', { className: 'activation-card' }, [
          header,
          h('h3', { textContent: HERO_DEFINITIONS[activeHero.id].name }),
          h('p', {
            className: 'help',
            textContent: `Destination: row ${destination.row + 1}, column ${destination.column + 1}. Choose the hero’s final facing to complete the Move.`,
          }),
          h('div', { className: 'action-grid' }, [
            h('label', {}, [h('span', { textContent: 'Final facing' }), facingSelect]),
            completeMove,
            cancelMove,
          ]),
        ]);
      }

      const choosingDestination = this.#moveSelection?.stage === 'destination';
      const move = h('button', {
        type: 'button',
        textContent: choosingDestination ? 'Choosing destination…' : 'Move · 1 Action',
        disabled: choosingDestination || (this.#view?.actionsRemaining ?? 0) < 1,
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
            ? 'Select a highlighted destination on the board. The current square is a legal zero-square Move.'
            : 'Select Move, choose a highlighted destination, then choose the hero’s final facing.',
        }),
        h('div', { className: 'action-grid' }, [move, choosingDestination ? cancelMove : interact]),
        ...(choosingDestination ? [] : [end]),
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
      endPhase,
    ]);
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
