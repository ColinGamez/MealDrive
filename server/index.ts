import './env';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { handleShoppingExport } from './shoppingApi';
import {
  handleAnalyzeFridge,
  handleGenerateMealPlan,
  handleGenerateRecipes,
  handleGenerateSpeech,
  handleSwapMeal,
} from './geminiApi';
import { createRateLimiter, RateLimitOptions } from './rateLimit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distPath = path.resolve(root, 'dist');

export type AppMode = 'development' | 'production' | 'test';

export interface AppOptions {
  mode?: AppMode;
  rateLimits?: {
    ai?: RateLimitOptions;
    shopping?: RateLimitOptions;
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function createApp(
  options: AppOptions = {},
) {
  const mode = options.mode ?? (process.argv.includes('production') ? 'production' : 'development');
  const isProduction = mode === 'production';
  const app = express();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY_HOPS) {
    app.set('trust proxy', positiveInteger(process.env.TRUST_PROXY_HOPS, 1));
  }

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const aiRateLimit = options.rateLimits?.ai ?? {
    max: positiveInteger(process.env.AI_RATE_LIMIT_MAX, 30),
    windowMs: positiveInteger(process.env.AI_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    message: 'Too many AI requests. Please wait before trying again.',
  };
  const shoppingRateLimit = options.rateLimits?.shopping ?? {
    max: positiveInteger(process.env.SHOPPING_RATE_LIMIT_MAX, 60),
    windowMs: positiveInteger(
      process.env.SHOPPING_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
    ),
    message: 'Too many shopping export requests. Please wait before trying again.',
  };

  app.use('/api/ai', createRateLimiter(aiRateLimit));
  app.use('/api/shopping', createRateLimiter(shoppingRateLimit));

  app.post('/api/shopping/export', handleShoppingExport);

  app.post('/api/ai/analyze-fridge', handleAnalyzeFridge);
  app.post('/api/ai/recipes', handleGenerateRecipes);
  app.post('/api/ai/meal-plan', handleGenerateMealPlan);
  app.post('/api/ai/swap-meal', handleSwapMeal);
  app.post('/api/ai/speech', handleGenerateSpeech);

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  const jsonErrorHandler: express.ErrorRequestHandler = (error, _req, res, next) => {
    const type = (error as { type?: string }).type;
    if (type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Request body must contain valid JSON.' });
      return;
    }
    if (type === 'entity.too.large') {
      res.status(413).json({ message: 'Request body is too large.' });
      return;
    }
    next(error);
  };
  app.use(jsonErrorHandler);

  if (isProduction) {
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      throw new Error('Production build not found. Run `npm run build` before `npm run start`.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (mode === 'development') {
    const vite = await createViteServer({
      root,
      server: {
        middlewareMode: true,
      },
    });

    app.use(vite.middlewares);
  }

  return app;
}

export async function startServer() {
  const mode: AppMode = process.argv.includes('production') ? 'production' : 'development';
  const port = Number(process.env.PORT || 3000);
  const app = await createApp({ mode });

  return app.listen(port, () => {
    console.log(`mealDrive server running in ${mode} mode at http://localhost:${port}`);
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error('Failed to start mealDrive server', error);
    process.exit(1);
  });
}
