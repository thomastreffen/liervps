import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  count?: number;
}

export function SectionHeader({ icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <div className="flex-1 h-px bg-[hsl(var(--section-border))]" />
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/60 border border-[hsl(var(--section-border))]">
        {icon}
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-background">{count}</Badge>
        )}
      </div>
      <div className="flex-1 h-px bg-[hsl(var(--section-border))]" />
    </div>
  );
}
