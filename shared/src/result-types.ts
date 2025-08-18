/**
 * Result type for consistent error handling
 */
export type Result<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export type AsyncResult<T> = Promise<Result<T>>;
export function createSuccess<T>(data: T): Result<T> {
  return { success: true, data };
}

export function createError<T>(error: string): Result<T> {
  return { success: false, error };
}

export function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success;
}

export function isError<T>(result: Result<T>): result is { success: false; error: string } {
  return !result.success;
}

/**
 * API response result types
 */
export type AuthResult = Result<{
  user: {
    id: string;
    username: string;
    email: string;
  };
  token?: string;
}>;

export type MessageResult = Result<{
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  status: string;
  created_at: string;
}>;

export type MessagesListResult = Result<{
  messages: Array<{
    id: string;
    content: string;
    sender_id: string;
    recipient_id: string;
    status: string;
    created_at: string;
  }>;
  next_cursor?: string;
}>;

// API ERROR CODES
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
