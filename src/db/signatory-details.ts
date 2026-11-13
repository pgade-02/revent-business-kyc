import { eq } from "drizzle-orm";
import type { SignatoryDetails } from "@/kyc/signatory/signatory-details";
import type { Database } from "./client";
import { applications } from "./schema";

export async function saveSignatoryDetails(db: Database, applicationId: number, details: SignatoryDetails): Promise<void> {
  await db
    .update(applications)
    .set({
      signatoryIsApplicant: details.isApplicant,
      signatoryName: details.fullName,
      signatoryEmail: details.signingEmail,
      signatoryMobile: details.mobile,
    })
    .where(eq(applications.id, applicationId));
}

// What was saved, as stored (any field may still be empty).
export type SavedSignatoryDetails = NonNullable<Awaited<ReturnType<typeof loadSignatoryDetails>>>;

export async function loadSignatoryDetails(db: Database, applicationId: number) {
  const [row] = await db
    .select({
      isApplicant: applications.signatoryIsApplicant,
      fullName: applications.signatoryName,
      signingEmail: applications.signatoryEmail,
      mobile: applications.signatoryMobile,
    })
    .from(applications)
    .where(eq(applications.id, applicationId));
  return row ?? null;
}
