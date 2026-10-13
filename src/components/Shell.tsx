"use client";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Compass, LogOut, MessageCircle, MessageSquareText, User } from "lucide-react";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import { cx } from "@/lib/utils";

const items = [
  { href: "/app", label: "Chats", icon: MessageSquareText },
  { href: "/app/feed", label: "Feed", icon: Compass },
  { href: "/app/profile", label: "Profile", icon: User },
];

function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const { me, supabase } = useApp();
  const chatOpen = path === "/app" && !!sp.get("c");

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* desktop rail */}
      <aside className="hidden w-[76px] shrink-0 flex-col items-center justify-between border-r border-line bg-panel py-5 md:flex">
        <div className="flex flex-col items-center gap-6">
          <Link href="/app" className="brand-grad flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"><MessageCircle size={22} /></Link>
          <nav className="flex flex-col gap-2">
            {items.map(({ href, label, icon: I }) => {
              const active = href === "/app" ? path === "/app" : path.startsWith(href);
              return (
                <Link key={href} href={href} title={label}
                  className={cx("flex h-11 w-11 items-center justify-center rounded-2xl transition", active ? "bg-accent/15 text-accent" : "text-muted hover:bg-panel2 hover:text-fg")}>
                  <I size={22} />
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button onClick={signOut} title="Sign out" className="flex h-10 w-10 items-center justify-center rounded-2xl text-muted hover:bg-panel2 hover:text-fg"><LogOut size={20} /></button>
          <Link href="/app/profile"><Avatar name={me.display_name || me.username} src={me.avatar_url} size={38} /></Link>
        </div>
      </aside>
      {/* mobile bottom bar */}
      {!chatOpen && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-panel/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden">
          {items.map(({ href, label, icon: I }) => {
            const active = href === "/app" ? path === "/app" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={cx("flex flex-col items-center gap-0.5 rounded-xl px-5 py-1 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
                <I size={22} />{label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Suspense><Nav /></Suspense>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
