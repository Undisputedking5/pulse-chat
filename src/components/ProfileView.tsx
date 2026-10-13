"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Check, Loader2, LogOut } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import { uploadMedia } from "@/lib/upload";
import type { Profile } from "@/lib/types";

export default function ProfileView() {
  const { supabase, me, setMe } = useApp();
  const router = useRouter();
  const [name, setName] = useState(me.display_name);
  const [bio, setBio] = useState(me.bio);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(patch: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url">>) {
    setBusy(true); setErr(null); setSaved(false);
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", me.id).select().single();
    setBusy(false);
    if (error) return setErr(error.message);
    setMe(data as Profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function avatar(file?: File) {
    if (!file) return;
    try {
      const url = await uploadMedia(supabase, me.id, file);
      await save({ avatar_url: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const input = "w-full rounded-xl border border-line bg-panel2 px-4 py-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-[var(--glow)]";
  return (
    <div className="scroll-thin h-full overflow-y-auto pb-24 md:pb-8">
      <div className="mx-auto max-w-lg px-4 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <div className="aurora mt-5 flex flex-col items-center rounded-3xl border border-line p-8">
          <label className="group relative cursor-pointer">
            <Avatar name={me.display_name || me.username} src={me.avatar_url} size={104} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><Camera size={26} /></span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => avatar(e.target.files?.[0])} />
          </label>
          <p className="mt-4 text-xl font-bold">{me.display_name || me.username}</p>
          <p className="text-sm text-muted">@{me.username}</p>
        </div>
        <div className="mt-5 space-y-3 rounded-3xl border border-line bg-panel p-5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Display name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Bio</label>
          <textarea className={input} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Tell people about yourself" />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button onClick={() => save({ display_name: name.trim() || me.username, bio: bio.trim() })} disabled={busy}
            className="brand-grad flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {saved ? "Saved" : "Save changes"}
          </button>
        </div>
        <button onClick={signOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 text-sm font-medium text-red-500 hover:bg-red-500/10">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
