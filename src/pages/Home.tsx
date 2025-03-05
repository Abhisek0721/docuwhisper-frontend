import { useEffect, useRef, useState } from "react";
import { Upload, Button, Card, List } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Sidebar from "../components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { getAllDocuments, uploadDocument } from "../api/queries/documentQueries";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { ApiResponse, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types/HomeType";
import SocketService from "../services/socketService";
import GoogleDrivePickerButton from "../components/GoogleDrivePicker";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { envConstant } from "../constants";


const CustomParagraph = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="mb-4 last:mb-0" {...props}>{children}</p>
);

const Home = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("9BWtsMINqrJLrRacOk9x");
  const [isConversationActive, setIsConversationActive] = useState(false);
  
  const socketService = useRef(SocketService.getInstance());
  const audioQueue = useRef<Array<{ url: string, text: string }>>([]);
  const textToProcessQueue = useRef<Array<string>>([]);
  const isProcessingQueue = useRef(false);
  const isProcessingTextQueue = useRef(false);
  const currentChunk = useRef("");
  const chunkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Rate limiting params
  const rateLimitDelay = useRef(250);
  const maxRateLimitDelay = 2000;
  const rateLimitBackoff = useRef(1.5);
  
  const {
    data: allDocuments,
    isLoading: allDocumentsLoading,
    error: allDocumentsError,
    refetch: refetchAllDocuments
  } = useQuery<ApiResponse>({
    queryKey: ["allDocumentsKey"],
    queryFn: () => getAllDocuments(),
  });

  // Initialize voice recognition
  useEffect(() => {
    if (!isConversationActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      // Immediately stop AI speech when user starts speaking
      stopSpeaking();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Process interim results to detect when user starts speaking
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult.isFinal) {
        // User is speaking, stop AI immediately
        stopSpeaking();
      } else {
        // Final result, process the transcript
        const transcript = lastResult[0].transcript.trim();
        if (transcript) {
          handleVoiceInput(transcript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        toast.error("Voice recognition error: " + event.error);
      }
    };

    recognition.onend = () => {
      if (isListening && isConversationActive) {
        try {
          recognition.start();
        } catch (error) {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isConversationActive]);
  
  // Process the audio queue
  const processAudioQueue = async () => {
    if (isProcessingQueue.current || audioQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    setIsSpeaking(true);
    
    const item = audioQueue.current.shift();
    if (!item) {
      isProcessingQueue.current = false;
      setIsSpeaking(false);
      return;
    }
    
    try {
      // Create and play audio
      const audio = new Audio(item.url);
      currentAudio.current = audio;
      
      audio.onended = () => {
        // Release object URL to free memory
        URL.revokeObjectURL(item.url);
        isProcessingQueue.current = false;
        // Process next item in queue
        processAudioQueue();
      };
      
      audio.onerror = () => {
        console.error("Audio playback error");
        URL.revokeObjectURL(item.url);
        isProcessingQueue.current = false;
        processAudioQueue();
      };

      // Stop audio if user starts speaking or conversation is stopped
      audio.onpause = () => {
        URL.revokeObjectURL(item.url);
        isProcessingQueue.current = false;
        setIsSpeaking(false);
      };
      
      await audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      isProcessingQueue.current = false;
      processAudioQueue();
    }
  };
  
  // Process text queue with rate limiting
  const processTextQueue = async () => {
    if (isProcessingTextQueue.current || textToProcessQueue.current.length === 0) return;
    
    isProcessingTextQueue.current = true;
    const text = textToProcessQueue.current.shift();
    
    if (!text) {
      isProcessingTextQueue.current = false;
      return;
    }
    
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': envConstant.ELEVEN_LABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
          }),
        }
      );
      
      // Check for rate limiting
      if (response.status === 429) {
        console.warn("Rate limited by ElevenLabs API, backing off and retrying");
        
        // Put text back at front of queue
        textToProcessQueue.current.unshift(text);
        
        // Increase backoff delay
        rateLimitDelay.current = Math.min(
          rateLimitDelay.current * rateLimitBackoff.current,
          maxRateLimitDelay
        );
        
        toast.loading(`Rate limited by speech API. Adjusting speed...`);
        
        // Wait before retrying
        setTimeout(() => {
          isProcessingTextQueue.current = false;
          processTextQueue();
        }, rateLimitDelay.current);
        
        return;
      } else if (!response.ok) {
        throw new Error(`Failed with status: ${response.status}`);
      }
      
      // Success! Gradually reduce delay if we're not at minimum
      if (rateLimitDelay.current > 250) {
        rateLimitDelay.current = Math.max(250, rateLimitDelay.current / 1.2);
      }
      
      // Get audio as blob and add to queue
      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' }); 
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Add to queue and process
      audioQueue.current.push({ url: audioUrl, text });
      if (!isProcessingQueue.current) {
        processAudioQueue();
      }
      
      // Process next item after delay to prevent rate limiting
      setTimeout(() => {
        isProcessingTextQueue.current = false;
        processTextQueue();
      }, rateLimitDelay.current);
      
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      toast.error("Failed to convert text to speech");
      
      // Retry with increased delay
      setTimeout(() => {
        isProcessingTextQueue.current = false;
        processTextQueue();
      }, rateLimitDelay.current * 2);
    }
  };
  
  // Convert text chunk to speech with ElevenLabs
  const convertChunkToSpeech = async (text: string) => {
    if (!text.trim()) return;
    
    // Add text to processing queue
    textToProcessQueue.current.push(text);
    
    // Start processing if not already running
    if (!isProcessingTextQueue.current) {
      processTextQueue();
    }
  };
  
  // Process text chunks with debouncing
  const processTextChunk = () => {
    if (currentChunk.current.trim()) {
      // Get semantic boundaries for better speech (end of sentence, comma, etc.)
      let chunk = currentChunk.current;
      currentChunk.current = "";
      convertChunkToSpeech(chunk);
    }
    
    chunkTimeout.current = null;
  };
  
  // Optimize chunking for better speech and fewer API calls
  const queueTextForSpeech = (text: string) => {
    // Add to current chunk
    currentChunk.current += text;
    
    // Clear any existing timeout
    if (chunkTimeout.current) {
      clearTimeout(chunkTimeout.current);
    }
    
    // Find natural break points for speech
    const sentenceRegex = /[.!?]\s+/;
    const commaRegex = /,\s+/;
    const sentenceMatch = sentenceRegex.exec(currentChunk.current);
    const commaMatch = commaRegex.exec(currentChunk.current);
    
    // For very short responses, just wait for complete text
    if (currentChunk.current.length < 30) {
      chunkTimeout.current = setTimeout(processTextChunk, 800);
      return;
    }
    
    // For longer text, try to chunk at natural breaks
    if (sentenceMatch?.index && sentenceMatch.index > 15) {
      const endIndex = sentenceMatch.index + sentenceMatch[0].length;
      const chunk = currentChunk.current.substring(0, endIndex);
      currentChunk.current = currentChunk.current.substring(endIndex);
      convertChunkToSpeech(chunk);
    } else if (commaMatch?.index && commaMatch.index > 30) {
      const endIndex = commaMatch.index + commaMatch[0].length;
      const chunk = currentChunk.current.substring(0, endIndex);
      currentChunk.current = currentChunk.current.substring(endIndex);
      convertChunkToSpeech(chunk);
    } else if (currentChunk.current.length > 150) {
      // If chunk is very long, just process it
      convertChunkToSpeech(currentChunk.current);
      currentChunk.current = "";
    } else {
      // Otherwise wait a bit to see if more text comes in
      chunkTimeout.current = setTimeout(processTextChunk, 800);
    }
  };
  
  // Function to stop speaking
  const stopSpeaking = () => {
    // Immediately stop current audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
    
    // Clear audio queue and release all object URLs
    audioQueue.current.forEach(item => {
      URL.revokeObjectURL(item.url);
    });
    audioQueue.current = [];
    textToProcessQueue.current = [];
    
    // Reset all processing states
    isProcessingQueue.current = false;
    isProcessingTextQueue.current = false;
    setIsSpeaking(false);
    
    // Clear any pending chunks and timeouts
    if (chunkTimeout.current) {
      clearTimeout(chunkTimeout.current);
      chunkTimeout.current = null;
    }
    currentChunk.current = "";
  };
  
  // Initialize socket connection
  useEffect(() => {
    // Connect to WebSocket server
    const socket = socketService.current.connect();
    
    // Set up event listeners
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
    
    socketService.current.on('processing', (data: any) => {
      setIsLoading(true);
    });
    
    socketService.current.on('response', (data) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.sender === 'ai') {
          // Create a new object to ensure React detects the change
          const updatedMessage = {
            ...lastMessage,
            text: lastMessage.text + data.text
          };
          newMessages[newMessages.length - 1] = updatedMessage;
          return newMessages;
        } else {
          return [...prevMessages, { text: data.text, sender: 'ai' }];
        }
      });
      
      // Process this chunk of text for speech
      queueTextForSpeech(data.text);
    });
    
    socketService.current.on('done', (data) => {
      setIsLoading(false);
      
      // Process any remaining text
      if (currentChunk.current.trim()) {
        if (chunkTimeout.current) {
          clearTimeout(chunkTimeout.current);
          chunkTimeout.current = null;
        }
        processTextChunk();
      }
    });
    
    socketService.current.on('error', (data) => {
      toast.error(data.message || "Error processing your request");
      setIsLoading(false);
    });
    
    // Cleanup function
    return () => {
      socketService.current.disconnect();
      stopSpeaking();
    };
  }, []);
  
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  const handleFileUpload = async (file: File) => {
    try {
      setSelectedDocument(file);
      const response = await uploadDocument(file);
      refetchAllDocuments();
      toast.success(response?.message || `${file.name} uploaded successfully`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    }
  };
  
  const handleUpload = async (info: any) => {
    await handleFileUpload(info.file);
  };
  
  const handleGoogleDriveFileSelect = async (file: File) => {
    await handleFileUpload(file);
  };
  
  const handleSend = async (userQuery: string) => {
    if (!userQuery.trim() || isLoading) return;
    
    // Stop any current speech
    if (isSpeaking) {
      stopSpeaking();
    }
    
    // Reset rate limiting params for new conversation
    rateLimitDelay.current = 250;
    
    // Send query via socket service
    socketService.current.sendQuery(selectedDocument?.id || '', userQuery);
  };
  
  // ElevenLabs voice options
  const voiceOptions = [
    { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
    { id: "JBFqnCBsd6RMkjVDRZzb", name: "Rachel" },
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Adam" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Antoni" },
  ];
  
  // Toggle conversation state
  const toggleConversation = () => {
    if (!selectedDocument) {
      toast.error("Please select a document first");
      return;
    }

    if (isConversationActive) {
      // Stop conversation - stop speaking first, then recognition
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setIsConversationActive(false);
    } else {
      // Start conversation
      setIsConversationActive(true);
      setMessages([{ text: "Hello! I'm ready to help you with your document. What would you like to know?", sender: "ai" }]);
      queueTextForSpeech("Hello! I'm ready to help you with your document. What would you like to know?");
    }
  };
  
  // Handle user voice input
  const handleVoiceInput = (transcript: string) => {
    // Stop any ongoing speech immediately
    stopSpeaking();
    
    // Add user message and send query
    setMessages(prev => [...prev, { text: transcript, sender: "user" }]);
    handleSend(transcript);
  };
  
  return (
    <div className="flex bg-gray-100">
      {allDocumentsError ? (
        <div className="text-red-500">Error loading documents</div>
      ) : (
        <Sidebar
          refetchAllDocuments={refetchAllDocuments}
          uploadedFiles={allDocumentsLoading ? [] : (allDocuments?.data || [])}
          setSelectedDocument={setSelectedDocument}
        />
      )}
      <div className="flex flex-col items-center p-6 min-h-screen w-full mt-16">
        <Card className="w-full max-w-lg p-4 shadow-lg rounded-2xl">
          <h2 className="text-xl font-semibold text-center mb-4">Voice Conversation with AI</h2>
          <p className="text-sm text-gray-600 mb-4">Selected Document: {selectedDocument?.filename || 'No document selected'}</p>
          <div className="flex gap-4">
            <Upload beforeUpload={() => false} onChange={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />}>Click to Upload PDF</Button>
            </Upload>
            <GoogleOAuthProvider clientId={envConstant.GOOGLE_CLIENT_ID}>
              <GoogleDrivePickerButton onFileSelect={handleGoogleDriveFileSelect} buttonText="From Google Drive" />
            </GoogleOAuthProvider>
          </div>
        </Card>
        <Card className="w-full max-w-lg mt-4 p-4 shadow-lg rounded-2xl">
          <div className="max-h-80 overflow-auto">
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item className={item.sender === "user" ? "text-right" : "text-left"}>
                  <div className={`prose prose-sm max-w-none ${item.sender === "user" ? "ml-auto" : "mr-auto"} p-2 rounded-lg ${item.sender === "user" ? "bg-blue-100" : "bg-gray-100"}`}>
                    <ReactMarkdown components={{ p: CustomParagraph }}>{item.text}</ReactMarkdown>
                  </div>
                </List.Item>
              )}
            />
            {isLoading && (
              <div className="flex items-center p-2">
                <div className="animate-pulse flex space-x-1">
                  <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                </div>
                <span className="ml-2 text-sm text-gray-500">AI is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex mt-4 justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-500">
                {isListening ? 'Listening...' : 'Not listening'}
              </span>
            </div>
            <Button
              type="primary"
              onClick={toggleConversation}
              className={`${isConversationActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {isConversationActive ? 'Stop Conversation' : 'Start Conversation'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;