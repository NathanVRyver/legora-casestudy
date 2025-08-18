import { Pool, PoolClient } from 'pg';
import pino from 'pino';
import { config } from '../config/index.js';
import { error } from 'console';


const logger = pino();

let poolInstance: Pool | null = null;

function createDatabasePool(): { error?: string; data?: Pool } {
  if (!config.database.url) {
    return { error: 'Database URL not configured' };
  }

  try {
    const pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', err => {
      logger.error('Database pool error:', err);
    });

    return { data: pool };
  } catch (_error) {
    const message = error instanceof Error ? error.message : 'Pool creation failed';
    logger.error('Pool creation error:', message);
    return { error: `Failed to create database pool: ${message}` };
  }
}

function getPool(): { error?: string; data?: Pool } {
  if (poolInstance) {
    return { data: poolInstance };
  }

  const poolResult = createDatabasePool();
  if (poolResult.error) {
    return { error: poolResult.error };
  }

  poolInstance = poolResult.data!;
  return { data: poolInstance };
}

export async function executeQuery<T = any>(
  text: string,
  params?: any[]
): Promise<{ error?: string; data?: T[] }> {
  const poolResult = getPool();
  if (poolResult.error) {
    return { error: poolResult.error };
  }

  const start = Date.now();
  try {
    const res = await poolResult.data!.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms`, { duration, query: text });
    return { data: res.rows };
  } catch (_error) {
    const message = error instanceof Error ? error.message : 'Query execution failed';
    logger.error('Database query error:', { error: message, query: text, params });
    return { error: message };
  }
}

export async function getDatabaseClient(): Promise<{ error?: string; data?: PoolClient }> {
  const poolResult = getPool();
  if (poolResult.error) {
    return { error: poolResult.error };
  }

  try {
    const client = await poolResult.data!.connect();
    const originalQuery = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    const timeout = setTimeout(() => {
      logger.warn('Database client checked out for more than 5 seconds');
    }, 5000);

    // Wrap query and release to clear timeout
    client.query = (...args: any) => {
      clearTimeout(timeout);
      return originalQuery(...args);
    };

    client.release = () => {
      clearTimeout(timeout);
      return originalRelease();
    };

    return { data: client };
  } catch (_error) {
    const message = error instanceof Error ? error.message : 'Client connection failed';
    logger.error('Database client error:', message);
    return { error: message };
  }
}

export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<{ error?: string; data?: T }>
): Promise<{ error?: string; data?: T }> {
  const clientResult = await getDatabaseClient();
  if (clientResult.error) {
    return { error: clientResult.error };
  }

  const client = clientResult.data!;

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    if (result.error) {
      await client.query('ROLLBACK');
      return { error: result.error };
    }

    await client.query('COMMIT');
    return { data: result.data };
  } catch (_error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Transaction rollback failed:', rollbackError as undefined);
    }

    const message = _error instanceof Error ? _error.message : 'Transaction failed';
    logger.error('Transaction error:', message);
    return { error: message };
  } finally {
    client.release();
  }
}

export async function closeDatabasePool(): Promise<{ error?: string }> {
  if (!poolInstance) {
    return {};
  }

  try {
    await poolInstance.end();
    poolInstance = null;
    logger.info('Database pool closed successfully');
    return {};
  } catch (_error) {
    const message = error instanceof Error ? error.message : 'Pool close failed';
    logger.error('Pool close error:', message);
    return { error: message };
  }
}
