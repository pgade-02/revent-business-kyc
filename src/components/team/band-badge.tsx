import type { Score } from "@/kyc/scoring/score";
import { cn } from "@/lib/utils";

const STYLE: Record<Score["band"], string> = {
  GREEN: "bg-success-soft text-success",
  AMBER: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  RED: "bg-destructive/10 text-destructive",
};

// Red reads "Recommend reject": a recommendation for a person, never a decision (PRD §6).
export function BandBadge({ band }: { band: Score["band"] }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold", STYLE[band])}>
      {band === "RED" ? "Red · Recommend reject" : band === "GREEN" ? "Green" : "Amber"}
    </span>
  );
}
