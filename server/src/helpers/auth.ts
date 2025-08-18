import { LoginSchema } from '@messaging/shared';
import { verifyPassword } from '../auth-security';
import { getUserByEmail, createUserSession } from '../db/operations';
import { ParsedData, LoginData, LoginResponse } from '../types';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino();

/**
 * parses and validates login request body
 * @param body - request body containing login data
 * @returns parsed email and password or error message
 */
export function parseLoginRequestBody(body: any): ParsedData<LoginData> {
  try {
    const parsed = LoginSchema.parse(body);
    return { data: { email: parsed.email, password: parsed.password } };
  } catch {
    return { error: 'Invalid login data format' };
  }
}

/**
 * processes user login with email and password verification
 * @param loginData - object containing email and password
 * @returns user data and session token or error message
 */
export async function processHttpLogin(loginData: LoginData): Promise<ParsedData<LoginResponse>> {
  const userResult = await getUserByEmail(loginData.email);
  if (userResult.error) {
    logger.error('Login database error:', userResult.error);
    return { error: 'Authentication failed' };
  }

  if (!userResult.data) {
    return { error: 'Invalid credentials' };
  }

  const passwordResult = await verifyPassword(loginData.password, userResult.data.password_hash);
  if (passwordResult.error) {
    logger.error('Password verification error:', passwordResult.error);
    return { error: 'Authentication failed' };
  }

  if (!passwordResult.data) {
    return { error: 'Invalid credentials' };
  }

  const token = crypto.randomBytes(32).toString('hex');

  const sessionResult = await createUserSession(userResult.data.id, token);
  if (sessionResult.error) {
    logger.error('Session creation error:', sessionResult.error);
    return { error: 'Authentication failed' };
  }

  return {
    data: {
      user: {
        id: userResult.data.id,
        username: userResult.data.username,
        email: userResult.data.email,
      },
      token,
    },
  };
}