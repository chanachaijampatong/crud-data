import { Pool, PoolConfig } from "pg";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let poolConfig: PoolConfig;

if (
  connectionString &&
  !connectionString.includes("your_password") &&
  !connectionString.includes("รหัสผ่าน")
) {
  // If connection string is present (e.g. on Vercel or cloud provider)
  const isCloud =
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("vercel-storage.com") ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("cockroachlabs.cloud") ||
    connectionString.includes(".cloud");

  poolConfig = {
    connectionString,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  };
} else {
  // Local fallback
  poolConfig = {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    database: process.env.PGDATABASE || "rytc",
    user: process.env.PGUSER || "rytc",
    password: String(process.env.PGPASSWORD || "123456789"),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

if (!global._pgPool) {
  global._pgPool = new Pool(poolConfig);
}

const pool = global._pgPool;

export default pool;
