import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import myntmoreLogo from "@/assets/myntmore-logo.png";

export function LoginPage() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (session) nav({ to: "/" });
  }, [session, nav]);

  useEffect(() => {
    setError(null);
  }, [email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      nav({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={myntmoreLogo} alt="Myntmore" className="h-20 object-contain" />
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Dashboard OS
          </div>
        </div>

        <h1 className="mb-1 text-xl font-bold">Sign in</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Use the email your invite was sent to.
            </p>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
              
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gold font-bold text-gold-foreground hover:bg-gold/90 transition-all"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>

        <p className="mt-6 text-center text-xs text-muted-foreground border-t pt-4">
          Got an invite link?{" "}
          <Link to="/accept-invite" className="font-semibold text-foreground underline">
            Accept invite
          </Link>
        </p>
      </div>
    </div>
  );
}
