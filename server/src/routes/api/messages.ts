import { Router } from 'express';
import {
  createMessage,
  getUserMessages,
  updateMessageStatus,
  getConversationMessages,
} from '../../db/operations';
import {
  createSuccess,
  createError,
  CreateMessageSchema,
  MessageFilterSchema,
} from '@messaging/shared';
import { validateRequest } from '../../middleware/validation';
import { sseManager } from '../../helpers/sse';
import { parseCreateMessageBody, parseMessageFilterQuery } from '../../helpers/messages';
import { createAuthMiddleware } from '../../helpers/middleware';
import { AuthenticatedRequest } from '../../types';
import pino from 'pino';

const logger = pino();

const authMiddleware = createAuthMiddleware();

export const messagesRouter = Router();

const sendMessageValidationSchema = {
  body: CreateMessageSchema,
};

const getMessagesValidationSchema = {
  query: MessageFilterSchema,
};

/**
 * sends a new message to another user
 * @param req - express request with message content and recipient id
 * @param res - express response with created message data
 */
messagesRouter.post(
  '/',
  authMiddleware,
  validateRequest(sendMessageValidationSchema),
  async (req: AuthenticatedRequest, res) => {
    const messageData = parseCreateMessageBody(req.body);
    if (messageData.error) {
      return res.status(400).json(createError(messageData.error));
    }

    if (req.user.id === messageData.data!.recipient_id) {
      return res.status(400).json(createError('Cannot send message to yourself'));
    }

    const messageResult = await createMessage({
      content: messageData.data!.content,
      sender_id: req.user.id,
      recipient_id: messageData.data!.recipient_id,
    });

    if (messageResult.error) {
      logger.error('Message creation error:', messageResult.error);
      return res.status(500).json(createError('Failed to send message'));
    }

    sseManager.notifyNewMessage(req.user.id, messageData.data!.recipient_id, {
      ...messageResult.data!,
      sender_username: req.user.username,
    });

    res.status(201).json(createSuccess(messageResult.data!));
  }
);

/**
 * gets all messages for the authenticated user
 * @param req - express request with optional filter parameters
 * @param res - express response with user's messages
 */
messagesRouter.get(
  '/',
  authMiddleware,
  validateRequest(getMessagesValidationSchema),
  async (req: AuthenticatedRequest, res) => {
    const filterData = parseMessageFilterQuery(req.query);
    if (filterData.error) {
      return res.status(400).json(createError(filterData.error));
    }

    const messagesResult = await getUserMessages(req.user.id, {
      limit: filterData.data!.limit,
      cursor: filterData.data!.cursor,
    });

    if (messagesResult.error) {
      console.error('Get messages error:', messagesResult.error);
      return res.status(500).json(createError('Failed to retrieve messages'));
    }

    res.json(createSuccess(messagesResult.data!));
  }
);

/**
 * marks a message as read by the authenticated user
 * @param req - express request with message id in params
 * @param res - express response with success confirmation
 */
messagesRouter.patch('/:messageId/read', authMiddleware, async (req: any, res) => {
  const messageId = req.params.messageId;

  if (!messageId) {
    return res.status(400).json(createError('Message ID is required'));
  }

  const updateResult = await updateMessageStatus(messageId, 'read', req.user.id);
  if (updateResult.error) {
    console.error('Message status update error:', updateResult.error);
    return res.status(500).json(createError('Failed to mark message as read'));
  }

  res.json(createSuccess({ message: 'Message marked as read' }));
});

/**
 * gets conversation messages between authenticated user and specific user
 * @param req - express request with user id in params and optional cursor/limit
 * @param res - express response with conversation messages
 */
messagesRouter.get('/conversation/:userId', authMiddleware, async (req: any, res) => {
  const { userId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string;

  if (!userId) {
    return res.status(400).json(createError('User ID is required'));
  }

  if (userId === req.user.id) {
    return res.status(400).json(createError('Cannot get conversation with yourself'));
  }

  const conversationResult = await getConversationMessages(
    req.user.id,
    userId,
    limit,
    cursor
  );

  if (conversationResult.error) {
    console.error('Get conversation error:', conversationResult.error);
    return res.status(500).json(createError('Failed to retrieve conversation'));
  }

  res.json(createSuccess(conversationResult.data));
});

/**
 * health check endpoint for messages service
 * @param _req - express request (unused)
 * @param res - express response with service status
 */
messagesRouter.get('/health', (_req, res) => {
  res.json(
    createSuccess({
      status: 'Messages service healthy',
      timestamp: new Date().toISOString(),
    })
  );
});
