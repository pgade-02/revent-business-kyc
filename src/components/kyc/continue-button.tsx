"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DocumentSlot } from "@/kyc/documents/slots";

type Fix = { slot: DocumentSlot; messageKeys: string[] };

// PRD §5: on Continue, list anything in this task still waiting for a fix.
// It never blocks: the second press carries on.
export function ContinueButton({ nextHref, fixes, maxMb }: { nextHref: string | null; fixes: Fix[]; maxMb: number }) {
  const t = useTranslations();
  const router = useRouter();
  const [showFixes, setShowFixes] = useState(false);
  if (!nextHref) return null;

  function onContinue() {
    if (fixes.length > 0 && !showFixes) {
      setShowFixes(true);
      return;
    }
    if (nextHref) router.push(nextHref);
  }

  return (
    <div className="flex flex-col items-end gap-4 border-t pt-6">
      {showFixes && (
        <div role="alert" className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{t("Kyc.fixesTitle", { count: fixes.length })}</p>
          <ul className="mt-2 list-disc ps-5">
            {fixes.map((fix) => (
              <li key={fix.slot}>
                <span className="font-medium">{t(`Documents.slots.${fix.slot}.label`)}:</span>{" "}
                {fix.messageKeys.map((key) => t(key, { maxMb })).join(" ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">{t("Kyc.fixesHint")}</p>
        </div>
      )}
      <Button size="lg" onClick={onContinue}>
        {t(showFixes ? "Kyc.continueAnyway" : "Kyc.continue")}
        <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
      </Button>
    </div>
  );
}
