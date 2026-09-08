import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { scans, products } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { adaptOcrResults, requestScanSureOcr } from "@/lib/scansure-ocr";

export async function GET() {
  const rows = await db
    .select({
      id: scans.id,
      status: scans.status,
      imageUrl: scans.imageUrl,
      extracted: scans.extracted,
      confidence: scans.confidence,
      createdAt: scans.createdAt,
      productId: products.id,
      productName: products.name,
      productCategory: products.category,
      productImage: products.imageUrl,
    })
    .from(scans)
    .leftJoin(products, eq(products.id, scans.productId))
    .orderBy(desc(scans.createdAt));
  return NextResponse.json({ scans: rows });
}

const body = z.object({
  productId: z.string().uuid().optional(),
  image: z.string().optional(), // front / primary label — data URL or path
  backImage: z.string().optional(), // optional back panel — data URL or path
});

/**
 * POST /api/scans — runs the AI pipeline:
 * 1. persist a pending scan
 * 2. send the uploaded label panel(s) to ScanSure's PaddleOCR service
 * 3. run rule verification
 * 4. persist verification + findings
 * Returns the full report.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { productId: requestedProductId, image, backImage } = parsed.data;
  const productId = requestedProductId ?? null;
  const panels: 1 | 2 = backImage ? 2 : 1;

  const [product] = productId
    ? await db.select().from(products).where(eq(products.id, productId)).limit(1)
    : [undefined];

  if (productId && !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  
  if (!image?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Upload a label image before starting a scan." }, { status: 400 });
  }

  // 1. pending scan
  const [scan] = await db
    .insert(scans)
    .values({
      productId,
      status: "pending",
      imageUrl: image ?? product?.imageUrl ?? "",
    })
    .returning();

  // 2. Real OCR — each supplied panel is processed by the existing ScanSure engine.
  const { runVerification, persistVerification, markScanCompleted } = await import("@/lib/engine");
  let ocr;
  try {
    const front = await requestScanSureOcr(image, "scan-front");
    const results: Array<{ result: typeof front; side: "front" | "back" }> = [{ result: front, side: "front" }];
    if (backImage) results.push({ result: await requestScanSureOcr(backImage, "scan-back"), side: "back" });
    ocr = adaptOcrResults(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The OCR service is unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { extracted, confidence, regions, identification } = ocr;

  await db
    .update(scans)
    .set({
      detectedProductName: identification.productName,
      detectedCategory: identification.category,
      categoryConfidence: identification.confidence,
    })
    .where(eq(scans.id, scan.id));
  // 3. verify
  const result = await runVerification(
    productId,
    identification.category,
    Boolean(backImage),
    extracted,
    confidence,
    null,
    scan.id,
  );

  // 4. persist
  await markScanCompleted(scan.id, extracted, confidence);
  await persistVerification(scan.id, productId, null, result);

  const backImageUrl = backImage ?? product?.imageUrl ?? "";;
  return NextResponse.json({
    scan: {
      id: scan.id,
      status: "completed",
      imageUrl: image ?? product?.imageUrl ?? "",
      backImageUrl,
      panels,
      detectedProductName: identification.productName,
      detectedCategory: identification.category,
      categoryConfidence: identification.confidence,
    },
    verification: { ...result, regions, id: "", createdAt: new Date().toISOString() },
  });
}
