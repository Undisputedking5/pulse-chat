import { GRADIENTS, cx } from "@/lib/utils";

export default function Avatar({
  name, src, size = 40, ring, online, className,
}: {
  name: string; src?: string | null; size?: number; ring?: "new" | "seen" | null; online?: boolean; className?: string;
}) {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const inner = (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: src ? undefined : GRADIENTS[hash % GRADIENTS.length], fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
  return (
    <div className={cx("relative shrink-0", className)} style={{ width: size + (ring ? 6 : 0), height: size + (ring ? 6 : 0) }}>
      {ring ? (
        <div className={cx("flex h-full w-full items-center justify-center rounded-full", ring === "new" ? "ring-story" : "ring-seen")}>
          <div className="rounded-full bg-bg p-[2px]">{inner}</div>
        </div>
      ) : inner}
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-emerald-400" />}
    </div>
  );
}
