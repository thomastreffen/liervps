import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const text =
    names.length === 1
      ? `${names[0]} skriver...`
      : names.length === 2
        ? `${names[0]} og ${names[1]} skriver...`
        : `${names.length} personer skriver...`;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground/60 italic">{text}</span>
    </div>
  );
}
