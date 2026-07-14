import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.banned === true;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await isUserBanned(session.user.id)) redirect("/login?error=banned");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "operator";
  if (role !== "admin") redirect("/");
  return session;
}

export function getUserRole(user: { role?: string | null }): "admin" | "operator" {
  return user.role === "admin" ? "admin" : "operator";
}
