import { identifier } from '../db/runtime-role.mjs';
import { validateRightsRecord } from './index.mjs';

// Caller owns transaction, credentials and authorization. Never expose this client
// to an HTTP caller. Permission document refs are opaque IDs, not document bodies.
export function rightsRepository(client, schema='public') {
  const s=identifier(schema);
  return {
    async append(record) {
      validateRightsRecord(record);
      await client.query(`INSERT INTO ${s}.asset_rights(id,asset_id,revision,previous_revision,document)
        VALUES($1,$2,$3,$4,$5)`,[record.id,record.assetId,record.revision,record.revision===0?null:record.revision-1,record.document]);
    },
    async loadCurrent(assetId) {
      // FOR SHARE held until transaction end; rights appends take FOR UPDATE.
      const asset=(await client.query(`SELECT id,sha256,origin,institution_owned AS "institutionOwned"
        FROM ${s}.assets WHERE id=$1 FOR SHARE`,[assetId])).rows[0];
      if(!asset) return null;
      const row=(await client.query(`SELECT id,asset_id AS "assetId",revision,document FROM ${s}.asset_rights
        WHERE asset_id=$1 ORDER BY revision DESC LIMIT 1`,[assetId])).rows[0];
      if(!row) return null;
      return {asset,record:{...row,revision:Number(row.revision)}};
    },
  };
}


/** Owns the transaction. Do not nest in another transaction. A future release
 * service must perform its release write inside this callback, never after it.
 * READ COMMITTED is deliberate: after a competing append unlocks the asset, the
 * next SELECT sees the new decision rather than a repeatable-read old snapshot.
 */
export async function withRightsTransaction(client, work, schema='public') {
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    const result=await work(rightsRepository(client,schema));
    await client.query('COMMIT');
    return result;
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
