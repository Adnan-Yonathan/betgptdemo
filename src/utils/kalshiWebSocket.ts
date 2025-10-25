/**
 * Kalshi WebSocket Client
 *
 * Provides real-time market updates via WebSocket connection.
 * Auto-reconnects on disconnect with exponential backoff.
 */

import { KalshiAPI } from './kalshiApi';

// ============================================================================
// TYPES
// ============================================================================

export interface KalshiWebSocketMessage {
  type: 'market_update' | 'orderbook_update' | 'trade' | 'subscription_ack' | 'error';
  ticker?: string;
  data?: any;
  msg?: string;
}

export interface KalshiMarketUpdate {
  ticker: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  timestamp: number;
}

type MessageHandler = (message: KalshiWebSocketMessage) => void;
type MarketUpdateHandler = (update: KalshiMarketUpdate) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = () => void;

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

export class KalshiWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscribedTickers: Set<string> = new Set();
  private authToken: string | null = null;

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private marketUpdateHandlers: Map<string, MarketUpdateHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];

  private readonly WS_URL = 'wss://trading-api.kalshi.com/trade-api/ws/v2';

  constructor() {
    console.log('[KALSHI WS] Client initialized');
  }

  /**
   * Connect to Kalshi WebSocket
   */
  async connect(): Promise<void> {
    try {
      // Get auth token first
      this.authToken = await KalshiAPI.login();

      console.log('[KALSHI WS] Connecting...');

      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (event) => this.handleError(event);
      this.ws.onclose = (event) => this.handleClose(event);

    } catch (error) {
      console.error('[KALSHI WS] Connection error:', error);
      this.handleError(error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[KALSHI WS] Disconnecting...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscribedTickers.clear();
  }

  /**
   * Subscribe to market updates for a ticker
   */
  subscribe(ticker: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[KALSHI WS] Cannot subscribe - not connected');
      this.subscribedTickers.add(ticker);
      return;
    }

    console.log(`[KALSHI WS] Subscribing to ${ticker}`);

    const message = {
      type: 'subscribe',
      channels: [`market:${ticker}`],
    };

    this.send(message);
    this.subscribedTickers.add(ticker);
  }

  /**
   * Unsubscribe from market updates
   */
  unsubscribe(ticker: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.subscribedTickers.delete(ticker);
      return;
    }

    console.log(`[KALSHI WS] Unsubscribing from ${ticker}`);

    const message = {
      type: 'unsubscribe',
      channels: [`market:${ticker}`],
    };

    this.send(message);
    this.subscribedTickers.delete(ticker);
  }

  /**
   * Subscribe to multiple tickers
   */
  subscribeBulk(tickers: string[]): void {
    tickers.forEach(ticker => this.subscribe(ticker));
  }

  /**
   * Add message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Add market update handler for specific ticker
   */
  onMarketUpdate(ticker: string, handler: MarketUpdateHandler): () => void {
    if (!this.marketUpdateHandlers.has(ticker)) {
      this.marketUpdateHandlers.set(ticker, []);
    }
    this.marketUpdateHandlers.get(ticker)!.push(handler);

    return () => {
      const handlers = this.marketUpdateHandlers.get(ticker);
      if (handlers) {
        const filtered = handlers.filter(h => h !== handler);
        if (filtered.length === 0) {
          this.marketUpdateHandlers.delete(ticker);
        } else {
          this.marketUpdateHandlers.set(ticker, filtered);
        }
      }
    };
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Add connect handler
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.push(handler);
    return () => {
      this.connectHandlers = this.connectHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Add disconnect handler
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.push(handler);
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private handleOpen(): void {
    console.log('[KALSHI WS] Connected');
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    // Authenticate
    if (this.authToken) {
      this.send({
        type: 'auth',
        token: this.authToken,
      });
    }

    // Start ping interval to keep connection alive
    this.startPingInterval();

    // Resubscribe to previous tickers
    if (this.subscribedTickers.size > 0) {
      console.log(`[KALSHI WS] Resubscribing to ${this.subscribedTickers.size} tickers`);
      this.subscribedTickers.forEach(ticker => this.subscribe(ticker));
    }

    // Notify handlers
    this.connectHandlers.forEach(handler => handler());
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: KalshiWebSocketMessage = JSON.parse(event.data);

      // Notify generic message handlers
      this.messageHandlers.forEach(handler => handler(message));

      // Handle specific message types
      switch (message.type) {
        case 'market_update':
          this.handleMarketUpdate(message);
          break;

        case 'error':
          console.error('[KALSHI WS] Server error:', message.msg);
          this.errorHandlers.forEach(handler =>
            handler(new Error(message.msg || 'WebSocket server error'))
          );
          break;

        case 'subscription_ack':
          console.log('[KALSHI WS] Subscription acknowledged:', message.ticker);
          break;

        default:
          console.log('[KALSHI WS] Received message:', message.type);
      }
    } catch (error) {
      console.error('[KALSHI WS] Error parsing message:', error);
    }
  }

  private handleMarketUpdate(message: KalshiWebSocketMessage): void {
    if (!message.ticker || !message.data) return;

    const update: KalshiMarketUpdate = {
      ticker: message.ticker,
      yes_bid: message.data.yes_bid,
      yes_ask: message.data.yes_ask,
      no_bid: message.data.no_bid,
      no_ask: message.data.no_ask,
      last_price: message.data.last_price,
      volume: message.data.volume,
      timestamp: Date.now(),
    };

    // Notify ticker-specific handlers
    const handlers = this.marketUpdateHandlers.get(message.ticker);
    if (handlers) {
      handlers.forEach(handler => handler(update));
    }
  }

  private handleError(error: any): void {
    console.error('[KALSHI WS] Error:', error);
    const err = error instanceof Error ? error : new Error('WebSocket error');
    this.errorHandlers.forEach(handler => handler(err));
  }

  private handleClose(event: CloseEvent): void {
    console.log(`[KALSHI WS] Disconnected (${event.code}: ${event.reason})`);

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Notify handlers
    this.disconnectHandlers.forEach(handler => handler());

    // Attempt to reconnect unless explicitly closed
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[KALSHI WS] Max reconnect attempts reached');
      this.errorHandlers.forEach(handler =>
        handler(new Error('Max reconnect attempts reached'))
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[KALSHI WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[KALSHI WS] Cannot send - not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let wsClient: KalshiWebSocketClient | null = null;

/**
 * Get singleton WebSocket client instance
 */
export function getKalshiWebSocket(): KalshiWebSocketClient {
  if (!wsClient) {
    wsClient = new KalshiWebSocketClient();
  }
  return wsClient;
}

/**
 * React hook for Kalshi WebSocket
 */
export function useKalshiWebSocket(ticker?: string) {
  const [connected, setConnected] = React.useState(false);
  const [marketData, setMarketData] = React.useState<KalshiMarketUpdate | null>(null);

  React.useEffect(() => {
    const ws = getKalshiWebSocket();

    // Connect if not already connected
    if (!ws.isConnected()) {
      ws.connect();
    }

    // Set up handlers
    const unsubConnect = ws.onConnect(() => setConnected(true));
    const unsubDisconnect = ws.onDisconnect(() => setConnected(false));

    // Subscribe to ticker if provided
    let unsubMarket: (() => void) | undefined;
    if (ticker) {
      ws.subscribe(ticker);
      unsubMarket = ws.onMarketUpdate(ticker, (update) => {
        setMarketData(update);
      });
    }

    // Cleanup
    return () => {
      unsubConnect();
      unsubDisconnect();
      if (unsubMarket) {
        unsubMarket();
      }
      if (ticker) {
        ws.unsubscribe(ticker);
      }
    };
  }, [ticker]);

  return {
    connected,
    marketData,
    client: getKalshiWebSocket(),
  };
}

export default KalshiWebSocketClient;
