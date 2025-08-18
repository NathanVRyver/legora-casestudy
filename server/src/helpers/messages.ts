import { CreateMessageSchema, MessageFilterSchema } from '@messaging/shared';
import { getUserByToken } from '../db/operations';
import { ParsedData, CreateMessageData, MessageFilterData, User } from '../types';
import pino from 'pino';

const logger = pino();

/**
 * parses bearer token from authorization header
 * @param authHeader - authorization header string
 * @returns extracted token or error message
 */
export function parseAuthorizationHeader(authHeader?: string): ParsedData<string> {
  if (!authHeader) {
    return { error: 'Authorization header required' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid authorization format. Use: Bearer <token>' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return { error: 'Empty authorization token' };
  }

  return { data: token };
}

/**
 * parses and validates message creation request body
 * @param body - request body containing message data
 * @returns parsed message content and recipient id or error
 */
export function parseCreateMessageBody(body: any): ParsedData<CreateMessageData> {
  try {
    const parsed = CreateMessageSchema.parse(body);
    return { data: { content: parsed.content, recipient_id: parsed.recipient_id } };
  } catch (_error) {
    return { error: 'Invalid message data format' };
  }
}

/**
 * parses and validates message filter query parameters
 * @param query - query parameters for message filtering
 * @returns parsed filter options or error message
 */
export function parseMessageFilterQuery(query: any): ParsedData<MessageFilterData> {
  try {
    const parsed = MessageFilterSchema.parse(query);
    return { data: { limit: parsed.limit, cursor: parsed.cursor, status: parsed.status } };
  } catch (_error) {
    return { error: 'Invalid filter parameters' };
  }
}

/**
 * authenticates request using bearer token
 * @param authHeader - authorization header with bearer token
 * @returns authenticated user data or error message
 */
export async function authenticateRequest(authHeader?: string): Promise<ParsedData<Omit<User, 'password_hash'>>> {
  const tokenResult = parseAuthorizationHeader(authHeader);
  if (tokenResult.error) {
    return { error: tokenResult.error };
  }

  const userResult = await getUserByToken(tokenResult.data!);
  if (userResult.error) {
    logger.error('Token validation error:', userResult.error);
    return { error: 'Invalid authentication token' };
  }

  if (!userResult.data) {
    return { error: 'Authentication token expired' };
  }

  return { data: userResult.data };
}