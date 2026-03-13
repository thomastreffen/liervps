import { AVATAR_OPTIONS } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface AvatarPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AvatarPicker({ selectedId, onSelect }: AvatarPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Velg avatar</p>
      <div className="grid grid-cols-4 gap-2">
        {AVATAR_OPTIONS.map((avatar) => {
          const isSelected = selectedId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg p-2 transition-all hover:bg-secondary",
                isSelected && "ring-2 ring-primary bg-primary/5"
              )}
            >
              <img
                src={avatar.src}
                alt={avatar.label}
                className="h-10 w-10 rounded-full object-cover"
              />
              <span className="text-[10px] text-muted-foreground truncate max-w-full">
                {avatar.label}
              </span>
              {isSelected && (
                <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
