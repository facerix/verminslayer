import liveServer from 'live-server';

liveServer.start({
  root: 'dist',
  port: 8140,
  open: false,
  middleware: [
    (request, _response, next) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/game') request.url = `/game.html${url.search}`;
      next();
    },
  ],
});
