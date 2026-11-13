import type { Company } from "../companies";
import { escapeHtml as e, fakeQr, htmlPage, signature, stamp, uaeDate, watermark } from "./shared";

const css = `
  .header { border-bottom: 3px double #1f3f7a; padding-bottom: 14px; margin-bottom: 8px; }
  .crest { width: 54px; height: 54px; border-radius: 50%; border: 2px solid #1f3f7a; display: flex; align-items: center;
    justify-content: center; font-weight: 800; color: #1f3f7a; font-size: 18px; }
  .kv td:first-child, .kv td:nth-child(3) { width: 22%; background: #f6f8fb; font-weight: 600; }
  .footer { margin-top: 26px; align-items: flex-end; }
`;

// Two pages: the licence itself, then activities and the manager, like most UAE licences.
export function tradeLicenceHtml(company: Company): string {
  const field = (en: string, value: string, ar: string, valueAr = value) =>
    `<tr><td>${e(en)}</td><td>${e(value)}</td><td class="ar">${e(ar)}</td><td class="ar">${e(valueAr)}</td></tr>`;
  const pageOne = `
    <section class="page" style="height:1123px">${watermark}
      <div class="header row">
        <div class="crest">ER</div>
        <div style="text-align:center"><h1>COMMERCIAL LICENCE</h1><div class="ar" style="font-size:18px;font-weight:700">رخصة تجارية</div>
          <div class="muted">${e(company.authority)} — ${e(company.emirate)}</div></div>
        ${fakeQr(company.licenceNumber)}
      </div>
      <table class="kv">
        ${field("Licence No.", company.licenceNumber, "رقم الرخصة")}
        ${field("Trade Name", company.name, "الاسم التجاري", company.nameAr)}
        ${field("Legal Type", company.legalForm, "الشكل القانوني", "شركة ذات مسؤولية محدودة")}
        ${field("Issue Date", uaeDate(company.licenceIssued), "تاريخ الإصدار")}
        ${field("Expiry Date", uaeDate(company.licenceExpires), "تاريخ الانتهاء")}
        ${field("Address", company.address, "العنوان")}
      </table>
      <h2>Licence Members / أعضاء الرخصة</h2>
      <table><tr><th>Name</th><th>Nationality</th><th>Role</th><th class="ar">الصفة</th></tr>
        <tr><td>${e(`${company.signatory.givenNames} ${company.signatory.surname}`)}</td><td>${e(company.signatory.nationality)}</td>
          <td>Manager / Authorised Signatory</td><td class="ar">مدير / المفوض بالتوقيع</td></tr></table>
      <div class="row footer"><div class="muted">This licence is valid only with the stamp of the issuing authority.<br/>Verify by scanning the QR code.</div>
        ${stamp("REGISTRY", "السجل")}</div>
    </section>`;
  const pageTwo = `
    <section class="page" style="height:1123px">${watermark}
      <h2>Licensed Activities / الأنشطة المرخصة</h2>
      <table><tr><th>#</th><th>Activity</th><th>Code</th></tr>
        ${company.activities.map((activity, index) => `<tr><td>${index + 1}</td><td>${e(activity)}</td><td>${4651 + index * 7}.0${index + 1}</td></tr>`).join("")}</table>
      <h2>Manager / المدير</h2>
      <table class="kv">${field("Name", `${company.signatory.givenNames} ${company.signatory.surname}`, "الاسم", company.signatory.nameAr)}
        ${field("Emirates ID", company.signatory.emiratesId, "رقم الهوية")}</table>
      <p class="muted" style="margin-top:20px">Licence No. ${e(company.licenceNumber)} — page 2 of 2</p>
    </section>`;
  return htmlPage(css, pageOne + pageTwo);
}

export function taxCertificateHtml(company: Company): string {
  return htmlPage(
    css,
    `<section class="page" style="height:1123px">${watermark}
      <div class="header row">
        <div class="crest">TA</div>
        <div style="text-align:center"><h1>TAX REGISTRATION CERTIFICATE</h1>
          <div class="ar" style="font-size:18px;font-weight:700">شهادة التسجيل الضريبي</div>
          <div class="muted">Corporate Tax · Tax Authority (Specimen)</div></div>
        ${fakeQr(company.trn)}
      </div>
      <p>This is to certify that the person below is registered for Corporate Tax.</p>
      <p class="ar">نشهد بأن الشخص المذكور أدناه مسجل لضريبة الشركات.</p>
      <table class="kv">
        <tr><td>Tax Registration Number (TRN)</td><td colspan="2">${e(company.trn)}</td><td class="ar">رقم التسجيل الضريبي</td></tr>
        <tr><td>Legal Name of Entity</td><td>${e(company.name)}</td><td class="ar">${e(company.nameAr)}</td><td class="ar">الاسم القانوني</td></tr>
        <tr><td>Registered Address</td><td colspan="2">${e(company.address)}</td><td class="ar">العنوان المسجل</td></tr>
        <tr><td>Effective Registration Date</td><td colspan="2">${uaeDate(company.taxEffectiveDate)}</td><td class="ar">تاريخ نفاذ التسجيل</td></tr>
        <tr><td>Trade Licence No.</td><td colspan="2">${e(company.licenceNumber)}</td><td class="ar">رقم الرخصة التجارية</td></tr>
      </table>
      <div class="row footer"><div>${signature("Director, Registration")}<div class="muted">Director of Registration (Specimen)</div></div>
        ${stamp("TAX AUTHORITY", "الهيئة الضريبية", "#7a1f3f")}</div>
    </section>`,
  );
}
