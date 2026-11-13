import { checkDigit } from "@/kyc/extraction/emirates-id-mrz";
import type { Person } from "./companies";

// Machine-readable zone (ICAO 9303): the "<<<" lines at the bottom of passports and
// on the back of ID cards. Each field is followed by a check digit, so a real reader
// can tell when a character was misread or changed.

const yymmdd = (isoDate: string) => isoDate.slice(2).replaceAll("-", "");
const pad = (text: string, length: number) => text.padEnd(length, "<").slice(0, length);

export { checkDigit };

const mrzName = (person: Person) => `${person.surname.replaceAll(" ", "<")}<<${person.givenNames.replaceAll(" ", "<")}`;

// Passport (TD3): two lines of 44 characters.
export function passportMrz(person: Person): [string, string] {
  const number = pad(person.passportNumber, 9);
  const birth = yymmdd(person.birthDate);
  const expiry = yymmdd(person.passportExpires);
  const optional = pad("", 14);
  const composite = `${number}${checkDigit(number)}${birth}${checkDigit(birth)}${expiry}${checkDigit(expiry)}${optional}${checkDigit(optional)}`;
  const line1 = pad(`P<${person.nationality}${mrzName(person)}`, 44);
  const line2 = `${number}${checkDigit(number)}${person.nationality}${birth}${checkDigit(birth)}${person.sex}${expiry}${checkDigit(expiry)}${optional}${checkDigit(optional)}${checkDigit(composite)}`;
  return [line1, line2];
}

// Emirates ID back (TD1): three lines of 30 characters, starting "ILARE".
export function emiratesIdMrz(person: Person): [string, string, string] {
  const cardNumber = pad(person.emiratesIdCardNumber, 9);
  const idDigits = person.emiratesId.replaceAll("-", "");
  const line1 = pad(`ILARE${cardNumber}${checkDigit(cardNumber)}${idDigits}`, 30);
  const birth = yymmdd(person.birthDate);
  const expiry = yymmdd(person.emiratesIdExpires);
  const upper = `${line1.slice(5, 30)}${birth}${checkDigit(birth)}${expiry}${checkDigit(expiry)}`;
  const line2 = `${birth}${checkDigit(birth)}${person.sex}${expiry}${checkDigit(expiry)}${person.nationality}${pad("", 11)}${checkDigit(upper)}`;
  const line3 = pad(mrzName(person), 30);
  return [line1, line2, line3];
}
