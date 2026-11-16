import { accessDeniedResponse, findCustomerDocument, parseId } from "@/auth/access";
import { eq } from "drizzle-orm";
import { applications } from "@/db/schema";
import { getDocumentServices, runAssessmentSafely } from "@/services/app-services";
import { processDocument } from "@/services/documents";
import { recordCustomerAnswer } from "@/services/request-answers";

// Read and check an uploaded file, then answer with its status and customer messages.
// Only a file still "checking" (or one whose run crashed) can be processed.
export async function POST(_request: Request, context: RouteContext<"/api/documents/[id]/process">) {
  const documentId = parseId((await context.params).id);
  if (documentId === null) return accessDeniedResponse("NOT_FOUND");

  const services = await getDocumentServices();
  const access = await findCustomerDocument(services.db, documentId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const document = access.value;
  if (document.status !== "checking" && document.status !== "failed") {
    return Response.json({ error: "Already checked" }, { status: 409 });
  }
  const result = await processDocument(services, document, access.user.id);
  const [application] = await services.db.select().from(applications).where(eq(applications.id, document.applicationId));
  if (application) {
    const backToReview = await recordCustomerAnswer(services.db, { application, customerId: access.user.id, subject: document.slot, now: new Date().toISOString() });
    if (backToReview) await runAssessmentSafely(services.db, application.id);
  }
  return Response.json(result);
}
