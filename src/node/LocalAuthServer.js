import http from 'http';
import { URL } from 'url';

/**
 * Starts a temporary local HTTP server that waits for Spotify's OAuth callback.
 * Resolves with { code, state } when the callback is received, then shuts down.
 */
export function waitForCallback(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const state = url.searchParams.get('state');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization failed</h1><p>You can close this window.</p>');
        server.close();
        reject(new Error(`Spotify authorization error: ${error}`));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>');
      server.close();
      resolve({ code, state });
    });

    server.listen(port, '127.0.0.1', () => {
      // Ready — caller opens the browser and awaits this promise
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`spot-auth: port ${port} is already in use. Set a different redirectUri port in your config.`));
      } else {
        reject(err);
      }
    });
  });
}
