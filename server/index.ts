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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distPath = path.resolve(root, 'dist');
const isProduction = process.argv.includes('production');
const port = Number(process.env.PORT || 3000);

async function createApp() {
  const app = express();

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/shopping/export', handleShoppingExport);

  app.post('/api/ai/analyze-fridge', handleAnalyzeFridge);
  app.post('/api/ai/recipes', handleGenerateRecipes);
  app.post('/api/ai/meal-plan', handleGenerateMealPlan);
  app.post('/api/ai/swap-meal', handleSwapMeal);
  app.post('/api/ai/speech', handleGenerateSpeech);

  if (isProduction) {
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      throw new Error('Production build not found. Run `npm run build` before `npm run start`.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      root,
      server: {
        middlewareMode: true,
      },
    });

    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    const mode = isProduction ? 'production' : 'development';
    console.log(`mealDrive server running in ${mode} mode at http://localhost:${port}`);
  });
}

createApp().catch((error) => {
  console.error('Failed to start mealDrive server', error);
  process.exit(1);
});
