// Builds a realistic synthetic document set (fictional companies, SPECIMEN marks) into
// test-documents/samples/realistic/ (git-ignored):
//   falcon/    one complete, consistent application for Company A
//   horizon/   Company B's documents, to mix into Company A's application
//   problems/  Company A documents with one deliberate problem each
//   manifest.json  what each file should produce
// Run: npm run generate:documents
// File names avoid "company": the check script guesses the box from names and "pan" means passport.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { companyA, companyB, omarFarouk, type Company } from "../tests/fixtures/realistic/companies";
import { emiratesIdMrz } from "../tests/fixtures/realistic/mrz";
import { blurryPhoto, normalPhoto, phonePhoto, startRenderer, type Renderer } from "../tests/fixtures/realistic/render";
import { generateStatements, tamperWithStatement } from "../tests/fixtures/realistic/statements";
import { bankStatementHtml } from "../tests/fixtures/realistic/templates/bank-statement";
import { taxCertificateHtml, tradeLicenceHtml } from "../tests/fixtures/realistic/templates/business-documents";
import { emiratesIdBackHtml, emiratesIdFrontHtml, passportPageHtml } from "../tests/fixtures/realistic/templates/identity-documents";

const outputRoot = path.join(process.cwd(), "test-documents", "samples", "realistic");
const statementMonths = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

type ManifestEntry = { file: string; slot: string; expected: string };
const manifest: ManifestEntry[] = [];

function save(folder: string, file: string, bytes: Uint8Array, slot: string, expected: string) {
  const directory = path.join(outputRoot, folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, file), bytes);
  manifest.push({ file: `${folder}/${file}`, slot, expected });
}

async function cleanApplication(renderer: Renderer, company: Company, folder: string) {
  const licence = tradeLicenceHtml(company);
  save(folder, "trade-licence.pdf", await renderer.pdf(licence), "trade_licence", "ready");
  save(folder, "trade-licence-photo.jpg", await phonePhoto(await renderer.png(licence), normalPhoto), "trade_licence", "ready (photo of page 1)");
  save(folder, "tax-certificate.pdf", await renderer.pdf(taxCertificateHtml(company)), "tax_certificate", "ready");
  const statements = generateStatements(company, statementMonths);
  for (const statement of statements) {
    save(folder, `bank-statement-${statement.month}.pdf`, await renderer.pdf(bankStatementHtml(company, statement)), "bank_statement", "ready; balances reconcile");
  }
  const person = company.signatory;
  save(folder, "passport.jpg", await phonePhoto(await renderer.png(passportPageHtml(person)), normalPhoto), "passport", "ready; MRZ check digits valid");
  save(folder, "emirates-id-front.jpg", await phonePhoto(await renderer.png(emiratesIdFrontHtml(person)), normalPhoto), "emirates_id_front", "ready");
  save(folder, "emirates-id-back.jpg", await phonePhoto(await renderer.png(emiratesIdBackHtml(person)), normalPhoto), "emirates_id_back", "ready");
  return statements;
}

async function problems(renderer: Renderer, statementsA: ReturnType<typeof generateStatements>) {
  const folder = "problems";
  const expiredLicence = { ...companyA, licenceIssued: "2024-04-01", licenceExpires: "2026-03-31" };
  save(folder, "trade-licence-expired.pdf", await renderer.pdf(tradeLicenceHtml(expiredLicence)), "trade_licence", "DOC_EXPIRED fails");

  const lastMonth = statementsA.at(-1);
  if (!lastMonth) throw new Error("no statements generated");
  const tampered = tamperWithStatement(lastMonth, 3, 5_000_000); // +AED 50,000 on one balance
  save(folder, "bank-statement-tampered.pdf", await renderer.pdf(bankStatementHtml(companyA, tampered)), "bank_statement", "balance break on 2 rows (STMT_BALANCE, Part 2)");

  const blurry = await phonePhoto(await renderer.png(emiratesIdFrontHtml(companyA.signatory)), blurryPhoto);
  save(folder, "emirates-id-front-blurry.jpg", blurry, "emirates_id_front", "unreadable / needs a clearer photo");

  save(folder, "passport-other-person.jpg", await phonePhoto(await renderer.png(passportPageHtml(omarFarouk)), normalPhoto), "passport", "ready alone; name mismatch with licence manager (cross-check, Part 2)");
  const futureIssue = { ...companyA.signatory, emiratesIdIssued: "2027-01-15" };
  save(folder, "emirates-id-front-issued-in-future.jpg", await phonePhoto(await renderer.png(emiratesIdFrontHtml(futureIssue)), normalPhoto), "emirates_id_front", "EID_DATES fails (needs review)");

  const [line1, line2, line3] = emiratesIdMrz(companyA.signatory);
  const editedLine2 = `${line2.slice(0, 9)}${line2[9] === "9" ? "8" : "9"}${line2.slice(10)}`; // expiry year changed by hand
  const editedBack = emiratesIdBackHtml(companyA.signatory, [line1, editedLine2, line3]);
  save(folder, "emirates-id-back-edited.jpg", await phonePhoto(await renderer.png(editedBack), normalPhoto), "emirates_id_back", "MRZ_CHECK_DIGITS fails (needs a fix)");
  save(folder, "emirates-id-back-other-person.jpg", await phonePhoto(await renderer.png(emiratesIdBackHtml(omarFarouk)), normalPhoto), "emirates_id_back", "ready alone; EID_SIDES_MATCH with Falcon front fails (Part 2)");

  save(folder, "tax-certificate-in-licence-box.pdf", await renderer.pdf(taxCertificateHtml(companyA)), "trade_licence", "DOC_WRONG_TYPE");
}

async function main() {
  rmSync(outputRoot, { recursive: true, force: true });
  const renderer = await startRenderer();
  try {
    const statementsA = await cleanApplication(renderer, companyA, "falcon");
    await cleanApplication(renderer, companyB, "horizon");
    await problems(renderer, statementsA);
  } finally {
    await renderer.close();
  }
  writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.length} files to ${outputRoot}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
