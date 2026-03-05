import { useRef } from "react";
import { Camera } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (files: File[]) => void;
  disabled?: boolean;
}

export function CameraCapture({ onCapture, disabled }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onCapture(files);
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50 cursor-pointer shrink-0 mb-0.5"
        title="Ta bilde"
      >
        <Camera className="h-4 w-4" />
      </button>
    </>
  );
}
