export async function register() {
  // Coolify injects BOOTSTRAP_* / DATABASE_URL as build ARGs; next build must not touch SQLite.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runMigrations } = await import("@/lib/db/migrate");
  const { seedDatabase } = await import("@/lib/db/seed");
  runMigrations();
  await seedDatabase();
}
