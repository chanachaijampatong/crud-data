import { Pool, PoolConfig } from "pg";

// Explicit connection configuration with user-provided credentials as solid defaults
const poolConfig: PoolConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432", 10),
  database: process.env.PGDATABASE || "rytc",
  user: process.env.PGUSER || "rytc",
  password: String(process.env.PGPASSWORD || "123456789"),
};

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

// Ensure pool is always refreshed if credentials or configuration were updated
if (global._pgPool) {
  try {
    global._pgPool.end().catch(() => {});
  } catch {
    // ignore
  }
  global._pgPool = undefined;
}

const pool = new Pool(poolConfig);
global._pgPool = pool;

export default pool;
