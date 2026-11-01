import { cn } from "@/lib/utils";

// None of these is green, so the avatar never blends into the green Plantify logo.
const COLORS = [
  "bg-indigo-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-sky-600",
  "bg-orange-600",
  "bg-fuchsia-600",
  "bg-cyan-700",
  "bg-pink-600",
];

/** First letter of the first and of the last name: "Maria Lopez Garcia" is "MG", "Maria" is "M". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function colorFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" } as const;

/** Round avatar with the person's initials. The colour is stable per person (their id, or else their name). */
export function UserAvatar({ name, seed, size = "sm", className }: { name: string; seed?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        SIZES[size],
        colorFor(seed ?? name),
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
