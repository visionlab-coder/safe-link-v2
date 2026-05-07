import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Client } = pg;

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error("Usage: node scripts/run-pg-sql.mjs <sql-file>");
  process.exit(1);
}

const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const explicitDbUrl = process.env.SUPABASE_DB_URL?.trim();

if ((!password || !projectUrl) && !explicitDbUrl) {
  console.error("Missing SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL/SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const projectRef = projectUrl ? new URL(projectUrl).hostname.split(".")[0] : null;
const sql = fs.readFileSync(path.resolve(sqlFile), "utf8");

const connectionAttempts = explicitDbUrl
  ? [
      {
        label: "explicit-db-url",
        connectionString: explicitDbUrl,
        ssl: { rejectUnauthorized: false },
      },
    ]
  : [
      {
        label: "direct-5432",
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: "postgres",
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
      {
        label: "pooler-6543",
        host: `db.${projectRef}.supabase.co`,
        port: 6543,
        user: "postgres",
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
      {
        label: "supavisor-ap-northeast-2-5432",
        host: "aws-0-ap-northeast-2.pooler.supabase.com",
        port: 5432,
        user: `postgres.${projectRef}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
      {
        label: "supavisor-ap-northeast-2-6543",
        host: "aws-0-ap-northeast-2.pooler.supabase.com",
        port: 6543,
        user: `postgres.${projectRef}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
      {
        label: "supavisor-ap-northeast-1-5432",
        host: "aws-0-ap-northeast-1.pooler.supabase.com",
        port: 5432,
        user: `postgres.${projectRef}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
      {
        label: "supavisor-ap-northeast-1-6543",
        host: "aws-0-ap-northeast-1.pooler.supabase.com",
        port: 6543,
        user: `postgres.${projectRef}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
    ];

async function runWith(config) {
  const client = new Client({
    connectionString: config.connectionString,
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl,
  });

  await client.connect();
  try {
    const result = await client.query(sql);
    console.log(JSON.stringify({ connection: config.label, command: result.command, rowCount: result.rowCount ?? null }, null, 2));
  } finally {
    await client.end();
  }
}

async function main() {
  let lastError = null;

  for (const attempt of connectionAttempts) {
    try {
      await runWith(attempt);
      return;
    } catch (error) {
      lastError = error;
      console.error(`[${attempt.label}] failed: ${error.message}`);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
