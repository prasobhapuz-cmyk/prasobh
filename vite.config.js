import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import syncHandler from './api/sync.js';

function apiMiddlewarePlugin() {
  return {
    name: 'api-sync-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/sync')) {
          // Read body for POST
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => bodyStr += chunk);
            req.on('end', async () => {
              try {
                req.body = bodyStr ? JSON.parse(bodyStr) : {};
              } catch (e) {
                req.body = {};
              }
              // Mock Vercel res helper
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
              await syncHandler(req, res);
            });
            return;
          } else {
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
            await syncHandler(req, res);
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
