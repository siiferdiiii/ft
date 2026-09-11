"use client";

import React, { useState, useEffect, useRef } from "react";
import { MicIcon } from "../ui/Icons";
import { parseVoiceInput, ParsedVoiceResult } from "@/lib/parseVoiceAmount";

// Extended interface for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface VoiceMicButtonProps {
  onParsedResult: (result: ParsedVoiceResult, suggestedCategoryId?: string | null) => void;
  onError: (message: string) => void;
}

export const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  onParsedResult,
  onError,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Cek dukungan Web Speech API pada browser
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "id-ID";

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (event.error === "not-allowed") {
          onError("Izin mikrofon ditolak. Mohon izinkan mikrofon di pengaturan browser Anda.");
        } else if (event.error === "no-speech") {
          onError("Tidak ada suara yang terdeteksi. Silakan coba tekan mic dan bicara kembali.");
        } else {
          onError(`Gagal mendengarkan suara (${event.error}). Silakan coba lagi.`);
        }
      };

      recognition.onend = async () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onError]);

  const handleToggleListen = async () => {
    if (!recognitionRef.current) {
      // Fallback jika browser tidak mendukung Web Speech API
      onError(
        "Browser Anda belum mendukung Web Speech API. Anda dapat menggunakan tombol +Catat untuk input manual."
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.trim()) {
        await processTranscript(transcript);
      }
    } else {
      try {
        setTranscript("");
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current?.start();
        }, 200);
      }
    }
  };

  const processTranscript = async (text: string) => {
    const parsed = parseVoiceInput(text);

    if (!parsed.amount) {
      onError(
        `Berhasil mendengar "${text}", namun nominal belum terdeteksi. Silakan ulangi atau lengkapi nominal di formulir.`
      );
    }

    // Coba tebak kategori dari kata kunci histori
    let suggestedCategoryId: string | null = null;
    try {
      const res = await fetch("/api/voice/suggest-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: text }),
      });
      const data = await res.json();
      if (data.data?.categoryId) {
        suggestedCategoryId = data.data.categoryId;
      }
    } catch {
      // Abaikan jika suggestion gagal
    }

    onParsedResult(parsed, suggestedCategoryId);
  };

  // Saat transkrip selesai berbicara dan listening selesai
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      processTranscript(transcript);
      setTranscript("");
    }
  }, [isListening]);

  return (
    <div className="flex flex-col items-center justify-center my-6">
      {/* Live transcript indicator saat sedang mendengarkan */}
      {isListening && (
        <div className="mb-3 px-3 py-1.5 rounded-full bg-chip text-primary text-[12px] font-medium animate-pulse max-w-[280px] truncate text-center">
          {transcript || "Mendengarkan... Katakan misal: 'Beli kopi 15 ribu'"}
        </div>
      )}

      <button
        type="button"
        onClick={handleToggleListen}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
          isListening
            ? "bg-expense scale-105 shadow-[0_8px_25px_rgba(239,68,68,0.5)]"
            : "bg-primary shadow-mic-glow hover:scale-102 active:scale-95"
        }`}
        aria-label={isListening ? "Hentikan perekaman suara" : "Mulai merekam suara transaksi"}
      >
        {isListening ? (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-6 bg-white rounded-full animate-bounce" />
            <span className="w-1.5 h-8 bg-white rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="w-1.5 h-5 bg-white rounded-full animate-bounce [animation-delay:0.3s]" />
          </div>
        ) : (
          <MicIcon className="w-8 h-8 text-white" />
        )}
      </button>

      <span className="mt-2 text-[12px] font-medium text-text-secondary">
        {isListening ? "Ketuk untuk selesai" : "Ketuk mic untuk bicara"}
      </span>
    </div>
  );
};
