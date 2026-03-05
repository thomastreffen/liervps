import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecorded: (blob: Blob, duration: number) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecorded, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; duration: number; url: string } | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPreview({ blob, duration, url });
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      // Permission denied or not available
    }
  }, [duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const confirmSend = useCallback(() => {
    if (preview) {
      onRecorded(preview.blob, preview.duration);
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      setDuration(0);
    }
  }, [preview, onRecorded]);

  const cancelPreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setDuration(0);
  }, [preview]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, []);

  // Preview mode
  if (preview) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/30">
        <audio src={preview.url} controls className="h-8 max-w-[180px]" />
        <span className="text-[11px] text-muted-foreground">{formatTime(preview.duration)}</span>
        <button
          onClick={cancelPreview}
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors cursor-pointer"
          title="Slett"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={confirmSend}
          className="h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Send
        </button>
      </div>
    );
  }

  // Recording mode
  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-mono text-destructive">{formatTime(duration)}</span>
        </div>
        <button
          onClick={stopRecording}
          className="h-9 w-9 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 transition-colors cursor-pointer"
          title="Stopp"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Default mic button
  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50 cursor-pointer shrink-0 mb-0.5"
      title="Talemelding"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
