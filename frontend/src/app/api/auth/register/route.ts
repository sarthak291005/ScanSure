import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";

const body = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6),
  company: z.string().max(160).optional(),
  role: z.enum(["manufacturer", "packer", "importer", "seller", "inspector"]).default("seller"),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, email, password, company, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
      company: company ?? null,
      role,
    })
    .returning();
  const token = await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, company: user.company, role: user.role },
    token,
  });
}
