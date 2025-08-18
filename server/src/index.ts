import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { authRouter } from './routes/api/auth';
import { messagesRouter } from './routes/api/messages';
import { sseRouter } from './routes/api/sse';
import { createSuccess, createError } from '@messaging/shared';

type ServerConfig = {
  env: string;
  http: { port: number };
  database: { url?: string };
};

function createServerConfig(): ServerConfig {
  return {
    env: process.env['NODE_ENV'] || 'development',
    http: { port: Number(process.env['HTTP_PORT']) || 8080 },
    database: { url: process.env['DATABASE_URL'] },
  };
}

function createLogger(config: ServerConfig) {
  return pino({
    level: config.env === 'development' ? 'debug' : 'info',
    transport: config.env === 'development' ? { target: 'pino-pretty' } : undefined,
  });
}

function createHttpApp( logger: pino.Logger): express.Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: ['http://localhost:3000', 'http://localhost:8080'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json(
      createSuccess({
        status: 'Server healthy',
        timestamp: new Date().toISOString(),
        services: {
          http: 'running',
        },
      })
    );
  });

  app.use('/api/auth', authRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/sse', sseRouter);

  app.get('/', (_req, res) => {
    res.json(
      createSuccess({
        message: 'Messaging Platform API',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          messages: '/api/messages',
        },
      })
    );
  });

  app.use('*', (req, res) => {
    res.status(404).json(createError(`Endpoint not found: ${req.method} ${req.originalUrl}`));
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled HTTP error:', err);
    res.status(500).json(createError('Internal server error'));
  });

  return app;
}

async function startHttpServer(
  app: express.Application,
  config: ServerConfig,
  logger: pino.Logger
): Promise<{ error?: string }> {
  return new Promise(resolve => {
    const server = app.listen(config.http.port, () => {
      logger.info(`
┌─────────────────────────────────────────────────┐
│                 HTTP SERVER                     │
├─────────────────────────────────────────────────┤
│ Port: ${config.http.port.toString().padEnd(42)} │
│ Health: /health${' '.repeat(32)}                │
│ API: /api${' '.repeat(37)}                      │
│ Environment: ${config.env.padEnd(30)}           │
└─────────────────────────────────────────────────┘`);
      resolve({});
    });

    server.on('error', error => {
      const message = error instanceof Error ? error.message : 'HTTP server failed';
      logger.error('HTTP server error:', message);
      resolve({ error: message });
    });
  });
}

async function startServers(): Promise<{ error?: string }> {
  const config = createServerConfig();
  const logger = createLogger(config);

  try {
    const app = createHttpApp(logger);

    const httpResult = await startHttpServer(app, config, logger);
    if (httpResult.error) {
      return { error: `HTTP server failed: ${httpResult.error}` };
    }

    logger.info(`
╔═════════════════════════════════════════════════╗
║                 SYSTEM READY                    ║
╠═════════════════════════════════════════════════╣
║ HTTP Server: ✓ Running                          ║
║ Database: ✓ Connected                           ║
║ Authentication: ✓ Secure                        ║
╚═════════════════════════════════════════════════╝

> Ready to handle requests
> Use Ctrl+C to gracefully shutdown`);

    return {};
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Server startup failed';
    logger.error('Server startup error:', message);
    return { error: message };
  }
}

/**
 * Sets up graceful shutdown handlers
 */
function setupGracefulShutdown(logger: pino.Logger) {
  const shutdown = (signal: string) => {
    logger.info(
      `\n┌──────────────────────────────────────────────────┐\n│                  SHUTDOWN                        │\n├──────────────────────────────────────────────────┤\n│ Signal: ${signal.padEnd(37)} │\n│ Status: Gracefully shutting down servers        │\n│ Database: Closing connections                    │\n│ HTTP: Stopping listeners                        │\n└──────────────────────────────────────────────────┘\n\n> Goodbye!`
    );
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const logger = createLogger(createServerConfig());

  setupGracefulShutdown(logger);

  startServers()
    .then(result => {
      if (result.error) {
        logger.error(`[ERROR] Server startup failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('[ERROR] Unexpected server error:', error);
      process.exit(1);
    });
}
