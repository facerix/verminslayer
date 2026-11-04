import { serviceWorkerManager } from '/src/ServiceWorkerManager.js';
import '/components/UpdateNotification.js';
import '/components/StageSelectModal.js';
import DataStore from '/src/DataStore.js';
import { MISSIONS } from '/src/game/missions/registry.js';
import { gameUrl } from '/src/game/navigation.js';
import type StageSelectModal from '/components/StageSelectModal.js';

const whenReady = Promise.all([
  customElements.whenDefined('update-notification'),
  customElements.whenDefined('stage-select-modal'),
]);

whenReady.then(async () => {
  const updateNotification = document.querySelector('update-notification');
  window.addEventListener('sw-update-available', event => {
    updateNotification?.show(event.detail.pendingWorker);
  });
  await serviceWorkerManager.register();

  const missionSelect = document.querySelector<StageSelectModal>('stage-select-modal');
  const newGame = document.querySelector<HTMLAnchorElement>('#new-game');
  const continueGame = document.querySelector<HTMLAnchorElement>('#continue-game');

  DataStore.init();
  const savedGame = DataStore.savedGame;
  if (savedGame && continueGame) {
    const mission = MISSIONS[savedGame.state.missionId];
    if (!mission) throw new Error(`Saved game has unknown mission ${savedGame.state.missionId}`);
    continueGame.href = gameUrl(mission.id);
    continueGame.textContent = `Continue ${mission.name}`;
    continueGame.hidden = false;
  }

  newGame?.addEventListener("click", evt => {
    evt.preventDefault();
    missionSelect?.showModal();
  })
});
