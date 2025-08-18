import { Router } from 'express';
import { createSuccess, createError, LoginSchema } from '@messaging/shared';
import { validateRequest } from '../../middleware/validation';
import { parseLoginRequestBody, processHttpLogin } from '../../helpers/auth';
import { validateBearerToken } from '../../helpers/sse-auth';


export const authRouter = Router();

const loginValidationSchema = {
  body: LoginSchema,
};

/**
 * handles user login request
 * @param req - express request with email and password in body
 * @param res - express response with user data and token
 */
authRouter.post('/login', validateRequest(loginValidationSchema), async (req, res) => {
  const requestData = parseLoginRequestBody(req.body);
  if (requestData.error) {
    return res.status(400).json(createError(requestData.error));
  }

  const loginResult = await processHttpLogin(requestData.data!);
  if (loginResult.error) {
    return res.status(401).json(createError(loginResult.error));
  }

  return res.json(createSuccess(loginResult.data!));
});

/**
 * validates user authentication token
 * @param req - express request with authorization header
 * @param res - express response with user data if token is valid
 */
authRouter.get('/validate', async (req, res) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const token = req.headers.authorization?.replace('Bearer ', '').trim();

  return res.json(
    createSuccess({
      user: userResult.data,
      token,
    })
  );
});

/**
 * searches for users by query or returns random users
 * @param req - express request with optional query parameter and auth header
 * @param res - express response with list of users matching search
 */
authRouter.get('/users/search', async (req, res) => {
  const userResult = await validateBearerToken(req.headers.authorization);

  if (userResult.error) {
    return res.status(401).json(createError(userResult.error));
  }

  const query = req.query['q'] as string;
  const limit = Math.min(parseInt(req.query['limit'] as string) || 5, 20); 
  const offset = parseInt(req.query['offset'] as string) || 0;

  try {
    let result;

    if (query && query.trim().length > 0) {
      // search by username, email, or uid
      const { searchUsers } = await import('../../db/operations');
      result = await searchUsers(query.trim(), userResult.data!.id, limit, offset);
    } else {
      const { getRandomUsers } = await import('../../db/operations');
      result = await getRandomUsers(userResult.data!.id, limit, offset);
    }
    if (result.error) {
      return res.status(500).json(createError('Failed to search users'));
    }

    return res.json(
      createSuccess({
        users: result.data,
        hasMore: result.data?.length === limit,
        query,
        limit,
        offset,
      })
    );
  } catch (_error) {
    return res.status(500).json(createError('Search failed'));
  }
});

/**
 * health check endpoint for auth service
 * @param _req - express request (unused)
 * @param res - express response with service status
 */
authRouter.get('/health', (_req, res) => {
  res.json(createSuccess({ status: 'Auth service healthy', timestamp: new Date().toISOString() }));
});
