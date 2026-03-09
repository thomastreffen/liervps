import { cn } from "@/lib/utils";

interface PageContainerProps {
  variant?: "contained" | "fluid";
  className?: string;
  children: React.ReactNode;
}

/**
 * Layout wrapper for page content.
 * - `contained` (default): max-w-5xl centered — for settings, forms, detail pages
 * - `fluid`: full width with comfortable padding — for dashboards, tables, operational pages
 */
export function PageContainer({ variant = "contained", className, children }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full p-4 sm:p-6 lg:p-8",
        variant === "contained" && "max-w-5xl",
        variant === "fluid" && "max-w-[1920px]",
        className
      )}
    >
      {children}
    </div>
  );
}
