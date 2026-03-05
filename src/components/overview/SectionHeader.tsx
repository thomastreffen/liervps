import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
}

export function SectionHeader({ icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">{title}</h2>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 ml-1">{count}</Badge>
      )}
    </div>
  );
}
