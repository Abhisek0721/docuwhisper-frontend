// src/services/elevenLabsService.ts

import { envConstant } from "../constants";

interface ElevenLabsStreamOptions {
    text: string;
    voiceId: string;
    modelId: string;
    stability?: number;
    similarityBoost?: number;
  }
  
  interface ElevenLabsConnectionCallbacks {
    onOpen?: () => void;
    onError?: (error: string) => void;
    onClose?: () => void;
    onAudioStream?: (audioChunk: ArrayBuffer) => void;
  }
  
  class ElevenLabsService {
    private socket: WebSocket | null = null;
    private readonly API_KEY: string = envConstant.ELEVEN_LABS_API_KEY || '';
    private callbacks: ElevenLabsConnectionCallbacks = {};
    
    constructor() {
      // Initialize with empty callbacks
      this.callbacks = {
        onOpen: () => {},
        onError: () => {},
        onClose: () => {},
        onAudioStream: () => {}
      };
    }
  
    public connect(callbacks: ElevenLabsConnectionCallbacks): void {
      // Store callbacks
      this.callbacks = { ...this.callbacks, ...callbacks };
      
      // Close existing connection if any
      if (this.socket) {
        this.socket.close();
      }
      
      try {
        // Create WebSocket connection to ElevenLabs API
        this.socket = new WebSocket('wss://api.elevenlabs.io/v1/text-to-speech/stream-input?model_id=eleven_monolingual_v1');
        
        this.socket.onopen = () => {
          console.log('Connected to ElevenLabs WebSocket');
          this.sendInitMessage();
          this.callbacks.onOpen?.();
        };
        
        this.socket.onmessage = (event) => {
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            if (data.audio) {
              const audioBuffer = this.base64ToArrayBuffer(data.audio);
              this.callbacks.onAudioStream?.(audioBuffer);
            }
            
            if (data.isFinal) {
              // Handle final message if needed
            }
          } else if (event.data instanceof Blob) {
            // Handle binary data if sent
            event.data.arrayBuffer().then(buffer => {
              this.callbacks.onAudioStream?.(buffer);
            });
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('ElevenLabs WebSocket error:', error);
          this.callbacks.onError?.(`WebSocket error: ${error}`);
        };
        
        this.socket.onclose = () => {
          console.log('Disconnected from ElevenLabs WebSocket');
          this.callbacks.onClose?.();
        };
      } catch (error) {
        console.error('Failed to connect to ElevenLabs WebSocket:', error);
        this.callbacks.onError?.(`Connection error: ${error}`);
      }
    }
  
    private sendInitMessage(): void {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        return;
      }
      
      // Send the initial connection message with API key
      const initMessage = {
        text: " ",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        },
        xi_api_key: this.API_KEY
      };
      
      this.socket.send(JSON.stringify(initMessage));
    }
  
    public streamSpeech(options: ElevenLabsStreamOptions): void {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        return;
      }
      
      const message = {
        text: options.text,
        voice_id: options.voiceId,
        model_id: options.modelId || "eleven_monolingual_v1",
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarityBoost || 0.75
        },
        xi_api_key: this.API_KEY
      };
      
      this.socket.send(JSON.stringify(message));
    }
  
    public disconnect(): void {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    }
  
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    }
  }
  
  export default ElevenLabsService;