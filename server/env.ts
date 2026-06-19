import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.MEALDRIVE_SKIP_ENV_LOAD !== 'true') {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(serverDir, '..');

  config({
    path: [path.join(root, '.env.local'), path.join(root, '.env')],
    quiet: true,
  });
}
