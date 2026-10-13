import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageCircle, Sparkles, Zap, Image as Img, ShieldCheck } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/app");

  const features = [
    { icon: Zap, title: "Real-time chat", text: "Instant delivery, typing indicators, read receipts and live presence." },
    { icon: Sparkles, title: "Stories", text: "Share text or photo stories that vanish after 24 hours." },
    { icon: Img, title: "Moments feed", text: "Post photos, like and comment — a social feed built in." },
    { icon: ShieldCheck, title: "Private by design", text: "Row-level security means only chat members can read a chat." },
  ];
  return (
    <main className="aurora min-h-dvh">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="brand-grad flex h-10 w-10 items-center justify-center rounded-2xl text-white"><MessageCircle size={20} /></span>
          <span className="text-xl font-bold tracking-tight">Pulse</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-panel2">Sign in</Link>
          <Link href="/signup" className="brand-grad rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg">Get started</Link>
        </div>
      </nav>
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-16 text-center md:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live &amp; open for everyone
        </span>
        <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Talk. Share. <span className="brand-text">Stay in the pulse.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          One app for messaging, disappearing stories and a photo feed — fast, beautiful and built for the way people actually connect.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="brand-grad rounded-full px-8 py-3.5 font-semibold text-white shadow-xl transition hover:scale-[1.03]">Create your account</Link>
          <Link href="/login" className="rounded-full border border-line bg-panel/60 px-8 py-3.5 font-semibold backdrop-blur transition hover:bg-panel">I already have one</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-24 sm:grid-cols-2">
        {features.map(({ icon: I, title, text }) => (
          <div key={title} className="rounded-3xl border border-line bg-panel/70 p-6 backdrop-blur">
            <span className="brand-grad mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white"><I size={20} /></span>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
