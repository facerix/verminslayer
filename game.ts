import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import '/components/GameBoard.js';
import '/components/GameSetup.js';
import '/components/ConfirmationModal.js';
import '/components/UpdateNotification.js';
import ToastMessage from '/components/ToastMessage.js';
import DataStore from '/src/DataStore.js';
import { createGameEventDelegate } from '/src/game/gameModule.js';
import type { GameModule } from '/src/game/gameModule.js';
import { GameSession } from '/src/game/gameSession.js';
import { browserRandomSource } from '/src/game/gameState.js';
import { runSoloSkavenAi } from '/src/game/skavenAi.js';
import { SetupGameModule } from '/src/game/modules/setup.js';
import { InitialNoiseGameModule } from '/src/game/modules/initialNoise.js';
import { HeroTurnGameModule } from '/src/game/modules/heroTurn.js';
import { SkavenTurnGameModule } from '/src/game/modules/skavenTurn.js';
import { getMissionDefinition } from '/src/game/missions/registry.js';
import { missionIdFromSearch } from '/src/game/navigation.js';
import type { MissionDefinition } from '/src/game/missionDefinition.js';
import type { GameState } from '/src/game/gameState.js';
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
  const missionTitle = document.querySelector<HTMLElement>('#mission-title');
  const quitGame = document.querySelector<HTMLButtonElement>('#quit-game');
  if (!board || !setup || !confirmationModal || !missionTitle || !quitGame) {
    throw new Error('The game board, setup controls, and application shell are required');
  }
  const mission = getMissionDefinition(missionIdFromSearch(window.location.search));
  missionTitle.textContent = mission.name;
  document.title = `${mission.name} · Verminslayer`;

  const highlight = document.querySelector<ToastMessage>('#event-highlight');
  if (!highlight) throw new Error('The event highlight is required');
  document.addEventListener('game-important-event', event => {
    const result = (event as CustomEvent<ImportantEventPresentation>).detail;
    highlight.show(result.title, result.detail);
  });

  DataStore.init();
  const savedGame = DataStore.savedGame;

  quitGame.addEventListener('click', () => {
    const cleanup = () => {
      confirmationModal.removeEventListener('confirm', confirm);
      confirmationModal.removeEventListener('cancel', cancel);
    };
    const confirm = () => {
      cleanup();
      DataStore.clearSavedGame();
      window.location.assign('/');
    };
    const cancel = () => cleanup();
    confirmationModal.addEventListener('confirm', confirm);
    confirmationModal.addEventListener('cancel', cancel);
    confirmationModal.showModal('Quit this game? All saved progress will be deleted.');
  });

  const startGame = (mission: MissionDefinition, savedState?: GameState) => {
    board.mission = mission;
    const session = new GameSession(mission, browserRandomSource, savedState, state => {
      DataStore.saveGame(state);
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
    const resumedEvents = savedState ? runSoloSkavenAi(session, browserRandomSource) : [];
    for (const module of gameModules) module.render();
    if (resumedEvents.length > 0) setup.announce(resumedEvents);
  };

  if (savedGame && savedGame.state.missionId !== mission.id) {
    const cleanup = () => {
      confirmationModal.removeEventListener('confirm', confirm);
      confirmationModal.removeEventListener('cancel', cancel);
    };
    const confirm = () => {
      cleanup();
      DataStore.clearSavedGame();
      startGame(mission);
    };
    const cancel = () => {
      cleanup();
      window.location.assign('/');
    };
    confirmationModal.addEventListener('confirm', confirm);
    confirmationModal.addEventListener('cancel', cancel);
    confirmationModal.showModal(
      `Start ${mission.name}? Your saved ${getMissionDefinition(savedGame.state.missionId).name} game will be deleted.`
    );
  } else {
    startGame(mission, savedGame?.state);
  }
});
