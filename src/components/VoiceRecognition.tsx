import { useState, useRef } from "react";

const API_KEY = "4f1866d113894a9389b8d31a16c7477e";
const ASSEMBLY_AI_URL = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000";

const VoiceRecorder = () => {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      socketRef.current = new WebSocket(ASSEMBLY_AI_URL);
      socketRef.current.onopen = () => {
        socketRef.current?.send(JSON.stringify({ auth_token: API_KEY }));
        setIsListening(true);
      };

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.text) {
            console.log(data.text);
          setTranscript(data.text);
        }
      };

      socketRef.current.onerror = (event) => {
        console.error("WebSocket error:", event);
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(event.data);
        }
      };

      mediaRecorderRef.current.start(250); // Send data every 250ms
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopListening = () => {
    mediaRecorderRef.current?.stop();
    socketRef.current?.close();
    setIsListening(false);
  };

  return (
    <div>
      <button onClick={startListening} disabled={isListening}>
        Start Listening
      </button>
      <button onClick={stopListening} disabled={!isListening}>
        Stop Listening
      </button>
      <p>Transcript: {transcript}</p>
    </div>
  );
};

export default VoiceRecorder;
