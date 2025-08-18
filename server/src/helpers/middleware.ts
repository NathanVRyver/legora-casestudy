import { NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { createError } from '@messaging/shared';
import { authenticateRequest } from './messages';

/**
 * creates middleware for request authentication
 * @returns express middleware function for authentication
 */
export function createAuthMiddleware() {
  return async (req: AuthenticatedRequest, res: any, next: NextFunction) => {
    const authResult = await authenticateRequest(req.headers.authorization);
    if (authResult.error) {
      return res.status(401).json(createError(authResult.error));
    }

    req.user = authResult.data;
    next();
  };
}