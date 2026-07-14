export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("@/lib/db/migrate");
    const { seedDatabase } = await import("@/lib/db/seed");
    runMigrations();
    await seedDatabase();
  }
}
