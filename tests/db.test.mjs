import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrate } from '../packages/db/migrate.mjs';
import { configureRuntimeRole, identifier } from '../packages/db/runtime-role.mjs';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required; tests create/drop only uniquely named temporary schemas');
const suffix = () => randomUUID().replaceAll('-', '');
const connect = async () => {
  const c = new pg.Client({ connectionString }); await c.connect(); return c;
};
async function fixture(t) {
  const c = await connect();
  const schema = 'dkb_test_' + suffix();
  await c.query(`CREATE SCHEMA ${identifier(schema)}`);
  await c.query(`SET search_path TO ${identifier(schema)}, public`);
  t.after(async () => {
    await c.query('RESET ROLE');
    await c.query('ROLLBACK');
    await c.query(`DROP SCHEMA ${identifier(schema)} CASCADE`);
    await c.end();
  });
  return { c, schema };
}
async function sources(t, extra = null) {
  const dir = await mkdtemp(join(tmpdir(), 'dkb-migration-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sql = await readFile(new URL('../packages/db/migrations/001_core.sql', import.meta.url), 'utf8');
  await writeFile(join(dir, '001_core.sql'), sql);
  if (extra) await writeFile(join(dir, '002_synthetic.sql'), extra);
  return { dir, url: pathToFileURL(dir + '/') };
}
async function seed(c) {
  const actor = (await c.query("INSERT INTO contributors(display_name) VALUES('Synthetic reviewer') RETURNING id")).rows[0].id;
  const structure = (await c.query("INSERT INTO structures(name_en,category) VALUES('Synthetic structure','synthetic') RETURNING id")).rows[0].id;
  const claim = (await c.query("INSERT INTO claims(subject_structure_id,predicate,value,anatomical_class,author_id) VALUES($1,'synthetic', '{}'::jsonb,'variant',$2) RETURNING id", [structure,actor])).rows[0].id;
  return { actor, structure, claim };
}
async function assessment(c, { actor, claim }, revision, state, grade = 'E3_INDEPENDENTLY_VERIFIED', previousState = null) {
  const event = (await c.query(`INSERT INTO audit_events(actor_id,actor_kind,entity_type,entity_id,action,reason,
    correlation_id,policy_decision_id,policy_version,from_state,to_state,previous_revision,new_revision)
    VALUES($1,'human','claim',$2,'synthetic','Synthetic test','test-correlation','synthetic-decision','test-v1',$3,$4,$5,$6) RETURNING id`,
  [actor,claim,previousState,state,revision === 0 ? null : revision-1,revision])).rows[0].id;
  return c.query(`INSERT INTO claim_assessments(claim_id,revision,previous_revision,evidence_grade,consensus_state,audit_event_id)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [claim,revision,revision === 0 ? null : revision-1,grade,state,event]);
}

test('clean migration, all eight tables, repeat run is idempotent', async t => {
  const { c, schema } = await fixture(t);
  await migrate(c); await migrate(c);
  const tables = (await c.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[schema])).rows.map(r=>r.tablename);
  assert.deepEqual(tables, ['audit_events','claim_assessments','claims','contributors','institutions','schema_migrations','structures','terminology_mappings']);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,1);
});

test('changed, removed and reordered migration history is rejected', async t => {
  const { c } = await fixture(t); const { dir, url } = await sources(t);
  await migrate(c,url);
  const path=join(dir,'001_core.sql'); const original=await readFile(path,'utf8');
  await writeFile(path, original+'\n-- altered\n');
  await assert.rejects(migrate(c,url), /Applied migration changed/);
  await rm(path);
  await assert.rejects(migrate(c,url), /missing/);
  await writeFile(path,original);
  await writeFile(join(dir,'000_earlier.sql'),'SELECT 1;');
  await assert.rejects(migrate(c,url), /reordered/);
});

test('failed migration rolls back DDL/ledger and releases advisory lock', async t => {
  const { c } = await fixture(t);
  const { dir,url }=await sources(t,'CREATE TABLE failed_probe(id int); SELECT 1/0;');
  await assert.rejects(migrate(c,url), /division by zero/);
  assert.equal((await c.query("SELECT to_regclass('failed_probe') AS t")).rows[0].t,null);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,1);
  const other=await connect();
  try {
    assert.equal((await other.query('SELECT pg_try_advisory_lock(74622101) AS acquired')).rows[0].acquired,true);
    await other.query('SELECT pg_advisory_unlock(74622101)');
  } finally { await other.end(); }
  await writeFile(join(dir,'002_synthetic.sql'),'CREATE TABLE successful_probe(id int);');
  await migrate(c,url);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,2);
});

test('two simultaneous migration runners produce one ledger entry', async t => {
  const { c,schema }=await fixture(t); const other=await connect();
  try {
    await other.query(`SET search_path TO ${identifier(schema)}, public`);
    await Promise.all([migrate(c),migrate(other)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,1);
  } finally { await other.end(); }
});

test('notation mapping preserves structure ID; FK and JSON shape reject invalid rows', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  for(const [system,code] of [['FDI','36'],['Universal','19']]) {
    await c.query("INSERT INTO terminology_mappings(structure_id,system,version,code,attribution) VALUES($1,$2,'synthetic',$3,'Synthetic fixture')",[data.structure,system,code]);
  }
  assert.equal((await c.query('SELECT count(DISTINCT structure_id)::int AS n FROM terminology_mappings')).rows[0].n,1);
  await assert.rejects(c.query("INSERT INTO claims(subject_structure_id,predicate,value,anatomical_class,author_id) VALUES($1,'test','{}','variant',$2)",[randomUUID(),data.actor]), e=>e.code==='23503');
  await assert.rejects(c.query("INSERT INTO claims(subject_structure_id,predicate,value,scope,anatomical_class,author_id) VALUES($1,'test','{}','[]','variant',$2)",[data.structure,data.actor]), e=>e.code==='23514');
});

test('E3 accepted variant and subsequent dispute preserve immutable assertion and assessments', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  await assessment(c,data,0,'proposed');
  await assessment(c,data,1,'under_review','E3_INDEPENDENTLY_VERIFIED','proposed');
  await assessment(c,data,2,'accepted','E3_INDEPENDENTLY_VERIFIED','under_review');
  await assessment(c,data,3,'disputed','E3_INDEPENDENTLY_VERIFIED','accepted');
  assert.equal((await c.query('SELECT anatomical_class FROM claims WHERE id=$1',[data.claim])).rows[0].anatomical_class,'variant');
  assert.deepEqual((await c.query('SELECT consensus_state FROM claim_assessments ORDER BY revision')).rows.map(r=>r.consensus_state), ['proposed','under_review','accepted','disputed']);
  for(const table of ['claims','claim_assessments','audit_events']) {
    await assert.rejects(c.query(`UPDATE ${table} SET created_at=now()`),/immutable/);
    await assert.rejects(c.query(`DELETE FROM ${table}`),/immutable/);
    await assert.rejects(c.query(`TRUNCATE ${table} CASCADE`),/immutable/);
  }
  const next=(await c.query("INSERT INTO claims(subject_structure_id,predicate,value,anatomical_class,author_id,supersedes_claim_id) VALUES($1,'changed','{}','variant',$2,$3) RETURNING id",[data.structure,data.actor,data.claim])).rows[0].id;
  assert.notEqual(next,data.claim);
});

test('assessment predecessor, audit binding and revision collisions are constrained', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  await assessment(c,data,0,'proposed');
  await assert.rejects(assessment(c,data,0,'proposed'), e=>e.code==='23505');
  await assert.rejects(assessment(c,data,2,'accepted'), e=>e.code==='23503');
  await assert.rejects(assessment(c,data,1,'accepted','not-a-grade'), e=>e.code==='23514');
  const audit=(await c.query('SELECT id FROM audit_events WHERE new_revision=0 LIMIT 1')).rows[0].id;
  await assert.rejects(c.query("INSERT INTO claim_assessments(claim_id,revision,previous_revision,evidence_grade,consensus_state,audit_event_id) VALUES($1,1,0,'E0_OBSERVATION','accepted',$2)",[data.claim,audit]));
});

test('concurrent appends permit only one next revision; losing transaction rolls back audit', async t => {
  const { c,schema }=await fixture(t); await migrate(c); const data=await seed(c);
  await assessment(c,data,0,'proposed');
  async function writer() {
    const w=await connect();
    try {
      await w.query(`SET search_path TO ${identifier(schema)}, public`); await w.query('BEGIN');
      await assessment(w,data,1,'under_review','E1_REPLICATED_OBSERVATION','proposed');
      await w.query('COMMIT'); return true;
    } catch(error) { await w.query('ROLLBACK'); throw error; }
    finally { await w.end(); }
  }
  const results=await Promise.allSettled([writer(),writer()]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'23505');
  assert.equal((await c.query('SELECT count(*)::int AS n FROM audit_events')).rows[0].n,2);
});

test('runtime role can read but cannot write, truncate, disable triggers or create tables', async t => {
  const { c,schema }=await fixture(t); await migrate(c); await seed(c);
  const role='dkb_runtime_test_'+suffix();
  await configureRuntimeRole(c,role,schema); await configureRuntimeRole(c,role,schema);
  const w=await connect();
  try {
    await w.query(`SET search_path TO ${identifier(schema)}, public`);
    await w.query(`SET ROLE ${identifier(role)}`);
    assert.equal((await w.query('SELECT count(*)::int AS n FROM claims')).rows[0].n,1);
    for(const sql of ["INSERT INTO institutions(name) VALUES('forbidden')",'UPDATE claims SET predicate=predicate','DELETE FROM claims','TRUNCATE claims CASCADE','ALTER TABLE claims DISABLE TRIGGER ALL','CREATE TABLE forbidden(id int)']) {
      await assert.rejects(w.query(sql), e=>e.code==='42501');
    }
  } finally {
    await w.end();
    await c.query(`DROP OWNED BY ${identifier(role)}`);
    await c.query(`DROP ROLE ${identifier(role)}`);
  }
});
