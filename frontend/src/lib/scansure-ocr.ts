export type ScanSureTextBlock = {
  text: string;
  bbox: number[];
  confidence: number;
};

export type ScanSureOcrResult = {
  image_id: string;
  ocr_engine: "PaddleOCR" | string;
  text_blocks: ScanSureTextBlock[];
};

export type ProductIdentification = {
  productName: string | null;
  category: string | null;
  confidence: number;
};

export type OcrRegion = {
  id: string;
  field: string;
  ruleCode: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  found: boolean;
  side: "front" | "back";
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Upload a JPEG, PNG, or WEBP image.");
  }
  const bytes = Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ""), "base64"));
  if (!bytes.length) throw new Error("The uploaded image is empty.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image must be 10 MB or smaller.");
  return { bytes, contentType: match[1].toLowerCase() };
}

export async function requestScanSureOcr(dataUrl: string, imageId: string): Promise<ScanSureOcrResult> {
  const { bytes, contentType } = decodeDataUrl(dataUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8000"}/ocr`, {
      method: "POST",
      headers: { "content-type": contentType, "x-image-id": imageId },
      body: Buffer.from(bytes),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.detail ?? "The OCR service could not process this image.");
    if (!payload || !Array.isArray(payload.text_blocks)) throw new Error("The OCR service returned an invalid response.");
    return payload as ScanSureOcrResult;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The OCR service took too long. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function identifyProduct(text: string[]): ProductIdentification {
  const normalized = text
    .map((value) => value.trim())
    .filter(Boolean);

  const joined = normalized.join(" ");

  const categoryPatterns: Array<{ category: string; pattern: RegExp }> = [
    {
      category: "cosmetics",
      pattern: /\b(shampoo|conditioner|hair\s*care|skin\s*care|skincare|lotion|cream|face\s*wash|cosmetic|deodorant)\b/i,
    },
    {
      category: "dairy",
      pattern: /\b(milk|curd|dahi|paneer|butter|cheese|ghee)\b/i,
    },
    {
      category: "beverages",
      pattern: /\b(juice|drink|beverage|water|soda|soft\s*drink)\b/i,
    },
    {
      category: "food",
      pattern: /\b(rice|atta|flour|almond|oil|spice|spices|pulse|pulses|snack|biscuits|biscuit|namkeen)\b/i,
    },
  ];

  const categoryMatch = categoryPatterns.find(({ pattern }) => pattern.test(joined));

  let productName: string | null = null;

  if (categoryMatch?.category === "cosmetics") {
    const likelyName = normalized.filter(
      (value) =>
        !/^\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|lt)\b/i.test(value) &&
        !/^(b1|e)$/i.test(value) &&
        !/\b(micrograms?|per\s+\d+)\b/i.test(value),
    );

    productName = likelyName.slice(0, 4).join(" ") || null;
  } else if (normalized.length > 0) {
    productName = normalized
      .filter((value) => !/^\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|lt)\b/i.test(value))
      .slice(0, 3)
      .join(" ") || null;
  }

  const confidence = categoryMatch
    ? categoryMatch.category === "cosmetics"
      ? 90
      : 80
    : 0;

  return {
    productName,
    category: categoryMatch?.category ?? null,
    confidence,
  };
}

function firstMatch(text: string, pattern: RegExp) {
  return pattern.test(text) ? text : null;
}

/**
 * This adapter preserves ScanSure's raw OCR contract and only prepares the
 * existing frontend's display/verification shape. It does not make a legal
 * decision or fabricate regions that OCR did not return.
 */
export function adaptOcrResults(results: Array<{ result: ScanSureOcrResult; side: "front" | "back" }>) {
  const extracted: Record<string, string | null> = {};
  const regions: OcrRegion[] = [];
  const confidences: number[] = [];

  for (const { result, side } of results) {
    const maxX = Math.max(1, ...result.text_blocks.map((block) => Number(block.bbox[2]) || 0));
    const maxY = Math.max(1, ...result.text_blocks.map((block) => Number(block.bbox[3]) || 0));
    result.text_blocks.forEach((block, index) => {
      const [left = 0, top = 0, right = left, bottom = top] = block.bbox.map(Number);
      const field = `text_${regions.length + 1}`;
      extracted[field] = block.text;
      confidences.push(block.confidence);
      regions.push({
        id: `${side}-${result.image_id}-${index}`,
        field,
        ruleCode: "OCR",
        x: Math.max(0, left / maxX),
        y: Math.max(0, top / maxY),
        w: Math.max(0.005, (right - left) / maxX),
        h: Math.max(0.005, (bottom - top) / maxY),
        confidence: Math.round(block.confidence * 100),
        found: true,
        side,
      });
    });
  }

  const text = Object.values(extracted).filter((value): value is string => Boolean(value));
  const identification = identifyProduct(text);
  const pick = (key: string, pattern: RegExp) => {
    const match = text.find((value) => firstMatch(value, pattern));
    if (match) extracted[key] = match;
  };
  pick("netWeight", /\bnet\s*(?:wt|weight|content)?\b.*\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|l|litre|pcs?|units?)\b/i);
  pick("manufacturer", /\b(?:mfd|manufactured|packed|imported)\s*(?:by|for)?\b/i);
  pick("address", /\b(?:address|road|street|lane|plot|area|phase|india|\d{5,6})\b/i);
  pick("mfgDate", /\b(?:mfd|mfg|manufactured|packed)\b.*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/i);
  pick("bestBefore", /\b(?:best\s*before|expiry|exp\.?|use\s*by)\b/i);
  pick("countryOfOrigin", /\b(?:country\s*of\s*origin|product\s*of|made\s*in)\b/i);
  pick("mrp", /\bmrp\b|₹|\brs\.?\s*\d/i);
  pick("licence", /\b(?:fssai|licen[cs]e)\b/i);
  const brandCandidate = text.find(
    (value) =>
      /[a-z]/i.test(value) &&
      !/^\s*(b1|e)\s*$/i.test(value) &&
      !/^\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|lt|pcs|nos|units)\b/i.test(value) &&
      !/\b(per|micrograms?)\b/i.test(value),
  );

  if (brandCandidate) {
    extracted.brand = brandCandidate;
  }

  const confidence = confidences.length
    ? Math.round((confidences.reduce((total, value) => total + value, 0) / confidences.length) * 100)
    : 0;
  return {
    extracted,
    regions,
    confidence,
    identification,
  };
}


