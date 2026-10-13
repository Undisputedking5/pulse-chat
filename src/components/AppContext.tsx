"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  supabase: SupabaseClient;
  me: Profile;
  setMe: (p: Profile) => void;
  online: Set<string>;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ initialMe, children }: { initialMe: Profile; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState(initialMe);
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ch = supabase.channel("presence:online", { config: { presence: { key: me.id } } });
    ch.on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))));
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
    });
    const beat = setInterval(() => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", me.id).then(() => {});
    }, 60_000);
    return () => { clearInterval(beat); supabase.removeChannel(ch); };
  }, [supabase, me.id]);

  return <AppCtx.Provider value={{ supabase, me, setMe, online }}>{children}</AppCtx.Provider>;
}
