import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function migrate(client, directory = new URL('./migrations/', import.meta.url)) {
  await client.query('SELECT pg_advisory_lock(74622101)');
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = [];
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
      if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(name)) throw new Error(`Invalid migration filename: ${name}`);
      const sql = await readFile(new URL(name, directory), 'utf8');
      files.push({ name, sql, checksum: createHash('sha256').update(sql).digest('hex') });
    }
    const applied = (await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name')).rows;
    for (let i = 0; i < applied.length; i++) {
      if (files[i]?.name !== applied[i].name || files[i]?.checksum !== applied[i].checksum) {
        throw new Error(`Applied migration changed, missing or reordered: ${applied[i].name}`);
      }
    }
    for (const { name, sql, checksum } of files.slice(applied.length)) {
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name, checksum) VALUES($1,$2)', [name, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(74622101)');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await migrate(client); console.log('PostgreSQL migrations passed.'); }
  finally { await client.end(); }
}
