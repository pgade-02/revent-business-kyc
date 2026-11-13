import { z } from "zod";
import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { DOCUMENT_SLOTS } from "@/kyc/documents/slots";
import { getDocumentServices } from "@/services/app-services";
import { uploadDocument } from "@/services/documents";

const slotField = z.enum(DOCUMENT_SLOTS);

// Upload one file into a box. Answers fast: the checks run in the separate "process" call.
export async function POST(request: Request, context: RouteContext<"/api/applications/[id]/documents">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const services = await getDocumentServices();
  const access = await findCustomerApplication(services.db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);
  if (access.value.status !== "draft") return Response.json({ error: "Already submitted" }, { status: 409 });

  const form = await request.formData().catch(() => null);
  const slot = slotField.safeParse(form?.get("slot"));
  const file = form?.get("file");
  if (!slot.success || !(file instanceof File)) return Response.json({ error: "Expected a slot and a file" }, { status: 400 });

  // Refuse an oversized file before copying it into memory.
  if (file.size > services.limits.maxBytes) return Response.json({ reason: "TOO_LARGE" }, { status: 422 });

  const result = await uploadDocument(services, {
    applicationId,
    slot: slot.data,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return Response.json({ reason: result.reason }, { status: 422 });
  const { documentId, sizeBytes, pageCount } = result;
  return Response.json({ documentId, sizeBytes, pageCount }, { status: 201 });
}
