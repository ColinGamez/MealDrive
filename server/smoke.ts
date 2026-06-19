import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createApp } from './index';

const app = await createApp({ mode: 'production' });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');

const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const [healthResponse, pageResponse] = await Promise.all([
    fetch(`${baseUrl}/api/health`),
    fetch(baseUrl),
  ]);

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true });
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /<title>MealDrive \| Smart AI Kitchen<\/title>/);

  console.log('Production smoke test passed.');
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
