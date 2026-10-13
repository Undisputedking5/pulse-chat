"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCirclePlus, Search } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import ChatThread from "./ChatThread";
import NewChatDialog from "./NewChatDialog";
import StoriesBar from "./StoriesBar";
import { cx, timeAgo } from "@/lib/utils";
import type { Conversation, Overview } from "@/lib/types";

export default function ChatsView() {
  const { supabase, me, online } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c");
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [overview, setOverview] = useState<Record<string, Overview>>({});
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from("conversations")
        .select("*, members:conversation_members(user_id,last_read_at,role,profile:profiles(*))")
        .order("last_message_at", { ascending: false }),
      supabase.rpc("conversation_overview"),
    ]);
    setConvs((c as unknown as Conversation[]) ?? []);
    setOverview(Object.fromEntries(((o as Overview[]) ?? []).map((x) => [x.conversation_id, x])));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel("inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load]);

  // opening a chat clears its unread badge locally; the thread also persists last_read_at
  useEffect(() => {
    if (activeId) setOverview((o) => (o[activeId] ? { ...o, [activeId]: { ...o[activeId], unread: 0 } } : o));
  }, [activeId, convs.length]);

  const nameOf = useCallback((c: Conversation) => {
    if (c.is_group) return c.name ?? "Group";
    const p = c.members.find((m) => m.user_id !== me.id)?.profile;
    return p?.display_name || p?.username || "Chat";
  }, [me.id]);

  const visible = useMemo(
    () => convs.filter((c) => nameOf(c).toLowerCase().includes(filter.toLowerCase())),
    [convs, filter, nameOf]
  );
  const active = convs.find((c) => c.id === activeId) ?? null;

  const open = (id: string) => router.push(`/app?c=${id}`);

  return (
    <div className="flex h-full">
      <section className={cx("flex h-full w-full flex-col border-r border-line bg-panel md:w-[370px] md:shrink-0", activeId && "hidden md:flex")}>
        <div className="flex items-center justify-between px-5 pb-1 pt-5">
          <h1 className="text-2xl font-extrabold tracking-tight">Chats</h1>
          <button onClick={() => setDialog(true)} className="brand-grad flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105" aria-label="New chat">
            <MessageCirclePlus size={19} />
          </button>
        </div>
        <StoriesBar className="border-b border-line" />
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chats"
              className="w-full rounded-xl bg-panel2 py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-accent/40" />
          </div>
        </div>
        <div className="scroll-thin mt-2 flex-1 overflow-y-auto px-2 pb-24 md:pb-4">
          {!loaded && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3"><div className="h-12 w-12 animate-pulse rounded-full bg-panel2" /><div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-panel2" /><div className="h-3 w-2/3 animate-pulse rounded bg-panel2" /></div></div>
          ))}
          {loaded && visible.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="brand-grad mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl text-3xl">💬</div>
              <p className="font-semibold">{filter ? "No matching chats" : "No conversations yet"}</p>
              <p className="mt-1 text-sm text-muted">{filter ? "Try a different search." : "Start a chat with someone to see it here."}</p>
              {!filter && <button onClick={() => setDialog(true)} className="brand-grad mt-5 rounded-full px-6 py-2.5 text-sm font-semibold text-white">Start a chat</button>}
            </div>
          )}
          {visible.map((c) => {
            const ov = overview[c.id];
            const other = c.is_group ? null : c.members.find((m) => m.user_id !== me.id)?.profile;
            const name = nameOf(c);
            const preview = ov?.last_body || (ov?.last_media_type ? `📎 ${ov.last_media_type}` : "No messages yet");
            const fromMe = ov?.last_sender === me.id;
            return (
              <button key={c.id} onClick={() => open(c.id)}
                className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition", c.id === activeId ? "bg-accent/12" : "hover:bg-panel2")}>
                <Avatar name={name} src={c.is_group ? c.avatar_url : other?.avatar_url} size={50} online={!!other && online.has(other.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold">{name}</p>
                    <span className={cx("shrink-0 text-[11px]", ov?.unread ? "font-semibold text-accent" : "text-muted")}>{ov?.last_at ? timeAgo(ov.last_at) : ""}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx("truncate text-sm", ov?.unread ? "font-medium text-fg" : "text-muted")}>{fromMe && "You: "}{preview}</p>
                    {!!ov?.unread && <span className="brand-grad flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white">{ov.unread > 99 ? "99+" : ov.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={cx("h-full min-w-0 flex-1", !activeId && "hidden md:block")}>
        {active ? (
          <ChatThread key={active.id} conversation={active} onBack={() => router.push("/app")} />
        ) : (
          <div className="aurora hidden h-full flex-col items-center justify-center text-center md:flex">
            <div className="brand-grad mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] text-4xl shadow-2xl">💜</div>
            <h2 className="text-2xl font-bold">Your messages</h2>
            <p className="mt-1 max-w-xs text-sm text-muted">Pick a conversation or start a new one — everything syncs in real time.</p>
            <button onClick={() => setDialog(true)} className="brand-grad mt-6 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-lg">New chat</button>
          </div>
        )}
      </section>

      {dialog && <NewChatDialog onClose={() => setDialog(false)} onOpen={(id) => { setDialog(false); load().then(() => open(id)); }} />}
    </div>
  );
}
