import pg from 'pg';
import { fileURLToPath } from 'node:url';

export function identifier(name) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('Invalid SQL identifier');
  return '"' + name + '"';
}

// Dedicated group role, no login/credentials. No runtime writes until a scoped
// workflow grants them. Run only against the project's dedicated database.
export async function configureRuntimeRole(client, role = 'dental_runtime', schema = 'public') {
  const r = identifier(role);
  const s = identifier(schema);
  const existing = await client.query(
    'SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin, rolinherit, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=$1', [role],
  );
  if (existing.rowCount) {
    if (Object.values(existing.rows[0]).some(Boolean)) throw new Error('Refusing an existing privileged/login/inheriting role');
    const memberships = await client.query('SELECT 1 FROM pg_auth_members WHERE member=$1::regrole', [role]);
    if (memberships.rowCount) throw new Error('Runtime role must not inherit memberships');
    // Revoking ACLs cannot remove owner authority. Refuse before changing grants.
    const ownership = await client.query(`SELECT EXISTS (
      SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=$1::regrole
      UNION ALL
      SELECT 1 FROM pg_namespace WHERE nspname=$2 AND nspowner=$1::regrole
      UNION ALL
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=$2 AND c.relowner=$1::regrole
      UNION ALL
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=$2 AND p.proowner=$1::regrole
    ) AS owns`, [role, schema]);
    if (ownership.rows[0].owns) throw new Error('Runtime role owns protected database/schema/relation/function');
  } else {
    await client.query(`CREATE ROLE ${r} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  }
  await client.query(`REVOKE CREATE ON SCHEMA ${s} FROM PUBLIC`);
  await client.query(`REVOKE ALL ON SCHEMA ${s} FROM ${r}`);
  await client.query(`GRANT USAGE ON SCHEMA ${s} TO ${r}`);
  const tables = ['institutions', 'contributors', 'structures', 'terminology_mappings', 'claims', 'claim_assessments', 'audit_events', 'schema_migrations'];
  for (const table of tables) {
    await client.query(`REVOKE ALL ON TABLE ${s}.${identifier(table)} FROM ${r}`);
    await client.query(`REVOKE ALL ON TABLE ${s}.${identifier(table)} FROM PUBLIC`);
    await client.query(`GRANT SELECT ON TABLE ${s}.${identifier(table)} TO ${r}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await configureRuntimeRole(client);
    await client.query('COMMIT');
    console.log('Read-only dental_runtime role configured (NOLOGIN).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
