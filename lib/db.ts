import { Pool } from "pg";

const url = process.env.DATABASE_URL || "";
const precisaSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/i.test(url) ||
  /\b(supabase|neon|railway|render|aws|amazonaws|gcp|azure)\b/i.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: precisaSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export default pool;
