import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
}

export function SectionHeader({ icon, title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 ml-1">{count}</Badge>
      )}
    </div>
  );
}
