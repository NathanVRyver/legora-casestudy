import { Express, Router } from 'express';
import { healthRouter } from './health.js';
import { apiRouter } from './api/index.js';

export function setupRoutes(app: Express): void {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/api', apiRouter);

  app.use(router);
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });
}
