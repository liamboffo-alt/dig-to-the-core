// Entry point:  npm run server        (PORT, DATA_FILE and STATIC_DIR are optional)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PORT } from '../src/shared/protocol';
import { startServer } from './server';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const dataFile = resolve(process.env.DATA_FILE ?? 'server/data/rooms.json');
const dist = resolve(process.env.STATIC_DIR ?? 'dist');
const server = startServer({ port, dataFile, staticDir: existsSync(dist) ? dist : null });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { void server.close().then(() => process.exit(0)); });
}
