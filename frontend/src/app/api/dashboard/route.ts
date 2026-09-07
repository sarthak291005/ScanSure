import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, verifications, scans, findings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const [productCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(products);
  const [scanCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(scans);
  const [verCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(verifications);

  const byResult = await db
    .select({ result: verifications.result, c: sql<number>`count(*)` })
    .from(verifications)
    .groupBy(verifications.result);

  const byStatus = await db
    .select({ status: findings.status, c: sql<number>`count(*)` })
    .from(findings)
    .groupBy(findings.status);

  const recent = await db
    .select({
      id: verifications.id,
      result: verifications.result,
      score: verifications.score,
      createdAt: verifications.createdAt,
      productName: products.name,
      productId: products.id,
    })
    .from(verifications)
    .innerJoin(products, eq(products.id, verifications.productId))
    .orderBy(sql`${verifications.createdAt} desc`)
    .limit(6);

  const avgScore = await db
    .select({ avg: sql<number>`avg(${verifications.score})` })
    .from(verifications)
    .where(eq(verifications.result, "compliant"));

  return NextResponse.json({
    counts: {
      products: Number(productCount.c),
      scans: Number(scanCount.c),
      verifications: Number(verCount.c),
    },
    byResult: Object.fromEntries(byResult.map((r) => [r.result, Number(r.c)])),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.c)])),
    recent,
    avgComplianceScore: avgScore[0]?.avg != null ? Math.round(Number(avgScore[0].avg)) : null,
  });
}
