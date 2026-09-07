import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  return NextResponse.json({ products: rows });
}

const productSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1),
  hsnCode: z.string().max(20).nullable().optional(),
  packagingUnit: z.string().min(1).max(40).default("g"),
  declaredWeight: z.string().min(1).max(40),
  manufacturerName: z.string().min(1).max(200),
  manufacturerAddress: z.string().min(1),
  mfgDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  mfgLicense: z.string().max(60).nullable().optional(),
  countryOfOrigin: z.string().default("India"),
  mrp: z.number().int().positive().nullable().optional(),
  netQuantity: z.string().min(1).max(60),
  imageUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = productSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const [row] = await db.insert(products).values(parsed.data).returning();
  return NextResponse.json({ product: row }, { status: 201 });
}
