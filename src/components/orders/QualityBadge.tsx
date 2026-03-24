import { Badge } from "@/components/ui/badge";
import { QUALITY_LABELS, type QualityLevel } from "@/lib/order-quality";
import { cn } from "@/lib/utils";

interface QualityBadgeProps {
  score: QualityLevel;
  className?: string;
}

export function QualityBadge({ score, className }: QualityBadgeProps) {
  const config = QUALITY_LABELS[score];
  return (
    <Badge className={cn("text-[10px]", config.color, className)}>
      {config.label}
    </Badge>
  );
}

export function QualityDot({ score }: { score: QualityLevel }) {
  const config = QUALITY_LABELS[score];
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", config.dotClass)} />;
}
