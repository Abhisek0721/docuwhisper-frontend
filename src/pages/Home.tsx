import { useEffect, useRef, useState } from "react";
import { Upload, Button, Card, Input, List } from "antd";
import { UploadOutlined, SendOutlined, AudioOutlined } from "@ant-design/icons";
import Sidebar from "../components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { getAllDocuments, uploadDocument } from "../api/queries/documentQueries";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { ApiResponse, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types/HomeType";
import SocketService from "../services/socketService";
import GoogleDrivePickerButton from "../components/GoogleDrivePicker";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { envConstant } from "../constants";

const CustomParagraph = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="mb-4 last:mb-0" {...props}>{children}</p>
);

const Home = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketService = useRef(SocketService.getInstance());
  const speechMessage = useRef<SpeechSynthesisUtterance>(new SpeechSynthesisUtterance());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const {
    data: allDocuments,
    isLoading: allDocumentsLoading,
    error: allDocumentsError,
    refetch: refetchAllDocuments
  } = useQuery<ApiResponse>({
    queryKey: ["allDocumentsKey"],
    queryFn: () => getAllDocuments(),
  });

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
    });
    
    socketService.current.on('done', (data) => {
      setIsLoading(false);
      speechMessage.current.text = data.text;
      window.speechSynthesis.speak(speechMessage.current);
    });
    
    socketService.current.on('error', (data) => {
      toast.error(data.message || "Error processing your request");
      setIsLoading(false);
    });
    
    // Cleanup function
    return () => {
      socketService.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleFileUpload = async (file: File) => {
    try {
      setPdfFile(file);
      const response = await uploadDocument(file);
      setSelectedDocument(response?.data);
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

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    // Add user message to chat
    setMessages((prev) => [...prev, { text: inputText, sender: "user" }]);
    // Send query via socket service
    socketService.current.sendQuery(selectedDocument?.id, inputText);
    // Reset input field
    setInputText("");
  };

  const handleVoiceInput = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      toast.success("AI speaking stopped");
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      toast.error("Voice recognition error: " + event.error);
    };
  };

  // Function to handle document context for AI
  const updateDocumentContext = () => {
    if (selectedDocument && socketService.current.getSocket()) {
      socketService.current.getSocket()?.emit('setDocumentContext', { documentId: selectedDocument.id });
    }
  };

  // Update document context when selected document changes
  useEffect(() => {
    updateDocumentContext();
  }, [selectedDocument]);

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
          <h2 className="text-xl font-semibold text-center mb-4">Upload PDF and Chat with AI</h2>
          <p className="text-sm text-gray-600 mb-4">Selected Document: {selectedDocument?.filename}</p>
          
          <div className="flex gap-4">
            <Upload beforeUpload={() => false} onChange={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />}>Click to Upload PDF</Button>
            </Upload>
            
            <GoogleOAuthProvider clientId={envConstant.GOOGLE_CLIENT_ID}>
              <GoogleDrivePickerButton onFileSelect={handleGoogleDriveFileSelect} buttonText="From Google Drive" />
            </GoogleOAuthProvider>
          </div>
          
          {pdfFile && <p className="mt-2 text-sm text-gray-600">Uploaded: {pdfFile.name}</p>}
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
          
          <div className="flex mt-4">
            <Input
              className="flex-1"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              onPressEnter={handleSend}
              disabled={isLoading}
            />
            <Button
              icon={<AudioOutlined />}
              onClick={handleVoiceInput}
              className="ml-2"
              disabled={isLoading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              className="ml-2"
              loading={isLoading}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;