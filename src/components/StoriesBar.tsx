"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Send, X } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import { GRADIENTS, cx, timeAgo } from "@/lib/utils";
import { uploadMedia } from "@/lib/upload";
import type { Profile, Story } from "@/lib/types";

type Group = { user: Profile; stories: Story[]; allSeen: boolean };

export default function StoriesBar({ className }: { className?: string }) {
  const { supabase, me } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("stories")
      .select("*, profile:profiles(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    setStories((data as Story[]) ?? []);
    const { data: v } = await supabase.from("story_views").select("story_id").eq("viewer_id", me.id);
    setSeen(new Set((v ?? []).map((r) => r.story_id as string)));
  }, [supabase, me.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("stories-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, load]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of stories) {
      if (!s.profile) continue;
      const g = map.get(s.user_id) ?? { user: s.profile, stories: [], allSeen: true };
      g.stories.push(s);
      if (!seen.has(s.id) && s.user_id !== me.id) g.allSeen = false;
      map.set(s.user_id, g);
    }
    const arr = [...map.values()];
    // mine first, then unseen, then seen
    return arr.sort((a, b) => Number(b.user.id === me.id) - Number(a.user.id === me.id) || Number(a.allSeen) - Number(b.allSeen));
  }, [stories, seen, me.id]);

  const mine = groups.find((g) => g.user.id === me.id);

  return (
    <>
      <div className={cx("no-scrollbar flex gap-4 overflow-x-auto px-4 py-3", className)}>
        <button onClick={() => (mine ? setViewing(groups.indexOf(mine)) : setComposing(true))} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
          <div className="relative">
            <Avatar name={me.display_name || me.username} src={me.avatar_url} size={58} ring={mine ? "new" : null} />
            <span
              onClick={(e) => { e.stopPropagation(); setComposing(true); }}
              className="brand-grad absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg text-white"
            ><Plus size={14} strokeWidth={3} /></span>
          </div>
          <span className="w-full truncate text-center text-[11px] text-muted">Your story</span>
        </button>
        {groups.filter((g) => g.user.id !== me.id).map((g) => (
          <button key={g.user.id} onClick={() => setViewing(groups.indexOf(g))} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
            <Avatar name={g.user.display_name || g.user.username} src={g.user.avatar_url} size={58} ring={g.allSeen ? "seen" : "new"} />
            <span className="w-full truncate text-center text-[11px] text-muted">{g.user.display_name || g.user.username}</span>
          </button>
        ))}
      </div>
      {viewing !== null && groups[viewing] && (
        <StoryViewer
          groups={groups}
          startGroup={viewing}
          onClose={() => { setViewing(null); load(); }}
        />
      )}
      {composing && <StoryComposer onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
    </>
  );
}

function StoryViewer({ groups, startGroup, onClose }: { groups: Group[]; startGroup: number; onClose: () => void }) {
  const { supabase, me } = useApp();
  const [gi, setGi] = useState(startGroup);
  const [si, setSi] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<Profile[]>([]);
  const group = groups[gi];
  const story = group.stories[si];
  const DURATION = 5000;
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  const next = useCallback(() => {
    if (si < group.stories.length - 1) { setSi(si + 1); setProgress(0); }
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); setProgress(0); }
    else onClose();
  }, [si, gi, group.stories.length, groups.length, onClose]);

  const prev = () => {
    if (si > 0) { setSi(si - 1); setProgress(0); }
    else if (gi > 0) { setGi(gi - 1); setSi(0); setProgress(0); }
    else setProgress(0);
  };

  // record view + owner's viewer list
  useEffect(() => {
    if (story.user_id !== me.id) {
      supabase.from("story_views").upsert({ story_id: story.id, viewer_id: me.id }, { onConflict: "story_id,viewer_id", ignoreDuplicates: true }).then(() => {});
      setViewers([]);
    } else {
      supabase.from("story_views").select("viewer:profiles(*)").eq("story_id", story.id).then(({ data }) => {
        setViewers(((data ?? []) as unknown as { viewer: Profile }[]).map((r) => r.viewer));
      });
    }
  }, [story.id, story.user_id, me.id, supabase]);

  // progress timer
  useEffect(() => {
    if (paused) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last; last = t;
      setProgress((p) => {
        const n = p + dt / DURATION;
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [paused, story.id]);

  useEffect(() => { if (progress >= 1) next(); }, [progress, next]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  async function remove() {
    await supabase.from("stories").delete().eq("id", story.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative h-dvh w-full max-w-[440px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-3xl"
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <div className="absolute inset-0" style={{ background: story.media_url ? "#000" : story.bg }}>
          {story.media_url && <img src={story.media_url} alt="" className="h-full w-full object-contain" />}
          {story.caption && (
            <p className={cx("absolute inset-x-0 px-8 text-center font-bold text-white drop-shadow-lg", story.media_url ? "bottom-24 text-lg" : "top-1/2 -translate-y-1/2 text-3xl leading-tight")}>
              {story.caption}
            </p>
          )}
        </div>
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pt-4">
          <div className="mb-3 flex gap-1">
            {group.stories.map((s, i) => (
              <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full bg-white" style={{ width: i < si ? "100%" : i === si ? `${Math.min(progress, 1) * 100}%` : "0%" }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 text-white">
            <Avatar name={group.user.display_name || group.user.username} src={group.user.avatar_url} size={36} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{group.user.display_name || group.user.username}</p>
              <p className="text-xs text-white/70">{timeAgo(story.created_at)}</p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close"><X size={22} /></button>
          </div>
        </div>
        <button className="absolute inset-y-20 left-0 w-1/3" onClick={prev} aria-label="Previous" />
        <button className="absolute inset-y-20 right-0 w-1/3" onClick={next} aria-label="Next" />
        {story.user_id === me.id && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
            <span className="text-sm">{viewers.length} {viewers.length === 1 ? "view" : "views"}</span>
            <button onClick={remove} className="rounded-full bg-white/15 px-4 py-1.5 text-sm hover:bg-white/25">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function StoryComposer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { supabase, me } = useApp();
  const [caption, setCaption] = useState("");
  const [bg, setBg] = useState(GRADIENTS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function post() {
    if (!file && !caption.trim()) return;
    setBusy(true); setErr(null);
    try {
      const media_url = file ? await uploadMedia(supabase, me.id, file) : null;
      const { error } = await supabase.from("stories").insert({ user_id: me.id, media_url, caption: caption.trim(), bg });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not post story");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4">
      <div className="pop flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-panel sm:h-[88vh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-semibold">New story</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-panel2"><X size={20} /></button>
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ background: preview ? "#000" : bg }}>
          {preview && <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />}
          <textarea
            value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))}
            placeholder={preview ? "Add a caption…" : "Type something…"}
            className={cx("relative z-10 w-full resize-none bg-transparent px-8 text-center font-bold text-white placeholder-white/60 outline-none drop-shadow-lg", preview ? "mt-auto mb-10 text-lg" : "text-3xl")}
            rows={preview ? 2 : 4}
          />
        </div>
        <div className="space-y-3 p-4">
          {!file && (
            <div className="flex gap-2">
              {GRADIENTS.map((g) => (
                <button key={g} onClick={() => setBg(g)} style={{ background: g }} className={cx("h-8 w-8 rounded-full border-2", bg === g ? "border-fg" : "border-transparent")} aria-label="Background" />
              ))}
            </div>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium hover:bg-panel2">
              <ImagePlus size={18} /> {file ? "Change photo" : "Photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {file && <button onClick={() => setFile(null)} className="text-sm text-muted hover:text-fg">Remove</button>}
            <button onClick={post} disabled={busy || (!file && !caption.trim())} className="brand-grad ml-auto flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
