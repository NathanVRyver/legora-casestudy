import { Router, Request, Response } from 'express';
import { createError, createSuccess } from '@messaging/shared';
import { sseManager, sseTokenManager } from '../../helpers/sse';
import { validateBearerToken } from '../../helpers/sse-auth';
import pino from 'pino';

const logger = pino();

export const sseRouter = Router();

/**
 * creates temporary session token for sse authentication
 * @param req - express request with bearer token in header
 * @param res - express response with session token
 */
sseRouter.post('/session', async (req, res) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const sessionToken = sseTokenManager.createSession(userResult.data!.id);

  res.json(createSuccess({ sessionToken }));
});

/**
 * establishes server-sent events connection for real-time updates
 * @param req - express request with session token in query
 * @param res - express response stream for sse events
 */
sseRouter.get('/events', async (req: Request, res: Response) => {
  const sessionToken = req.query['session'] as string;
  
  if (!sessionToken) {
    return res.status(401).json(createError('Session token required'));
  }

  const session = sseTokenManager.getSession(sessionToken);
  if (!session) {
    return res.status(401).json(createError('Invalid or expired session token'));
  }

  const userId = session.userId;
  logger.info(`SSE connection attempt for user: ${userId}, session: ${sessionToken}`);

  const connectionAdded = sseManager.addConnection(userId, res);
  if (!connectionAdded) {
    logger.info(`SSE connection rejected for user: ${userId}, session: ${sessionToken}`);
    return;
  }
  
  logger.info(`SSE connection accepted for user: ${userId}, session: ${sessionToken}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no', 
  });

  // send  the initial connection message
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  const onlineUsers = sseManager.getOnlineUsers();
  res.write(`event: online-users\n`);
  res.write(`data: ${JSON.stringify({ type: 'online-users', users: onlineUsers })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\n`);
      res.write(
        `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
      );
    } catch (_error) {
      console.error('Heartbeat failed for user', userId, _error);
      clearInterval(heartbeatInterval);
      sseManager.removeConnection(userId);
    }
  }, 30000);

  req.on('close', () => {
    logger.info(`SSE connection closed for user: ${userId}`);
    clearInterval(heartbeatInterval);
    sseManager.removeConnection(userId);
  });

  req.on('error', (error) => {
    logger.error(`SSE connection error for user ${userId}:`, error);
    clearInterval(heartbeatInterval);
    sseManager.removeConnection(userId);
  });
});

/**
 * notifies about user typing status change
 * @param req - express request with recipient id and typing status
 * @param res - express response with success confirmation
 */
sseRouter.post('/typing', async (req: Request, res: Response) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const { recipientId, isTyping } = req.body;

  if (!recipientId || typeof isTyping !== 'boolean') {
    return res.status(400).json(createError('recipientId and isTyping are required'));
  }

  sseManager.notifyTyping(userResult.data!.id, recipientId, isTyping);

  res.json({ success: true });
});

/**
 * checks if specific user is currently online
 * @param req - express request with user id in params
 * @param res - express response with online status
 */
sseRouter.get('/online/:userId', async (req: Request, res: Response) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const userId = req.params['userId'];
  const isOnline = sseManager.isUserOnline(userId as string);

  res.json({ success: true, data: { userId, isOnline } });
});

/**
 * gets list of all currently online users
 * @param req - express request with authorization header
 * @param res - express response with online users list
 */
sseRouter.get('/online', async (req: Request, res: Response) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const onlineUsers = sseManager.getOnlineUsers();

  res.json({ success: true, data: { onlineUsers } });
});
