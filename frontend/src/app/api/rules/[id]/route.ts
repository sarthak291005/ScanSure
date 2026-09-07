import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rules } from "@/db/schema";
import { eq } from "drizzle-orm";

const patch = z.object({
  code: z.string().min(2).max(30).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  legalReference: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(60).optional(),
  severity: z.enum(["critical", "major", "minor"]).optional(),
  applicableTo: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const [row] = await db.update(rules).set(parsed.data).where(eq(rules.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ rule: row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [row] = await db.delete(rules).where(eq(rules.id, id)).returning({ id: rules.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
