import { NextResponse } from "next/server";
import { db } from "@/db";
import { verifications, findings, rules, products, scans } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/verifications — list verification reports (join product).
 * ?id= returns a single report with findings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const singleId = url.searchParams.get("id");

  if (singleId) {
    const [ver] = await db
      .select({
        id: verifications.id,
        result: verifications.result,
        score: verifications.score,
        passed: verifications.passed,
        failed: verifications.failed,
        warnings: verifications.warnings,
        summary: verifications.summary,
        createdAt: verifications.createdAt,
        scanId: verifications.scanId,
        productName: products.name,
        productId: products.id,
        scanImage: scans.imageUrl,
      })
      .from(verifications)
      .innerJoin(products, eq(products.id, verifications.productId))
      .innerJoin(scans, eq(scans.id, verifications.scanId))
      .where(eq(verifications.id, singleId))
      .limit(1);
    if (!ver) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const findingsRows = await db
      .select({
        id: findings.id,
        status: findings.status,
        detail: findings.detail,
        evidence: findings.evidence,
        code: rules.code,
        title: rules.title,
        legalReference: rules.legalReference,
        severity: rules.severity,
        category: rules.category,
      })
      .from(findings)
      .innerJoin(rules, eq(rules.id, findings.ruleId))
      .where(eq(findings.verificationId, singleId));
    return NextResponse.json({ verification: ver, findings: findingsRows });
  }

  // list with distinct per product (latest)
  const rows = await db
    .select({
      id: verifications.id,
      result: verifications.result,
      score: verifications.score,
      passed: verifications.passed,
      failed: verifications.failed,
      warnings: verifications.warnings,
      createdAt: verifications.createdAt,
      scanId: verifications.scanId,
      productName: products.name,
      productId: products.id,
      productCategory: products.category,
      scanImage: scans.imageUrl,
    })
    .from(verifications)
    .innerJoin(products, eq(products.id, verifications.productId))
    .innerJoin(scans, eq(scans.id, verifications.scanId))
    .orderBy(desc(verifications.createdAt))
    .limit(200);

  const latestByProduct = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByProduct.has(r.productId)) latestByProduct.set(r.productId, r);

  return NextResponse.json({
    verifications: rows,
    latestByProduct: Object.fromEntries(latestByProduct),
  });
}
