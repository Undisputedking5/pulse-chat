"use client";
import { useCallback, useEffect, useState } from "react";
import { Heart, ImagePlus, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import StoriesBar from "./StoriesBar";
import { cx, timeAgo } from "@/lib/utils";
import { uploadMedia } from "@/lib/upload";
import type { Post } from "@/lib/types";

export default function FeedView() {
  const { supabase, me } = useApp();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("posts")
      .select("*, profile:profiles(*), likes:post_likes(user_id), comments:post_comments(id,body,created_at,user_id,profile:profiles(*))")
      .order("created_at", { ascending: false }).limit(40);
    setPosts(((data as unknown as Post[]) ?? []).map((p) => ({ ...p, comments: [...p.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)) })));
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel("feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load]);

  async function publish() {
    if (!file && !caption.trim()) return;
    setBusy(true); setErr(null);
    try {
      const image_url = file ? await uploadMedia(supabase, me.id, file) : null;
      const { error } = await supabase.from("posts").insert({ user_id: me.id, image_url, caption: caption.trim() });
      if (error) throw error;
      setCaption(""); setFile(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not post");
    }
    setBusy(false);
  }

  async function toggleLike(p: Post) {
    const liked = p.likes.some((l) => l.user_id === me.id);
    setPosts((cur) => cur.map((x) => x.id === p.id ? { ...x, likes: liked ? x.likes.filter((l) => l.user_id !== me.id) : [...x.likes, { user_id: me.id }] } : x));
    if (liked) await supabase.from("post_likes").delete().match({ post_id: p.id, user_id: me.id });
    else await supabase.from("post_likes").insert({ post_id: p.id, user_id: me.id });
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-24 md:pb-8">
      <div className="mx-auto max-w-xl">
        <div className="px-4 pt-5"><h1 className="text-2xl font-extrabold tracking-tight">Moments</h1></div>
        <StoriesBar />

        <div className="mx-4 mb-4 rounded-3xl border border-line bg-panel p-4">
          <div className="flex gap-3">
            <Avatar name={me.display_name || me.username} src={me.avatar_url} size={42} />
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={2000}
              placeholder="Share a moment…" className="min-h-[56px] flex-1 resize-none bg-transparent pt-2 text-[15px] outline-none" />
          </div>
          {file && (
            <div className="relative mt-3">
              
              <img src={URL.createObjectURL(file)} alt="" className="max-h-72 w-full rounded-2xl object-cover" />
              <button onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"><X size={16} /></button>
            </div>
          )}
          {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
          <div className="mt-3 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10">
              <ImagePlus size={18} /> Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={publish} disabled={busy || (!file && !caption.trim())} className="brand-grad flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Post
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4">
          {!loaded && <div className="h-64 animate-pulse rounded-3xl bg-panel" />}
          {loaded && posts.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center text-muted">
              <p className="text-3xl">📸</p><p className="mt-2 font-semibold text-fg">No moments yet</p><p className="text-sm">Be the first to post something.</p>
            </div>
          )}
          {posts.map((p) => <PostCard key={p.id} post={p} onLike={() => toggleLike(p)} onChanged={load} />)}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, onLike, onChanged }: { post: Post; onLike: () => void; onChanged: () => void }) {
  const { supabase, me } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const liked = post.likes.some((l) => l.user_id === me.id);

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    await supabase.from("post_comments").insert({ post_id: post.id, user_id: me.id, body });
    onChanged();
  }
  async function del() {
    await supabase.from("posts").delete().eq("id", post.id);
    onChanged();
  }

  return (
    <article className="pop overflow-hidden rounded-3xl border border-line bg-panel">
      <header className="flex items-center gap-3 p-4">
        <Avatar name={post.profile.display_name || post.profile.username} src={post.profile.avatar_url} size={40} />
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold">{post.profile.display_name || post.profile.username}</p>
          <p className="text-xs text-muted">@{post.profile.username} · {timeAgo(post.created_at)}</p>
        </div>
        {post.user_id === me.id && <button onClick={del} className="rounded-full p-2 text-muted hover:bg-panel2 hover:text-red-500" aria-label="Delete post"><Trash2 size={16} /></button>}
      </header>
      {post.image_url && <img src={post.image_url} alt="" className="max-h-[560px] w-full object-cover" loading="lazy" onDoubleClick={() => !liked && onLike()} />}
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-4">
          <button onClick={onLike} className="flex items-center gap-1.5 text-sm" aria-label="Like">
            <Heart size={24} className={cx("transition", liked ? "heart-pop fill-pink-500 text-pink-500" : "text-fg")} />
            <span className="font-medium">{post.likes.length}</span>
          </button>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm" aria-label="Comments">
            <MessageCircle size={23} /><span className="font-medium">{post.comments.length}</span>
          </button>
        </div>
        {post.caption && <p className="mt-2 text-[15px]"><span className="font-semibold">{post.profile.username}</span> {post.caption}</p>}
        {open && (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            {post.comments.map((c) => (
              <p key={c.id} className="text-sm"><span className="font-semibold">{c.profile.username}</span> {c.body}</p>
            ))}
            <form onSubmit={comment} className="flex gap-2 pt-1">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Add a comment…"
                className="flex-1 rounded-full border border-line bg-panel2 px-4 py-2 text-sm outline-none focus:border-accent" />
              <button className="brand-grad flex h-9 w-9 items-center justify-center rounded-full text-white" aria-label="Send comment"><Send size={15} /></button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
