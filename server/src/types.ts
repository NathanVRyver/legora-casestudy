import { Request, Response } from 'express';

/**
 * database and api response types
 */
export interface User {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  sender_username?: string;
  recipient_username?: string;
  status?: string;
  created_at: string | Date;
  read_at?: string | Date;
}

export interface Session {
  id?: string;
  user_id: string;
  token: string;
  expires_at?: Date;
  created_at?: Date;
}

/**
 * api response types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
}

export interface MessagesResponse {
  messages: Message[];
  next_cursor?: string;
}

export interface UsersSearchResponse {
  users: Omit<User, 'password_hash'>[];
  hasMore: boolean;
  query?: string;
  limit: number;
  offset: number;
}

/**
 * request types
 */
export interface AuthenticatedRequest extends Request {
  user?: Omit<User, 'password_hash'>;
}

export interface ParsedData<T> {
  error?: string;
  data?: T;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface CreateMessageData {
  content: string;
  recipient_id: string;
}

export interface MessageFilterData {
  limit: number;
  cursor?: string;
  status?: string;
}

/**
 * sse types
 */
export interface SSEConnection {
  userId: string;
  response: Response;
  lastSeen: Date;
}

export interface SSESession {
  userId: string;
  expires: number;
}

export interface SSEMessage {
  type: string;
  [key: string]: any;
}