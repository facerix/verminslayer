import { renderBoard } from '/src/canvas/boardRenderer.js';
import { h } from '/src/domUtils.js';
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
        'The Nest board: 13 columns by 19 rows, with six doors, three nests, three Skaven spawn points, one hero deployment point, and a locked south exit.',
    });
    this.#frame = h('div', { className: 'board-frame' }, [this.#canvas, description]);
    shadow.append(h('style', { textContent: STYLES }), this.#frame);
    this.#resizeObserver = new ResizeObserver(() => this.#draw());
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
    renderBoard(context, THE_NEST.board, width, height);
  }
}

customElements.define('game-board', GameBoard);

declare global {
  interface HTMLElementTagNameMap {
    'game-board': GameBoard;
  }
}
