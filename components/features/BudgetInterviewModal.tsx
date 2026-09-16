"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { CategoryDto } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ProposedBudget {
  categoryId: string;
  categoryName: string;
  amount: number;
}

// State machine: INTRO → TALKING → PROPOSING → CONFIRMING → DONE
type InterviewPhase = "INTRO" | "TALKING" | "PROPOSING" | "CONFIRMING" | "DONE";

// Web Speech API types (tidak ada di lib TypeScript standar)
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface BudgetInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseCategories: CategoryDto[];
  perpetualFundPercent: number;
  onDone: () => void; // dipanggil setelah simpan sukses untuk trigger refresh
}

// Konstanta rate-limit sesi — disimpan di localStorage, bukan DB (PRD §2.2 & §5)
const RATE_LIMIT_KEY = "ft_interview_sessions";
const MAX_SESSIONS_PER_MONTH = 5;

function getSessionCount(): number {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { month: string; count: number };
    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    if (data.month !== currentMonth) return 0;
    return data.count;
  } catch {
    return 0;
  }
}

function incrementSessionCount(): void {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const current = getSessionCount();
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ month: currentMonth, count: current + 1 }));
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

// Gunakan SpeechSynthesis browser untuk TTS output AI
function speakText(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // hentikan TTS sebelumnya dulu
  const cleaned = text.replace(/[*_`#]/g, ""); // hapus markdown sebelum dibacakan
  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = "id-ID";
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

// ─── Komponen Utama ────────────────────────────────────────────────────────────

export const BudgetInterviewModal: React.FC<BudgetInterviewModalProps> = ({
  isOpen,
  onClose,
  expenseCategories,
  perpetualFundPercent,
  onDone,
}) => {
  const [phase, setPhase] = useState<InterviewPhase>("INTRO");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiReply, setAiReply] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State mic (STT)
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Fallback: teks manual jika tidak ada mic
  const [textInput, setTextInput] = useState("");
  const [hasMic, setHasMic] = useState(true);

  // Usulan budget dari AI
  const [proposedBudgets, setProposedBudgets] = useState<ProposedBudget[]>([]);
  const [proposedPercent, setProposedPercent] = useState<number>(perpetualFundPercent);
  const [editedBudgets, setEditedBudgets] = useState<Record<string, string>>({}); // categoryId -> formatted string
  const [incomeHint, setIncomeHint] = useState<number | undefined>(undefined);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const turnCountRef = useRef(0);
  const MAX_TURNS = 50; // Dilonggarkan untuk fase uji coba

  // Reset state saat modal dibuka/tutup
  useEffect(() => {
    if (isOpen) {
      setPhase("INTRO");
      setMessages([]);
      setAiReply("");
      setErrorMsg(null);
      setTranscript("");
      setTextInput("");
      setProposedBudgets([]);
      setEditedBudgets({});
      setIncomeHint(undefined);
      setProposedPercent(perpetualFundPercent);
      turnCountRef.current = 0;
    } else {
      // Hentikan TTS saat modal ditutup
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    }
  }, [isOpen, perpetualFundPercent]);

  // Scroll ke bawah saat pesan baru masuk
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiReply]);

  // Setup Web Speech API (STT)
  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SR) {
      setHasMic(false);
      return;
    }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "id-ID";
    rec.onstart = () => { setIsListening(true); setTranscript(""); };
    rec.onresult = (e) => setTranscript(e.results[0][0].transcript);
    rec.onerror = () => { setIsListening(false); setHasMic(false); };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  // Saat transcript selesai (isListening berhenti + ada teks), kirim ke AI
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      handleSendMessage(transcript.trim());
      setTranscript("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Blok kuota: di-hide/dinonaktifkan sementara untuk fase uji coba
  // const sessionCount = getSessionCount();
  const isRateLimited = false;

  // ── Kirim pesan ke AI ────────────────────────────────────────────────────────

  const sendToAI = useCallback(async (updatedMessages: ChatMessage[]) => {
    setIsAiLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/budget-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          monthlyIncomeHint: incomeHint,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        const msg = json.error?.message || "Gagal menghubungi asisten AI";
        setErrorMsg(msg);
        return;
      }

      const { reply, proposedBudgets: proposed, proposedPerpetualPercent, done } = json.data;

      // Tambah balasan AI ke riwayat percakapan
      const modelMsg: ChatMessage = { role: "model", content: reply };
      setMessages((prev) => [...prev, modelMsg]);
      setAiReply(reply);
      speakText(reply);

      if (done && Array.isArray(proposed) && proposed.length > 0) {
        setProposedBudgets(proposed);
        if (proposedPerpetualPercent) setProposedPercent(proposedPerpetualPercent);
        // Pre-fill edited budgets dengan angka dari AI
        const initialEdits: Record<string, string> = {};
        for (const b of proposed) {
          initialEdits[b.categoryId] = formatCurrencyInput(b.amount);
        }
        setEditedBudgets(initialEdits);
        setPhase("PROPOSING");
      }
    } catch {
      setErrorMsg("Gangguan koneksi. Pastikan kamu terhubung ke internet lalu coba lagi.");
    } finally {
      setIsAiLoading(false);
    }
  }, [incomeHint]);

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim() || isAiLoading) return;
    if (turnCountRef.current >= MAX_TURNS) {
      setErrorMsg("Percakapan sudah mencapai batas maksimum. Silakan konfirmasi atau mulai ulang.");
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setTextInput("");
    turnCountRef.current += 1;
    sendToAI(updated);
  }, [messages, isAiLoading, sendToAI]);

  // ── Mulai interview (Langkah 0 → 1) ─────────────────────────────────────────

  const handleStartInterview = useCallback(async () => {
    if (isRateLimited) return;
    // incrementSessionCount(); // dinonaktifkan sementara untuk uji coba
    setPhase("TALKING");
    // Kirim dengan messages kosong → server return sapaan pembuka tanpa panggil Gemini
    await sendToAI([]);
  }, [isRateLimited, sendToAI]);

  // ── Mic toggle ───────────────────────────────────────────────────────────────

  const handleMicToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
      }
    }
  };

  // ── Konfirmasi & simpan ───────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setPhase("CONFIRMING");
    setErrorMsg(null);
    try {
      const budgetsPayload = proposedBudgets.map((b) => ({
        categoryId: b.categoryId,
        budgetLimit: parseCurrencyInput(editedBudgets[b.categoryId] ?? String(b.amount)),
      }));

      // Cari apakah ada income yang disebut dalam percakapan
      const res = await fetch("/api/ai/budget-interview/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgets: budgetsPayload,
          perpetualFundPercent: proposedPercent !== perpetualFundPercent ? proposedPercent : undefined,
          monthlyIncome: incomeHint,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal menyimpan budget");
        setPhase("PROPOSING");
        return;
      }

      setPhase("DONE");
      setTimeout(() => {
        onDone();
        onClose();
      }, 1800);
    } catch {
      setErrorMsg("Gangguan koneksi saat menyimpan. Silakan coba lagi.");
      setPhase("PROPOSING");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D0D17]/70 backdrop-blur-sm"
        onClick={() => {
          window.speechSynthesis?.cancel();
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md h-[90vh] bg-surface rounded-t-[28px] flex flex-col border-t border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div>
            <p className="text-[11px] font-medium text-text-secondary">Asisten Keuangan</p>
            <h2 className="text-[16px] font-bold text-text">Susun Budget dengan AI</h2>
          </div>
          <button
            type="button"
            onClick={() => { window.speechSynthesis?.cancel(); onClose(); }}
            className="p-1.5 rounded-full text-text-secondary hover:text-text hover:bg-field transition-colors"
            aria-label="Tutup"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── PHASE: INTRO ── */}
          {phase === "INTRO" && (
            <div className="flex-1 flex flex-col justify-between px-5 py-6">
              <div className="space-y-5">
                {/* Avatar AI */}
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-chip flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="6" y="10" width="20" height="14" rx="4" fill="#4E44E5" opacity="0.15"/>
                      <rect x="10" y="6" width="12" height="8" rx="3" fill="#4E44E5"/>
                      <circle cx="13" cy="10" r="1.5" fill="white"/>
                      <circle cx="19" cy="10" r="1.5" fill="white"/>
                      <path d="M12 14.5h8" stroke="#4E44E5" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-[17px] font-bold text-text">Halo! Aku Fin 👋</h3>
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    Aku akan bantu kamu menyusun rencana budget bulanan lewat percakapan singkat — sekitar 6 pertanyaan saja.
                  </p>
                </div>

                {/* Disclaimer */}
                <div className="bg-chip rounded-[14px] px-4 py-3 space-y-1.5">
                  <p className="text-[12px] font-semibold text-primary">Sebelum mulai:</p>
                  <p className="text-[12px] text-text-secondary leading-relaxed">
                    Percakapan ini <span className="font-medium text-text">tidak disimpan permanen</span>. Data yang kamu bagikan hanya digunakan sementara untuk memberikan saran budget yang relevan untukmu.
                  </p>
                </div>

                {isRateLimited && (
                  <div className="bg-expense/10 rounded-[14px] px-4 py-3">
                    <p className="text-[12px] text-expense font-medium">
                      Kamu sudah menggunakan fitur ini {MAX_SESSIONS_PER_MONTH}x bulan ini (batas maksimum). Coba lagi bulan depan.
                    </p>
                  </div>
                )}

                {expenseCategories.length === 0 && (
                  <div className="bg-budget-yellow/10 rounded-[14px] px-4 py-3">
                    <p className="text-[12px] text-budget-yellow font-medium">
                      Kamu belum punya kategori pengeluaran. Buat dulu di menu Kategori agar AI bisa menyusun budget per kategori.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleStartInterview}
                  disabled={isRateLimited || expenseCategories.length === 0}
                  id="btn-start-interview"
                >
                  Mulai Percakapan
                </Button>
                <Button variant="secondary" fullWidth onClick={onClose}>
                  Nanti Saja
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE: TALKING ── */}
          {phase === "TALKING" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Chat area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] px-4 py-2.5 rounded-[18px] text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-white rounded-br-[6px]"
                          : "bg-field text-text rounded-bl-[6px]"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Loading dots saat AI thinking */}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-field px-4 py-3 rounded-[18px] rounded-bl-[6px] flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Error banner */}
              {errorMsg && (
                <div className="mx-4 mb-2 px-3 py-2 bg-expense/10 rounded-[12px]">
                  <p className="text-[12px] text-expense font-medium">{errorMsg}</p>
                </div>
              )}

              {/* Input area */}
              <div className="px-4 pb-5 pt-2 flex-shrink-0 border-t border-border space-y-2">
                {/* Transcript preview */}
                {isListening && (
                  <div className="px-3 py-1.5 bg-chip rounded-full text-primary text-[12px] font-medium animate-pulse truncate text-center">
                    {transcript || "Mendengarkan..."}
                  </div>
                )}

                {/* Text input fallback */}
                <div className="flex items-end gap-2">
                  {!hasMic || !isListening ? (
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(textInput);
                        }
                      }}
                      placeholder="Ketik jawaban..."
                      className="flex-1 bg-field text-text text-[14px] px-4 py-2.5 rounded-[14px] border-none focus:ring-2 focus:ring-primary focus:outline-none"
                      disabled={isAiLoading}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}

                  {/* Send button (teks) */}
                  {textInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSendMessage(textInput)}
                      disabled={isAiLoading}
                      className="px-4 py-2.5 bg-primary text-white text-[13px] font-semibold rounded-[14px] disabled:opacity-50"
                    >
                      Kirim
                    </button>
                  )}

                  {/* Mic button */}
                  {hasMic && (
                    <button
                      type="button"
                      onClick={handleMicToggle}
                      disabled={isAiLoading}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                        isListening
                          ? "bg-expense scale-105 shadow-[0_6px_20px_rgba(239,68,68,0.4)]"
                          : "bg-primary shadow-[0_8px_20px_rgba(78,68,229,0.4)] hover:scale-105 active:scale-95"
                      } disabled:opacity-50`}
                      aria-label={isListening ? "Hentikan rekaman" : "Bicara"}
                    >
                      {isListening ? (
                        <div className="flex items-center gap-0.5">
                          <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="6" y="1" width="6" height="10" rx="3" fill="white"/>
                          <path d="M3 9c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          <line x1="9" y1="15" x2="9" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Turn counter */}
                <p className="text-center text-[11px] text-text-secondary">
                  Putaran {Math.ceil(messages.filter(m => m.role === "user").length)} / {MAX_TURNS}
                </p>
              </div>
            </div>
          )}

          {/* ── PHASE: PROPOSING ── */}
          {phase === "PROPOSING" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                <div className="bg-chip rounded-[16px] px-4 py-3">
                  <p className="text-[12px] text-primary font-semibold mb-1">Usulan Budget Bulananan</p>
                  <p className="text-[12px] text-text-secondary">
                    Kamu bisa ubah angkanya langsung di bawah sebelum konfirmasi.
                  </p>
                </div>

                {/* Dana Abadi section jika persentase berubah */}
                {proposedPercent !== perpetualFundPercent && (
                  <div className="bg-surface border border-border rounded-[16px] px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-text">Dana Abadi</span>
                      <span className="text-[12px] font-medium text-primary">{proposedPercent}% dari income</span>
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      Persentase berubah dari {perpetualFundPercent}% → {proposedPercent}%
                    </p>
                  </div>
                )}

                {/* Kartu per kategori */}
                {proposedBudgets.map((b) => (
                  <div
                    key={b.categoryId}
                    className="bg-surface border border-border rounded-[16px] px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-chip flex items-center justify-center text-primary font-bold text-[13px] flex-shrink-0">
                      {b.categoryName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-text truncate">{b.categoryName}</p>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editedBudgets[b.categoryId] ?? formatCurrencyInput(b.amount)}
                      onChange={(e) =>
                        setEditedBudgets((prev) => ({
                          ...prev,
                          [b.categoryId]: formatCurrencyInput(e.target.value),
                        }))
                      }
                      className="w-32 bg-field text-text text-[14px] font-semibold px-3 py-1.5 rounded-[10px] border-none focus:ring-2 focus:ring-primary focus:outline-none text-right"
                    />
                  </div>
                ))}

                {errorMsg && (
                  <div className="px-3 py-2 bg-expense/10 rounded-[12px]">
                    <p className="text-[12px] text-expense font-medium">{errorMsg}</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-4 pb-5 pt-3 border-t border-border space-y-2 flex-shrink-0">
                <Button variant="primary" fullWidth onClick={handleConfirm} id="btn-confirm-budget">
                  Konfirmasi & Simpan
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setPhase("TALKING");
                    setErrorMsg(null);
                  }}
                >
                  Minta Revisi
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE: CONFIRMING ── */}
          {phase === "CONFIRMING" && (
            <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-4">
              <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[14px] font-medium text-text-secondary">Menyimpan budget...</p>
            </div>
          )}

          {/* ── PHASE: DONE ── */}
          {phase === "DONE" && (
            <div className="flex-1 flex flex-col items-center justify-center px-5 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-income/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 16l5.5 5.5L24 10" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[17px] font-bold text-text">Budget berhasil disimpan!</p>
                <p className="text-[13px] text-text-secondary mt-1">Halaman budget akan diperbarui.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
