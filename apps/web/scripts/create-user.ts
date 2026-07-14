import { runMigrations } from "../src/lib/db/migrate";
import { db } from "../src/lib/db";
import { user } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";

async function main() {
  runMigrations();

  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] ?? "Platform User";
  const role = (process.argv[5] ?? "operator") as "admin" | "operator";

  if (!email || !password) {
    console.error("Usage: tsx scripts/create-user.ts <email> <password> [name] [admin|operator]");
    process.exit(1);
  }

  if (role !== "admin" && role !== "operator") {
    console.error("Role must be admin or operator");
    process.exit(1);
  }

  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing.length > 0) {
    console.error(`User already exists: ${email}`);
    process.exit(1);
  }

  await auth.api.signUpEmail({ body: { name, email, password } });
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.email, email));

  console.log(JSON.stringify({ ok: true, email, password, name, role }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
