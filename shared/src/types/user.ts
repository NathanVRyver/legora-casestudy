import { z } from 'zod';

export const MessageStatus = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
} as const;

export type MessageStatusType = (typeof MessageStatus)[keyof typeof MessageStatus];

/**
 * Validation schemas
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and dash'),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .transform(email => email.toLowerCase()),
  created_at: z.date(),
  updated_at: z.date(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long (max 5000 characters)'),
  sender_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  status: z.enum(['sent', 'delivered', 'read']),
  created_at: z.date(),
  updated_at: z.date(),
  read_at: z.date().nullable(),
});

export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and dash'),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .transform(email => email.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .transform(email => email.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const CreateMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long (max 5000 characters)'),
  recipient_id: z.string().uuid('Invalid recipient ID'),
});

export const MessageFilterSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
  status: z.enum(['sent', 'delivered', 'read']).optional(),
});

export type User = z.infer<typeof UserSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type MessageFilter = z.infer<typeof MessageFilterSchema>;
