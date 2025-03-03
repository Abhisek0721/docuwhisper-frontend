import React, { useState, useEffect, useRef } from "react";
import { envConstant } from "../constants";

const RealTimeConversation = () => {
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const ELEVENLABS_API_KEY = envConstant.ELEVEN_LABS_API_KEY;
  const VOICE_ID = "9BWtsMINqrJLrRacOk9x";

  useEffect(() => {
    audioContextRef.current = new AudioContext();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      sendTextToElevenLabs();
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer();
        playAudio(arrayBuffer);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const sendTextToElevenLabs = () => {
    if (!wsRef.current) return;
    const requestData = {
      text,
      api_key: ELEVENLABS_API_KEY,
      format: "pcm"
    };
    wsRef.current.send(JSON.stringify(requestData));
  };

  const playAudio = async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
    if (sourceRef.current) {
      sourceRef.current.stop();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
    sourceRef.current = source;
  };

  return (
    <div>
      <h2>Real-Time Voice Response</h2>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to speak"
      />
      <button onClick={connectWebSocket}>Speak</button>
    </div>
  );
};

export default RealTimeConversation;
