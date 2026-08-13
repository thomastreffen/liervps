import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { LeadProvider } from "./LeadContext";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <LeadProvider>
      <div className="min-h-screen flex flex-col bg-[hsl(var(--mcs-light))] text-[hsl(var(--mcs-charcoal))]">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </LeadProvider>
  );
}
