// App-specific service-worker resources.
// Add URL paths here when the app introduces pages or assets beyond the
// template defaults. These paths must also be copied into dist/ by
// scripts/copy-assets.mjs.
const AppCacheResources = Object.freeze({
  core: [
    '/components/GameBoard.js',
    '/components/GameSetup.js',
    '/src/canvas/boardGeometry.js',
    '/src/canvas/boardRenderer.js',
    '/src/game/map.js',
    '/src/game/entities.js',
    '/src/game/gameModule.js',
    '/src/game/gameSession.js',
    '/src/game/gameState.js',
    '/src/game/lineOfSight.js',
    '/src/game/missionDefinition.js',
    '/src/game/modules/setup.js',
    '/src/game/modules/initialNoise.js',
    '/src/game/missions/theNest.js',
    '/src/game/missions/registry.js',
    '/src/game/rulesError.js',
  ],
  static: [],
});

self.AppCacheResources = AppCacheResources;
