// Dedicated worker only. SMTP acceptance is not proof of inbox delivery.
export async function dispatchOne(pool, send) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const row = (
      await c.query(`SELECT application_id,attempts FROM membership_mail_outbox
      WHERE sent_at IS NULL AND next_attempt_at<=now()
      ORDER BY next_attempt_at,application_id LIMIT 1 FOR UPDATE SKIP LOCKED`)
    ).rows[0];
    if (!row) {
      await c.query("COMMIT");
      return false;
    }
    let accepted = false;
    try {
      await send(row.application_id);
      accepted = true;
    } catch {
      /* Never store SMTP errors or credentials. */
    }
    if (accepted) {
      await c.query(
        "UPDATE membership_mail_outbox SET sent_at=now(),attempts=attempts+1,last_error=NULL WHERE application_id=$1",
        [row.application_id],
      );
    } else {
      const delay = Math.min(21600, 60 * 2 ** Math.min(row.attempts, 9));
      await c.query(
        "UPDATE membership_mail_outbox SET attempts=attempts+1,last_error='smtp_failed',next_attempt_at=now()+$2*interval '1 second' WHERE application_id=$1",
        [row.application_id, delay],
      );
    }
    await c.query("COMMIT");
    return true;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
