import type { Person } from "../companies";
import { emiratesIdMrz, passportMrz } from "../mrz";
import { escapeHtml as e, faceSilhouette, htmlPage, signature, uaeDate } from "./shared";

// Card and passport-page layouts. Rendered as images, then turned into phone photos.

const cardCss = `
  .card { width: 856px; height: 540px; border-radius: 28px; padding: 26px 30px; position: relative; overflow: hidden;
    background: linear-gradient(135deg, #e8f1ee 0%, #f6efe2 55%, #e3ecf6 100%); border: 1px solid #b8c4c0; }
  .label { font-size: 13px; color: #4b5563; }
  .value { font-size: 19px; font-weight: 600; margin-bottom: 8px; }
  .mrz { font-family: "OCR-B", "Consolas", "Courier New", monospace; font-size: 25px; letter-spacing: 2px; line-height: 1.35; }
  .specimen { position: absolute; right: -40px; top: 210px; transform: rotate(-30deg); font-size: 62px; font-weight: 800;
    color: rgba(190, 20, 20, 0.12); }
`;

const fullName = (person: Person) => `${person.givenNames} ${person.surname}`;

// Layout follows a real current-design card (docs/document-specs/emirates-id.md §1):
// fictional issuer line and no emblem, but the same fields in the same order.
const issuer = `<div class="row"><div><div style="font-weight:800;font-size:20px">UNITED ARAB EMIRATES</div>
    <div style="font-size:12px;font-weight:600">IDENTITY REGISTRY AUTHORITY (SPECIMEN)</div>
    <div style="font-size:14px;font-weight:600">Resident Identity Card</div></div>
  <div class="ar" style="text-align:right"><div style="font-size:19px;font-weight:700">الإمارات العربية المتحدة</div>
    <div style="font-size:12px">هيئة سجل الهوية (نموذج)</div><div style="font-size:14px;font-weight:600">بطاقة هوية مقيم</div></div></div>`;

const line = (en: string, value: string, ar: string, valueAr = value) =>
  `<div class="row" style="align-items:baseline;margin-bottom:4px"><div><span class="label">${e(en)}:</span> <b>${e(value)}</b></div>
    <div class="ar"><span class="label">${e(ar)}:</span> <b>${e(valueAr)}</b></div></div>`;

const ghostPhoto = `<div style="position:absolute;right:120px;bottom:30px;width:110px;height:80px;border-radius:50%;
  background:radial-gradient(#cfd6df,#e9edf2);opacity:.8"></div>`;

export function emiratesIdFrontHtml(person: Person): string {
  return htmlPage(
    cardCss,
    `<div class="card"><div class="specimen">SPECIMEN</div>${issuer}
      <div class="row" style="margin-top:14px;justify-content:flex-start;gap:24px">
        <div>${faceSilhouette(150, 188)}<div style="margin-top:10px">${signature(person.givenNames.split(" ")[0] ?? "")}</div>
          <div class="label">Signature / التوقيع</div></div>
        <div style="flex:1">
          <div style="text-align:center"><div class="label">ID Number / رقم الهوية</div><div class="value">${e(person.emiratesId)}</div></div>
          <div class="ar" style="margin-bottom:4px"><span class="label">الاسم:</span> <b>${e(person.nameAr)}</b></div>
          <div style="margin-bottom:4px"><span class="label">Name:</span> <b>${e(fullName(person))}</b></div>
          ${line("Date of Birth", uaeDate(person.birthDate), "تاريخ الميلاد")}
          ${line("Nationality", "Utopia (Specimen)", "الجنسية", "يوتوبيا")}
          <div class="label">Issuing Date / تاريخ الاصدار</div><div class="value">${uaeDate(person.emiratesIdIssued)}</div>
          <div class="label">Expiry Date / تاريخ الانتهاء</div><div class="value">${uaeDate(person.emiratesIdExpires)}</div>
          ${line("Sex", person.sex, "الجنس", person.sex === "F" ? "أنثى" : "ذكر")}
        </div>
      </div>${ghostPhoto}</div>`,
  );
}

const emirateAr: Record<string, string> = { Dubai: "دبي", Sharjah: "الشارقة", "Abu Dhabi": "أبوظبي" };

const chip = `<svg width="110" height="90" viewBox="0 0 110 90"><rect x="2" y="2" width="106" height="86" rx="14" fill="#d9b85c" stroke="#9c7d2c"/>
  <path d="M2 30H40V60H2M108 30H70V60H108M40 2V88M70 2V88" fill="none" stroke="#9c7d2c" stroke-width="2"/></svg>`;

// `lines` lets a problem file print edited machine-readable lines.
export function emiratesIdBackHtml(person: Person, lines = emiratesIdMrz(person)): string {
  const [line1, line2, line3] = lines;
  const serial = `26${person.emiratesIdCardNumber.slice(0, 8)}`;
  return htmlPage(
    `${cardCss} .band { position:absolute; left:0; right:0; bottom:0; height:190px; background:#fbfbfb; border-top:3px solid #b9d4e8; }`,
    `<div class="card"><div class="specimen" style="top:120px">SPECIMEN</div>
      <div class="label">Card Number / رقم البطاقة</div><div class="value">${e(person.emiratesIdCardNumber)}</div>
      <div class="row" style="justify-content:flex-start;gap:30px;margin-top:6px">
        <div style="text-align:center">${chip}<div style="font-size:15px;margin-top:6px">${e(serial)}</div></div>
        <div style="flex:1">
          ${line("Occupation", "General Manager", "المهنة", "مدير عام")}
          ${line("Employer", "Specimen Employer L.L.C.", "صاحب العمل", "صاحب عمل نموذجي")}
          ${line("Issuing Place", person.emiratesIdIssuingPlace, "مكان الإصدار", emirateAr[person.emiratesIdIssuingPlace] ?? "")}
          <div class="row" style="font-size:10px;color:#4b5563;margin-top:4px"><div>If you find this card, please return it to the issuing<br/>organization or to the nearest police station.</div>
            <div class="ar">عند العثور على هذه البطاقة يرجى إرجاعها إلى جهة<br/>إصدارها أو إلى أقرب مركز شرطة.</div></div>
        </div></div>
      <div class="band"><div style="position:absolute;left:30px;right:30px;bottom:22px;font-size:33px;letter-spacing:5px" class="mrz">${e(line1)}<br/>${e(line2)}<br/>${e(line3)}</div></div></div>`,
  );
}

export function passportPageHtml(person: Person): string {
  const [line1, line2] = passportMrz(person);
  const css = `${cardCss}
    .passport { width: 1000px; height: 700px; padding: 30px 36px; position: relative; overflow: hidden;
      background: repeating-linear-gradient(45deg, #f4f0e6, #f4f0e6 8px, #efe9dc 8px, #efe9dc 16px); border: 1px solid #c8bfa9; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 26px; }`;
  const item = (label: string, value: string) => `<div><div class="label">${e(label)}</div><div class="value">${e(value)}</div></div>`;
  return htmlPage(
    css,
    `<div class="passport"><div class="specimen" style="top:260px">SPECIMEN</div>
      <div class="row"><div style="font-weight:800;font-size:20px">PASSPORT · PASSEPORT</div>
        <div style="font-size:15px">Type <b>P</b> · Country code <b>${person.nationality}</b> · Passport No. <b>${e(person.passportNumber)}</b></div></div>
      <div class="row" style="margin-top:16px;justify-content:flex-start;gap:30px">
        <div>${faceSilhouette(190, 238)}</div>
        <div class="grid" style="flex:1">
          ${item("Surname", person.surname)}${item("Given names", person.givenNames)}
          ${item("Nationality", "UTOPIA (SPECIMEN)")}${item("Date of birth", uaeDate(person.birthDate))}
          ${item("Sex", person.sex)}${item("Place of birth", "SPECIMEN CITY")}
          ${item("Date of issue", uaeDate(person.passportIssued))}${item("Date of expiry", uaeDate(person.passportExpires))}
        </div></div>
      <div style="position:absolute;left:36px;right:36px;bottom:30px" class="mrz">${e(line1)}<br/>${e(line2)}</div></div>`,
  );
}
