"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import { cx } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default function NewChatDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (conversationId: string) => void }) {
  const { supabase, me, online } = useApp();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [group, setGroup] = useState(false);
  const [picked, setPicked] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim().replace(/[%,()]/g, "");
      let query = supabase.from("profiles").select("*").neq("id", me.id).order("last_seen", { ascending: false }).limit(25);
      if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
      const { data } = await query;
      setResults((data as Profile[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, supabase, me.id]);

  async function choose(p: Profile) {
    if (group) {
      setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]));
      return;
    }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("start_direct_chat", { other: p.id });
    setBusy(false);
    if (error) return setErr(error.message);
    onOpen(data as string);
  }

  async function createGroup() {
    if (!name.trim() || picked.length === 0) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("create_group_chat", { group_name: name.trim(), member_ids: picked.map((p) => p.id) });
    setBusy(false);
    if (error) return setErr(error.message);
    onOpen(data as string);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="pop flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-panel shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-lg font-bold">{group ? "New group" : "New chat"}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-panel2"><X size={20} /></button>
        </div>
        <div className="space-y-3 px-5 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name or @username"
              className="w-full rounded-xl border border-line bg-panel2 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-accent" />
          </div>
          <button onClick={() => { setGroup(!group); setPicked([]); }}
            className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", group ? "bg-accent/15 text-accent" : "hover:bg-panel2")}>
            <span className="brand-grad flex h-9 w-9 items-center justify-center rounded-full text-white"><Users size={17} /></span>
            {group ? "Creating a group — pick members" : "Create a group"}
          </button>
          {group && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={60}
              className="w-full rounded-xl border border-line bg-panel2 px-4 py-2.5 text-sm outline-none focus:border-accent" />
          )}
        </div>
        <div className="scroll-thin mt-2 flex-1 overflow-y-auto px-2 pb-2">
          {results.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No one found yet. Invite friends to sign up!</p>}
          {results.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <button key={p.id} disabled={busy} onClick={() => choose(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-panel2">
                <Avatar name={p.display_name || p.username} src={p.avatar_url} size={42} online={online.has(p.id)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted">@{p.username}{p.bio ? ` · ${p.bio}` : ""}</p>
                </div>
                {group && <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border", on ? "brand-grad border-transparent text-white" : "border-line")}>{on && <Check size={14} />}</span>}
              </button>
            );
          })}
        </div>
        {(err || group) && (
          <div className="space-y-2 border-t border-line p-4">
            {err && <p className="text-sm text-red-500">{err}</p>}
            {group && (
              <button onClick={createGroup} disabled={busy || !name.trim() || picked.length === 0}
                className="brand-grad flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy && <Loader2 size={16} className="animate-spin" />} Create group{picked.length ? ` (${picked.length})` : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
