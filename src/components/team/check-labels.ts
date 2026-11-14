// Plain names for the upload checks, shown when a reviewer opens a document (team UI, English).
export const CHECK_LABEL: Readonly<Record<string, string>> = {
  FILE_DUPLICATE: "Not uploaded twice",
  FILE_REUSED: "Not used in another customer's application",
  DOC_READING: "Read completely",
  DOC_UNREADABLE: "Clear enough to read",
  DOC_WRONG_TYPE: "The right kind of document",
  DOC_EXPIRED: "Not expired",
  DOC_EXPIRES_SOON: "Not expiring soon",
  PASSPORT_MRZ: "Passport code lines are valid",
  MRZ_CHECK_DIGITS: "Emirates ID code lines are valid",
  EID_DATES: "Issue and expiry dates make sense",
  ID_FORMAT: "ID numbers are well-formed",
  STMT_BALANCE: "Balances add up",
};

export const checkLabel = (code: string) => CHECK_LABEL[code] ?? code;
