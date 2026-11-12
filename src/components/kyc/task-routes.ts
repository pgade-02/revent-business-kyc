import { Building2Icon, FilesIcon, FileSignatureIcon, SignatureIcon, UserIcon, type LucideIcon } from "lucide-react";
import type { KycTask } from "@/kyc/documents/kyc-tasks";

// The page and icon for each task on the hub.
export const TASK_HREF: Record<KycTask, string> = {
  account: "/kyc/account",
  company: "/kyc/company",
  documents: "/kyc/documents",
  signatory: "/kyc/signatory",
  self_disclosure: "/kyc/self-disclosure",
};

export const TASK_ICON: Record<KycTask, LucideIcon> = {
  account: UserIcon,
  company: Building2Icon,
  documents: FilesIcon,
  signatory: SignatureIcon,
  self_disclosure: FileSignatureIcon,
};
