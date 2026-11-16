import { accessDeniedResponse, findReviewerDocument, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { getFileStore } from "@/services/app-services";

const CONTENT_TYPE: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpeg: "image/jpeg" };

// Sends a document's file to a reviewer, shown in the browser or, with ?download=1, saved.
export async function GET(request: Request, context: RouteContext<"/api/ops/documents/[id]/file">) {
  const documentId = parseId((await context.params).id);
  if (documentId === null) return accessDeniedResponse("NOT_FOUND");
  const access = await findReviewerDocument(await getAppDatabase(), documentId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const bytes = await getFileStore().get(access.value.fileKey);
  if (!bytes) return accessDeniedResponse("NOT_FOUND");
  const extension = access.value.fileKind === "jpeg" ? "jpg" : access.value.fileKind;
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPE[access.value.fileKind] ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${access.value.slot}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
