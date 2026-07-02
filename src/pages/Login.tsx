import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/", { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        toast.error("Innlogging feilet", { description: error.message });
        return;
      }
      // onAuthStateChange will trigger redirect via the effect above
    } catch (err: any) {
      toast.error("Innlogging feilet", { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Laster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <form
        onSubmit={handleLogin}
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Flame className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-card-foreground">Lier Varmepumpeservice</h1>
            <p className="text-sm text-muted-foreground">Intern arbeidsflate</p>
          </div>
        </div>

        <div className="w-full space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Logg inn
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Kun tilgjengelig for ansatte i Lier VPS.
        </p>
      </form>
    </div>
  );
}
