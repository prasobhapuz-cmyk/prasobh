import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import syncHandler from './api/sync.js';
import uploadHandler from './api/upload.js';

function apiMiddlewarePlugin() {
  return {
    name: 'api-sync-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/sync') || req.url.startsWith('/api/upload'))) {
          const handler = req.url.startsWith('/api/upload') ? uploadHandler : syncHandler;

          // Helper response methods
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => bodyStr += chunk);
            req.on('end', async () => {
              try {
                req.body = bodyStr ? JSON.parse(bodyStr) : {};
              } catch (e) {
                req.body = {};
              }
              await handler(req, res);
            });
            return;
          } else {
            await handler(req, res);
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  server: {
    port: 5173,
    host: true
  }
});
