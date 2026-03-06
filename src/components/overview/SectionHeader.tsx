import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  count?: number;
}

export function SectionHeader({ icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-foreground/70">{title}</h2>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-muted">{count}</Badge>
        )}
      </div>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}
