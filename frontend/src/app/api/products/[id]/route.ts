import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { products, verifications, scans } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

const productPatch = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).optional(),
  hsnCode: z.string().max(20).nullable().optional(),
  packagingUnit: z.string().min(1).max(40).optional(),
  declaredWeight: z.string().min(1).max(40).optional(),
  manufacturerName: z.string().min(1).max(200).optional(),
  manufacturerAddress: z.string().min(1).optional(),
  mfgDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  mfgLicense: z.string().max(60).nullable().optional(),
  countryOfOrigin: z.string().optional(),
  mrp: z.number().int().positive().nullable().optional(),
  netQuantity: z.string().min(1).max(60).optional(),
  imageUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const vrs = await db
    .select()
    .from(verifications)
    .where(eq(verifications.productId, id))
    .orderBy(desc(verifications.createdAt));
  const sc = await db
    .select()
    .from(scans)
    .where(eq(scans.productId, id))
    .orderBy(desc(scans.createdAt));
  return NextResponse.json({ product, verifications: vrs, scans: sc });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = productPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const [row] = await db
    .update(products)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product: row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
