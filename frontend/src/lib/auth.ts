import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE = "lm_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string;
};

export async function getUserFromToken(token: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const rows = await db
      .select({
        u: {
          id: users.id,
          name: users.name,
          email: users.email,
          company: users.company,
          role: users.role,
        },
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.token, token))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.token, token));
      return null;
    }
    return row.u as SessionUser;
  } catch (err) {
    console.error("getUserFromToken error:", err);
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    return await getUserFromToken(token);
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  try {
    const store = await cookies();
    // Use sameSite: "none", secure: true when https, otherwise "lax"
    const isProd = process.env.NODE_ENV === "production";
    store.set(COOKIE, token, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      expires: expiresAt,
      path: "/",
    });
  } catch (err) {
    console.warn("createSession cookie set failed (e.g. running in serverless action):", err);
  }
  return token;
}

export async function destroySession() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (token) await db.delete(sessions).where(eq(sessions.token, token));
    store.delete(COOKIE);
  } catch {}
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: user.company,
    role: user.role,
  };
}
