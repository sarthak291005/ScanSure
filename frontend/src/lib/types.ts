export type User = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  hsnCode: string | null;
  packagingUnit: string;
  declaredWeight: string;
  manufacturerName: string;
  manufacturerAddress: string;
  mfgDate: string;
  expDate: string | null;
  mfgLicense: string | null;
  countryOfOrigin: string;
  importCode: string | null;
  mrp: number | null;
  netQuantity: string;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Scan = {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  productImage: string | null;
  status: "pending" | "completed";
  imageUrl: string;
  extracted: Record<string, string | null>;
  confidence: number | null;
  createdAt: string;
};

export type Rule = {
  id: string;
  code: string;
  title: string;
  description: string;
  legalReference: string;
  category: string;
  severity: "critical" | "major" | "minor";
  applicableTo: string;
  active: boolean;
};

export type FindingStatus = "pass" | "fail" | "warning" | "not_applicable";

export type Verification = {
  id: string;
  result: "compliant" | "non_compliant" | "needs_review";
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  summary: string;
  createdAt: string;
  scanId: string;
  productName: string;
  productId: string;
  scanImage: string;
  productCategory?: string;
};

export type Finding = {
  id: string;
  status: FindingStatus;
  detail: string;
  evidence: string | null;
  code: string;
  title: string;
  legalReference: string;
  severity: "critical" | "major" | "minor";
  category: string;
};

export const CATEGORIES = [
  "food",
  "dairy",
  "beverages",
  "bakery",
  "cosmetics",
  "pharma",
  "electronics",
  "textiles",
  "hardware",
  "other",
] as const;

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

export function formatMRP(paise: number | null): string {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
