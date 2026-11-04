/**
 * StageSelectModal Web Component
 * Dialog showing the available missions a player can choose from.
 *
 * Usage:
 *   const modal = document.querySelector('stage-select-modal');
 *   modal.showModal();
 */

import { h, CreateSvg } from '/src/utils.js';
import { MISSIONS } from '/src/game/missions/registry.js';
import { gameUrl } from '/src/game/navigation.js';

const closeIconSvg = CreateSvg(
  '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  '24',
  '24'
);

const CSS = `
:host {
  --confirmation-primary: #f4ede5;
  --confirmation-border: rgba(192, 0, 0, 0.12);
  --confirmation-focus: rgba(192, 0, 0, 0.75);
  --confirmation-bg: #2c2520;

  dialog[open] {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: min(480px, calc(100vw - 24px));
    width: min(90vw, calc(100vw - 24px));
    margin: auto;
    box-sizing: border-box;
    padding: 0;
    border: 1px solid var(--confirmation-border);
    border-radius: 8px;
    background-color: var(--confirmation-bg);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  ::backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }

  header {
    padding: 1em 1.5em;
    background-color: #171310;
    border-bottom: 1px solid #d4552e;
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 1.25em;
      color: var(--confirmation-primary);
      font-weight: 500;
    }

    #close-modal {
      background: none;
      border: none;
      padding: 0;
      width: 1.5em;
      height: 1.5em;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--confirmation-primary);
    }

    #close-modal:hover {
      opacity: 0.7;
    }

    #close-modal:focus {
      outline: none;
    }

    #close-modal:focus-visible {
      outline: 2px solid var(--confirmation-focus);
      outline-offset: 2px;
    }
  }

  .mission-list {
    display: grid;
    gap: 0.6rem;
    padding: 1rem 3rem;
  }

  .mission-choice {
    display: grid;
    align-content: center;
    min-height: 3.5rem;
    padding: 0.55rem 1.2rem;
    color: #f7ead7;
    font: inherit;
    font-weight: 700;
    text-decoration: none;
    text-shadow: 0 2px 4px #000;
    background: rgb(0 0 0 / 55%);
    border: 1px solid rgb(232 167 104 / 40%);
    border-radius: 0.25rem;
    gap: 0.2rem;
    text-align: left;
  }

  .mission-choice small {
    color: #d9bfa7;
    font-weight: 400;
  }

  .mission-choice:hover,
  .mission-choice:focus-visible {
    background: #9f2019;
    outline: 2px solid #e6ad70;
    outline-offset: 2px;
  }

  dialog,
  ::backdrop {
    transition: opacity 0.25s allow-discrete;
    opacity: 0;
  }

  dialog[open],
  dialog[open]::backdrop {
    opacity: 1;
  }

  @starting-style {
    dialog[open],
    dialog[open]::backdrop {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    @starting-style {
      dialog[open] {
        transform: translateY(-12px);
      }

      dialog[open],
      dialog[open]::backdrop {
        opacity: 0;
      }
    }

    dialog[open] {
      animation: dialogSlideIn 0.25s ease;
    }
  }

  @keyframes dialogSlideIn {
    from {
      transform: translateY(-12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 420px) {
    dialog[open] {
      width: calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
      max-width: none;
    }
  }
}
`;

class StageSelectModal extends HTMLElement {
  #ready = false;
  #context: unknown | null = null;
  #modal: HTMLDialogElement | null = null;

  constructor() {
    super();
  }

  connectedCallback(): void {
    const shadow = this.attachShadow({ mode: 'open' });
    const styles = document.createElement('style');
    styles.innerHTML = CSS;
    shadow.appendChild(styles);

    const closeIcon = closeIconSvg.cloneNode(true);
    const missionList = h("div", { id: "mission-list", className: "mission-list" });

    this.#modal = h('dialog', { closedby: 'any' }, [
      h('header', {}, [
        h('h3', { innerText: 'Select your Mission' }),
        h('button', { type: 'button', id: 'close-modal' }, [closeIcon]),
      ]),
      missionList
    ]) as HTMLDialogElement;

    for (const mission of Object.values(MISSIONS)) {
        const choice = h('a', { className: 'mission-choice', href: gameUrl(mission.id) }, [
        h('span', { textContent: mission.name }),
        h('small', {
            textContent: `${mission.board.width} × ${mission.board.height} board · ${mission.board.nests.length} ${mission.board.nests.length === 1 ? 'nest' : 'nests'} · ${mission.roundLimit} rounds`,
        }),
        ]);
        missionList.append(choice);
    }

    shadow.appendChild(this.#modal);
  }

  #onClose(evt: Event): void {
    evt.preventDefault();
    this.#emit('cancel');
    this.#modal?.close();
  }

  #init(): void {
    const closeHandler = this.#onClose.bind(this);
    this.shadowRoot?.querySelector('#close-modal')?.addEventListener('click', closeHandler);
    this.shadowRoot?.querySelector('#btnCancel')?.addEventListener('click', closeHandler);

    this.#ready = true;
  }

  #emit(eventName: string, detail: Record<string, unknown> = {}): void {
    const payload: Record<string, unknown> = { ...detail };
    if (this.#context !== null) {
      payload.context = this.#context;
    }
    this.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  /**
   * Show the stage select modal
   */
  showModal(): void {
    if (!this.#ready) {
      this.#init();
    }
    this.#modal?.showModal();
  }
}

customElements.define('stage-select-modal', StageSelectModal);

declare global {
  interface HTMLElementTagNameMap {
    'stage-select-modal': StageSelectModal;
  }
}

export default StageSelectModal;
