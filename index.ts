import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import '/components/GameBoard.js';
import '/components/GameSetup.js';
import '/components/ConfirmationModal.js';
import '/components/UpdateNotification.js';
import ToastMessage from '/components/ToastMessage.js';
import DataStore from '/src/DataStore.js';
import { h } from './src/utils.js';
import { createGameEventDelegate } from '/src/game/gameModule.js';
import type { GameModule } from '/src/game/gameModule.js';
import { GameSession } from '/src/game/gameSession.js';
import { browserRandomSource } from '/src/game/gameState.js';
import { runSoloSkavenAi } from '/src/game/skavenAi.js';
import { SetupGameModule } from '/src/game/modules/setup.js';
import { InitialNoiseGameModule } from '/src/game/modules/initialNoise.js';
import { HeroTurnGameModule } from '/src/game/modules/heroTurn.js';
import { SkavenTurnGameModule } from '/src/game/modules/skavenTurn.js';
import { THE_NEST } from '/src/game/missions/theNest.js';
import type { ImportantEventPresentation } from '/src/game/eventPresentation.js';

const whenLoaded = Promise.all([
  customElements.whenDefined('update-notification'),
  customElements.whenDefined('confirmation-modal'),
  customElements.whenDefined('toast-message'),
]);

whenLoaded.then(async () => {
  const updateNotification = document.querySelector('update-notification');

  window.addEventListener('sw-update-available', event => {
    console.log('Service worker update available, showing notification');
    updateNotification?.show(event.detail.pendingWorker);
  });

  await serviceWorkerManager.register();

  // actual game bootstrapping
  const board = document.querySelector('game-board');
  const setup = document.querySelector('game-setup');
  const confirmationModal = document.querySelector('confirmation-modal');
  const header = document.querySelector<HTMLElement>('#main-head');
  if (!board || !setup || !confirmationModal || !header) {
    throw new Error('The game board, setup controls, and application shell are required');
  }
  const quitGame =
    document.querySelector<HTMLButtonElement>('#quit-game') ??
    h('button', { id: 'quit-game', type: 'button', hidden: true, textContent: 'Quit game' });
  if (!quitGame.isConnected) header.append(quitGame);

  const highlight = document.querySelector<ToastMessage>('#event-highlight');
  if (!highlight) throw new Error('The event highlight is required');
  document.addEventListener('game-important-event', event => {
    const result = (event as CustomEvent<ImportantEventPresentation>).detail;
    highlight.show(result.title, result.detail);
  });

  DataStore.init();
  const savedGame = DataStore.savedGame;
  const session = new GameSession(THE_NEST, browserRandomSource, savedGame?.state, state => {
    DataStore.saveGame(state);
    quitGame.hidden = false;
  });
  quitGame.hidden = session.heroView.setupStep === 'select-roster';

  quitGame.addEventListener('click', () => {
    const cleanup = () => {
      confirmationModal.removeEventListener('confirm', confirm);
      confirmationModal.removeEventListener('cancel', cancel);
    };
    const confirm = () => {
      cleanup();
      DataStore.clearSavedGame();
      window.location.reload();
    };
    const cancel = () => cleanup();
    confirmationModal.addEventListener('confirm', confirm);
    confirmationModal.addEventListener('cancel', cancel);
    confirmationModal.showModal('Quit this game? All saved progress will be deleted.');
  });

  const gameModules: readonly GameModule[] = Object.freeze([
    new SetupGameModule({ session, board, setup }),
    new InitialNoiseGameModule({ session, board, setup, randomSource: browserRandomSource }),
    new HeroTurnGameModule({ session, board, setup, randomSource: browserRandomSource }),
    new SkavenTurnGameModule({ session, board, setup, randomSource: browserRandomSource }),
  ]);
  const delegateGameEvent = createGameEventDelegate(gameModules);
  const gameEventTypes = new Set(gameModules.flatMap(module => module.eventTypes));
  for (const eventType of gameEventTypes) document.addEventListener(eventType, delegateGameEvent);
  const resumedEvents = savedGame ? runSoloSkavenAi(session, browserRandomSource) : [];
  for (const module of gameModules) module.render();
  if (resumedEvents.length > 0) setup.announce(resumedEvents);
});
