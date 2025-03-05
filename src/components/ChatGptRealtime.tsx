import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, VolumeX } from 'lucide-react';
import { envConstant } from '../constants';

// Existing interfaces from previous implementation
interface WebSocketConfig {
  WS_URL: string;
  API_KEY: string;
  ORG_ID: string;
  PROJECT_ID: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

interface ServerEvent {
  type: string;
  response?: {
    content?: string;
    modalities?: string[];
    instructions?: string;
  };
}

// Configuration object
const CONFIG: WebSocketConfig = {
  WS_URL: "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
  API_KEY: envConstant.OPENAI_API_KEY,
  ORG_ID: envConstant.OPENAI_ORG_ID,
  PROJECT_ID: envConstant.OPENAI_PROJECT_ID
};

const ChatGptRealtime: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // WebSocket and speech-related refs
  const webSocketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Generate unique message ID
  const generateMessageId = (): string => 
    `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Add message methods
  const addSystemMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { 
      id: generateMessageId(),
      type: 'system', 
      content: text,
      timestamp: Date.now()
    }]);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { 
      id: generateMessageId(),
      type: 'user', 
      content: text,
      timestamp: Date.now()
    }]);
  }, []);

  const addAIMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { 
      id: generateMessageId(),
      type: 'ai', 
      content: text,
      timestamp: Date.now()
    }]);
  }, []);

  // Text-to-Speech method
  const speakResponse = useCallback((text: string) => {
    if (!synthesisRef.current) return;

    // Cancel any ongoing speech
    synthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    synthesisRef.current.speak(utterance);
  }, []);

  // Send message to WebSocket
  const sendMessageToAI = useCallback((message: string) => {
    if (!webSocketRef.current || !isConnected) return;

    try {
      const event = {
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
          instructions: message,
        }
      };

      webSocketRef.current.send(JSON.stringify(event));
      setIsLoading(true);
    } catch (error) {
      console.error("Failed to send message:", error);
      addSystemMessage("Message could not be sent.");
    }
  }, [isConnected, addSystemMessage]);

  // WebSocket connection setup
  useEffect(() => {
    // Initialize Web Speech APIs
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new (window as any).webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
          addUserMessage(transcript);
          sendMessageToAI(transcript);
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }

    // Initialize Speech Synthesis
    synthesisRef.current = window.speechSynthesis;

    // WebSocket connection
    const connectWebSocket = () => {
      if (typeof window !== 'undefined' && window.WebSocket) {
        try {
          webSocketRef.current = new WebSocket(
            CONFIG.WS_URL,
            [
              "realtime",
              `openai-insecure-api-key.${CONFIG.API_KEY}`,
              `openai-organization.${CONFIG.ORG_ID}`,
              `openai-project.${CONFIG.PROJECT_ID}`,
              "openai-beta.realtime-v1"
            ]
          );

          webSocketRef.current.onopen = () => {
            setIsConnected(true);
            addSystemMessage("Connected and ready to chat!");
          };

          webSocketRef.current.onmessage = (event: MessageEvent) => {
            try {
              const serverEvent = JSON.parse(event.data);
              if (serverEvent.type === 'response.create') {
                const aiResponse = serverEvent.response?.content || "No response received";
                addAIMessage(aiResponse);
                speakResponse(aiResponse);
                setIsLoading(false);
              }
            } catch (error) {
              console.error("Error parsing message:", error);
            }
          };

          webSocketRef.current.onerror = () => {
            addSystemMessage("Connection error occurred.");
          };

          webSocketRef.current.onclose = () => {
            setIsConnected(false);
            addSystemMessage("Disconnected from server.");
          };
        } catch (error) {
          addSystemMessage("Failed to establish connection.");
        }
      }
    };

    connectWebSocket();

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, [addSystemMessage, addAIMessage, speakResponse, sendMessageToAI]);

  // Toggle voice listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      addSystemMessage("Voice recognition not supported");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Render messages
  const renderMessage = (message: Message) => {
    const typeClasses = {
      'user': 'bg-blue-100 text-right justify-end',
      'ai': 'bg-green-100 text-left justify-start',
      'system': 'bg-gray-100 text-center justify-center italic'
    };

    return (
      <div 
        key={message.id}
        className={`flex ${typeClasses[message.type]} p-2 rounded-lg m-2`}
      >
        {message.content}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto border">
      {/* Chat Messages */}
      <div className="flex-grow overflow-y-auto p-4">
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="flex justify-center items-center">
            <Loader2 className="animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex p-4 border-t justify-center items-center space-x-4">
        <button 
          onClick={toggleListening}
          disabled={!isConnected}
          className={`p-2 rounded-full ${
            isListening 
              ? 'bg-red-500 text-white' 
              : 'bg-blue-500 text-white'
          } disabled:opacity-50`}
        >
          {isListening ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        {isSpeaking ? (
          <Volume2 className="text-green-500" size={24} />
        ) : (
          <VolumeX className="text-gray-500" size={24} />
        )}
      </div>
    </div>
  );
};

export default ChatGptRealtime;