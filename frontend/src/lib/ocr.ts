import type { Extracted } from "./engine";

/**
 * A detected text region on the label image (relative 0..1 coordinates),
 * used to visualise OCR bounding boxes and forensic evidence.
 */
export type OcrRegion = {
  id: string;
  field: string; // key in extracted
  ruleCode: string; // LM rule it feeds
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number; // 0-100
  found: boolean;
  side: "front" | "back"; // which physical panel the text is on
};

const clamp01 = (v: number) => Math.min(0.97, Math.max(0.03, v));

// Typical label layout template (relative coordinates on the pack photo)
const REGION_LAYOUT: Record<string, { x: number; y: number; w: number; h: number; rule: string }> = {
  brand: { x: 0.28, y: 0.05, w: 0.44, h: 0.11, rule: "LM-009" },
  manufacturer: { x: 0.07, y: 0.54, w: 0.42, h: 0.07, rule: "LM-003" },
  address: { x: 0.07, y: 0.63, w: 0.46, h: 0.07, rule: "LM-003" },
  mfgDate: { x: 0.55, y: 0.54, w: 0.31, h: 0.07, rule: "LM-004" },
  bestBefore: { x: 0.55, y: 0.63, w: 0.33, h: 0.07, rule: "LM-005" },
  netWeight: { x: 0.05, y: 0.76, w: 0.25, h: 0.1, rule: "LM-001" },
  mrp: { x: 0.66, y: 0.74, w: 0.28, h: 0.11, rule: "LM-007" },
  licence: { x: 0.05, y: 0.89, w: 0.36, h: 0.07, rule: "LM-008" },
  countryOfOrigin: { x: 0.44, y: 0.89, w: 0.28, h: 0.07, rule: "LM-006" },
};

/**
 * Simulated on-device OCR + AI extraction pipeline.
 * In production this would call a vision model; here we deterministically
 * synthesise plausible extraction results from the product master so the
 * end-to-end flow (upload → OCR → verify → report) works fully.
 */
export function simulateOcr(product: {
  name: string;
  category: string;
  manufacturerName: string;
  manufacturerAddress: string;
  mfgDate: string;
  expDate: string | null;
  mfgLicense: string | null;
  countryOfOrigin: string;
  mrp: number | null;
  netQuantity: string;
  declaredWeight: string;
  packagingUnit: string;
}, options?: { panels?: 1 | 2 }) {
  const panels = options?.panels ?? 1;
  // Fields typically printed on the front vs back of a pack. When only ONE
  // image is scanned we treat it as containing all panels (so every rule can
  // be verified from a single front OR back image). When two panels are
  // supplied we tag each region with its side for the front/back viewer.
  const FRONT_FIELDS = new Set(["brand", "netWeight", "mrp", "countryOfOrigin"]);
  const sideOf = (field: string): "front" | "back" =>
    panels === 2 ? (FRONT_FIELDS.has(field) ? "front" : "back") : "front";
  const seed = product.name.length + (product.mfgDate.charCodeAt(5) ?? 7);
  const rand = (n: number) => ((seed * 31 + n * 17) % 100) / 100;

  const confidence = 78 + Math.round(rand(1) * 20); // 78-98

  const toDdMmYyyy = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-");
    return `${d}-${m}-${y}`;
  };

  const isPerishable = ["food", "dairy", "bakery", "beverages", "pharma", "cosmetics"].includes(product.category);
  const unit = product.packagingUnit.toLowerCase();
  const netWord = unit === "l" || unit === "ml" ? "Net Content" : "Net Wt";

  const extracted: Extracted = {
    netWeight: `${netWord}: ${product.netQuantity.replace(/^(net\s*wt|net\s*content|net\s*weight)\s*:?\s*/i, "")}`,
    brand: product.name,
    manufacturer: `Mfd. by: ${product.manufacturerName}`,
    address: product.manufacturerAddress,
    mfgDate: `Mfd. on: ${toDdMmYyyy(product.mfgDate)}`,
    bestBefore:
      isPerishable && product.expDate
        ? `Best Before: ${toDdMmYyyy(product.expDate)}`
        : null,
    countryOfOrigin:
      product.countryOfOrigin === "India"
        ? "Product of India"
        : `Country of Origin: ${product.countryOfOrigin}`,
    mrp: product.mrp
      ? `MRP: ₹${(product.mrp / 100).toFixed(2)} incl. of all taxes`
      : null,
    licence: product.mfgLicense
      ? `Mfg. Lic. No: ${product.mfgLicense}`
      : null,
  };

  // deterministic quirks so reports feel real
  if (rand(2) > 0.85) {
    extracted.mrp = extracted.mrp
      ? extracted.mrp.replace(" incl. of all taxes", "")
      : null;
  }
  if (rand(3) > 0.9 && unit === "l") {
    extracted.netWeight = extracted.netWeight!.replace("Net Content", "Net Cnt.");
  }

  // Build bounding-box regions for each detected (or missing) declaration
  const regions: OcrRegion[] = Object.entries(REGION_LAYOUT).map(([field, l], i) => {
    const jx = (rand(i + 11) - 0.5) * 0.05;
    const jy = (rand(i + 21) - 0.5) * 0.04;
    const val = extracted[field];
    const found = val != null;
    return {
      id: `rg-${field}`,
      field,
      ruleCode: l.rule,
      x: clamp01(l.x + jx),
      y: clamp01(l.y + jy),
      w: l.w,
      h: l.h,
      confidence: found ? Math.max(52, Math.min(99, confidence - Math.round(rand(i + 31) * 12))) : 0,
      found,
      side: sideOf(field),
    };
  });

  return { extracted, confidence, regions, panels };
}

export const OCR_STAGES = [
  "Uploading label image…",
  "Pre-processing: deskew & denoise…",
  "Sending image to ScanSure OCR…",
  "Detecting text regions with PaddleOCR…",
  "Recognizing label text…",
  "Preparing OCR evidence for review…",
];
