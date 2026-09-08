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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set view(view: HeroGameView) {
    this.#view = view;
    this.#privateNoiseView = null;
    this.#error = '';
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

  showError(message: string) {
    this.#error = message;
    const error = this.shadowRoot?.querySelector('.error');
    if (error) error.textContent = message;
  }

  announce(events: readonly GameEvent[]) {
    const latest = events.at(-1);
    if (latest?.type === 'hero-deployed') {
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
    return h('div', { className: 'complete' }, [
      h('div', {}, [
        h('p', { className: 'eyebrow', textContent: `Round ${this.#view?.round ?? 1}` }),
        h('h2', { textContent: 'Hero turn' }),
        h('p', {
          textContent: `Initial noise is in position. The company begins with ${this.#view?.command ?? 3} Command.`,
        }),
      ]),
      h('p', {
        className: 'callout',
        textContent: 'Hero activation actions begin in the next reviewable slice.',
      }),
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
