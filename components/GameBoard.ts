import { renderBoard } from '/src/canvas/boardRenderer.js';
import type { BoardHeroPresentation, BoardNoisePresentation } from '/src/canvas/boardRenderer.js';
import { pointToSquare } from '/src/canvas/boardGeometry.js';
import type { BoardGeometry } from '/src/canvas/boardGeometry.js';
import { h } from '/src/domUtils.js';
import type { Position } from '/src/game/map.js';
import { THE_NEST } from '/src/game/missions/theNest.js';

const STYLES = `
  :host {
    display: grid;
    width: 100%;
    min-height: 0;
    place-items: center;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: manipulation;
  }

  canvas.is-interactive {
    cursor: crosshair;
  }

  .board-frame {
    position: relative;
    width: min(100%, calc(72vh * 13 / 19), 39rem);
    aspect-ratio: 13 / 19;
    border: 1px solid #5d4c3d;
    border-radius: 0.35rem;
    overflow: hidden;
    background: #221c18;
    box-shadow: 0 0.75rem 2.5rem rgb(0 0 0 / 35%);
  }

  .description {
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
`;

export class GameBoard extends HTMLElement {
  readonly #canvas: HTMLCanvasElement;
  readonly #frame: HTMLDivElement;
  readonly #resizeObserver: ResizeObserver;
  #geometry: BoardGeometry | null = null;
  #heroes: readonly BoardHeroPresentation[] = [];
  #noiseTokens: readonly BoardNoisePresentation[] = [];
  #legalSquares: readonly Position[] = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.#canvas = h('canvas');
    this.#canvas.setAttribute('role', 'img');
    this.#canvas.setAttribute('aria-describedby', 'board-description');

    const description = h('p', {
      id: 'board-description',
      className: 'description',
      textContent:
        'The Nest board: 13 columns by 19 rows, with doors, three nests, three Skaven spawn points, one hero deployment point, and a locked south exit.',
    });
    this.#frame = h('div', { className: 'board-frame' }, [this.#canvas, description]);
    shadow.append(h('style', { textContent: STYLES }), this.#frame);
    this.#resizeObserver = new ResizeObserver(() => this.#draw());
    this.#canvas.addEventListener('pointerup', event => this.#selectSquare(event));
  }

  set heroes(heroes: readonly BoardHeroPresentation[]) {
    this.#heroes = heroes;
    this.#updateDescription();
    this.#draw();
  }

  set legalSquares(positions: readonly Position[]) {
    this.#legalSquares = positions;
    this.#canvas.classList.toggle('is-interactive', positions.length > 0);
    this.#draw();
  }

  set noiseTokens(tokens: readonly BoardNoisePresentation[]) {
    this.#noiseTokens = tokens;
    this.#updateDescription();
    this.#draw();
  }

  connectedCallback() {
    this.#resizeObserver.observe(this.#frame);
    this.#draw();
  }

  disconnectedCallback() {
    this.#resizeObserver.disconnect();
  }

  #draw() {
    const { width, height } = this.#canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const pixelRatio = window.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * pixelRatio);
    this.#canvas.height = Math.round(height * pixelRatio);
    const context = this.#canvas.getContext('2d');
    if (!context) throw new Error('This browser does not provide a 2D canvas context');

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.#geometry = renderBoard(context, THE_NEST.board, width, height, {
      heroes: this.#heroes,
      noiseTokens: this.#noiseTokens,
      legalSquares: this.#legalSquares,
    });
  }

  #selectSquare(event: PointerEvent) {
    if (!this.#geometry || this.#legalSquares.length === 0) return;
    const bounds = this.#canvas.getBoundingClientRect();
    const position = pointToSquare(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      this.#geometry
    );
    if (
      !position ||
      !this.#legalSquares.some(
        legal => legal.row === position.row && legal.column === position.column
      )
    ) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<Position>('board-square-selected', {
        detail: position,
        bubbles: true,
        composed: true,
      })
    );
  }

  #updateDescription() {
    const description = this.shadowRoot?.querySelector('#board-description');
    if (!description) return;
    const heroes = this.#heroes.length
      ? ` Deployed heroes: ${this.#heroes
          .map(
            hero =>
              `${hero.label} at row ${hero.position.row + 1}, column ${hero.position.column + 1}, facing ${hero.facing}`
          )
          .join('; ')}.`
      : '';
    const concealedNoise = this.#noiseTokens.filter(token => !token.revealedLabel);
    const revealedNoise = this.#noiseTokens.filter(token => token.revealedLabel);
    const noise = concealedNoise.length
      ? ` Face-down noise tokens: ${concealedNoise
          .map(token => `row ${token.position.row + 1}, column ${token.position.column + 1}`)
          .join('; ')}.`
      : '';
    const reveals = revealedNoise.length
      ? ` Revealed noise: ${revealedNoise
          .map(
            token =>
              `${token.accessibleLabel ?? token.revealedLabel} at row ${token.position.row + 1}, column ${token.position.column + 1}`
          )
          .join('; ')}.`
      : '';
    description.textContent =
      'The Nest board: 13 columns by 19 rows, with doors, three nests, three Skaven spawn points, one hero deployment point, and a locked south exit.' +
      heroes +
      noise +
      reveals;
  }
}

customElements.define('game-board', GameBoard);

declare global {
  interface HTMLElementTagNameMap {
    'game-board': GameBoard;
  }
}
