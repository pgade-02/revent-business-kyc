import { describe, expect, it } from "vitest";
import { startingScoringSettings } from "@/db/seed/scoring-settings";
import { companyNameKey, compareCompanyNames } from "@/kyc/matching/company-names";
import { comparePersonNames } from "@/kyc/matching/person-names";
import { sameNumber, scriptOf } from "@/kyc/matching/text";

// All names are invented.
const cutoffs = startingScoringSettings.nameMatch;
const compare = (a: string, b: string) => comparePersonNames(a, b, cutoffs);

describe("compareCompanyNames", () => {
  it("ignores case, punctuation and legal forms", () => {
    expect(compareCompanyNames("Falcon Trading L.L.C.", "FALCON TRADING")).toBe("match");
    expect(compareCompanyNames("Horizon Tech FZ-LLC", "Horizon Tech")).toBe("match");
    expect(compareCompanyNames("Café Lumière Est.", "Cafe Lumiere Establishment")).toBe("match");
  });

  it("drops Arabic legal forms", () => {
    expect(companyNameKey("مؤسسة النور")).toBe(companyNameKey("النور"));
    expect(compareCompanyNames("فالكون للتجارة ش.ذ.م.م", "فالكون للتجارة")).toBe("match");
  });

  it("treats any other difference as a different company", () => {
    expect(compareCompanyNames("Falcon Trading LLC", "Falcon General Trading LLC")).toBe("different");
  });

  it("cannot compare Arabic with English, or a name that is only a legal form", () => {
    expect(compareCompanyNames("فالكون للتجارة", "Falcon Trading")).toBe("not_comparable");
    expect(compareCompanyNames("LLC", "Falcon Trading")).toBe("not_comparable");
  });
});

describe("comparePersonNames", () => {
  it("ignores case, accents and punctuation", () => {
    expect(compare("José García-López", "JOSE GARCIA LOPEZ")).toBe("match");
  });

  it("ignores word order", () => {
    expect(compare("Omar Hamdan", "Hamdan Omar")).toBe("match");
  });

  it("allows extra middle names", () => {
    expect(compare("Priya Ramesh Nair", "Priya Nair")).toBe("match");
  });

  it("ignores spacing inside a name", () => {
    expect(compare("Sara Al Mansoori", "Sara Almansoori")).toBe("match");
    expect(compare("Omar Abdul Rahman", "Omar Abdulrahman")).toBe("match");
  });

  it("matches a one-letter spelling difference in a long word", () => {
    expect(compare("Arjun Chaudhary", "Arjun Chaudhry")).toBe("match");
  });

  it("sends a larger spelling difference to the reviewer as a possible match", () => {
    expect(compare("Mohammed Saeed", "Muhammad Saeed")).toBe("possible_match");
  });

  it("finds different people", () => {
    expect(compare("Omar Khalid Saeed", "Omar Khalid Hamdan")).toBe("different");
    expect(compare("Elena Petrova", "Daria Petrova")).toBe("different");
  });

  it("does not prove anything from a single word", () => {
    expect(compare("Omar", "Omar Khalid Saeed")).toBe("not_comparable");
  });

  it("cannot compare Arabic with English", () => {
    expect(compare("سارة المنصوري", "Sara Al Mansoori")).toBe("not_comparable");
  });
});

describe("sameNumber", () => {
  it("ignores spaces and dashes", () => {
    expect(sameNumber("100-234 567 800003", "100234567800003")).toBe("match");
  });

  it("finds a different number, and cannot compare an empty one", () => {
    expect(sameNumber("1048372", "1048373")).toBe("different");
    expect(sameNumber("  ", "1048372")).toBe("not_comparable");
  });
});

describe("scriptOf", () => {
  it("tells Arabic from Latin", () => {
    expect(scriptOf("فالكون")).toBe("arabic");
    expect(scriptOf("Falcon")).toBe("latin");
    expect(scriptOf("123")).toBe("none");
  });
});
