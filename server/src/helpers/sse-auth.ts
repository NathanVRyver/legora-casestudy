import { getUserByToken } from '../db/operations';
import { ParsedData, User } from '../types';

/**
 * validates bearer token from authorization header
 * @param authHeader - authorization header string
 * @returns user data or error message
 */
export async function validateBearerToken(authHeader?: string): Promise<ParsedData<Omit<User, 'password_hash'>>> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const userResult = await getUserByToken(token);

  if (userResult.error || !userResult.data) {
    return { error: 'Invalid or expired token' };
  }

  return { data: userResult.data };
}