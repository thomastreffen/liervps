import { getAvatarSrc } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface TechAvatarProps {
  name: string;
  avatarId?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

export function TechAvatar({ name, avatarId, color, size = 32, className }: TechAvatarProps) {
  const src = getAvatarSrc(avatarId);
  const initial = name.trim().charAt(0).toUpperCase();
  const bgColor = color || "#039BE5";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const fontSize = size <= 20 ? 8 : size <= 28 ? 10 : 12;

  return (
    <div
      className={cn("flex items-center justify-center rounded-full text-white font-bold shrink-0", className)}
      style={{ width: size, height: size, backgroundColor: bgColor, fontSize }}
    >
      {initial}
    </div>
  );
}
