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

test('clean migration, all ten tables, repeat run is idempotent', async t => {
  const { c, schema } = await fixture(t);
  await migrate(c); await migrate(c);
  const tables = (await c.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[schema])).rows.map(r=>r.tablename);
  assert.deepEqual(tables, ['asset_rights','assets','audit_events','claim_assessments','claims','contributors','institutions','schema_migrations','structures','terminology_mappings']);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,3);
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

test('two simultaneous migration runners produce one entry per migration', async t => {
  const { c,schema }=await fixture(t); const other=await connect();
  try {
    await other.query(`SET search_path TO ${identifier(schema)}, public`);
    await Promise.all([migrate(c),migrate(other)]);
    assert.equal((await c.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,3);
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
  await assert.rejects(assessment(c,data,2,'accepted','E3_INDEPENDENTLY_VERIFIED','proposed'), e=>e.code==='23503');
  await assert.rejects(assessment(c,data,1,'accepted','not-a-grade','proposed'), e=>e.code==='23514');

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
    for(const sql of ["INSERT INTO institutions(name) VALUES('forbidden')",'UPDATE claims SET predicate=predicate','DELETE FROM claims','TRUNCATE claims CASCADE','ALTER TABLE claims DISABLE TRIGGER ALL','DELETE FROM assets','DELETE FROM asset_rights','CREATE TABLE forbidden(id int)']) {
      await assert.rejects(w.query(sql), e=>e.code==='42501');
    }
  } finally {
    await w.end();
    await c.query(`DROP OWNED BY ${identifier(role)}`);
    await c.query(`DROP ROLE ${identifier(role)}`);
  }
});


async function event(c, data, revision = 1, to = 'under_review', from = 'proposed') {
  return (await c.query(`INSERT INTO audit_events(actor_id,actor_kind,entity_type,entity_id,action,reason,
    correlation_id,policy_decision_id,policy_version,from_state,to_state,previous_revision,new_revision)
    VALUES($1,'human','claim',$2,'test','Synthetic','test','test','test',$3,$4,$5,$6) RETURNING id`,
  [data.actor,data.claim,from,to,revision ? revision-1 : null,revision])).rows[0].id;
}
const insertAssessment = (c, claim, audit, revision=1) => c.query(`INSERT INTO claim_assessments
  (claim_id,revision,previous_revision,evidence_grade,consensus_state,audit_event_id)
  VALUES($1,$3,CASE WHEN $3::bigint=0 THEN NULL ELSE $3::bigint-1 END,'E0_OBSERVATION','under_review',$2)`,[claim,audit,revision]);
const constraintError = name => e => e.code === '23514' && e.constraint === name;
async function edges(c, data, rows, select = false) {
  return c.query(`INSERT INTO claims(id,subject_structure_id,predicate,value,anatomical_class,author_id,supersedes_claim_id)
    ${select ? 'SELECT * FROM (' : ''} VALUES ${rows.map((_,i)=>`($${3+i*2}::uuid,$1::uuid,'synthetic','{}'::jsonb,'variant',$2::uuid,$${4+i*2}::uuid)`).join(',')}
    ${select ? ') AS batch' : ''}`, [data.structure,data.actor,...rows.flat()]);
}

test('R4 fresh audit bindings reject the intended FK; mutation invalidates the assertion', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  await assessment(c,data,0,'proposed');
  const other=await seed(c);
  const fk=(await c.query(`SELECT conname FROM pg_constraint WHERE conrelid='claim_assessments'::regclass
    AND confrelid='audit_events'::regclass AND contype='f'`)).rows[0].conname;
  const expected=e=>e.code==='23503' && e.constraint===fk;
  for(const [d,rev,to] of [[other,1,'under_review'],[data,2,'under_review'],[data,1,'accepted']]) {
    const id=await event(c,d,rev,to);
    await assert.rejects(insertAssessment(c,data.claim,id),expected);
  }
  await c.query('BEGIN');
  try {
    await c.query(`ALTER TABLE claim_assessments DROP CONSTRAINT ${identifier(fk)}`);
    const id=await event(c,data,1,'accepted');
    await assert.rejects(assert.rejects(insertAssessment(c,data.claim,id),expected), /Missing expected rejection/);
  } finally { await c.query('ROLLBACK'); }
  await insertAssessment(c,data.claim,await event(c,data));
});

test('R1 rejects false or missing source state and invalid initial audit', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  await assert.rejects(event(c,data,0,'proposed','accepted'),constraintError('claim_audit_source_shape'));
  await assessment(c,data,0,'proposed');
  await assert.rejects(event(c,data,1,'under_review',null),constraintError('claim_audit_source_shape'));
  await assert.rejects(insertAssessment(c,data.claim,await event(c,data,1,'under_review','accepted')),
    constraintError('assessment_audit_source_matches'));
  await insertAssessment(c,data.claim,await event(c,data));
});

test('R2 rejects two/three-node statement cycles and permits chains and branches', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  for(const n of [2,3]) for(const select of [false,true]) {
    const ids=Array.from({length:n},()=>randomUUID());
    await assert.rejects(edges(c,data,ids.map((id,i)=>[id,ids[(i+1)%n]]),select),constraintError('claims_supersession_acyclic'));
  }
  const [a,b,d]=Array.from({length:3},()=>randomUUID());
  await edges(c,data,[[a,data.claim],[b,a],[d,a]]);
  assert.equal((await c.query('SELECT count(*)::int n FROM claims')).rows[0].n,4);
});

test('R2 concurrent opposite edges cannot both commit; independent successors can', async t => {
  const { c,schema }=await fixture(t); await migrate(c); const data=await seed(c);
  const [a,b]=[randomUUID(),randomUUID()];
  async function writer(rows) {
    const w=await connect();
    try {
      await w.query(`SET search_path TO ${identifier(schema)}, public`);
      await w.query("SET statement_timeout='5s'");
      await w.query('BEGIN'); await edges(w,data,rows); await w.query('COMMIT');
    } catch(e) { await w.query('ROLLBACK'); throw e; }
    finally { await w.end(); }
  }
  const results=await Promise.allSettled([writer([[a,b]]),writer([[b,a]])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,0);
  for(const r of results) assert.ok(['23503','40P01'].includes(r.reason.code),r.reason.message);
  await Promise.all([writer([[randomUUID(),data.claim]]),writer([[randomUUID(),data.claim]])]);
});

test('R3 rejects existing object owners before changing grants', async t => {
  const { c,schema }=await fixture(t); await migrate(c);
  const role='dkb_owner_'+suffix(); const r=identifier(role);
  await c.query(`CREATE ROLE ${r} NOLOGIN NOINHERIT`);
  try {
    for(const target of [`TABLE ${identifier(schema)}.claims`,`SCHEMA ${identifier(schema)}`,
      `FUNCTION ${identifier(schema)}.reject_history_mutation()`,
      `DATABASE ${identifier((await c.query('SELECT current_database() AS name')).rows[0].name)}`]) {
      await c.query('BEGIN');
      try {
        await c.query(`ALTER ${target} OWNER TO ${r}`);
        await assert.rejects(configureRuntimeRole(c,role,schema),/owns protected/);
        assert.equal((await c.query('SELECT has_schema_privilege($1,$2,\'USAGE\') AS allowed',[role,schema])).rows[0].allowed,
          target.startsWith('SCHEMA'));
      } finally { await c.query('ROLLBACK'); }
    }
    await configureRuntimeRole(c,role,schema); await configureRuntimeRole(c,role,schema);
  } finally { await c.query(`DROP OWNED BY ${r}`); await c.query(`DROP ROLE ${r}`); }
});

test('002 rejects inconsistent old history atomically and upgrades valid history unchanged', async t => {
  for(const bad of ['audit','cycle',null]) {
    const { c }=await fixture(t); const { url }=await sources(t); await migrate(c,url);
    const data=await seed(c); await assessment(c,data,0,'proposed');
    if(bad==='audit') await assessment(c,data,1,'under_review','E0_OBSERVATION','accepted');
    if(bad==='cycle') { const a=randomUUID(),b=randomUUID(); await edges(c,data,[[a,b],[b,a]]); }
    const before=(await c.query('SELECT row_to_json(a) AS row FROM claim_assessments a ORDER BY revision')).rows;
    if(bad) {
      await assert.rejects(migrate(c), /source|cycle/i);
      assert.equal((await c.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,1);
      assert.equal((await c.query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='audit_events'::regclass AND conname='claim_audit_source_shape'")).rows[0].n,0);
    } else { await migrate(c); await migrate(c); }
    assert.deepEqual((await c.query('SELECT row_to_json(a) AS row FROM claim_assessments a ORDER BY revision')).rows,before);
  }
});


test('R2 COPY and writable CTE paths enforce cycle checks atomically', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  async function copy(rows) {
    // Tiny synthetic COPY payload; use pg's Query protocol hook without a new dependency.
    const sql='COPY claims(id,subject_structure_id,predicate,value,anatomical_class,author_id,supersedes_claim_id) FROM STDIN';
    const input=rows.map(([id,parent])=>[id,data.structure,'synthetic','{}','variant',data.actor,parent].join('\t')).join('\n')+'\n';
    await new Promise((resolve,reject)=>{
      const query=new pg.Query(sql,[],error=>error ? reject(error) : resolve());
      query.handleCopyInResponse=connection=>{
        connection.sendCopyFromChunk(Buffer.from(input)); connection.endCopyFrom();
      };
      c.query(query);
    });
  }
  const [a,b]=[randomUUID(),randomUUID()];
  await assert.rejects(copy([[a,b],[b,a]]),constraintError('claims_supersession_acyclic'));
  await copy([[a,data.claim],[b,a]]);
  const [d,e]=[randomUUID(),randomUUID()];
  await assert.rejects(c.query(`WITH batch AS (
    INSERT INTO claims(id,subject_structure_id,predicate,value,anatomical_class,author_id,supersedes_claim_id)
    VALUES($3,$1,'synthetic','{}','variant',$2,$4),($4,$1,'synthetic','{}','variant',$2,$3) RETURNING id
  ) SELECT * FROM batch`,[data.structure,data.actor,d,e]),constraintError('claims_supersession_acyclic'));
  assert.equal((await c.query('SELECT count(*)::int n FROM claims')).rows[0].n,3);
});

test('R1 statement-wide predecessor validation supports reverse-order batches', async t => {
  const { c }=await fixture(t); await migrate(c); const data=await seed(c);
  const initial=await event(c,data,0,'proposed',null);
  const next=await event(c,data,1,'under_review','proposed');
  await c.query(`INSERT INTO claim_assessments(claim_id,revision,previous_revision,evidence_grade,consensus_state,audit_event_id)
    VALUES($1,1,0,'E0_OBSERVATION','under_review',$3),($1,0,NULL,'E0_OBSERVATION','proposed',$2)`,[data.claim,initial,next]);
  const bad=await event(c,data,2,'under_review','proposed');
  await assert.rejects(insertAssessment(c,data.claim,bad,2),constraintError('assessment_audit_source_matches'));
  assert.equal((await c.query('SELECT count(*)::int n FROM claim_assessments')).rows[0].n,2);
});

test('TASK-004 rights history is immutable; latest revocation invalidates a pinned old approval', async t => {
  const {rightsFixture}=await import('./rights-fixture.mjs');
  const {rightsRepository}=await import('../packages/rights/repository.mjs');
  const {createRightsGate}=await import('../packages/rights/index.mjs');
  const {c,schema}=await fixture(t); await migrate(c);const data=await seed(c);
  const f=rightsFixture();f.record.document.review.actorId=data.actor;
  await c.query('INSERT INTO assets(id,sha256,origin,institution_owned) VALUES($1,$2,$3,$4)',
    [f.asset.id,f.asset.sha256,f.asset.origin,f.asset.institutionOwned]);
  const repo=rightsRepository(c,schema); await repo.append(f.record);
  const check=createRightsGate({loadCurrent:repo.loadCurrent,verifyReview:()=>true});
  assert.equal((await check(f.manifest)).allowed,true);
  for(const table of ['assets','asset_rights']) {
    for(const statement of [`UPDATE ${table} SET created_at=now()`,`DELETE FROM ${table}`,`TRUNCATE ${table} CASCADE`]) {
      await assert.rejects(c.query(statement),/immutable/);
    }
  }
  await repo.append({...f.record,id:randomUUID(),revision:1,document:{...f.record.document,status:'REVOKED'}});
  const result=await check(f.manifest);assert.equal(result.allowed,false);
  assert.equal(result.reasons[0].code,'STALE_OR_MISMATCHED_RIGHTS');
  assert.equal((await c.query('SELECT count(*)::int n FROM asset_rights')).rows[0].n,2);
  assert.equal((await c.query('SELECT status FROM asset_rights WHERE revision=0')).rows[0].status,'APPROVED');
  await assert.rejects(repo.append({...f.record,id:randomUUID(),revision:3}),e=>e.code==='23503');
  await assert.rejects(repo.append({...f.record,id:randomUUID(),revision:1}),e=>e.code==='23505');
});

test('TASK-004 DB rejects approved records without human rights review and missing assets', async t => {
  const {rightsFixture}=await import('./rights-fixture.mjs');
  const {c}=await fixture(t); await migrate(c); const data=await seed(c);const f=rightsFixture();
  f.record.document.review.actorId=data.actor;
  await c.query('INSERT INTO assets(id,sha256,origin,institution_owned) VALUES($1,$2,$3,$4)',[f.asset.id,f.asset.sha256,'synthetic',false]);
  for(const review of [null,{actorId:data.actor,actorKind:'ai',role:'rights_reviewer',decisionId:'fake'},
    {actorId:data.actor,actorKind:'human',role:'academic_reviewer',decisionId:'fake'}]) {
    await assert.rejects(c.query('INSERT INTO asset_rights(id,asset_id,revision,document) VALUES($1,$2,0,$3)',
      [randomUUID(),f.asset.id,{...f.record.document,review}]),e=>e.code==='23514');
  }
  await assert.rejects(c.query('INSERT INTO asset_rights(id,asset_id,revision,document) VALUES($1,$2,0,$3)',
    [randomUUID(),randomUUID(),f.record.document]),e=>e.code==='23503');
});

test('TASK-004 registry lock prevents revocation racing a held release transaction', async t => {
  const {rightsFixture}=await import('./rights-fixture.mjs');
  const {rightsRepository}=await import('../packages/rights/repository.mjs');
  const {c,schema}=await fixture(t); await migrate(c);const data=await seed(c);const f=rightsFixture();
  f.record.document.review.actorId=data.actor;
  await c.query('INSERT INTO assets(id,sha256,origin,institution_owned) VALUES($1,$2,$3,$4)',[f.asset.id,f.asset.sha256,'synthetic',false]);
  const repo=rightsRepository(c,schema);await repo.append(f.record);
  const other=await connect();const revoked={...f.record,id:randomUUID(),revision:1,document:{...f.record.document,status:'REVOKED'}};
  try {
    await c.query('BEGIN');await repo.loadCurrent(f.asset.id);
    await other.query("SET lock_timeout='150ms'");
    await assert.rejects(rightsRepository(other,schema).append(revoked),e=>e.code==='55P03');
    await c.query('COMMIT');
    await rightsRepository(other,schema).append(revoked);
    assert.equal((await repo.loadCurrent(f.asset.id)).record.document.status,'REVOKED');
  } finally {await c.query('ROLLBACK');await other.end();}
});

test('TASK-004 rights transaction commits callbacks or rolls back all writes on denial', async t => {
  const {withRightsTransaction}=await import('../packages/rights/repository.mjs');
  const {c,schema}=await fixture(t);await migrate(c);
  await assert.rejects(withRightsTransaction(c,async()=>{
    await c.query("INSERT INTO assets(sha256,origin,institution_owned) VALUES($1,'synthetic',false)",['a'.repeat(64)]);
    throw new Error('Release denied');
  },schema),/Release denied/);
  assert.equal((await c.query('SELECT count(*)::int n FROM assets')).rows[0].n,0);
  await withRightsTransaction(c,async()=>{
    assert.equal((await c.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'read committed');
    await c.query("INSERT INTO assets(sha256,origin,institution_owned) VALUES($1,'synthetic',false)",['b'.repeat(64)]);
  },schema);
  assert.equal((await c.query('SELECT count(*)::int n FROM assets')).rows[0].n,1);
});
