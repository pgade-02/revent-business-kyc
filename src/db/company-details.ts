import { eq } from "drizzle-orm";
import type { CompanyDetails } from "@/kyc/company/company-details";
import type { Database } from "./client";
import { applications } from "./schema";

export async function saveCompanyDetails(db: Database, applicationId: number, details: CompanyDetails): Promise<void> {
  await db.update(applications).set(details).where(eq(applications.id, applicationId));
}

// What was saved, as stored (any field may still be empty). Callers that need complete,
// valid details parse it with companyDetailsSchema.
export type SavedCompanyDetails = NonNullable<Awaited<ReturnType<typeof loadCompanyDetails>>>;

export async function loadCompanyDetails(db: Database, applicationId: number) {
  const [row] = await db
    .select({
      companyName: applications.companyName,
      licenceNumber: applications.licenceNumber,
      yearEstablished: applications.yearEstablished,
      issuingAuthority: applications.issuingAuthority,
      emirate: applications.emirate,
      legalForm: applications.legalForm,
      trn: applications.trn,
      registeredAddress: applications.registeredAddress,
      deliverToRegisteredAddress: applications.deliverToRegisteredAddress,
    })
    .from(applications)
    .where(eq(applications.id, applicationId));
  return row ?? null;
}
