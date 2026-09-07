import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rules } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(rules).orderBy(asc(rules.code));
  return NextResponse.json({ rules: rows });
}

const ruleSchema = z.object({
  code: z.string().min(2).max(30),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  legalReference: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  severity: z.enum(["critical", "major", "minor"]),
  applicableTo: z.string().default("all"),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  const parsed = ruleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const [row] = await db.insert(rules).values(parsed.data).returning();
  return NextResponse.json({ rule: row }, { status: 201 });
}
