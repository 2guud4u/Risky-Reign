import { defineConfig, type Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIECES } from './pieces';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const abs = (p: string) => path.join(repo, p);

const exists = (p: string) =>
  fs.access(abs(p)).then(
    () => true,
    () => false
  );

/** Strip a `data:image/png;base64,` prefix into raw bytes. */
const dataUrlBytes = (url: string): Buffer => {
  const m = /^data:image\/png;base64,(.+)$/.exec(url);
  if (!m) throw new Error('expected a PNG data URL');
  return Buffer.from(m[1], 'base64');
};

const readBody = (req: NodeJS.ReadableStream): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  let s = '';
  req.setEncoding('utf8');
  req.on('data', (c) => (s += c));
  req.on('end', () => resolve(s));
  req.on('error', reject);
  return promise;
};

/**
 * Local file API for the painter: lists pieces, streams their source and
 * saved layers, and writes the re-editable layers + the shipped game PNGs.
 * Only paths declared in pieces.ts are ever read or written.
 */
function pieceApi(): Plugin {
  return {
    name: 'mask-painter-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const m = /^\/api\/pieces(?:\/([\w-]+)(?:\/(source|mask|silhouette))?)?$/.exec(url.pathname);
        if (!m) return next();
        try {
          const [, id, file] = m;
          if (!id) {
            const list = await Promise.all(
              Object.entries(PIECES).map(async ([pid, p]) => ({
                id: pid,
                label: p.label,
                longSide: p.longSide,
                hasMask: await exists(p.maskLayer),
                hasSilhouette: await exists(p.silhouetteLayer),
              }))
            );
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(list));
          }
          const piece = PIECES[id];
          if (!piece) {
            res.statusCode = 404;
            return res.end('unknown piece');
          }
          if (req.method === 'GET' && file) {
            const p = file === 'source' ? piece.source : file === 'mask' ? piece.maskLayer : piece.silhouetteLayer;
            res.setHeader('Content-Type', p.endsWith('.png') ? 'image/png' : 'image/jpeg');
            res.setHeader('Cache-Control', 'no-store');
            return res.end(await fs.readFile(abs(p)));
          }
          if (req.method === 'POST' && !file) {
            const body = JSON.parse(await readBody(req)) as Record<
              'maskLayer' | 'silhouetteLayer' | 'art' | 'mask',
              string
            >;
            const writes: [string, string][] = [
              [piece.maskLayer, body.maskLayer],
              [piece.silhouetteLayer, body.silhouetteLayer],
              [piece.outArt, body.art],
              [piece.outMask, body.mask],
            ];
            for (const [p, data] of writes) {
              await fs.mkdir(path.dirname(abs(p)), { recursive: true });
              await fs.writeFile(abs(p), dataUrlBytes(data));
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ wrote: writes.map(([p]) => p) }));
          }
          res.statusCode = 405;
          res.end();
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [pieceApi()],
  server: { port: 5199 },
});
