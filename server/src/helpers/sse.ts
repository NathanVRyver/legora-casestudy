import { Response } from 'express';
import pino from 'pino';
import crypto from 'crypto';
import { SSEConnection, SSESession } from '../types';

const logger = pino();

/**
 * manages server-sent events connections and messaging
 */
export class SSEManager {
  private connections = new Map<string, SSEConnection>();

  /**
   * adds new sse connection for user
   * @param userId - unique user identifier
   * @param response - express response object for sse
   * @returns boolean indicating if connection was added successfully
   */
  addConnection(userId: string, response: Response): boolean {
    logger.info(`addConnection called for user ${userId}`);
    
    if (this.connections.has(userId)) {
      const existing = this.connections.get(userId);
      const timeSinceLastSeen = Date.now() - existing!.lastSeen.getTime();
      logger.info(`Existing connection found for user ${userId}, age: ${timeSinceLastSeen}ms`);
      
      // If there's an existing connection that's very recent (< 5 seconds), 
      // silently close the new connection request instead of disrupting the existing one
      if (existing && timeSinceLastSeen < 5000) {
        logger.info(`Silently closing duplicate connection for user ${userId} (keeping existing, age: ${timeSinceLastSeen}ms)`);
        try {
          response.end();
        } catch (_error) {
          logger.error(`Error closing duplicate connection for user ${userId}:`, _error);
        }
        return false;
      }
      
      logger.info(`Removing existing stale connection for user ${userId} (age: ${timeSinceLastSeen}ms)`);
      if (existing && existing.response !== response) {
        try {
          existing.response.end();
        } catch (_error) {
          logger.error(`Error closing existing connection for user ${userId}:`, _error);
        }
      }
    } else {
      logger.info(`No existing connection for user ${userId}, creating new one`);
    }

    this.connections.set(userId, {
      userId,
      response,
      lastSeen: new Date(),
    });

    logger.info(`SSE connection added for user ${userId}`);

    // inform connected users of the online status
    this.broadcastUserStatus(userId, true);
    
    return true;
  }

  /**
   * removes sse connection for user
   * @param userId - unique user identifier
   */
  removeConnection(userId: string) {
    const connection = this.connections.get(userId);
    if (connection) {
      try {
        connection.response.end();
      } catch (_error) {
        console.warn("connection closed")
      }
      this.connections.delete(userId);
      logger.info(`SSE connection removed for user ${userId}`);
      this.broadcastUserStatus(userId, false);
    }
  }

  /**
   * broadcasts user online/offline status to all connected users
   * @param userId - user whose status changed
   * @param isOnline - whether user is online or offline
   */
  broadcastUserStatus(userId: string, isOnline: boolean) {
    for (const [connectedUserId, connection] of this.connections.entries()) {
      if (connectedUserId !== userId) {
        try {
          connection.response.write(`event: user-status\n`);
          connection.response.write(
            `data: ${JSON.stringify({
              type: 'user-status',
              userId,
              isOnline,
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
        } catch (_error) {
          console.warn("connection closed")
        }
      }
    }
  }

  /**
   * sends sse event to specific user
   * @param userId - target user identifier
   * @param event - event type name
   * @param data - event payload data
   * @returns boolean indicating success
   */
  sendToUser(userId: string, event: string, data: any) {
    const connection = this.connections.get(userId);
    if (connection) {
      try {
        connection.response.write(`event: ${event}\n`);
        connection.response.write(`data: ${JSON.stringify(data)}\n\n`);
        connection.lastSeen = new Date();
        return true;
      } catch (_error) {
        logger.error(`Failed to send SSE to user ${userId}:`, _error);
        this.removeConnection(userId);
        return false;
      }
    }
    return false;
  }

  /**
   * checks if user is currently online
   * @param userId - user identifier to check
   * @returns boolean indicating online status
   */
  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  /**
   * gets list of all currently online users
   * @returns array of user identifiers
   */
  getOnlineUsers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * notifies users about new message via sse
   * @param senderId - user who sent the message
   * @param recipientId - user who should receive notification
   * @param messageData - message content and metadata
   */
  notifyNewMessage(senderId: string, recipientId: string, messageData: any) {
    // new messsage notification
    this.sendToUser(recipientId, 'new-message', {
      type: 'new-message',
      senderId,
      message: messageData,
      timestamp: new Date().toISOString(),
    });

    // doesn't really work that well, might remove
    this.sendToUser(senderId, 'message-sent', {
      type: 'message-sent',
      message: messageData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * notifies recipient about typing status
   * @param senderId - user who is typing
   * @param recipientId - user who should see typing indicator
   * @param isTyping - whether sender is currently typing
   */
  notifyTyping(senderId: string, recipientId: string, isTyping: boolean) {
    this.sendToUser(recipientId, 'typing', {
      type: 'typing',
      senderId,
      isTyping,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * removes stale connections that haven't been active
   */
  cleanupConnections() {
    const now = new Date();
    const timeout = 5 * 60 * 1000; 

    for (const [userId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastSeen.getTime() > timeout) {
        this.removeConnection(userId);
      }
    }
  }
}

/**
 * creates and manages sse session tokens
 */
export class SSETokenManager {
  private tokens = new Map<string, SSESession>();

  /**
   * creates new session token for user
   * @param userId - user identifier
   * @returns session token string
   */
  createSession(userId: string): string {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 5 * 60 * 1000; 
    
    this.tokens.set(sessionToken, {
      userId,
      expires
    });

    return sessionToken;
  }

  /**
   * validates and retrieves session data
   * @param token - session token to validate
   * @returns session data or null if invalid
   */
  getSession(token: string): SSESession | null {
    const session = this.tokens.get(token);
    if (!session || session.expires < Date.now()) {
      if (session) this.tokens.delete(token);
      return null;
    }
    return session;
  }

  /**
   * cleans up expired session tokens
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [token, session] of this.tokens.entries()) {
      if (session.expires < now) {
        this.tokens.delete(token);
      }
    }
  }
}

export const sseManager = new SSEManager();
export const sseTokenManager = new SSETokenManager();

// clean up dead connections every 2 minutes
setInterval(
  () => {
    sseManager.cleanupConnections();
    sseTokenManager.cleanupExpired();
  },
  2 * 60 * 1000
);