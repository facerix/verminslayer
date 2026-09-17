/**
 * ToastMessage Web Component
 * Displays a brief message in a popup that can be dismissed or timed out
 * Uses Shadow DOM with encapsulated styles
 */

class ToastMessage extends HTMLElement {
  isVisible = false;
  dismissTimeout: number | null = null;
  boundHandleDismiss: EventListener;

  constructor() {
    super();
    this.boundHandleDismiss = this.handleDismiss.bind(this) as EventListener;

    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback(): void {
    this.cleanupEventListeners();
  }

  render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    root.innerHTML = `
      <style>
        :host {
          --toast-bg: #2c2520;
          --toast-color: #f3d38b;
          --toast-border: #d9a849;
          --toast-btn-bg: #daa84a;
          --toast-btn-color: #e6ddce;
          --toast-btn-hover: #f3d38b;
        }

        .toast-body {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--toast-bg);
          color: var(--toast-color);
          padding: 0.65rem 0.9rem;
          border-radius: 0.35rem;
          border: 1px solid var(--toast-border);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 1000;
          max-width: min(400px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
          box-sizing: border-box;

          strong {
            color: var(--toast-color);
            font-size: 1.1rem;
          }

          p {
            margin: 0.3rem 0 0;
            font-size: 0.82rem;
            line-height: 1.4;
          }

          button {
            // display: none; /* hide this for the moment */
            background: var(--toast-btn-bg);
            color: var(--toast-btn-color);
            border: none;
            padding: 0 0.5rem 0.25rem;
            margin: -0.25rem -0.5rem 0 0.5rem;
            border-radius: 4px;
            float: right;
            cursor: pointer;
            font-weight: bold;
            font-size: 22px;
            font-family: inherit;

            &:hover:not(:disabled) {
              background: var(--toast-btn-hover);
            }
  
            &:active:not(:disabled) {
              transform: scale(0.98);
            }
  
            &:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
          }

          // transition stuff
          display: none;
          opacity: 0;
          backgroundColor: #2c2520;
          borderColor: #d9a849;
          transition: opacity 0.5s, display 0.5s, backgroundColor 1.2s, borderColor 1.2s;
          transition-behavior: allow-discrete;

          &.visible {
            display: block;
            opacity: 1;
            backgroundColor: #2c2520;
            borderColor: #d9a849;
          }
            
          @starting-style {
            .toast-body.visible {
              opacity: 0;
              backgroundColor: #2c2520;
              borderColor: #d9a849;
            }
          }
        }
      </style>
      <div class="toast-body"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong id="event-title">Latest result</strong>
        <button class="dismiss" aria-label="dismiss">𝘅</button>
        <p id="event-detail">
          Fight and Noise results will appear here. Token pips show remaining HP; hollow pips show
          lost HP.
        </p>
      </div>
    `;
  }

  /*
    // highlight.getAnimations().forEach(animation => animation.cancel());
    // if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    //   highlight.animate(
    //     [
    //       { backgroundColor: '#70402f', borderColor: '#fff0dc' },
    //       { backgroundColor: '#2c2520', borderColor: '#d9a849' },
    //     ],
    //     { duration: 1200, easing: 'ease-out' }
    //   );
    // }
  */

  setupEventListeners(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const dismissBtn = root.querySelector('.dismiss');

    if (dismissBtn) {
      dismissBtn.addEventListener('click', this.boundHandleDismiss);
    }
  }

  cleanupEventListeners(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const dismissBtn = root.querySelector('.dismiss');

    if (dismissBtn) {
      dismissBtn.removeEventListener('click', this.boundHandleDismiss);
    }

    if (this.dismissTimeout) {
      window.clearTimeout(this.dismissTimeout);
    }
  }

  show(title: string, message: string): void {
    const toastBody = this.shadowRoot?.querySelector<HTMLElement>('.toast-body');

    if (toastBody) {
      toastBody.classList.add('visible');
      toastBody.querySelector('strong')!.innerText = title;
      toastBody.querySelector('p')!.innerText = message;
      this.isVisible = true;

      this.dismissTimeout = window.setTimeout(() => this.hide(), 1000);

    } else {
      console.error('[ToastMessage] Could not find .toast-body element');
    }
  }

  hide(): void {
    const toastBody = this.shadowRoot?.querySelector<HTMLElement>('.toast-body');

    if (toastBody) {
      toastBody.classList.remove('visible');
      this.isVisible = false;
    }
  }

  handleDismiss(): void {
    this.hide();
  }

  get visible(): boolean {
    return this.isVisible;
  }
}

customElements.define('toast-message', ToastMessage);

declare global {
  interface HTMLElementTagNameMap {
    'toast-message': ToastMessage;
  }
}

export default ToastMessage;
