import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function seedDatabase() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (email && password) {
    const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existing.length === 0) {
      await auth.api.signUpEmail({
        body: { name: "Admin", email, password },
      });
      await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
      console.log(`Bootstrap admin created: ${email}`);
    }
  }
}

export async function listUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user);
}

export async function updateUserRole(userId: string, role: "admin" | "operator") {
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId));
}

export async function createOperator(input: { name: string; email: string; password: string }) {
  const result = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });
  await db.update(user).set({ role: "operator" }).where(eq(user.email, input.email));
  return result;
}

export async function setUserBanned(userId: string, banned: boolean) {
  await db
    .update(user)
    .set({ banned, updatedAt: new Date(), banReason: banned ? "Disabled by admin" : null })
    .where(eq(user.id, userId));
}
