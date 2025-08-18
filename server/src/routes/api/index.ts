import { Router } from 'express';
import { authRouter } from './auth.js';
import { messagesRouter } from './messages.js';
import { sseRouter } from './sse.js';

export const apiRouter = Router();

apiRouter.use('/', authRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/sse', sseRouter);
