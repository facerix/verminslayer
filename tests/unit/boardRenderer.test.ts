import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderBoard } from '../../src/canvas/boardRenderer.ts';
import { THE_NEST } from '../../src/game/missions/theNest.ts';

test('hero and Rat Ogor tokens display filled remaining HP and hollow lost HP pips', () => {
  const circles: { radius: number; fill?: string; stroke?: string }[] = [];
  let circle: (typeof circles)[number] | undefined;
  const recording = {
    fillStyle: '',
    strokeStyle: '',
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    save() {},
    restore() {},
    translate() {},
    quadraticCurveTo() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fillText() {},
    beginPath() {
      circle = undefined;
    },
    arc(_x: number, _y: number, radius: number) {
      circle = { radius };
      circles.push(circle);
    },
    fill() {
      if (circle) circle.fill = this.fillStyle;
    },
    stroke() {
      if (circle) circle.stroke = this.strokeStyle;
    },
  };
  const context = recording as unknown as CanvasRenderingContext2D;
  renderBoard(context, THE_NEST.board, 650, 950, {
    heroes: [
      {
        label: 'Go',
        position: { row: 0, column: 0 },
        facing: 'north',
        woundsRemaining: 1,
        woundsMaximum: 3,
      },
    ],
    skaven: [
      {
        id: 'skaven-1',
        identifier: '1',
        label: 'RO',
        accessibleLabel: 'Rat Ogor',
        position: { row: 0, column: 2 },
        facing: 'west',
        woundsRemaining: 1,
        woundsMaximum: 2,
      },
    ],
  });
  const pips = circles.filter(circle => circle.radius === 50 * 0.065);
  assert.equal(pips.length, 5, 'one pip per printed Wound');
  assert.equal(pips.filter(pip => pip.fill === '#f3d38b').length, 2);
  assert.equal(pips.filter(pip => pip.fill === '#171310').length, 3);
  assert.ok(
    pips.every(pip => pip.stroke === '#fff0dc'),
    'lost HP remains visible as hollow pips'
  );
});
