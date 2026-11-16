import { z } from "zod";
import { accessDeniedResponse, currentReviewer } from "@/auth/access";
import { getTranslator } from "@/services/app-services";

const translateInput = z.object({ texts: z.array(z.string().trim().max(500)).min(1).max(10) });

// Drafts Arabic for the reviewer's notes; empty notes stay empty.
export async function POST(request: Request) {
  const reviewer = await currentReviewer();
  if (!reviewer.ok) return accessDeniedResponse(reviewer.reason);
  const parsed = translateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Expected up to 10 notes" }, { status: 400 });

  const translator = getTranslator();
  const arabic: (string | null)[] = [];
  for (const text of parsed.data.texts) {
    if (!text) {
      arabic.push("");
      continue;
    }
    const result = await translator.toArabic(text);
    arabic.push(result.ok ? result.text : null);
  }
  return Response.json({ arabic });
}
