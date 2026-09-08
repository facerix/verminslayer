import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import '/components/GameBoard.js';
import '/components/GameSetup.js';
import '/components/UpdateNotification.js';
import { createGameEventDelegate } from '/src/game/gameModule.js';
import type { GameModule } from '/src/game/gameModule.js';
import { GameSession } from '/src/game/gameSession.js';
import { browserRandomSource } from '/src/game/gameState.js';
import { SetupGameModule } from '/src/game/modules/setup.js';
import { THE_NEST } from '/src/game/missions/theNest.js';

const board = document.querySelector('game-board');
const setup = document.querySelector('game-setup');
if (!board || !setup) throw new Error('The game board and setup controls are required');

const session = new GameSession(THE_NEST, browserRandomSource);
const gameModules: readonly GameModule[] = Object.freeze([
  new SetupGameModule({ session, board, setup }),
]);
const delegateGameEvent = createGameEventDelegate(gameModules);
const gameEventTypes = new Set(gameModules.flatMap(module => module.eventTypes));
for (const eventType of gameEventTypes) document.addEventListener(eventType, delegateGameEvent);
for (const module of gameModules) module.render();

const whenLoaded = customElements.whenDefined('update-notification');

whenLoaded.then(async () => {
  const updateNotification = document.querySelector('update-notification');

  window.addEventListener('sw-update-available', event => {
    console.log('Service worker update available, showing notification');
    updateNotification?.show(event.detail.pendingWorker);
  });

  await serviceWorkerManager.register();
});
