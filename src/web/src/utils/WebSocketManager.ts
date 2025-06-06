/**
 * WebSocketManager - Production-ready WebSocket client for AIOps Infrastructure
 * 
 * Features:
 * - Automatic connection lifecycle management
 * - Reconnection logic with exponential backoff
 * - Heartbeat monitoring and connection health
 * - Event-driven architecture with topic subscriptions
 * - Error handling and logging
 * - Connection status tracking
 */

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface WebSocketMessage {
  type: string;
  topic?: string;
  data: any;
  timestamp?: number;
}

export interface WebSocketSubscription {
  topic: string;
  callback: (data: any) => void;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private listeners: Map<string, Set<(event: any) => void>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...config
    };
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      this.log('info', 'Connecting to WebSocket server', { url: this.config.url });

      try {
        this.ws = new WebSocket(this.config.url);
        this.setupEventHandlers(resolve, reject);
        this.startConnectionTimeout();
      } catch (error) {
        this.handleError('Connection failed', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.log('info', 'Disconnecting from WebSocket server');
    this.setStatus('disconnecting');
    
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  /**
   * Subscribe to topic-based messages
   */
  public subscribe(topic: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    this.subscriptions.get(topic)!.add(callback);
    this.log('debug', 'Subscribed to topic', { topic });

    // Send subscription message to server
    if (this.isConnected()) {
      this.send({
        type: 'subscribe',
        topic: topic
      });
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(topic);
          
          // Send unsubscribe message to server
          if (this.isConnected()) {
            this.send({
              type: 'unsubscribe',
              topic: topic
            });
          }
        }
      }
      this.log('debug', 'Unsubscribed from topic', { topic });
    };
  }

  /**
   * Send message to WebSocket server
   */
  public send(message: WebSocketMessage): boolean {
    if (!this.isConnected()) {
      this.log('warn', 'Cannot send message: not connected', { message });
      return false;
    }

    try {
      const payload = {
        ...message,
        timestamp: Date.now()
      };
      
      this.ws!.send(JSON.stringify(payload));
      this.log('debug', 'Message sent', { message: payload });
      return true;
    } catch (error) {
      this.handleError('Failed to send message', error);
      return false;
    }
  }

  /**
   * Add event listener for connection events
   */
  public addEventListener(event: string, callback: (event: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);

    // Return remove listener function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Get current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.status === 'connected';
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      status: this.status,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys()),
      lastHeartbeat: this.lastHeartbeat,
      connectionTime: this.lastHeartbeat ? Date.now() - this.lastHeartbeat : 0
    };
  }

  private setupEventHandlers(resolve: () => void, reject: (error: any) => void): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('info', 'WebSocket connection opened');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.clearTimers();
      this.startHeartbeat();
      
      // Resubscribe to all topics
      this.resubscribeAll();
      
      resolve();
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        this.handleError('Failed to parse message', error);
      }
    };

    this.ws.onclose = (event) => {
      this.log('info', 'WebSocket connection closed', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean 
      });
      
      this.clearTimers();
      
      if (this.status !== 'disconnecting') {
        this.setStatus('disconnected');
        this.emit('disconnected', { code: event.code, reason: event.reason });
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.handleError('WebSocket error', event);
      this.setStatus('error');
      reject(new Error('WebSocket connection failed'));
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    this.log('debug', 'Message received', { message });

    // Handle heartbeat responses
    if (message.type === 'pong') {
      this.lastHeartbeat = Date.now();
      return;
    }

    // Handle topic-based messages
    if (message.topic && this.subscriptions.has(message.topic)) {
      const callbacks = this.subscriptions.get(message.topic)!;
      callbacks.forEach(callback => {
        try {
          callback(message.data);
        } catch (error) {
          this.handleError('Subscription callback error', error);
        }
      });
    }

    // Emit general message event
    this.emit('message', message);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('error', 'Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached', {});
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;
    this.log('info', 'Attempting reconnection', { 
      attempt: this.reconnectAttempts, 
      delay 
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.log('error', 'Reconnection attempt failed', { error });
        this.attemptReconnect();
      });
    }, delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((callbacks, topic) => {
      this.send({
        type: 'subscribe',
        topic: topic
      });
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: 'ping',
          data: {}
        });
      }
    }, this.config.heartbeatInterval);
  }

  private startConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.status === 'connecting') {
        this.handleError('Connection timeout', new Error('Connection timeout'));
        this.ws?.close();
      }
    }, this.config.connectionTimeout);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      const previousStatus = this.status;
      this.status = status;
      
      this.log('info', 'Status changed', { 
        from: previousStatus, 
        to: status 
      });
      
      this.emit('statusChange', { 
        from: previousStatus, 
        to: status 
      });
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.handleError('Event listener error', error);
        }
      });
    }
  }

  private handleError(message: string, error: any): void {
    this.log('error', message, { error });
    this.emit('error', { message, error });
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: 'WebSocketManager',
      ...data
    };

    // In production, this would go to a proper logging service
    console[level === 'debug' ? 'log' : level]('[WebSocketManager]', message, data || '');
  }
} 