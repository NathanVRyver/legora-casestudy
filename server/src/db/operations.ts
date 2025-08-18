import { Client } from 'pg';
import pino from 'pino';
import { User, ParsedData } from '../types';

const logger = pino();
async function connectToDatabase(): Promise<{
  error?: string;
  data?: { client: Client; connStr: string };
}> {
  // just to make it smoother -- dx and tings
  const candidates = [
    process.env['DATABASE_URL'],
    'postgresql://postgres@localhost:5432/messaging_db',
    `postgresql://${process.env['USER']}@localhost:5432/messaging_db`,
    'postgresql://postgres:postgres@localhost:5432/messaging_db',
    'postgresql://postgres:password@localhost:5432/messaging_db',
  ].filter((url): url is string => Boolean(url));

  for (const connStr of candidates) {
    try {
      const client = new Client(connStr);
      await client.connect();
      await client.query('SELECT 1');
      return { data: { client, connStr } };
    } catch (_error) {
      continue;
    }
  }

  return {
    error: `---Database connection failed. Set DATABASE_URL or run: npm run db:setup -w server :(`,
  };
}

async function executeQuery<T>(
  query: string,
  params: any[] = []
): Promise<{ error?: string; data?: T[] }> {
  const connection = await connectToDatabase();
  if (connection.error) {
    return { error: connection.error };
  }

  const { client } = connection.data!;

  try {
    const result = await client.query(query, params);
    return { data: result.rows as T[] };
  } catch (_error) {
    const message = _error instanceof Error ? _error.message : 'Database query failed';
    logger.error('Query error:', message);
    return { error: message };
  } finally {
    await client.end();
  }
}

/**
 * User database operations
 */
export async function getUserByEmail(email: string): Promise<ParsedData<User>> {
  if (!email || typeof email !== 'string') {
    return { error: 'Email is required' };
  }

  const result = await executeQuery<User>('SELECT id, username, email, password_hash FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);

  if (result.error) {
    return { error: result.error };
  }

  if (!result.data || result.data.length === 0) {
    return { data: undefined };
  }

  return { data: result.data[0] };
}

export async function getUserByToken(token: string): Promise<ParsedData<Omit<User, 'password_hash'>>> {
  if (!token || typeof token !== 'string') {
    return { error: 'Token is required' };
  }

  const result = await executeQuery<Omit<User, 'password_hash'>>(
    `SELECT u.id, u.username, u.email 
     FROM users u 
     WHERE u.id = (
       SELECT user_id FROM user_sessions 
       WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
     )`,
    [token]
  );

  if (result.error) {
    return { error: result.error };
  }

  if (!result.data || result.data.length === 0) {
    return { data: undefined };
  }

  return { data: result.data[0] };
}

export async function createUserSession(
  userId: string,
  token: string
): Promise<{ error?: string }> {
  if (!userId || !token) {
    return { error: 'User ID and token are required' };
  }

  const createTableResult = await executeQuery(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (createTableResult.error) {
    return { error: createTableResult.error };
  }

  const result = await executeQuery(
    `INSERT INTO user_sessions (user_id, token) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET 
       expires_at = (CURRENT_TIMESTAMP + INTERVAL '7 days'),
       created_at = CURRENT_TIMESTAMP`,
    [userId, token]
  );

  if (result.error) {
    return { error: result.error };
  }

  return {};
}

/**
 * Message database operations
 */
export async function createMessage(messageData: {
  content: string;
  sender_id: string;
  recipient_id: string;
}): Promise<{
  error?: string;
  data?: {
    id: string;
    content: string;
    sender_id: string;
    recipient_id: string;
    status: string;
    created_at: string;
  };
}> {
  if (!messageData.content || !messageData.sender_id || !messageData.recipient_id) {
    return { error: 'Content, sender ID, and recipient ID are required' };
  }

  if (messageData.content.length > 5000) {
    return { error: 'Message content too long (max 5000 characters)' };
  }

  const result = await executeQuery(
    `INSERT INTO messages (content, sender_id, recipient_id, status) 
     VALUES ($1, $2, $3, 'sent') 
     RETURNING id, content, sender_id, recipient_id, status, created_at`,
    [messageData.content, messageData.sender_id, messageData.recipient_id]
  );

  if (result.error) {
    return { error: result.error };
  }

  if (!result.data || result.data.length === 0) {
    return { error: 'Failed to create message' };
  }

  const message = result.data[0] as any;
  return {
    data: {
      id: message.id,
      content: message.content,
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
      status: message.status,
      created_at: message.created_at,
    },
  };
}

export async function getUserMessages(
  userId: string,
  options: { limit: number; cursor?: string }
): Promise<{
  error?: string;
  data?: {
    messages: Array<{
      id: string;
      content: string;
      sender_id: string;
      recipient_id: string;
      status: string;
      created_at: string;
    }>;
    next_cursor?: string;
  };
}> {
  if (!userId) {
    return { error: 'User ID is required' };
  }

  let query = `
    SELECT 
      m.id, 
      m.content, 
      m.sender_id, 
      m.recipient_id, 
      m.status, 
      m.created_at,
      sender.username as sender_username,
      recipient.username as recipient_username
    FROM messages m
    LEFT JOIN users sender ON m.sender_id = sender.id
    LEFT JOIN users recipient ON m.recipient_id = recipient.id
    WHERE sender_id = $1 OR recipient_id = $1
  `;

  const params = [userId];

  if (options.cursor) {
    query += ' AND created_at < $2';
    params.push(options.cursor);
  }

  query += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
  params.push((options.limit + 1).toString());

  const result = await executeQuery(query, params);

  if (result.error) {
    return { error: result.error };
  }

  if (!result.data) {
    return { data: { messages: [] } };
  }

  let messages = result.data as any[];
  let next_cursor: string | undefined;

  if (messages.length > options.limit) {
    next_cursor = messages[options.limit - 1].created_at;
    messages = messages.slice(0, options.limit);
  }

  return {
    data: {
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        recipient_id: msg.recipient_id,
        status: msg.status,
        created_at: msg.created_at,
      })),
      next_cursor,
    },
  };
}

/**
 * Updates message status
 */
export async function updateMessageStatus(
  messageId: string,
  status: 'delivered' | 'read',
  userId: string
): Promise<{ error?: string }> {
  if (!messageId || !status || !userId) {
    return { error: 'Message ID, status, and user ID are required' };
  }

  if (!['delivered', 'read'].includes(status)) {
    return { error: 'Invalid status. Must be "delivered" or "read"' };
  }

  let query = `
    UPDATE messages 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
  `;

  const params = [status, messageId, userId];

  if (status === 'read') {
    query += ', read_at = CURRENT_TIMESTAMP';
  }

  query += ' WHERE id = $2 AND recipient_id = $3';

  const result = await executeQuery(query, params);

  if (result.error) {
    return { error: result.error };
  }

  return {};
}
export async function searchUsers(
  searchQuery: string,
  currentUserId: string,
  limit: number,
  offset: number
): Promise<ParsedData<Omit<User, 'password_hash'>[]>> {
  const sql = `
    SELECT id, username, email FROM users 
    WHERE (username ILIKE $1 OR email ILIKE $1 OR id::text ILIKE $1) AND id != $2 
    ORDER BY 
      CASE 
        WHEN username ILIKE $1 THEN 1
        WHEN email ILIKE $1 THEN 2
        ELSE 3
      END,
      username 
    LIMIT $3 OFFSET $4
  `;
  const params = [`%${searchQuery.trim()}%`, currentUserId, limit, offset];
  
  const result = await executeQuery<Omit<User, 'password_hash'>>(sql, params);

  if (result.error) {
    return { error: result.error };
  }

  return { data: result.data || [] };
}

export async function getRandomUsers(
  currentUserId: string,
  limit: number,
  offset: number
): Promise<ParsedData<Omit<User, 'password_hash'>[]>> {
  const sql = `
    SELECT id, username, email FROM users 
    WHERE id != $1 
    ORDER BY RANDOM() 
    LIMIT $2 OFFSET $3
  `;
  const params = [currentUserId, limit, offset];
  
  const result = await executeQuery<Omit<User, 'password_hash'>>(sql, params);

  if (result.error) {
    return { error: result.error };
  }

  return { data: result.data || [] };
}


export async function getConversationMessages(
  userId1: string,
  userId2: string,
  limit: number = 50,
  cursor?: string
): Promise<{
  error?: string;
  data?: {
    messages: {
      id: string;
      content: string;
      sender_id: string;
      recipient_id: string;
      sender_username: string;
      created_at: Date;
    }[];
  };
}> {
  let sql = `
    SELECT 
      m.id,
      m.content,
      m.sender_id,
      m.recipient_id,
      u.username as sender_username,
      m.created_at
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (
      (m.sender_id = $1 AND m.recipient_id = $2) OR 
      (m.sender_id = $2 AND m.recipient_id = $1)
    )
  `;
  
  const params: any[] = [userId1, userId2];
  
  if (cursor) {
    sql += ` AND m.created_at < $3`;
    params.push(cursor);
  }
  
  sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await executeQuery<{
    id: string;
    content: string;
    sender_id: string;
    recipient_id: string;
    sender_username: string;
    created_at: Date;
  }>(sql, params);

  if (result.error) {
    return { error: result.error };
  }

  return { 
    data: { 
      messages: (result.data || []).reverse() 
    }
  };
}
