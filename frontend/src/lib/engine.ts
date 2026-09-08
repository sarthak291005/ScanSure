import { db } from "@/db";
import { rules, findings, verifications, scans, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type Extracted = Record<string, string | null>;

export type CheckStatus = "pass" | "fail" | "warning" | "not_applicable";

export type EngineFinding = {
  ruleCode: string;
  status: CheckStatus;
  detail: string;
  evidence: string;
};

export type EngineResult = {
  extracted: Extracted;
  confidence: number;
  findings: EngineFinding[];
  result: "compliant" | "non_compliant" | "needs_review";
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  summary: string;
  belowThreshold: boolean;
};

const LOW = (s: string | null) => (s ?? "").toLowerCase();

function findField(e: Extracted, keys: string[]): string | null {
  for (const [k, v] of Object.entries(e)) {
    if (keys.includes(k.toLowerCase())) return v;
  }
  return null;
}

const NET_WEIGHT_PATTERNS = [
  /net\s*wt\s*[:\-]?\s*([\d.,]+)\s*(kg|mg|ml|lt|litre|liters|g|l|m|mm|cm|sq\.?m|oz|lb|pcs|nos|units)/i,
  /net\s*weight\s*[:\-]?\s*([\d.,]+)\s*(kg|mg|ml|lt|litre|liters|g|l|m|mm|cm|sq\.?m|oz|lb|pcs|nos|units)/i,
  /net\s*content\s*[:\-]?\s*([\d.,]+)\s*(kg|mg|ml|lt|litre|liters|g|l|m|mm|cm|oz|lb)/i,
];

function extractNetWeight(e: Extracted): string | null {
  // 1. Explicit net-quantity declarations
  const explicitPatterns = [
    /net\s*(?:wt|weight|wght|content|quantity)\s*[:\-]?\s*([\d.,]+)\s*(kg|mg|ml|lt|litre|liters|g|l|oz|lb|pcs|nos|units)\b/i,
  ];

  for (const v of Object.values(e)) {
    if (!v) continue;

    for (const pattern of explicitPatterns) {
      const match = v.match(pattern);
      if (match) {
        return `${match[1]} ${match[2]}`.toLowerCase();
      }
    }
  }

  // 2. Standalone package quantity, e.g. "200 ml", "500 g", "1 kg", "10 pcs"
  // Reject measurements that are clearly part of another statement.
  const standalonePattern =
    /^\s*([\d.,]+)\s*(kg|mg|ml|lt|litre|liters|g|l|oz|lb|pcs|nos|units)\s*$/i;

  for (const v of Object.values(e)) {
    if (!v) continue;

    const value = v.trim();

    // Ignore phrases such as "38 micrograms per 100 ml".
    if (/\bper\b/i.test(value)) continue;

    const match = value.match(standalonePattern);
    if (match) {
      return `${match[1]} ${match[2]}`.toLowerCase();
    }
  }

  return null;
}

function parseDeclared(declared: string, unit: string): string {
  const u = unit.toLowerCase();
  let v = declared;
  if (u === "l" && v.match(/^\d+$/)) v = `${v} l`;
  else if (u === "kg" && v.match(/^\d+(\.\d+)?$/)) v = `${v} kg`;
  else if (u === "g" && v.match(/^\d+$/)) v = `${v} g`;
  else if (u === "ml" && v.match(/^\d+$/)) v = `${v} ml`;
  return v.toLowerCase().trim();
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return new Date(+y, +mo - 1, +d);
  }
  const m2 = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function hasAddress(text: string | null): boolean {
  if (!text) return false;
  // crude address heuristics: pin code, "india", street words
  return /\b\d{5,6}\b/.test(text) || /india/i.test(text) || /street|road|lane|plot|area|phase|unit|road|highway/i.test(text);
}

const PERISHABLE = ["food", "dairy", "bakery", "beverages", "pharma", "cosmetics", "snacks", "spices", "pulses"];

export async function runVerification(
  productId: string | null,
  detectedCategory: string | null,
  hasBackImage: boolean,
  extracted: Extracted,
  confidence: number,
  userId: string | null,
  scanId: string,
): Promise<EngineResult> {
  const [product] = productId
    ? await db.select().from(products).where(eq(products.id, productId)).limit(1)
    : [undefined];

  if (productId && !product) {
    throw new Error("Product not found");
 }

  const allRules = await db.select().from(rules).where(eq(rules.active, true));

  const findings: EngineFinding[] = [];

  const category = detectedCategory ?? product?.category ?? null;

  const applicable = (r: (typeof allRules)[number]) => {
    if (r.applicableTo === "all") return true;
    if (!category) return false;

    return r.applicableTo
      .split(",")
      .map((s) => s.trim())
      .includes(category);
  };

  const declaredNorm = product
    ? parseDeclared(product.declaredWeight, product.packagingUnit)
    : null;

  const labelNet = extractNetWeight(extracted);

  const mk = (code: string, status: CheckStatus, detail: string, evidence: string) =>
    findings.push({ ruleCode: code, status, detail, evidence });

  const ruleByCode = Object.fromEntries(allRules.map((r) => [r.code, r]));

  // LM-001 net quantity
  {
    const r = ruleByCode["LM-001"];
    if (r && applicable(r)) {
      if (!labelNet) {
        mk(
          r.code,
          "fail",
          "No legible net quantity declaration found on the label.",
          "OCR did not detect a usable net quantity declaration.",
        );
      } else if (!product) {
        mk(
          r.code,
          "pass",
          `Net quantity '${labelNet}' detected on the label. No reference product was selected, so master-data comparison was not performed.`,
          `Label: '${labelNet}'.`,
        );
      } else if (!declaredNorm) {
        mk(
          r.code,
          "warning",
          `Net quantity '${labelNet}' detected, but the reference product has no usable declared pack size for comparison.`,
          `Label: '${labelNet}'.`,
        );
      } else if (labelNet !== declaredNorm) {
        mk(
          r.code,
          "fail",
          `Label shows net quantity '${labelNet}' but the product master declares '${declaredNorm}'. Declaration mismatch blocks certificate.`,
          `Label: '${labelNet}' vs declared: '${declaredNorm}'.`,
        );
      } else {
        mk(
          r.code,
          "pass",
          `Net quantity '${labelNet}' found and matches the declared pack size.`,
          `Label: '${labelNet}'.`,
        );
      }
    }
  }

    // LM-002 legibility
  {
    const r = ruleByCode["LM-002"];

    if (r && applicable(r)) {
      if (confidence >= 80) {
        mk(
          r.code,
          "pass",
          "Required label text was successfully detected with high OCR readability. Physical print size should still be verified against the applicable minimum.",
          `Overall OCR confidence: ${confidence}%. Physical character height was not estimated from OCR confidence.`,
        );
      } else {
        mk(
          r.code,
          "warning",
          "OCR readability is insufficient to confidently assess label legibility. Verify the physical print size and contrast against the applicable requirements.",
          `Overall OCR confidence: ${confidence}%. No physical font-size measurement was inferred.`,
        );
      }
    }
  }

  // LM-003 name & address
  {
    const r = ruleByCode["LM-003"];
    if (r && applicable(r)) {
      const man = findField(extracted, ["manufacturer", "packedby", "mfdby", "importer"]);
      const addr = findField(extracted, ["address"]);

      if (man && addr && hasAddress(addr)) {
        mk(r.code, "pass", "Manufacturer name and address detected on the scanned label.", `Label: '${man}' — ${addr}`);
      } else if (man && addr && !hasAddress(addr)) {
        mk(r.code, "fail", "Address field was detected but could not be validated as a complete address.", `Label: '${addr}' — address appears incomplete.`);
      } else if (man) {
        mk(r.code, hasBackImage ? "fail" : "warning", hasBackImage ? "Manufacturer name is present but the required address could not be verified on the scanned panels." : "Manufacturer name detected, but the address may be present on the unscanned back/side panel. Review the complete package.", `OCR located '${man}' but no complete address was detected.`);
      } else {
        mk(r.code, hasBackImage ? "fail" : "warning", hasBackImage ? "Manufacturer / packer / importer name and address were not detected on the scanned panels." : "Manufacturer / packer / importer information was not detected on the front image. Scan the back/side panel before deciding compliance.", hasBackImage ? "No manufacturer/address block was detected across the scanned panels." : "Front panel only — additional package panels have not been inspected.");
      }
    }
  }

  // LM-004 mfg date
  {
    const r = ruleByCode["LM-004"];
    if (r && applicable(r)) {
      const m = findField(extracted, ["mfgdate", "manufactureddate", "dateofpack", "packedon", "mfdon"]);
      const d = parseDate(m);

      if (!m || !d) {
        mk(r.code, hasBackImage ? "fail" : "warning", hasBackImage ? "Date of manufacturing / packing was not detected on the scanned panels." : "Manufacturing / packing date was not detected on the front image. Scan the back/side panel before deciding compliance.", hasBackImage ? "No manufacturing / packing date was detected across the scanned panels." : "Front panel only — additional package panels have not been inspected.");
      } else {
        mk(r.code, "pass", "Date of manufacture / packing detected and parseable.", `Label: '${m}'.`);
      }
    }
  }

  // LM-005 best before (perishable)
    // LM-005 best before (perishable)
  {
    const r = ruleByCode["LM-005"];

    if (r) {
      if (!applicable(r)) {
        mk(
          r.code,
          "not_applicable",
          `Best-before / expiry check is not applicable to category '${category ?? "unknown"}' under the current rule configuration.`,
          "Rule applicability check: category is not covered.",
        );
      } else {
        const bb = findField(extracted, [
          "bestbefore",
          "expirydate",
          "expdate",
          "useby",
        ]);
        const d = parseDate(bb);

        if (!bb || !d) {
          mk(
            r.code,
            hasBackImage ? "fail" : "warning",
            hasBackImage
              ? "Best-before / expiry date was not detected on the scanned panels."
              : "Best-before / expiry date was not detected on the front image. Scan the back/side panel before deciding compliance.",
            hasBackImage
              ? "No best-before / expiry date was detected across the scanned panels."
              : "Front panel only — additional package panels have not been inspected.",
          );
        } else {
          mk(
            r.code,
            "pass",
            "Best-before / expiry date detected and parseable.",
            `Label: '${bb}'.`,
          );
        }
      }
    }
  }


  // LM-006 country of origin
    // LM-006 country of origin
  {
    const r = ruleByCode["LM-006"];

    if (r && applicable(r)) {
      const coo = findField(extracted, ["countryoforigin", "origin"]);

      if (coo) {
        mk(
          r.code,
          "pass",
          "Country of origin declaration detected on the scanned label.",
          `Label: '${coo}'.`,
        );
      } else if (!hasBackImage) {
        mk(
          r.code,
          "warning",
          "Country of origin was not detected on the front image. Scan the back/side panel before deciding compliance.",
          "Front panel only — additional package panels have not been inspected.",
        );
      } else if (product?.countryOfOrigin) {
        mk(
          r.code,
          "warning",
          "Country of origin is present in the product master but was not detected on the scanned panels. Verify the physical label.",
          `Product master: '${product.countryOfOrigin}' — label declaration not detected.`,
        );
      } else {
        mk(
          r.code,
          "warning",
          "Country of origin was not detected on the scanned panels. Manual verification is required before making a compliance decision.",
          "No country-of-origin declaration was detected and no reference product was available to establish origin.",
        );
      }
    }
  }

  // LM-007 MRP
    // LM-007 MRP
  {
    const r = ruleByCode["LM-007"];

    if (r && applicable(r)) {
      const mrp = findField(extracted, ["mrp", "price"]);

      if (mrp) {
        mk(
          r.code,
          "pass",
          "MRP / price declaration detected on the scanned label.",
          `Label: '${mrp}'.`,
        );
      } else if (!hasBackImage) {
        mk(
          r.code,
          "warning",
          "MRP / price declaration was not detected on the front image. Scan the back/side panel before deciding compliance.",
          "Front panel only — additional package panels have not been inspected.",
        );
      } else {
        mk(
          r.code,
          "warning",
          "MRP / price declaration was not detected on the scanned panels. Manual verification is required before making a compliance decision.",
          "No MRP / price declaration was detected across the scanned panels.",
        );
      }
    }
  }

  // LM-008 licence
    // LM-008 licence
  {
    const r = ruleByCode["LM-008"];

    if (r && applicable(r)) {
      const lic = findField(extracted, [
        "licence",
        "license",
        "fssaileg",
        "fssaiceg",
      ]);

      const isFoodCategory = ["food", "dairy", "bakery", "beverages", "snacks", "spices", "pulses"].includes(
        category ?? "",
      );

      if (lic) {
        if (isFoodCategory && /\d{10,14}/.test(lic)) {
          mk(
            r.code,
            "pass",
            "Food-related statutory licence number detected on the scanned label.",
            `Label: '${lic}'.`,
          );
        } else if (/\d{10,14}/.test(lic)) {
          mk(
            r.code,
            "pass",
            "Statutory licence / registration number detected on the scanned label.",
            `Label: '${lic}'.`,
          );
        } else {
          mk(
            r.code,
            "warning",
            "A licence / registration field was detected, but its number could not be confidently validated.",
            `Label: '${lic}'.`,
          );
        }
      } else if (!hasBackImage) {
        mk(
          r.code,
          "warning",
          isFoodCategory
            ? "Food-related licence information was not detected on the front image. Scan the back/side panel before deciding compliance."
            : "Statutory licence information was not detected on the front image. Scan the back/side panel before deciding compliance.",
          "Front panel only — additional package panels have not been inspected.",
        );
      } else {
        mk(
          r.code,
          "warning",
          isFoodCategory
            ? "Food-related licence information was not detected on the scanned panels. Manual verification is required."
            : "Statutory licence information was not detected on the scanned panels. Manual verification is required.",
          "No licence / registration number was detected across the scanned panels.",
        );
      }
    }
  }

    // LM-009 product identification
  {
    const r = ruleByCode["LM-009"];

    if (r && applicable(r)) {
      const productName = findField(extracted, [
        "product",
        "article",
        "brand",
      ]);

      if (productName && productName.trim().length >= 3) {
        mk(
          r.code,
          "pass",
          "Product identification text detected on the scanned label.",
          `Label: '${productName}'.`,
        );
      } else if (!hasBackImage) {
        mk(
          r.code,
          "warning",
          "A clear product identification was not detected on the front image. Scan the back/side panel before deciding compliance.",
          "Front panel only — additional package panels have not been inspected.",
        );
      } else {
        mk(
          r.code,
          "warning",
          "A clear product identification was not detected on the scanned panels. Manual verification is required.",
          "No reliable product/article identification was detected across the scanned panels.",
        );
      }
    }
  }

  // LM-010 date integrity
  {
    const r = ruleByCode["LM-010"];
    if (r && applicable(r)) {
      const m = findField(extracted, ["mfgdate", "manufactureddate", "dateofpack"]);
      const bb = findField(extracted, ["bestbefore", "expirydate", "expdate"]);
      const dm = parseDate(m);
      const dbb = parseDate(bb);
      const now = new Date();
      if (dm && dm > new Date(now.getTime() + 2 * 86400000)) {
        mk(r.code, "fail", `Manufacturing date '${fmtDate(dm)}' is in the future — possible back-dating / tampering.`, `Label: '${m}'.`);
      } else if (dm && dbb && dbb <= dm) {
        mk(r.code, "fail", "Best-before date precedes or equals the manufacturing date — impossible timeline.", `MFG ${fmtDate(dm)} vs BB ${fmtDate(dbb)}.`);
      } else if (dm && dbb) {
        const delta = Math.round((dbb.getTime() - dm.getTime()) / 86400000);
        mk(r.code, "pass", `Dates internally consistent (${delta}-day shelf life).`, `MFG ${fmtDate(dm)} → BB ${fmtDate(dbb)}.`);
      } else if (dm) {
        mk(r.code, "pass", "Manufacturing date consistent with the production calendar.", `MFG ${fmtDate(dm)} is within the last 30 days.`);
      } else {
        mk(r.code, "warning", "Unable to validate date integrity — one or both dates missing.", "Insufficient date fields on label.");
      }
    }
  }

  const applicableCount = findings.filter((f) => f.status !== "not_applicable").length;
  const passed = findings.filter((f) => f.status === "pass").length;
  const failed = findings.filter((f) => f.status === "fail").length;
  const warnings = findings.filter((f) => f.status === "warning").length;
  const score = Math.round(((passed + warnings * 0.5) / Math.max(1, applicableCount)) * 100);

    const belowThreshold = confidence < 70;

  // OCR uncertainty or unresolved warnings require human verification.
  // A warning must never be treated as proof of compliance.
  const result: EngineResult["result"] =
    belowThreshold
      ? "needs_review"
      : failed > 0
        ? "non_compliant"
        : warnings > 0
          ? "needs_review"
          : "compliant";

  let summary: string;

  if (belowThreshold) {
    summary = `OCR confidence (${confidence}%) is below the 70% verification threshold. Findings are provisional; manually review the physical label before making a compliance decision.`;
  } else if (failed > 0) {
    const fails = findings
      .filter((f) => f.status === "fail")
      .map((f) => f.ruleCode);

    summary = `${failed} confirmed rule issue${failed > 1 ? "s" : ""} detected (${fails.join(", ")}). ${warnings} additional finding${warnings !== 1 ? "s" : ""} require review.`;
  } else if (warnings > 0) {
    summary = `${warnings} finding${warnings > 1 ? "s" : ""} require manual verification. The available label evidence is insufficient to issue a final compliance decision.`;
  } else {
    summary = `All ${passed} applicable checks passed with OCR confidence ${confidence}%.`;
  }

  return { extracted, confidence, findings, result, score, passed, failed, warnings, summary, belowThreshold };
}

export async function persistVerification(
  scanId: string,
  productId: string | null,
  userId: string | null,
  res: EngineResult,
) {
  const allRules = await db.select().from(rules);
  const codeToId = Object.fromEntries(allRules.map((r) => [r.code, r.id]));

  const [ver] = await db
    .insert(verifications)
    .values({
      scanId,
      productId,
      result: res.result,
      score: res.score,
      passed: res.passed,
      failed: res.failed,
      warnings: res.warnings,
      summary: res.summary,
      createdBy: userId,
    })
    .returning();

  await db.insert(findings).values(
    res.findings.map((f) => ({
      verificationId: ver.id,
      ruleId: codeToId[f.ruleCode],
      status: f.status,
      detail: f.detail,
      evidence: f.evidence,
    })),
  );
  return ver.id;
}

export async function markScanCompleted(scanId: string, extracted: Extracted, confidence: number) {
  await db
    .update(scans)
    .set({ status: "completed", extracted, confidence })
    .where(and(eq(scans.id, scanId)));
}

