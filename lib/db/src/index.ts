import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  dbInstance = drizzle(pool, { schema });
} else {
  console.warn("[db] DATABASE_URL not set — database features disabled (offline/desktop mode)");
}

const db = dbInstance as ReturnType<typeof drizzle<typeof schema>>;

export { pool, db };
export * from "./schema/index.js";
