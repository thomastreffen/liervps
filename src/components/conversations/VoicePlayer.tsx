import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  url: string;
  duration?: number;
  isOwn?: boolean;
}

export function VoicePlayer({ url, duration, isOwn }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setCurrentTime(Math.floor(audio.currentTime));
      }
    });
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-2 min-w-[160px]",
    )}>
      <button
        onClick={toggle}
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer",
          isOwn
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        )}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {/* Progress bar */}
        <div className={cn(
          "h-1 rounded-full overflow-hidden",
          isOwn ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
        )}>
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOwn ? "bg-primary-foreground/60" : "bg-primary/60"
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className={cn(
          "text-[10px]",
          isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
        )}>
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </span>
      </div>
    </div>
  );
}
