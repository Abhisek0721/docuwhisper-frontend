import React, { useEffect, useRef, useState } from "react";
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types/HomeType";
import { toast } from "react-hot-toast";

interface UseSpeechRecognitionProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
}

export const useSpeechRecognition = ({ onTranscript, onError }: UseSpeechRecognitionProps) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser");
      onError?.("Unsupported");
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      toast.success("Listening...");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.results.length - 1; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          onTranscript(transcript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = event.error;
      toast.error(`Voice recognition error: ${errorMessage}`);
      onError?.(errorMessage);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        try {
          recognition.start();
        } catch (error) {
          setIsListening(false);
          onError?.("Restart failed");
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      toast.error("Failed to start speech recognition");
      onError?.("Start failed");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  return {
    isListening,
    startListening,
    stopListening
  };
};