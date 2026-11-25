import { Pool, PoolConfig } from "pg";
import fs from "fs";
import path from "path";

// Auto-load .env.local if running in standalone mode where Next.js doesn't inject it
if (!process.env.PGPASSWORD) {
  const possiblePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(__dirname, ".env.local"),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ envPath)) {
      try {
        if (typeof process.loadEnvFile === "function") {
          process.loadEnvFile(/*turbopackIgnore: true*/ envPath);
        } else {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ envPath, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
              const [k, ...v] = trimmed.split("=");
              if (!process.env[k.trim()]) {
                process.env[k.trim()] = v.join("=").trim();
              }
            }
          }
        }
        break;
      } catch {
        // ignore and continue
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

let pool: Pool;

const hasValidDatabaseUrl =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("your_password") &&
  !process.env.DATABASE_URL.includes("รหัสผ่าน");

const poolConfig: PoolConfig = hasValidDatabaseUrl
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || "localhost",
      port: parseInt(process.env.PGPORT || "5432", 10),
      database: process.env.PGDATABASE || "rytc",
      user: process.env.PGUSER || "rytc",
      password: String(process.env.PGPASSWORD || "123456789"),
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
