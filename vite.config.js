import { defineConfig } from 'vite';
import { readProject, saveLook, ROOT } from './scripts/project-store.mjs';
import { createStudioApi } from './scripts/studio-api.mjs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export default defineConfig({
  resolve: { dedupe: ['three'] },
  // Experimental renderers have their own dependencies. The Studio must use
  // one Three.js version for both scene matrices and renderer add-ons.
  optimizeDeps: { entries: ['index.html'] },
  plugins: [{name:'lightweight-public-demo',transformIndexHtml:{order:'pre',handler(html){return process.env.VITE_PUBLIC_DEMO==='true'?html.replace('/src/viewer/main.js','/src/viewer/demo-main.js'):html;}}},{
    name: 'motion-local-project',
    configureServer(server) {
      server.middlewares.use('/api', createStudioApi());
      server.middlewares.use('/api', async (req, res, next) => {
        const send = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };
        try {
          if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Same-origin local requests only' });
          const { listReferences, addReference, addLink } = await import('./scripts/reference.mjs');
          if (req.method === 'GET' && req.url === '/project') return send(200, { look: await readProject('look'), motion: await readProject('motion'), references: await listReferences() });
          if (req.method !== 'POST') return send(404, { error: 'Unknown local endpoint' });
          let raw = '', size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 40 * 1024 * 1024) throw Error('Reference upload limit: 30 MB');
            raw += chunk;
          }
          const body = JSON.parse(raw);
          if (req.url === '/look') return send(200, { look: await saveLook(body) });
          if (req.url === '/references') {
            if (body.url) return send(200, await addLink(body));
            const ext = path.extname(body.filename || '').toLowerCase();
            if (!['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'].includes(ext)) throw Error('Unsupported reference type');
            const dir = path.join(ROOT, '.reference-upload');
            await mkdir(dir, { recursive: true });
            const file = path.join(dir, randomUUID() + ext);
            try { await writeFile(file, Buffer.from(body.data, 'base64')); return send(200, await addReference({ file, role: body.role, note: body.note })); }
            finally { await rm(file, { force: true }); }
          }
          return next();
        } catch (error) { return send(error.status ?? 400, { error: error.message }); }
      });
    }
  }]
});
