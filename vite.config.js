import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import syncHandler from './api/sync.js';
import uploadHandler from './api/upload.js';
import imageHandler from './api/image.js';

function apiMiddlewarePlugin() {
  return {
    name: 'api-sync-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api/sync') || req.url.startsWith('/api/upload') || req.url.startsWith('/api/image'))) {
          let handler = syncHandler;
          if (req.url.startsWith('/api/upload')) {
            handler = uploadHandler;
          } else if (req.url.startsWith('/api/image')) {
            handler = imageHandler;
          }

          // Parse query params
          const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5173'}`);
          req.query = Object.fromEntries(parsedUrl.searchParams.entries());

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
