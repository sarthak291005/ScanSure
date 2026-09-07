import { NextResponse } from "next/server";
import { getSessionUser, getUserFromToken } from "@/lib/auth";

export async function GET(req: Request) {
  // 1. Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const tokenUser = await getUserFromToken(token);
    if (tokenUser) return NextResponse.json({ user: tokenUser });
  }

  // 2. Check cookie
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
