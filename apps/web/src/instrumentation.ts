// Bootstrap (migrate + admin seed) runs in docker-entrypoint.mjs so `next build` never opens SQLite.
export async function register() {}
