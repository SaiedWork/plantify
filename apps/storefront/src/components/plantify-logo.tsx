import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlantifyLogoSize = "sm" | "md" | "lg";

const SIZES: Record<PlantifyLogoSize, { box: string; icon: string; text: string; gap: string }> = {
  sm: { box: "size-6 rounded-md", icon: "size-4", text: "text-base", gap: "gap-2" },
  md: { box: "size-8 rounded-lg", icon: "size-5", text: "text-xl", gap: "gap-2.5" },
  lg: { box: "size-12 rounded-xl", icon: "size-7", text: "text-3xl", gap: "gap-3" },
};

/** The leaf in a green rounded box, without the wordmark. Same drawing as the admin logo. */
export function PlantifyMark({ size = "md", className }: { size?: PlantifyLogoSize; className?: string }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center bg-green-700 text-white shadow-sm dark:bg-green-600", s.box, className)}
    >
      <Leaf className={s.icon} />
    </span>
  );
}

export function PlantifyLogo({ size = "md", className }: { size?: PlantifyLogoSize; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <PlantifyMark size={size} />
      <span className={cn("font-semibold leading-tight tracking-tight text-green-800 dark:text-green-400", s.text)}>
        Plantify
      </span>
    </span>
  );
}
