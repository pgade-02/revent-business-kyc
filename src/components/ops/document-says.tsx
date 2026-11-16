import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SLOT_LABEL } from "@/kyc/checks/read-value";
import type { Comparison } from "@/ops/typed-vs-document";

// Writes the short line under a typed value, e.g. 'Doesn't match: trade licence says "654321"'.
function noteText(comparison: Comparison): string {
  const source = SLOT_LABEL[comparison.slot].toLowerCase();
  const says = `${source} says "${comparison.documentValue ?? ""}"`;
  if (comparison.verdict === "matches") return `Matches the ${source}`;
  if (comparison.verdict === "different") return `Doesn't match: ${says}`;
  switch (comparison.reason) {
    case "close":
      return `Close: ${says}`;
    case "not_found":
      return `Not found on the ${source}`;
    case "other_script":
      return `Written in another script: ${says}`;
    case "not_typed":
      return `Not typed: ${says}`;
    default:
      return "";
  }
}

const STYLE = {
  matches: { className: "text-success", Icon: CheckIcon },
  needs_look: { className: "text-amber-700 dark:text-amber-300", Icon: TriangleAlertIcon },
  different: { className: "text-destructive", Icon: XIcon },
} as const;

// Shows a typed value with whether the document agrees: matches, needs a look, or doesn't match.
export function DocumentSays({ value, comparison }: { value: ReactNode; comparison: Comparison }) {
  const style = comparison.verdict ? STYLE[comparison.verdict] : null;
  return (
    <span className="flex flex-col">
      <span>{value ?? "—"}</span>
      {style && (
        <span className={`flex items-center gap-1 text-xs ${style.className}`}>
          <style.Icon className="size-3.5 shrink-0" aria-hidden />
          {noteText(comparison)}
        </span>
      )}
    </span>
  );
}
