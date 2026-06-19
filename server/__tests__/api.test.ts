import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import type { AppOptions } from '../index';

process.env.MEALDRIVE_SKIP_ENV_LOAD = 'true';

const { createApp } = await import('../index');

async function withServer<T>(
  run: (baseUrl: string) => Promise<T>,
  options: AppOptions = {},
): Promise<T> {
  const app = await createApp({ ...options, mode: 'test' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address() as AddressInfo;
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('MealDrive API', () => {
  it('reports service health', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('permissions-policy') || '', /camera=\(self\)/);
    });
  });

  it('returns JSON for malformed request bodies', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });

      assert.equal(response.status, 400);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      assert.deepEqual(await response.json(), {
        message: 'Request body must contain valid JSON.',
      });
    });
  });

  it('validates AI payloads before checking credentials', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await withServer(async (baseUrl) => {
        const imageResponse = await postJson(baseUrl, '/api/ai/analyze-fridge', {});
        assert.equal(imageResponse.status, 400);

        const invalidImageResponse = await postJson(baseUrl, '/api/ai/analyze-fridge', {
          image: 'data:text/plain;base64,SGVsbG8=',
        });
        assert.equal(invalidImageResponse.status, 400);

        const recipeResponse = await postJson(baseUrl, '/api/ai/recipes', {
          ingredients: 'eggs',
        });
        assert.equal(recipeResponse.status, 400);

        const speechResponse = await postJson(baseUrl, '/api/ai/speech', { text: '   ' });
        assert.equal(speechResponse.status, 400);
      });
    } finally {
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  it('returns a clear service error when Gemini is not configured', async () => {
    const previousKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await withServer(async (baseUrl) => {
        const response = await postJson(baseUrl, '/api/ai/recipes', {
          ingredients: [],
          dietaryRestrictions: [],
          language: 'en',
        });

        assert.equal(response.status, 503);
        assert.match(JSON.stringify(await response.json()), /GEMINI_API_KEY/);
      });
    } finally {
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  it('reports the shopping provider and missing credentials', async () => {
    const credentialNames = [
      'INSTACART_API_KEY',
      'RAKUTEN_APPLICATION_ID',
      'RAKUTEN_ACCESS_KEY',
      'NAVER_CLIENT_ID',
      'NAVER_CLIENT_SECRET',
    ] as const;
    const previous = Object.fromEntries(
      credentialNames.map((name) => [name, process.env[name]]),
    );
    credentialNames.forEach((name) => delete process.env[name]);

    try {
      await withServer(async (baseUrl) => {
        const response = await postJson(baseUrl, '/api/shopping/export', {
          language: 'en',
          items: [
            { id: 'milk', name: 'Milk', amount: '1 carton', checked: false },
          ],
        });
        const payload = await response.json() as {
          provider?: { id?: string };
          missingCredentials?: string[];
        };

        assert.equal(response.status, 503);
        assert.equal(payload.provider?.id, 'instacart');
        assert.deepEqual(payload.missingCredentials, ['INSTACART_API_KEY']);
      });
    } finally {
      credentialNames.forEach((name) => {
        const value = previous[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      });
    }
  });

  it('returns JSON for unknown API routes', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/not-real`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { message: 'API route not found.' });
    });
  });

  it('rate limits repeated AI requests and returns retry metadata', async () => {
    await withServer(
      async (baseUrl) => {
        const first = await postJson(baseUrl, '/api/ai/speech', {});
        const second = await postJson(baseUrl, '/api/ai/speech', {});
        const limited = await postJson(baseUrl, '/api/ai/speech', {});

        assert.equal(first.status, 400);
        assert.equal(second.status, 400);
        assert.equal(limited.status, 429);
        assert.equal(limited.headers.get('ratelimit-limit'), '2');
        assert.equal(limited.headers.get('ratelimit-remaining'), '0');
        assert.ok(Number(limited.headers.get('retry-after')) > 0);
      },
      {
        rateLimits: {
          ai: {
            max: 2,
            windowMs: 60_000,
            message: 'AI test limit reached.',
          },
        },
      },
    );
  });
});
