// App-specific service-worker resources.
// Add URL paths here when the app introduces pages or assets beyond the
// template defaults. These paths must also be copied into dist/ by
// scripts/copy-assets.mjs.
const AppCacheResources = Object.freeze({
  core: [
    '/components/GameBoard.js',
    '/src/canvas/boardGeometry.js',
    '/src/canvas/boardRenderer.js',
    '/src/game/map.js',
    '/src/game/missions/theNest.js',
  ],
  static: [],
});

self.AppCacheResources = AppCacheResources;
