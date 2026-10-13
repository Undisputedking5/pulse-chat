"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CornerUpLeft, Loader2, Paperclip, Send, Smile, Trash2, X } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import { clock, cx, dayLabel, timeAgo } from "@/lib/utils";
import { mediaKind, uploadMedia } from "@/lib/upload";
import type { Conversation, Message } from "@/lib/types";

type Reaction = { message_id: string; user_id: string; emoji: string };
const QUICK = ["❤️", "😂", "😮", "😢", "🔥", "👍"];
const EMOJI = ["😀", "😂", "🥹", "😍", "😎", "🤝", "🙏", "🔥", "🎉", "💯", "❤️", "😭", "🤔", "👀", "✨", "🙌"];

export default function ChatThread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { supabase, me, online } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSent = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const people = useMemo(() => new Map(conversation.members.map((m) => [m.user_id, m.profile])), [conversation.members]);
  const other = conversation.is_group ? null : conversation.members.find((m) => m.user_id !== me.id)?.profile;
  const title = conversation.is_group ? conversation.name ?? "Group" : other?.display_name || other?.username || "Chat";

  const markRead = useCallback(() => {
    supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id).eq("user_id", me.id).then(() => {});
  }, [supabase, conversation.id, me.id]);

  // load history
  useEffect(() => {
    let cancelled = false;
    setMessages([]); setReactions([]); setReplyTo(null);
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false }).limit(150);
      if (cancelled) return;
      const msgs = ((data as Message[]) ?? []).reverse();
      setMessages(msgs);
      if (msgs.length) {
        const { data: r } = await supabase.from("message_reactions").select("*").in("message_id", msgs.map((m) => m.id));
        if (!cancelled) setReactions((r as Reaction[]) ?? []);
      }
      markRead();
    })();
    return () => { cancelled = true; };
  }, [supabase, conversation.id, markRead]);

  // realtime
  useEffect(() => {
    const ch = supabase.channel(`thread:${conversation.id}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` }, (p) => {
        const m = p.new as Message;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.sender_id !== me.id) markRead();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        const id = (p.old as { id: string }).id;
        setMessages((cur) => cur.filter((x) => x.id !== id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          const r = p.new as Reaction;
          setReactions((cur) => (cur.some((x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji) ? cur : [...cur, r]));
        } else if (p.eventType === "DELETE") {
          const r = p.old as Partial<Reaction>;
          setReactions((cur) => cur.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)));
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const uid = (payload as { user: string }).user;
        setTyping((t) => ({ ...t, [uid]: Date.now() }));
      })
      .subscribe();
    chRef.current = ch;
    const sweep = setInterval(() => setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, at]) => Date.now() - at < 3500))), 1500);
    return () => { clearInterval(sweep); supabase.removeChannel(ch); chRef.current = null; };
  }, [supabase, conversation.id, me.id, markRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, Object.keys(typing).length]);

  function onType(v: string) {
    setText(v);
    if (Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      chRef.current?.send({ type: "broadcast", event: "typing", payload: { user: me.id } });
    }
  }

  async function send(extra?: { media_url: string; media_type: Message["media_type"] }) {
    const body = text.trim();
    if (!body && !extra) return;
    setSending(true); setError(null);
    const { data, error } = await supabase.from("messages").insert({
      conversation_id: conversation.id, sender_id: me.id, body,
      media_url: extra?.media_url ?? null, media_type: extra?.media_type ?? null, reply_to: replyTo?.id ?? null,
    }).select().single();
    setSending(false);
    if (error) return setError(error.message);
    setMessages((cur) => (cur.some((x) => x.id === (data as Message).id) ? cur : [...cur, data as Message]));
    setText(""); setReplyTo(null); setEmojiOpen(false);
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    setSending(true); setError(null);
    try {
      const url = await uploadMedia(supabase, me.id, file);
      await send({ media_url: url, media_type: mediaKind(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setSending(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function react(m: Message, emoji: string) {
    setPicker(null);
    const has = reactions.some((r) => r.message_id === m.id && r.user_id === me.id && r.emoji === emoji);
    if (has) {
      setReactions((c) => c.filter((r) => !(r.message_id === m.id && r.user_id === me.id && r.emoji === emoji)));
      await supabase.from("message_reactions").delete().match({ message_id: m.id, user_id: me.id, emoji });
    } else {
      setReactions((c) => [...c, { message_id: m.id, user_id: me.id, emoji }]);
      await supabase.from("message_reactions").insert({ message_id: m.id, user_id: me.id, emoji });
    }
  }

  async function remove(m: Message) {
    setMessages((c) => c.filter((x) => x.id !== m.id));
    await supabase.from("messages").delete().eq("id", m.id);
  }

  const typingNames = Object.keys(typing).filter((id) => id !== me.id).map((id) => people.get(id)?.display_name || people.get(id)?.username || "Someone");
  const status = conversation.is_group
    ? `${conversation.members.length} members`
    : other && online.has(other.id) ? "online" : other ? `last seen ${timeAgo(other.last_seen)} ago` : "";

  let lastDay = "";
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex items-center gap-3 border-b border-line bg-panel/80 px-3 py-3 backdrop-blur md:px-5">
        <button onClick={onBack} className="rounded-full p-2 hover:bg-panel2 md:hidden" aria-label="Back"><ArrowLeft size={20} /></button>
        <Avatar name={title} src={conversation.is_group ? conversation.avatar_url : other?.avatar_url} size={42} online={!!other && online.has(other.id)} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{title}</p>
          <p className={cx("truncate text-xs", status === "online" || typingNames.length ? "text-emerald-500" : "text-muted")}>
            {typingNames.length ? `${typingNames.join(", ")} typing…` : status}
          </p>
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-4 md:px-8" onClick={() => setPicker(null)}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted">
            <div className="brand-grad mb-3 flex h-16 w-16 items-center justify-center rounded-3xl text-3xl">👋</div>
            <p className="font-medium text-fg">Say hello to {title}</p>
            <p className="text-sm">Messages are delivered instantly.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === me.id;
          const sender = people.get(m.sender_id);
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay; lastDay = day;
          const prev = messages[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id && !showDay && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
          const parent = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
          const mr = reactions.filter((r) => r.message_id === m.id);
          const grouped_r = Object.entries(mr.reduce<Record<string, number>>((a, r) => ({ ...a, [r.emoji]: (a[r.emoji] ?? 0) + 1 }), {}));
          return (
            <div key={m.id}>
              {showDay && <div className="my-4 text-center"><span className="rounded-full bg-panel2 px-3 py-1 text-[11px] font-medium text-muted">{day}</span></div>}
              <div className={cx("group relative flex items-end gap-2", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
                {!mine && conversation.is_group && (
                  <div className="w-7 shrink-0">{!grouped && <Avatar name={sender?.display_name || "?"} src={sender?.avatar_url} size={28} />}</div>
                )}
                <div className={cx("relative max-w-[78%] md:max-w-[62%]", mine && "items-end")}>
                  {!mine && conversation.is_group && !grouped && <p className="mb-0.5 ml-3 text-xs font-semibold text-accent">{sender?.display_name || sender?.username}</p>}
                  <div
                    className={cx("pop rounded-2xl px-3.5 py-2 text-[15px] shadow-sm", mine ? "text-white rounded-br-md" : "rounded-bl-md border border-line")}
                    style={{ background: mine ? "var(--bubble-out)" : "var(--bubble-in)" }}
                  >
                    {parent && (
                      <div className={cx("mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs", mine ? "border-white/70 bg-white/15" : "border-accent bg-panel2")}>
                        <p className="font-semibold">{people.get(parent.sender_id)?.display_name || "…"}</p>
                        <p className="line-clamp-2 opacity-80">{parent.body || (parent.media_type ? `📎 ${parent.media_type}` : "")}</p>
                      </div>
                    )}
                    {m.media_url && m.media_type === "image" && <img src={m.media_url} alt="" className="mb-1 max-h-72 rounded-xl object-cover" loading="lazy" />}
                    {m.media_url && m.media_type === "video" && <video src={m.media_url} controls className="mb-1 max-h-72 rounded-xl" />}
                    {m.media_url && m.media_type === "audio" && <audio src={m.media_url} controls className="mb-1 max-w-full" />}
                    {m.media_url && m.media_type === "file" && <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 underline"><Paperclip size={14} /> Attachment</a>}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    <p className={cx("mt-0.5 text-right text-[10px]", mine ? "text-white/70" : "text-muted")}>{clock(m.created_at)}</p>
                  </div>
                  {grouped_r.length > 0 && (
                    <div className={cx("-mt-2 flex gap-1", mine ? "justify-end pr-2" : "pl-2")}>
                      {grouped_r.map(([e, n]) => (
                        <button key={e} onClick={() => react(m, e)} className={cx("heart-pop rounded-full border px-1.5 py-0.5 text-xs shadow-sm", mr.some((r) => r.emoji === e && r.user_id === me.id) ? "border-accent bg-accent/15" : "border-line bg-panel")}>
                          {e}{n > 1 && <span className="ml-0.5 text-[10px]">{n}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {picker === m.id && (
                    <div className={cx("pop absolute z-20 -top-11 flex gap-1 rounded-full border border-line bg-panel px-2 py-1.5 shadow-xl", mine ? "right-0" : "left-0")} onClick={(e) => e.stopPropagation()}>
                      {QUICK.map((e) => <button key={e} onClick={() => react(m, e)} className="text-xl transition hover:scale-125">{e}</button>)}
                    </div>
                  )}
                </div>
                <div className={cx("flex gap-0.5 self-center opacity-0 transition group-hover:opacity-100", mine && "order-first")}>
                  <button onClick={(e) => { e.stopPropagation(); setPicker(picker === m.id ? null : m.id); }} className="rounded-full p-1.5 text-muted hover:bg-panel2" aria-label="React"><Smile size={16} /></button>
                  <button onClick={() => setReplyTo(m)} className="rounded-full p-1.5 text-muted hover:bg-panel2" aria-label="Reply"><CornerUpLeft size={16} /></button>
                  {mine && <button onClick={() => remove(m)} className="rounded-full p-1.5 text-muted hover:bg-panel2 hover:text-red-500" aria-label="Delete"><Trash2 size={16} /></button>}
                </div>
              </div>
            </div>
          );
        })}
        {typingNames.length > 0 && (
          <div className="mt-3 flex items-center gap-1 pl-2">
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-panel px-3 py-3">
              {[0, 1, 2].map((i) => <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-panel/80 p-3 backdrop-blur md:px-5">
        {replyTo && (
          <div className="pop mb-2 flex items-center gap-2 rounded-xl border-l-2 border-accent bg-panel2 px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-accent">Replying to {people.get(replyTo.sender_id)?.display_name || "message"}</p>
              <p className="truncate text-muted">{replyTo.body || `📎 ${replyTo.media_type}`}</p>
            </div>
            <button onClick={() => setReplyTo(null)}><X size={16} /></button>
          </div>
        )}
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        {emojiOpen && (
          <div className="pop mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-line bg-panel p-2">
            {EMOJI.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="rounded-lg p-1 text-xl hover:bg-panel2">{e}</button>)}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full p-2.5 text-muted hover:bg-panel2" aria-label="Attach"><Paperclip size={20} /></button>
          <button type="button" onClick={() => setEmojiOpen(!emojiOpen)} className="rounded-full p-2.5 text-muted hover:bg-panel2" aria-label="Emoji"><Smile size={20} /></button>
          <textarea
            value={text} rows={1} placeholder="Message…" maxLength={4000}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-panel2 px-4 py-2.5 text-[15px] outline-none focus:border-accent"
          />
          <button disabled={sending || !text.trim()} className="brand-grad flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 disabled:opacity-40" aria-label="Send">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
