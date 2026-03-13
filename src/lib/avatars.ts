import avatar01 from "@/assets/avatars/avatar-01.png";
import avatar02 from "@/assets/avatars/avatar-02.png";
import avatar03 from "@/assets/avatars/avatar-03.png";
import avatar04 from "@/assets/avatars/avatar-04.png";
import avatar05 from "@/assets/avatars/avatar-05.png";
import avatar06 from "@/assets/avatars/avatar-06.png";
import avatar07 from "@/assets/avatars/avatar-07.png";
import avatar08 from "@/assets/avatars/avatar-08.png";
import avatar09 from "@/assets/avatars/avatar-09.png";
import avatar10 from "@/assets/avatars/avatar-10.png";
import avatar11 from "@/assets/avatars/avatar-11.png";
import avatar12 from "@/assets/avatars/avatar-12.png";

export interface AvatarOption {
  id: string;
  label: string;
  src: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "robot", label: "Robot", src: avatar01 },
  { id: "monster", label: "Monster", src: avatar02 },
  { id: "cyborg-cat", label: "Cyborg-katt", src: avatar03 },
  { id: "electric-eel", label: "Elektrisk ål", src: avatar04 },
  { id: "thunder-bear", label: "Torden-bjørn", src: avatar05 },
  { id: "battery", label: "Batteri", src: avatar06 },
  { id: "spark-plug", label: "Tennplugg", src: avatar07 },
  { id: "circuit-ghost", label: "Krets-spøkelse", src: avatar08 },
  { id: "electric-wolf", label: "Elektro-ulv", src: avatar09 },
  { id: "lightbulb", label: "Lyspære", src: avatar10 },
  { id: "plasma-ball", label: "Plasmakule", src: avatar11 },
  { id: "electric-dragon", label: "Elektro-drage", src: avatar12 },
];

const avatarMap = new Map(AVATAR_OPTIONS.map((a) => [a.id, a.src]));

export function getAvatarSrc(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return avatarMap.get(avatarId) || null;
}
