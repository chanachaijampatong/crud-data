import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

// Reuse pool across hot reloads in development
let pool: Pool;

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || "localhost",
      port: parseInt(process.env.PGPORT || "5432", 10),
      database: process.env.PGDATABASE || "rytc",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD,
    };

if (process.env.NODE_ENV === "production") {
  pool = new Pool(poolConfig);
} else {
  if (!global._pgPool) {
    global._pgPool = new Pool(poolConfig);
  }
  pool = global._pgPool;
}

export default pool;
