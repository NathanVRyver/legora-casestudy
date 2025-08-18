import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', (req, res) => {
  // no time to do database connection etc...
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});
