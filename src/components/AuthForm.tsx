"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, MessageCircle } from "lucide-react";

function Form({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "That confirmation link is invalid or expired. Try signing in." : null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (mode === "signup") {
      const clean = username.trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,24}$/.test(clean)) {
        setBusy(false);
        return setError("Username must be 3–24 characters: letters, numbers, dots or underscores.");
      }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username: clean, display_name: clean }, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) return router.replace("/app");
      setInfo("Check your inbox — we sent you a confirmation link.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
      router.replace("/app");
      router.refresh();
    }
  }

  async function forgot() {
    if (!email) return setError("Enter your email first, then tap “Forgot password”.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback` });
    if (error) setError(error.message); else setInfo("Password reset email sent.");
  }

  const input = "w-full rounded-xl border border-line bg-panel2 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-[var(--glow)]";

  return (
    <div className="aurora relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="pop w-full max-w-md rounded-3xl border border-line bg-panel/80 p-8 shadow-2xl backdrop-blur-xl">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="brand-grad flex h-10 w-10 items-center justify-center rounded-2xl text-white"><MessageCircle size={20} /></span>
          <span className="text-xl font-bold tracking-tight">Pulse</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{mode === "login" ? "Sign in to pick up your conversations." : "Chat, share stories and post moments — free."}</p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input className={input} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          )}
          <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <div className="relative">
            <input className={input} type={show ? "text" : "password"} placeholder="Password (min 8 characters)" minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label="Toggle password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">{info}</p>}
          <button disabled={busy} className="brand-grad flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "login" && (
            <button type="button" onClick={forgot} className="w-full text-center text-xs text-muted hover:text-fg">Forgot password?</button>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {mode === "login" ? "New to Pulse? " : "Already have an account? "}
          <Link href={mode === "login" ? "/signup" : "/login"} className="font-semibold text-accent">{mode === "login" ? "Sign up" : "Sign in"}</Link>
        </p>
      </div>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  return <Suspense><Form mode={mode} /></Suspense>;
}
