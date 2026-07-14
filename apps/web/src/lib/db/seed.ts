import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { account, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth";

async function setCredentialPassword(userId: string, email: string, password: string) {
  const hashed = await hashPassword(password);
  const existing = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(account)
      .set({ password: hashed, accountId: email, updatedAt: new Date() })
      .where(eq(account.id, existing[0].id));
    return;
  }

  const now = new Date();
  await db.insert(account).values({
    id: randomUUID(),
    accountId: email,
    providerId: "credential",
    userId,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  });
}

export async function seedDatabase() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("Bootstrap admin skipped: BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set");
    return;
  }

  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing.length > 0) {
    await setCredentialPassword(existing[0].id, email, password);
    await db
      .update(user)
      .set({ role: "admin", banned: false, updatedAt: new Date() })
      .where(eq(user.id, existing[0].id));
    console.log(`Bootstrap admin synced: ${email}`);
    return;
  }

  const admins = await db.select().from(user).where(eq(user.role, "admin")).limit(1);
  if (admins.length === 1) {
    await db
      .update(user)
      .set({ email, name: "Admin", role: "admin", banned: false, updatedAt: new Date() })
      .where(eq(user.id, admins[0].id));
    await setCredentialPassword(admins[0].id, email, password);
    console.log(`Bootstrap admin migrated to: ${email}`);
    return;
  }

  await auth.api.signUpEmail({
    body: { name: "Admin", email, password },
  });
  await db.update(user).set({ role: "admin" }).where(eq(user.email, email));
  console.log(`Bootstrap admin created: ${email}`);
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
