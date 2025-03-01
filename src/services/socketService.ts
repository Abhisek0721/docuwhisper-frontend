// src/services/socketService.ts
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService | null = null;

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Connect to the WebSocket server - use the correct port!
  public connect(url: string = 'http://localhost:8000'): Socket {
    // Make sure this URL matches your NestJS server port
    this.socket = io(url, {
      transports: ['websocket', 'polling'],  // Try both WebSocket and polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Add connection logging
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    return this.socket;
  }

  // Disconnect from the WebSocket server
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get the socket instance
  public getSocket(): Socket | null {
    return this.socket;
  }

  // Send a query to the AI
  public sendQuery(documentId: string, query: string): void {
    if (this.socket) {
      this.socket.emit('query', { documentId, query });
    } else {
      console.error('Socket not connected');
    }
  }

  // Listen for events
  public on(event: string, callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  public off(event: string): void {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default SocketService;