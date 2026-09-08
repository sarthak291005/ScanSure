import { NextResponse } from "next/server";
import { db } from "@/db";
import { scans, verifications, findings, rules, products } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

/**
 * GET /api/scans/:id/verify — full evidence-backed report for a scan:
 * scan, product, latest verification with rule-level findings.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [scan] = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  const [product] = scan.productId
    ? await db.select().from(products).where(eq(products.id, scan.productId)).limit(1)
    : [];

  const verRows = await db
    .select()
    .from(verifications)
    .where(eq(verifications.scanId, id))
    .orderBy(desc(verifications.createdAt));
  const ver = verRows[0] ?? null;

  let findingsRows: any[] = [];
  if (ver) {
    findingsRows = await db
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
      .where(eq(findings.verificationId, ver.id))
      .orderBy(asc(rules.code));
  }

  return NextResponse.json({ scan, product, verification: ver, findings: findingsRows });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [scan] = await db.select({ id: scans.id, productId: scans.productId }).from(scans).where(eq(scans.id, id)).limit(1);
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // cascade: verifications -> findings handled by FK cascade
  await db.delete(scans).where(eq(scans.id, id));
  return NextResponse.json({ ok: true });
}
