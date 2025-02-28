import { useEffect, useRef, useState } from "react";
import { Upload, Button, Card, Input, List } from "antd";
import { UploadOutlined, SendOutlined, AudioOutlined } from "@ant-design/icons";
import Sidebar from "../components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { getAllDocuments, uploadDocument } from "../api/queries/documentQueries";
import { askQueryToAI } from "../api/queries/chatQueries";
import { toast } from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { ApiResponse, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types/HomeType";


const CustomParagraph = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className="mb-4 last:mb-0" {...props}>{children}</p>
);

const Home = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const speechMessage = useRef<SpeechSynthesisUtterance>(new SpeechSynthesisUtterance());

  const {
    data: allDocuments,
    isLoading: allDocumentsLoading,
    error: allDocumentsError,
    refetch: refetchAllDocuments
  } = useQuery<ApiResponse>({
    queryKey: ["allDocumentsKey"],
    queryFn: () => getAllDocuments(),
  });

  useEffect(() => {
    window.speechSynthesis.speak(speechMessage.current);
  }, [speechMessage])

  const handleUpload = async (info: any) => {
    try {
      setPdfFile(info.file);
      const response = await uploadDocument(info.file);
      setSelectedDocument(response?.data);
      refetchAllDocuments();
      toast.success(response?.message || `${info.file.name} uploaded successfully`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    try {
      setMessages([...messages, { text: inputText, sender: "user" }]);
      const userQuery = inputText;
      setInputText("");
      const response = await askQueryToAI({documentId: selectedDocument?.id, query: userQuery});
      speechMessage.current.text = response?.data?.answer;
      window.speechSynthesis.speak(speechMessage.current);
      setMessages((prevMessages: any) => [...prevMessages, { text: response?.data?.answer, sender: "ai" }]);
      setInputText("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    }
  };

  const handleVoiceInput = () => {
    window.speechSynthesis.cancel();
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
  

  return (
    <div className="flex bg-gray-100">
      {allDocumentsError ? (
        <div className="text-red-500">Error loading documents</div>
      ) : (
        <Sidebar refetchAllDocuments={refetchAllDocuments} uploadedFiles={allDocumentsLoading ? [] : (allDocuments?.data || [])} setSelectedDocument={setSelectedDocument} />
      )}
      <div className="flex flex-col items-center p-6 min-h-screen w-full mt-16">
        <Card className="w-full max-w-lg p-4 shadow-lg rounded-2xl">
          <h2 className="text-xl font-semibold text-center mb-4">Upload PDF and Chat with AI</h2>
          <p className="text-sm text-gray-600 mb-4">Selected Document: {selectedDocument?.filename}</p>
          <Upload beforeUpload={() => false} onChange={handleUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>Click to Upload PDF</Button>
          </Upload>
          {pdfFile && <p className="mt-2 text-sm text-gray-600">Uploaded: {pdfFile.name}</p>}
        </Card>
        <Card className="w-full max-w-lg mt-4 p-4 shadow-lg rounded-2xl">
          <List
            className="max-h-80 overflow-auto"
            dataSource={messages}
            renderItem={(item) => (
              <List.Item className={item.sender === "user" ? "text-right" : "text-left"}>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: CustomParagraph,
                    }}
                  >
                    {item.text}
                  </ReactMarkdown>
                </div>
              </List.Item>
            )}
          />
          <div className="flex mt-4">
            <Input
              className="flex-1"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              onPressEnter={handleSend}
            />
            <Button icon={<AudioOutlined />} onClick={handleVoiceInput} className="ml-2" />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} className="ml-2" />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;
