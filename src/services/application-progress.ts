import { loadCompanyDetails } from "@/db/company-details";
import type { Database } from "@/db/client";
import { listCurrentDocuments } from "@/db/documents";
import { loadSignatoryDetails } from "@/db/signatory-details";

// Everything the hub and Submit need to know about how far an application has got.
// Typed details are only saved after passing validation, so "saved" means "complete".
export async function loadApplicationProgress(db: Database, applicationId: number) {
  const documents = await listCurrentDocuments(db, applicationId);
  const companyDetails = await loadCompanyDetails(db, applicationId);
  const signatoryDetails = await loadSignatoryDetails(db, applicationId);
  return {
    documents,
    companyDetails,
    signatoryDetails,
    inputs: {
      files: documents,
      companyDetailsSaved: companyDetails?.companyName != null,
      signatoryDetailsSaved: signatoryDetails?.fullName != null,
    },
  };
}
